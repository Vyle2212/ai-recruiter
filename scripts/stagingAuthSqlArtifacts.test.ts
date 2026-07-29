import assert from "node:assert/strict";
import {existsSync,readFileSync} from "node:fs";
import {
  buildStagingAuthSqlArtifactReview,
  calculateStagingAuthSqlArtifactFingerprint,
  readStagingAuthSqlArtifact,
  STAGING_AUTH_SQL_ARTIFACT_PATHS,
  STAGING_AUTH_SQL_V4_CORE_FINGERPRINTS,
  STAGING_AUTH_SQL_V4_PATHS,
  STAGING_AUTH_SQL_V5_PATHS,
  STAGING_AUTH_SQL_V7_PATHS,
  validateStagingAuthSqlArtifacts
} from "../lib/stagingAuthSqlArtifacts";

const review=buildStagingAuthSqlArtifactReview();
const read=(key:keyof typeof STAGING_AUTH_SQL_ARTIFACT_PATHS)=>readStagingAuthSqlArtifact(STAGING_AUTH_SQL_ARTIFACT_PATHS[key]);
const bootstrap=read("bootstrap");
const rollback=read("bootstrapRollback");
const privileges=read("privileges");
const privilegeRollback=read("privilegesRollback");
const combined=bootstrap+"\n"+rollback;
const docs=readFileSync("docs/staging-auth-sql-review.md","utf8");
const plan=readFileSync("docs/staging-auth-v3-validation-plan.md","utf8");
const token="__STAGING_BOOTSTRAP_CONFIG_B64__";
const integrityConditions=["unique_violation","foreign_key_violation","check_violation","not_null_violation","restrict_violation","exclusion_violation"];

assert.equal(calculateStagingAuthSqlArtifactFingerprint(readStagingAuthSqlArtifact(STAGING_AUTH_SQL_V5_PATHS.bootstrap)),"8182a28057d5c3276e3a23443c03159c141511ea6df2b5c8a858527e08886b1d");
assert.equal(calculateStagingAuthSqlArtifactFingerprint(readStagingAuthSqlArtifact(STAGING_AUTH_SQL_V5_PATHS.bootstrapRollback)),"6caf8e9645ecf624043d1602e9daf5fb7eaaf1ca22ed97aa0b150c0b3d0a0468");
assert.equal(calculateStagingAuthSqlArtifactFingerprint(readStagingAuthSqlArtifact(STAGING_AUTH_SQL_V7_PATHS.bootstrap)),"2915afc31882bd5ebae3df54cb03f7eeeca351ce73a1a4f201f7fa3c9335ab2e");
assert.equal(calculateStagingAuthSqlArtifactFingerprint(readStagingAuthSqlArtifact(STAGING_AUTH_SQL_V7_PATHS.bootstrapRollback)),"afbfd440dab7ed02aab909b145594f81906946fa9f0e74a2ddbcfd08336dcca0");
assert(review.historicalArtifacts.filter(item=>item.artifactVersion==="v5").every(item=>item.reviewStatus==="rejected"&&!item.executed));
assert(review.historicalArtifacts.filter(item=>item.artifactVersion==="v7").every(item=>item.reviewStatus==="rejected"&&!item.executed));

assert.equal(review.authoritativeVersion,"v8");
assert.deepEqual(review.executionOrder,["preflight","schema","helpers","privileges","bootstrap","rls"]);
assert.deepEqual(review.rollbackOrder,["rlsRollback","bootstrapRollback","privilegesRollback","helpersRollback","schemaRollback"]);
assert(review.artifacts.every(item=>item.artifactVersion==="v8"&&item.reviewStatus==="pending_manual_review"&&!item.executed&&!item.manuallyReviewed));
assert(existsSync(STAGING_AUTH_SQL_ARTIFACT_PATHS.bootstrap));
assert(existsSync(STAGING_AUTH_SQL_ARTIFACT_PATHS.bootstrapRollback));
assert.equal(calculateStagingAuthSqlArtifactFingerprint(bootstrap),"61fbe659d76471f33bcf0f6e0cf55b288e7511d8e034d23d87f8b3d42b0418d9");
assert.equal(calculateStagingAuthSqlArtifactFingerprint(rollback),"9cb8606cbb3e190d3f0602652e4ed23c9619804fd7b294a53922d22fafb69ce9");
for(const key of Object.keys(STAGING_AUTH_SQL_V4_CORE_FINGERPRINTS) as Array<keyof typeof STAGING_AUTH_SQL_V4_CORE_FINGERPRINTS>){
  assert.equal(calculateStagingAuthSqlArtifactFingerprint(readStagingAuthSqlArtifact(STAGING_AUTH_SQL_V4_PATHS[key])),STAGING_AUTH_SQL_V4_CORE_FINGERPRINTS[key]);
}

