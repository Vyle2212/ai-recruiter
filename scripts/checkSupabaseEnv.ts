import { loadCliEnv, printSupabaseEnvDiagnostics } from "../lib/cliEnv";
async function main(){const env=loadCliEnv();console.log("Mode: safe env diagnostics; values hidden");printSupabaseEnvDiagnostics(env.diagnostics);if(env.diagnostics.missing.length)console.log(`Missing: ${env.diagnostics.missing.join(", ")}`);}
if(process.argv[1]?.replace(/\\/g,"/").endsWith("scripts/checkSupabaseEnv.ts"))main().catch(e=>{console.error(e instanceof Error?e.message:e);process.exitCode=1});
