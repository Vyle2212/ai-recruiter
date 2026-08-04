import fs from "node:fs";
import path from "node:path";
import { writeWorkflowJson } from "./recruiterWorkflowStore";
function clean(value:any){return String(Array.isArray(value)?value.join(", "):value??"").replace(/\s+/g," ").trim();}
function readJson(filePath:string){const full=path.resolve(filePath);if(!fs.existsSync(full))return{found:false,data:null};try{return{found:true,data:JSON.parse(fs.readFileSync(full,"utf8"))}}catch{return{found:true,data:null}}}
export function buildQuickFixRollbackReadiness(options:{subsetPath?:string;backupPath?:string;rollbackPath?:string}={}){
 const subsetPath=options.subsetPath||path.join("reports","quick-fix-apply-subset.json"); const backupPath=options.backupPath||path.join("reports","quick-fix-subset-apply-backup.json"); const rollbackPath=options.rollbackPath||path.join("reports","quick-fix-subset-apply-rollback.json");
 const subset=readJson(subsetPath), backup=readJson(backupPath), rollback=readJson(rollbackPath); const subsetItems=Array.isArray(subset.data?.subsetItems)?subset.data.subsetItems:[]; const backups=Array.isArray(backup.data?.entries)?backup.data.entries:[]; const rollbacks=Array.isArray(rollback.data?.entries)?rollback.data.entries:[];
 const rollbackKeys=new Set(rollbacks.map((e:any)=>`${clean(e.candidateId)}:${clean(e.fieldName)}:${clean(e.stagingId)}`));
 const items=subsetItems.map((item:any)=>{const key=`${clean(item.candidateId)}:${clean(item.fieldName)}:${clean(item.stagingId)}`;return{candidateId:clean(item.candidateId),fieldName:clean(item.fieldName),stagingId:clean(item.stagingId),rollbackStatus:rollbackKeys.has(key)?"rollback_available":"rollback_missing",safetyNote:"Rollback readiness audit only. Rollback is not executed."}});
 const missing=items.filter((i: any)=>i.rollbackStatus==="rollback_missing");
 return{generatedAt:new Date().toISOString(),mode:"read-only rollback readiness audit; no candidate DB writes; no rollback execution; no delete; no OpenAI calls",backupFileExists:backup.found,rollbackFileExists:rollback.found,subsetItems:subsetItems.length,backupItems:backups.length,rollbackItems:rollbacks.length,rollbackCoverage:subsetItems.length?rollbacks.length/subsetItems.length:0,rollbackSafe:subsetItems.length>0&&missing.length===0&&backup.found&&rollback.found,missingRollbackItems:missing.length,items};
}
export function writeQuickFixRollbackReadiness(report:ReturnType<typeof buildQuickFixRollbackReadiness>,outputPath=path.join("reports","quick-fix-rollback-readiness.json")){return writeWorkflowJson(outputPath,report)}

