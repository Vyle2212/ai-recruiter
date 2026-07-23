import {createHash} from "node:crypto";import {readFileSync,existsSync} from "node:fs";import {resolve} from "node:path";
export const STAGING_AUTH_SQL_ARTIFACT_PATHS={schema:"supabase/migrations/202607230001_staging_auth_schema.sql",helpers:"supabase/migrations/202607230002_staging_auth_helpers.sql",rls:"supabase/migrations/202607230003_staging_auth_rls.sql",rollback:"supabase/rollback/202607230001_staging_auth_rollback.sql"} as const;
export type StagingAuthSqlArtifactKey=keyof typeof STAGING_AUTH_SQL_ARTIFACT_PATHS;export type StagingAuthSqlArtifact={artifactKey:StagingAuthSqlArtifactKey;path:string;label:string;exists:boolean;fingerprint:string;reviewStatus:"pending_manual_review";executionStatus:"not_executed";authoritative:true};
const labels:Record<StagingAuthSqlArtifactKey,string>={schema:"Staging auth schema",helpers:"Active-profile helper functions",rls:"Staging auth RLS policies",rollback:"Dependency-aware rollback"};
export function readStagingAuthSqlArtifact(path:string,baseDir=process.cwd()){const allowed=Object.values(STAGING_AUTH_SQL_ARTIFACT_PATHS);if(!allowed.includes(path as (typeof allowed)[number]))throw new Error("staging_auth_sql_artifact_path_not_allowed");return readFileSync(resolve(baseDir,path),"utf8")}
export function calculateStagingAuthSqlArtifactFingerprint(content:string){return createHash("sha256").update(content,"utf8").digest("hex")}
export function listStagingAuthSqlArtifacts(baseDir=process.cwd()):StagingAuthSqlArtifact[]{return(Object.entries(STAGING_AUTH_SQL_ARTIFACT_PATHS) as Array<[StagingAuthSqlArtifactKey,string]>).map(([artifactKey,path])=>{const found=existsSync(resolve(baseDir,path)),content=found?readStagingAuthSqlArtifact(path,baseDir):"";return{artifactKey,path,label:labels[artifactKey],exists:found,fingerprint:found?calculateStagingAuthSqlArtifactFingerprint(content):"",reviewStatus:"pending_manual_review",executionStatus:"not_executed",authoritative:true}})}
export function buildStagingAuthSqlArtifactReview(baseDir=process.cwd()){const artifacts=listStagingAuthSqlArtifacts(baseDir);return{id:"staging-auth-sql-artifacts-v1",generatedAt:new Date().toISOString(),artifacts,authoritative:true,legacyGeneratorsStatus:"deprecated_draft" as const,migrationManuallyReviewed:false,rlsManuallyReviewed:false,stagingImplementationApproved:false,productionCandidateDataCopied:false,safety:{readOnly:true,sqlExecuted:0,migrationsExecuted:0,rlsExecuted:0,supabaseCalls:0,databaseReads:0,databaseWrites:0,environmentFilesModified:false,candidateDbWrites:0,productionBlocked:true}}}
export function validateStagingAuthSqlArtifacts(baseDir=process.cwd()){
 const review=buildStagingAuthSqlArtifactReview(baseDir);
 const by=Object.fromEntries(review.artifacts.map(x=>[x.artifactKey,readStagingAuthSqlArtifact(x.path,baseDir)])) as Record<StagingAuthSqlArtifactKey,string>;
 const all=Object.values(by).join("\n");
 const insertPolicies=by.rls.split(/\r?\n/).filter(line=>/create policy .* for insert /i.test(line));
 const checks={
  artifacts:review.artifacts.every(x=>x.exists&&/^[a-f0-9]{64}$/.test(x.fingerprint)),
  roleConstraint:/user_profiles_role_check/.test(by.schema),
  statusConstraint:/user_profiles_status_check/.test(by.schema),
  activeProfileHelpers:/current_user_profile_id/.test(by.helpers)&&/status = 'active'/.test(by.helpers),
  insertPolicySyntax:insertPolicies.length>0&&insertPolicies.every(line=>/with check/i.test(line)&&!/\busing\s*\(/i.test(line)),
  appendOnlyAudit:!by.rls.split(/\r?\n/).some(line=>/create policy .*access_audit_logs.* for (update|delete) /i.test(line)),
  candidateTableProtected:!/(alter|update|delete|drop)\s+table\s+(public\.)?candidates\b/i.test(all),
 };
 const issues=Object.entries(checks).filter(([,passed])=>!passed).map(([key])=>key);
 return{valid:issues.length===0,artifacts:review.artifacts,issues};
}
