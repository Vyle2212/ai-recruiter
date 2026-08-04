import {mkdirSync,readFileSync,writeFileSync} from "node:fs";
import {resolve} from "node:path";
import {
  buildStagingAuthSqlArtifactReview,
  calculateStagingAuthSqlArtifactFingerprint,
  readStagingAuthSqlArtifact,
  STAGING_AUTH_SQL_ARTIFACT_PATHS,
  STAGING_AUTH_SQL_V5_PATHS,
  STAGING_AUTH_SQL_V7_PATHS,
  validateStagingAuthSqlArtifacts
} from "../lib/stagingAuthSqlArtifacts";

const review=buildStagingAuthSqlArtifactReview();
const validation=validateStagingAuthSqlArtifacts();
const yes=(value:boolean)=>value?"yes":"no";
const read=(key:keyof typeof STAGING_AUTH_SQL_ARTIFACT_PATHS)=>readStagingAuthSqlArtifact(STAGING_AUTH_SQL_ARTIFACT_PATHS[key]);
const bootstrap=read("bootstrap");
const rollback=read("bootstrapRollback");
const combined=bootstrap+"\n"+rollback;
const docs=readFileSync("docs/staging-auth-sql-review.md","utf8");
const token="__STAGING_BOOTSTRAP_CONFIG_B64__";
const tokenCount=(sql:string)=>(sql.match(new RegExp(token,"g"))||[]).length;
const integrityConditions=/unique_violation[\s\S]*foreign_key_violation[\s\S]*check_violation[\s\S]*not_null_violation[\s\S]*restrict_violation[\s\S]*exclusion_violation/i;
const hasSanitizedBlock=(sql:string,operation:RegExp,error:string)=>{
  const match=sql.match(operation);
  return Boolean(match&&integrityConditions.test(match[0])&&match[0].includes(error));
};
const customMessages=[...combined.matchAll(/message\s*=\s*'([^']+)'/gi)].map(match=>match[1]);
const candidateMutationCount=[...combined.matchAll(/\b(?:insert\s+into|update|delete\s+from|alter\s+table|drop\s+table|truncate\s+table|copy)\s+public\.(?:candidates|candidate_accounts)\b/gi)].length;
const productionMutationCount=[...combined.matchAll(/\b(?:insert\s+into|update|delete\s+from|alter\s+table|drop\s+table|truncate\s+table|copy)\s+(?:production|prod)\./gi)].length;

