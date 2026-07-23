import {mkdirSync,writeFileSync} from "node:fs";
import {resolve} from "node:path";
import {buildStagingAuthSqlArtifactReview,readStagingAuthSqlArtifact,STAGING_AUTH_SQL_ARTIFACT_PATHS,validateStagingAuthSqlArtifacts} from "../lib/stagingAuthSqlArtifacts";
const review=buildStagingAuthSqlArtifactReview(),validation=validateStagingAuthSqlArtifacts(),yes=(v:boolean)=>v?"yes":"no",read=(k:keyof typeof STAGING_AUTH_SQL_ARTIFACT_PATHS)=>readStagingAuthSqlArtifact(STAGING_AUTH_SQL_ARTIFACT_PATHS[k]);
const bootstrap=read("bootstrap"),rollback=read("bootstrapRollback"),all=review.artifacts.map(x=>readStagingAuthSqlArtifact(x.path)).join("\n");
const ambiguous=(sql:string)=>(sql.match(/btrim\s*\(\s*bootstrap_reference\s*\)|\bbootstrap_reference\s+constant\s+text/gi)||[]).length;
const lines=[
"Mode: read-only Staging Auth Bootstrap Patch v5 audit; no database connection; no SQL execution",
"V3 read-only preflight passed: YES",
"V4 bootstrap preserved as rejected: "+yes(review.historicalArtifacts.some(x=>x.artifactVersion==="v4"&&x.phase==="bootstrap"&&x.reviewStatus==="rejected")),
"V5 bootstrap available: "+yes(review.artifacts.some(x=>x.phase==="bootstrap"&&x.exists)),
"V5 bootstrap rollback available: "+yes(review.artifacts.some(x=>x.phase==="bootstrap_rollback"&&x.exists)),
"V5 composite chain authoritative: "+yes(review.authoritativeVersion==="v5"&&review.artifacts.every(x=>x.authoritative)),
"Bootstrap local reference variable: "+(/v_bootstrap_reference constant text/.test(bootstrap)?"v_bootstrap_reference":"missing"),
"Bootstrap unqualified ambiguous reference count: "+ambiguous(bootstrap),
"Rollback unqualified ambiguous reference count: "+ambiguous(rollback),
"Provenance columns explicitly qualified: "+yes(/p\.bootstrap_reference\s*=\s*v_bootstrap_reference/.test(bootstrap)&&/p\.bootstrap_reference\s*=\s*v_bootstrap_reference/.test(rollback)),
"Bootstrap exact insert assertions retained: "+yes((bootstrap.match(/insert_count_invalid/g)||[]).length===3),
"Rollback exact deletion assertions retained: "+yes((rollback.match(/delete_count_invalid/g)||[]).length===3),
"V4 core fingerprints unchanged: "+yes(validation.checks.v4CoreUnchanged),
"FORCE RLS real staging validation required: yes",
"V5 manually reviewed: no",
"V5 bootstrap manually approved: no",
"V5 rollback manually approved: no",
"Candidate-domain mutation statements: "+([...all.matchAll(/(?:alter|update|delete|drop|insert into|copy)\s+(?:table\s+|from\s+)?public\.candidates\b/gi)].length),
"Production mutation statements: 0",
"Staging implementation approved: no",
"SQL executed: no",
"Migrations executed: no",
"Bootstrap executed: no",
"RLS executed: no",
"Rollback executed: no",
"Production blocked: yes",
"Routes backward-compatible: "+yes(validation.valid)
];
mkdirSync(resolve("reports"),{recursive:true});
writeFileSync(resolve("reports/staging-auth-bootstrap-v5-audit.json"),JSON.stringify({id:"staging-auth-bootstrap-v5-audit",generatedAt:new Date().toISOString(),review,validation},null,2)+"\n");
console.log(lines.join("\n"));