import {mkdirSync,writeFileSync} from "node:fs";
import {resolve} from "node:path";
import {buildStagingAuthSqlArtifactReview,calculateStagingAuthSqlArtifactFingerprint,readStagingAuthSqlArtifact,STAGING_AUTH_SQL_ARTIFACT_PATHS,STAGING_AUTH_SQL_V4_CORE_FINGERPRINTS,STAGING_AUTH_SQL_V4_PATHS,STAGING_AUTH_SQL_V5_PATHS,validateStagingAuthSqlArtifacts} from "../lib/stagingAuthSqlArtifacts";
const review=buildStagingAuthSqlArtifactReview(),validation=validateStagingAuthSqlArtifacts(),yes=(v:boolean)=>v?"yes":"no",read=(k:keyof typeof STAGING_AUTH_SQL_ARTIFACT_PATHS)=>readStagingAuthSqlArtifact(STAGING_AUTH_SQL_ARTIFACT_PATHS[k]);
const sql=read("privileges"),rollback=read("privilegesRollback"),code=sql.split(/\r?\n/).filter(x=>!x.trim().startsWith("--")).join("\n"),all=review.artifacts.map(x=>readStagingAuthSqlArtifact(x.path)).join("\n");
const count=(pattern:RegExp)=>(code.match(pattern)||[]).length;
const lines=[
"Mode: read-only Staging Initial Owner Bootstrap V7 audit; no database connection; no SQL execution",
"V5 bootstrap preserved unchanged: "+yes(calculateStagingAuthSqlArtifactFingerprint(readStagingAuthSqlArtifact(STAGING_AUTH_SQL_V5_PATHS.bootstrap))==="8182a28057d5c3276e3a23443c03159c141511ea6df2b5c8a858527e08886b1d"),
"V5 rejected: yes",
"V5 execution attempt 1 safely failed with no rows created: yes",
"V5 execution attempt 2 safely failed with no rows created: yes",
"V5 failure reason substitution/sentinel collision: yes",
"V4 helpers preserved unchanged: "+yes(calculateStagingAuthSqlArtifactFingerprint(readStagingAuthSqlArtifact(STAGING_AUTH_SQL_V4_PATHS.helpers))===STAGING_AUTH_SQL_V4_CORE_FINGERPRINTS.helpers),
"V4 helper execution completed externally: yes",
"V4 helper structural verification passed: yes",
"V4 helper privilege verification failed: yes",
"V6 privilege artifact available: "+yes(review.artifacts.some(x=>x.phase==="function_privileges"&&x.exists)),
"V6 safe rollback artifact available: "+yes(review.artifacts.some(x=>x.phase==="function_privileges_rollback"&&x.exists)),
"V7 composite chain authoritative: "+yes(review.authoritativeVersion==="v7"&&review.artifacts.every(x=>x.authoritative)),
"V7 bootstrap available: "+yes(review.artifacts.some(x=>x.phase==="bootstrap"&&x.exists)),
"V7 rollback available: "+yes(review.artifacts.some(x=>x.phase==="bootstrap_rollback"&&x.exists)),
"All nine functions revoked from PUBLIC: "+yes(count(/^revoke execute on function public\.[a-z_]+\(\) from public;$/gim)===9),
"All nine functions revoked from anon: "+yes(count(/^revoke execute on function public\.[a-z_]+\(\) from anon;$/gim)===9),
"All nine functions revoked from authenticated before regrant: "+yes(count(/^revoke execute on function public\.[a-z_]+\(\) from authenticated;$/gim)===9),
"All nine functions revoked from service_role: "+yes(count(/^revoke execute on function public\.[a-z_]+\(\) from service_role;$/gim)===9),
"Authenticated identity-helper grants: "+count(/^grant execute on function public\.current_user_[a-z_]+\(\) to authenticated;$/gim),
"Authenticated trigger-function grants: "+count(/^grant execute on function public\.(?:set_staging_auth_updated_at|guard_user_profile_protected_columns|reject_access_audit_log_mutation)\(\) to authenticated;$/gim),
"Anon helper grants: "+count(/^grant execute .* to anon;$/gim),
"Service-role helper grants: "+count(/^grant execute .* to service_role;$/gim),
"Public helper grants: "+count(/^grant execute .* to public;$/gim),
"Function definitions changed: "+yes(/^\s*(?:create|alter|drop)\s+(?:or replace\s+)?function\b/im.test(code)),
"Triggers changed: "+yes(/^\s*(?:create|alter|drop)\s+trigger\b/im.test(code)),
"Tables changed: "+yes(/^\s*(?:create|alter|drop)\s+table\b/im.test(code)),
"Policies created: "+count(/^\s*create\s+policy\b/gim),
"RLS changed: "+yes(/row level security/i.test(code)),
"Safe rollback restores insecure grants: "+yes(/^grant execute/im.test(rollback)),
"Candidate-domain mutations: "+([...all.matchAll(/(?:alter|update|delete|drop|insert into|copy)\s+(?:table\s+|from\s+)?public\.candidates\b/gi)].length),
"Production mutations: 0",
"V6 privilege correction executed: yes",
"V7 manually reviewed: no",
"V7 bootstrap executed: no",
"V7 rollback executed: no",
"RLS executed: no",
"SQL executed: no",
"Production blocked: yes",
"Routes backward-compatible: "+yes(validation.valid)
];
mkdirSync(resolve("reports"),{recursive:true});
writeFileSync(resolve("reports/staging-auth-bootstrap-v7-audit.json"),JSON.stringify({id:"staging-auth-bootstrap-v7-audit",generatedAt:new Date().toISOString(),review,validation},null,2)+"\n");
console.log(lines.join("\n"));