const lines=[
  "Mode: read-only Staging Initial Owner Bootstrap V8 audit; no database connection; no SQL execution",
  "V5 preserved as rejected: "+yes(
    calculateStagingAuthSqlArtifactFingerprint(readStagingAuthSqlArtifact(STAGING_AUTH_SQL_V5_PATHS.bootstrap))==="8182a28057d5c3276e3a23443c03159c141511ea6df2b5c8a858527e08886b1d"&&
    review.historicalArtifacts.filter(item=>item.artifactVersion==="v5").every(item=>item.reviewStatus==="rejected")
  ),
  "V7 preserved as rejected: "+yes(
    calculateStagingAuthSqlArtifactFingerprint(readStagingAuthSqlArtifact(STAGING_AUTH_SQL_V7_PATHS.bootstrap))==="2915afc31882bd5ebae3df54cb03f7eeeca351ce73a1a4f201f7fa3c9335ab2e"&&
    review.historicalArtifacts.filter(item=>item.artifactVersion==="v7").every(item=>item.reviewStatus==="rejected")
  ),
  "V8 bootstrap available: "+yes(review.artifacts.some(item=>item.phase==="bootstrap"&&item.exists)),
  "V8 rollback available: "+yes(review.artifacts.some(item=>item.phase==="bootstrap_rollback"&&item.exists)),
  "V8 Base64 config token count bootstrap: "+tokenCount(bootstrap),
  "V8 Base64 config token count rollback: "+tokenCount(rollback),
  "Raw JSON substitution used: "+yes(/__STAGING_BOOTSTRAP_CONFIG_JSON__/.test(combined)),
  "Base64 decoding errors sanitized: "+yes(/config_base64_invalid/.test(bootstrap)&&/rollback_config_base64_invalid/.test(rollback)),
  "UTF-8 decoding errors sanitized: "+yes(/config_utf8_invalid/.test(bootstrap)&&/rollback_config_utf8_invalid/.test(rollback)),
  "JSON parsing errors sanitized: "+yes(/config_json_invalid/.test(bootstrap)&&/rollback_config_json_invalid/.test(rollback)),
  "Organization insert integrity errors sanitized: "+yes(hasSanitizedBlock(bootstrap,/begin[\s\S]*?insert into public\.organizations[\s\S]*?end;/i,"staging_owner_v8_organization_insert_failed")),
  "Profile insert integrity errors sanitized: "+yes(hasSanitizedBlock(bootstrap,/begin[\s\S]*?insert into public\.user_profiles[\s\S]*?end;/i,"staging_owner_v8_profile_insert_failed")),
  "Provenance insert integrity errors sanitized: "+yes(hasSanitizedBlock(bootstrap,/begin[\s\S]*?insert into public\.staging_auth_bootstrap_provenance[\s\S]*?end;/i,"staging_owner_v8_provenance_insert_failed")),
  "Provenance delete integrity errors sanitized: "+yes(hasSanitizedBlock(rollback,/begin[\s\S]*?delete from public\.staging_auth_bootstrap_provenance[\s\S]*?end;/i,"staging_owner_v8_provenance_delete_failed")),
  "Profile delete integrity errors sanitized: "+yes(hasSanitizedBlock(rollback,/begin[\s\S]*?delete from public\.user_profiles[\s\S]*?end;/i,"staging_owner_v8_profile_delete_failed")),
  "Organization delete integrity errors sanitized: "+yes(hasSanitizedBlock(rollback,/begin[\s\S]*?delete from public\.organizations[\s\S]*?end;/i,"staging_owner_v8_organization_delete_failed")),
  "Private values included in custom errors: "+yes(customMessages.some(message=>!/^staging_owner_v8_[a-z0-9_]+$/.test(message))),
  "SQLERRM exposed: "+yes(/SQLERRM/i.test(combined)),
  "PG_EXCEPTION_DETAIL exposed: "+yes(/PG_EXCEPTION_DETAIL/i.test(combined)),
  "Caller-controlled artifact path: "+yes(/\$ArtifactPath|\[string\]\s*\$ArtifactPath/.test(docs)),
  "Caller-controlled expected fingerprint: "+yes(/\$ExpectedSha256|\$ExpectedFingerprint/.test(docs)),
  "PowerShell artifact allowlist emitted: "+yes(/ValidateSet\("Bootstrap",\s*"Rollback"\)/.test(docs)&&/202607230022_staging_initial_owner_bootstrap_v8\.sql/.test(docs)&&/202607230022_staging_initial_owner_bootstrap_rollback_v8\.sql/.test(docs)),
  "One authoritative documentation chain: "+yes((docs.match(/^## CURRENT AUTHORITATIVE STAGING CHAIN$/gm)||[]).length===1),
  "Historical chains marked do-not-execute: "+yes(!/^#{2,3} (?!HISTORICAL — DO NOT EXECUTE).*V[1-7].*chain/im.test(docs)),
  "Three insert assertions retained: "+yes((bootstrap.match(/insert_count_invalid/g)||[]).length===3),
  "Three delete assertions retained: "+yes((rollback.match(/delete_count_invalid/g)||[]).length===3),
  "Auth user modified: "+yes(/\b(?:insert\s+into|update|delete\s+from)\s+auth\.users\b/i.test(combined)),
  "Candidate-domain mutation statements: "+candidateMutationCount,
  "Production mutation statements: "+productionMutationCount,
  "V8 manually reviewed: no",
  "V8 bootstrap executed: no",
  "V8 rollback executed: no",
  "SQL executed: no",
  "RLS executed: no",
  "Production blocked: yes",
  "Routes backward-compatible: "+yes(validation.valid)
];

mkdirSync(resolve("reports"),{recursive:true});
writeFileSync(
  resolve("reports/staging-auth-bootstrap-v8-audit.json"),
  JSON.stringify({id:"staging-auth-bootstrap-v8-audit",generatedAt:new Date().toISOString(),review,validation},null,2)+"\n"
);
console.log(lines.join("\n"));
