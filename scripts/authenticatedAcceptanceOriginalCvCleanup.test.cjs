const assert=require("node:assert/strict");
const vm=require("node:vm");
const ts=require("typescript");
const fs=require("node:fs");
const provision=fs.readFileSync("scripts/authenticatedAcceptanceProvision.ts","utf8");
const key=fs.readFileSync("lib/originalCvArchiveKey.ts","utf8");
const start=provision.indexOf("const MAX_ACCEPTANCE_ORIGINAL_CV_OBJECTS_PER_IDENTITY");
const end=provision.indexOf("\nasync function verifyDatabaseMarker",start);
assert.ok(start>=0 && end>start,"cleanup source boundaries must be present");
const source='const ORIGINAL_CV_BUCKET="candidate-original-cvs";\n'+key.slice(key.indexOf("export function originalCvReference")).replaceAll("export function","function")+"\n"+provision.slice(start,end);
const compiled=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText;
const ctx={};vm.createContext(ctx);vm.runInContext(compiled+"\nglobalThis.cleanup=cleanupRunOwnedOriginalCvData;globalThis.nameForRun=syntheticUploadCandidateName;",ctx);
const owner="00000000-0000-4000-8000-000000000001";
const filename="00000000-0000-4000-8000-000000000002.pdf";
const candidate="00000000-0000-4000-8000-000000000003";
function client(options={}){
 const events=[];
 let removed=false;
 const bucket={list:async()=>({data:options.storageNull?null:removed?[]:[{id:"object",name:filename}],error:null}),
 remove:async()=>{events.push("storage-remove");removed=true;return {error:null}}};
 const c={events,storage:{from:()=>bucket},from:(table)=>{
  let op="select";
  const q={select:()=>q,delete:()=>{op="delete";return q},in:()=>q,limit:()=>q,
   then:(resolve,reject)=>{
    if(op==="delete"){events.push("delete:"+table);return Promise.resolve({error:null}).then(resolve,reject)}
    if(table==="candidates"&&!events.includes("delete:candidates"))
     return Promise.resolve({data:options.candidatesNull?null:[{id:candidate,name:options.wrongName?"Real Candidate":"Synthetic Abcdefghijklmnop",source_file:"candidate-original-cvs/"+owner+"/"+filename}],error:null}).then(resolve,reject);
    const count=options.dependency&&table==="chat_conversations"?1:0;
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
 for(const options of [{wrongName:true},{dependency:true}]){
  const c=client(options);await assert.rejects(ctx.cleanup(c,[owner],"0123456789abcdef"));assert.deepEqual(c.events,[]);
 }
 for(const options of [{storageNull:true},{candidatesNull:true}]){
  const c=client(options);await assert.rejects(ctx.cleanup(c,[owner],"0123456789abcdef"),undefined,"ambiguous discovery must fail closed");assert.deepEqual(c.events,[]);
 }
 console.log("Cleanup behavioral regression PASS");
})().catch(e=>{console.error(e.message);process.exitCode=1});