for(const sql of [bootstrap,rollback]){
  assert.equal((sql.match(new RegExp(token,"g"))||[]).length,1);
  assert.doesNotMatch(sql,/__STAGING_BOOTSTRAP_CONFIG_JSON__/);
  assert.match(sql,/pg_catalog\.decode\(config_b64_text,\s*'base64'\)/);
  assert.match(sql,/pg_catalog\.convert_from\(v_config_bytes,\s*'UTF8'\)/);
  assert.match(sql,/concat\('__STAGING_BOOTSTRAP_',\s*'CONFIG_B64__'\)/);
  assert.doesNotMatch(sql.replace(token,"e30="),/if config_b64_text = 'e30='/);
  assert.match(sql,/config_base64_invalid/);
  assert.match(sql,/config_utf8_invalid/);
  assert.match(sql,/config_json_invalid/);
  assert.match(sql,/jsonb_object_keys\(v_config\)/);
  assert.match(sql,/cardinality\(v_required_keys\)/);
  assert.match(sql,/where not \(v_config \? required\.key\)/);
  assert.match(sql,/jsonb_typeof\(v_config -> v_key\) <> 'string'/);
  assert.match(sql,/btrim\(v_config ->> v_key\) = ''/);
  assert.match(sql,/\(v_config ->> 'provenance_id'\)::uuid/);
  assert.match(sql,/\(v_config ->> 'organization_id'\)::uuid/);
  assert.match(sql,/\(v_config ->> 'auth_user_id'\)::uuid/);
  assert.match(sql,/\(v_config ->> 'admin_profile_id'\)::uuid/);
  assert.match(sql,/pg_advisory_xact_lock\(731942607230017\)/);
  assert.match(sql,/^begin;/m);
  assert.match(sql,/commit;\s*(?:--[\s\S]*)?$/);
}
for(const field of ["provenance_id","organization_id","organization_name","auth_user_id","admin_profile_id","admin_email","bootstrap_reference"]){
  assert(bootstrap.includes(`'${field}'`)&&rollback.includes(`'${field}'`));
}
assert.match(bootstrap,/v_admin_email := lower\(btrim\(v_config ->> 'admin_email'\)\)/);
assert.match(bootstrap,/from auth\.users u where u\.id = v_auth_user_id for share/);
assert.match(bootstrap,/v_confirmed_auth_email <> v_admin_email/);

