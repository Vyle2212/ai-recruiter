const assert=require("node:assert/strict");
const vm=require("node:vm");
const ts=require("typescript");
const fs=require("node:fs");
const os=require("node:os");
const path=require("node:path");
const provision=fs.readFileSync("scripts/authenticatedAcceptanceProvision.ts","utf8");
const key=fs.readFileSync("lib/originalCvArchiveKey.ts","utf8");
const start=provision.indexOf("const MAX_ACCEPTANCE_ORIGINAL_CV_OBJECTS_PER_IDENTITY");
const end=provision.indexOf("\nasync function verifyDatabaseMarker",start);
assert.ok(start>=0 && end>start,"cleanup source boundaries must be present");
const source='const ACCEPTANCE_SYNTHETIC_CANDIDATE_ID="synthetic"; const ORIGINAL_CV_BUCKET="candidate-original-cvs";\n'+key.slice(key.indexOf("export function originalCvReference")).replaceAll("export function","function")+"\n"+provision.slice(start,end);
const compiled=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText;
const ctx={readFile:fs.promises.readFile};vm.createContext(ctx);vm.runInContext(compiled+"\nglobalThis.verifyChat=verifyAbsentChatFixtureReferences;globalThis.cleanup=cleanupRunOwnedOriginalCvData;globalThis.nameForRun=syntheticUploadCandidateName;globalThis.readLedger=readRunOwnedOriginalCvLedger;",ctx);
const owner="00000000-0000-4000-8000-000000000001";
const filename="00000000-0000-4000-8000-000000000002.pdf";
const candidate="00000000-0000-4000-8000-000000000003";
function client(options={}){
 const events=[];
 let removed=false;
 const bucket={list:async()=>({
  data:options.storageNull||removed&&options.storageReadbackNull?null:
   options.storageEmpty&&!removed||removed&&!options.storageResidue?[]:
    [{id:"object",name:filename}],
  error:null
 }),
 remove:async()=>{events.push("storage-remove");if(!options.storageRemoveError)removed=true;return {error:options.storageRemoveError?{message:"blocked"}:null}}};
 const c={events,storage:{from:()=>bucket},from:(table)=>{
  let op="select";
  let selectedColumn;
  const q={select:(column)=>{selectedColumn=column;return q},delete:()=>{op="delete";return q},in:()=>q,limit:()=>q,
   then:(resolve,reject)=>{
    if(op==="delete"){
     events.push("delete:"+table);
     const error=table==="candidate_upload_reviews"&&options.reviewDeleteError||
      table==="candidates"&&options.candidateDeleteError?{message:"blocked"}:null;
     return Promise.resolve({error}).then(resolve,reject);
    }
    if(table==="candidates"&&!events.includes("delete:candidates"))
     return Promise.resolve({data:options.candidatesNull?null:[{id:candidate,name:options.wrongName?"Real Candidate":options.lifecycleName?"Synthetic PTF Tester":"Synthetic Abcdefghijklmnop",source_file:"candidate-original-cvs/"+owner+"/"+filename}],error:null}).then(resolve,reject);
    // The deployed consent table has a composite key and no id column.
    if(table==="candidate_chat_contact_consents" && selectedColumn!=="candidate_id")
     return Promise.resolve({count:null,error:{code:"42703",message:"column id does not exist"}}).then(resolve,reject);
    if(options.probeError && table==="candidate_chat_contact_consent_events")
     return Promise.resolve({count:null,error:{code:"42501",message:"permission denied"}}).then(resolve,reject);
    const count=options.dependency&&table==="chat_conversations"||options.databaseResidue&&table==="candidates"?1:0;
    return Promise.resolve({count,error:null}).then(resolve,reject);
   }};
   return q;
 }};
 return c;
}
(async()=>{
 assert.equal(ctx.nameForRun("0123456789abcdef"),"Synthetic Abcdefghijklmnop");
 assert.throws(()=>ctx.nameForRun("runhash"));
 assert.notEqual(ctx.nameForRun("0123456789abcdef"),ctx.nameForRun("1123456789abcdef"));
 const good=client();await ctx.cleanup(good,[owner],"0123456789abcdef");
 assert.deepEqual(good.events,["delete:candidate_upload_reviews","delete:candidates","storage-remove"]);
 const lifecycle=client({lifecycleName:true});await ctx.cleanup(lifecycle,[owner],"0123456789abcdef");
 assert.deepEqual(lifecycle.events,good.events,"confirmed synthetic candidate must be cleaned");
 for(const options of [{wrongName:true},{dependency:true},{probeError:true}]){
  const c=client(options);await assert.rejects(ctx.cleanup(c,[owner],"0123456789abcdef"));assert.deepEqual(c.events,[]);
 }
 for(const options of [{storageNull:true},{candidatesNull:true}]){
  const c=client(options);await assert.rejects(ctx.cleanup(c,[owner],"0123456789abcdef"),undefined,"ambiguous discovery must fail closed");assert.deepEqual(c.events,[]);
 }
 for(const [options,events] of [
  [{reviewDeleteError:true},["delete:candidate_upload_reviews"]],
  [{candidateDeleteError:true},["delete:candidate_upload_reviews","delete:candidates"]],
  [{databaseResidue:true},["delete:candidate_upload_reviews","delete:candidates"]],
 ]){
  const c=client(options);await assert.rejects(ctx.cleanup(c,[owner],"0123456789abcdef"));assert.deepEqual(c.events,events,"database failure must preserve original bytes");
 }
 for(const options of [{storageRemoveError:true},{storageResidue:true},{storageReadbackNull:true}]){
  const c=client(options);await assert.rejects(ctx.cleanup(c,[owner],"0123456789abcdef"));assert.deepEqual(c.events,["delete:candidate_upload_reviews","delete:candidates","storage-remove"],"storage cleanup ambiguity must fail closed");
 }
 const ledgerKey=owner+"/"+filename;
 const ledgerDir=fs.mkdtempSync(path.join(os.tmpdir(),"acceptance-cv-ledger-"));
 try{
  const ledgerFile=path.join(ledgerDir,"ledger.jsonl");
  fs.writeFileSync(ledgerFile,JSON.stringify({objectKey:ledgerKey})+"\n");
  assert.deepEqual(Array.from(await ctx.readLedger(ledgerFile)),[ledgerKey]);
  fs.writeFileSync(ledgerFile,"not-json\n");
  await assert.rejects(ctx.readLedger(ledgerFile));
  assert.deepEqual(Array.from(await ctx.readLedger(path.join(ledgerDir,"missing.jsonl"))),[]);
 }finally{fs.rmSync(ledgerDir,{recursive:true,force:true})}
 const missingBytes=client({storageEmpty:true});
 await ctx.cleanup(missingBytes,[owner],"0123456789abcdef",[ledgerKey]);
 assert.deepEqual(missingBytes.events,["delete:candidate_upload_reviews","delete:candidates","storage-remove"],"ledger reference must drive database cleanup even when bytes are missing");
 const foreignLedger=client({storageEmpty:true});
 await assert.rejects(ctx.cleanup(foreignLedger,[owner],"0123456789abcdef",["00000000-0000-4000-8000-000000000099/"+filename]));
 assert.deepEqual(foreignLedger.events,[],"foreign ledger reference must fail before mutation");
 const overboundLedger=Array.from({length:101},(_,index)=>
  owner+"/00000000-0000-4000-8000-"+String(index).padStart(12,"0")+".pdf");
 const overbound=client({storageEmpty:true});
 await assert.rejects(ctx.cleanup(overbound,[owner],"0123456789abcdef",overboundLedger));
 assert.deepEqual(overbound.events,[],"per-owner ledger bound must fail before mutation");

 function chatClient(failAt=-1,ambiguous=false,fixtureCount=0,errorAt=-1){
  let index=-1;
  return {from(){const q={select(){return q},eq(){return q},in(){return q},then(resolve){
   index++;return Promise.resolve({count:index===0?fixtureCount:index===failAt?(ambiguous?null:1):0,error:index===errorAt?{message:"blocked"}:null}).then(resolve)
  }};return q}};
 }
 await ctx.verifyChat(chatClient(),[owner],"owned-run");
 for(let i=1;i<=10;i++){
  await assert.rejects(ctx.verifyChat(chatClient(i),[owner],"owned-run"));
  await assert.rejects(ctx.verifyChat(chatClient(i,true),[owner],"owned-run"));
  await assert.rejects(ctx.verifyChat(chatClient(-1,false,0,i),[owner],"owned-run"));
 }
 await assert.rejects(ctx.verifyChat(chatClient(-1,false,1),[owner],"owned-run"));
 await assert.rejects(ctx.verifyChat(chatClient(-1,false,null),[owner],"owned-run"));
 await assert.rejects(ctx.verifyChat(chatClient(-1,false,0,0),[owner],"owned-run"));
 await assert.rejects(ctx.verifyChat(chatClient(),[],"owned-run"));

 console.log("Cleanup behavioral regression PASS");
})().catch(e=>{console.error(e.message);process.exitCode=1});
