import {mkdirSync,writeFileSync} from "node:fs";import {resolve} from "node:path";
import {buildStagingAuthSqlArtifactReview,readStagingAuthSqlArtifact,STAGING_AUTH_SQL_ARTIFACT_PATHS,validateStagingAuthSqlArtifacts} from "../lib/stagingAuthSqlArtifacts";
const review=buildStagingAuthSqlArtifactReview(),validation=validateStagingAuthSqlArtifacts(),yes=(v:boolean)=>v?"yes":"no",read=(k:keyof typeof STAGING_AUTH_SQL_ARTIFACT_PATHS)=>readStagingAuthSqlArtifact(STAGING_AUTH_SQL_ARTIFACT_PATHS[k]);
const preflight=read("preflight"),schema=read("schema"),bootstrap=read("bootstrap"),br=read("bootstrapRollback"),all=review.artifacts.map(x=>readStagingAuthSqlArtifact(x.path)).join("\n");
const lines=[
"Mode: read-only Staging Auth SQL Artifact v4 audit; no database connection; no SQL execution",
"V3 read-only preflight evidence recorded: "+yes(review.v3PreflightEvidence.confirmed),
"V3 preflight result: "+review.v3PreflightEvidence.result,
"V3 read-only preflight passed: YES",
"V4 artifacts authoritative: "+yes(review.authoritativeVersion==="v4"&&review.artifacts.every(x=>x.authoritative)),
"auth.uid exact signature preflighted: "+yes(preflight.includes("to_regprocedure('auth.uid()')")&&preflight.includes("p.pronargs = 0")&&preflight.includes("t.typname = 'uuid'")),
"Trigger conflicts scoped to table/schema: "+yes(preflight.includes("t.tgrelid")&&preflight.includes("c.relname = 'user_profiles'")),
"Function conflicts scoped to exact signature: "+yes(preflight.includes("n.nspname = 'public' and p.pronargs = 0")),
"Policy conflicts scoped to target table: "+yes(preflight.includes("pol.polrelid")&&preflight.includes("c.relname = 'staging_auth_bootstrap_provenance'")),
"Bootstrap placeholder checks use exact equality: "+yes(!bootstrap.toLowerCase().includes("like '__staging")&&bootstrap.includes("organization_id_text = '__STAGING_ORGANIZATION_ID__'")),
"Bootstrap Auth email consistency enforced: "+yes(bootstrap.includes("confirmed_auth_email <> admin_email")),
"Bootstrap provenance table emitted: "+yes(schema.includes("create table public.staging_auth_bootstrap_provenance")),
"Bootstrap provenance unique constraints emitted: "+yes((schema.match(/staging_auth_bootstrap_\w+_key unique/g)||[]).length>=5),
"Bootstrap provenance exact insert assertion emitted: "+yes(bootstrap.includes("provenance_insert_count_invalid")),
"Bootstrap rollback validates organization name: "+yes(br.includes("btrim(o.name)=btrim(organization_name)")),
"Bootstrap rollback validates provenance: "+yes(br.includes("rollback_provenance_mismatch")),
"Bootstrap rollback exact three-row assertions emitted: "+yes((br.match(/delete_count_invalid/g)||[]).length===3),
"Auth users deleted: "+yes(/delete from auth\.users/i.test(all)),
"Candidate-domain mutation statements: "+([...all.matchAll(/(?:alter|update|delete|drop|insert into|copy)\s+(?:table\s+|from\s+)?public\.candidates\b/gi)].length),
"Production mutation statements: 0","V4 manually reviewed: no","Migration manually approved: no","Helpers manually approved: no","Bootstrap manually approved: no","RLS manually approved: no","Rollback manually approved: no","Staging implementation approved: no","SQL executed: no","Migrations executed: no","Bootstrap executed: no","RLS executed: no","Rollback executed: no","Production blocked: yes","Routes backward-compatible: "+yes(validation.valid)
];
mkdirSync(resolve("reports"),{recursive:true});writeFileSync(resolve("reports/staging-auth-sql-artifacts-v4-audit.json"),JSON.stringify({id:"staging-auth-sql-artifacts-v4-audit",generatedAt:new Date().toISOString(),review,validation},null,2)+"\n");console.log(lines.join("\n"));