const assertSanitizedOperation=(sql:string,operation:RegExp,error:string)=>{
  const operationMatch=operation.exec(sql);
  assert(operationMatch,`missing operation for ${error}`);
  const start=sql.lastIndexOf("begin",operationMatch.index);
  const end=sql.indexOf("end;",operationMatch.index);
  const block=sql.slice(start,end+4);
  for(const condition of integrityConditions)assert(block.includes(condition),`${error} missing ${condition}`);
  assert(block.includes(error),`missing fixed error ${error}`);
  assert.doesNotMatch(block,/SQLERRM|PG_EXCEPTION_DETAIL|PG_EXCEPTION_HINT|format\s*\(/i);
};
assertSanitizedOperation(bootstrap,/insert into public\.organizations/i,"staging_owner_v8_organization_insert_failed");
assertSanitizedOperation(bootstrap,/insert into public\.user_profiles/i,"staging_owner_v8_profile_insert_failed");
assertSanitizedOperation(bootstrap,/insert into public\.staging_auth_bootstrap_provenance/i,"staging_owner_v8_provenance_insert_failed");
assertSanitizedOperation(rollback,/delete from public\.staging_auth_bootstrap_provenance/i,"staging_owner_v8_provenance_delete_failed");
assertSanitizedOperation(rollback,/delete from public\.user_profiles/i,"staging_owner_v8_profile_delete_failed");
assertSanitizedOperation(rollback,/delete from public\.organizations/i,"staging_owner_v8_organization_delete_failed");
assert.equal((bootstrap.match(/insert_count_invalid/g)||[]).length,3);
assert.equal((rollback.match(/delete_count_invalid/g)||[]).length,3);
assert(rollback.indexOf("delete from public.staging_auth_bootstrap_provenance")<rollback.indexOf("delete from public.user_profiles"));
assert(rollback.indexOf("delete from public.user_profiles")<rollback.indexOf("delete from public.organizations"));

assert.doesNotMatch(combined,/SQLERRM|PG_EXCEPTION_DETAIL|PG_EXCEPTION_HINT/i);
for(const match of combined.matchAll(/message\s*=\s*([^;]+)/gi))assert.match(match[1].trim(),/^'staging_owner_v8_[a-z0-9_]+'$/);
assert.doesNotMatch(combined,/\b(?:insert\s+into|update|delete\s+from)\s+auth\.users\b/i);
assert.doesNotMatch(combined,/\b(?:insert\s+into|update|delete\s+from|alter\s+table|drop\s+table|truncate\s+table)\s+public\.(?:candidates|candidate_accounts)\b/i);
assert.doesNotMatch(combined,/\b(?:insert\s+into|update|delete\s+from|alter\s+table|drop\s+table|truncate\s+table)\s+(?:production|prod)\./i);
assert.doesNotMatch(combined,/https?:\/\/|password\s*=|service_role\s*=|anon_key/i);

assert.match(docs,/\[ValidateSet\("Bootstrap",\s*"Rollback"\)\]/);
assert.doesNotMatch(docs,/\[string\]\s*\$ArtifactPath|\[string\]\s*\$ExpectedSha256|\[string\]\s*\$ExpectedFingerprint/);
assert.match(docs,/202607230022_staging_initial_owner_bootstrap_v8\.sql/);
assert.match(docs,/61fbe659d76471f33bcf0f6e0cf55b288e7511d8e034d23d87f8b3d42b0418d9/);
assert.match(docs,/202607230022_staging_initial_owner_bootstrap_rollback_v8\.sql/);
assert.match(docs,/9cb8606cbb3e190d3f0602652e4ed23c9619804fd7b294a53922d22fafb69ce9/);
assert.match(docs,/ConvertTo-Json -Compress/);
assert.match(docs,/\[System\.Text\.Encoding\]::UTF8\.GetBytes/);
assert.match(docs,/\[System\.Convert\]::ToBase64String/);
assert.match(docs,/git status --porcelain --untracked-files=all/);
assert.match(docs,/Set-Clipboard -Value \$populatedSql/);
assert.doesNotMatch(docs,/Set-Content|Out-File|Add-Content|WriteAllText/);
assert.equal((docs.match(/^## CURRENT AUTHORITATIVE STAGING CHAIN$/gm)||[]).length,1);
assert.equal((plan.match(/^## CURRENT AUTHORITATIVE STAGING CHAIN$/gm)||[]).length,1);
assert.doesNotMatch(docs,/^#{2,3} (?!HISTORICAL — DO NOT EXECUTE).*V[1-7].*chain/im);
assert.match(docs,/V5 REJECTED/);
assert.match(docs,/V7 REJECTED/);
assert.match(docs,/V8 PENDING MANUAL REVIEW/);
assert.match(docs,/RLS NOT EXECUTED/);
assert.match(docs,/PRODUCTION BLOCKED/);

const functionNames=["set_staging_auth_updated_at","current_user_profile_id","current_user_role","current_user_organization_id","current_user_client_id","current_user_candidate_id","current_user_is_admin","guard_user_profile_protected_columns","reject_access_audit_log_mutation"];
for(const name of functionNames)for(const role of ["public","anon","authenticated","service_role"])assert.match(privileges,new RegExp(`revoke execute on function public\\.${name}\\(\\) from ${role};`,"i"));
assert.doesNotMatch(privilegeRollback,/^grant execute/im);

const validation=validateStagingAuthSqlArtifacts();
assert(validation.valid,validation.issues.join(","));
assert.equal(review.safety.sqlExecuted,0);
assert.equal(review.safety.rlsExecuted,0);
assert.equal(review.safety.candidateDbWrites,0);
assert.equal(review.safety.productionBlocked,true);
console.log("stagingAuthSqlArtifacts.test.ts passed");
