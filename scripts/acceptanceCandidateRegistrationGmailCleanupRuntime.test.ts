import assert from "node:assert/strict";
import { withAcceptanceRegistrationGmailCleanup } from "../lib/acceptanceCandidateRegistrationGmailCleanupRuntime";
import { createAcceptanceCandidateRegistrationIntent } from "../lib/acceptanceCandidateRegistrationIntent";
async function main() {
const email="lekhanhha3005@gmail.com", projectRef="iujucosewivndjpcjbuz", origin="https://acceptance.example.invalid";
const intent=createAcceptanceCandidateRegistrationIntent("0123456789abcdef",email);
const input={intent,projectRef,acceptanceOrigin:origin,startedAt:new Date(Date.now()-2000).toISOString()};
const env={APP_ENV:"acceptance",ACCEPTANCE_TEST_MODE:"true",ACCEPTANCE_GMAIL_CLEANUP_ENABLED:"true",ACCEPTANCE_GMAIL_CREDENTIAL_MODE:"dedicated-cleanup-preflight",ACCEPTANCE_REGISTRATION_CAPTURE_EMAIL:email,ACCEPTANCE_SUPABASE_PROJECT_REF:projectRef,CANDIDATE_REGISTRATION_CALLBACK_ORIGIN:origin,ACCEPTANCE_GMAIL_CLIENT_ID:"syntheticclient123.apps.googleusercontent.com",ACCEPTANCE_GMAIL_CLIENT_SECRET:"synthetic-secret-123456",ACCEPTANCE_GMAIL_REFRESH_TOKEN:"synthetic-refresh-123456"};
const link=new URL("https://"+projectRef+".supabase.co/auth/v1/verify");
link.searchParams.set("token","synthetic_confirmation_token");link.searchParams.set("type","signup");link.searchParams.set("redirect_to",origin+"/auth/candidate/callback");
const message={id:"abc123",internalDate:String(Date.now()),payload:{mimeType:"text/plain",headers:[{name:"Delivered-To",value:intent.email}],body:{data:Buffer.from(link.href).toString("base64url")}}};
let deleted=false, deletes=0, changed=false, residue=false, failDelete=false, calls=0, wrong=false;
const transport:typeof fetch=async(target,init)=>{
calls++;const url=new URL(String(target));
assert.equal(init?.redirect,"error");assert.equal(init?.cache,"no-store");
if(url.origin==="https://oauth2.googleapis.com") return Response.json({token_type:"Bearer",access_token:"synthetic_access_token_123",expires_in:3600,scope:"https://mail.google.com/"});
if(url.pathname.endsWith("/profile"))return Response.json({emailAddress:email});
if(url.pathname.endsWith("/messages"))return Response.json({messages:[{id:"abc123"}]});
assert.equal(url.pathname,"/gmail/v1/users/me/messages/abc123");
if(init?.method==="DELETE"){deletes++;if(failDelete)return new Response(null,{status:403});deleted=true;return new Response(null,{status:204});}
if(deleted&&!residue)return new Response(null,{status:404});
return Response.json({...message,internalDate:changed?String(Number(message.internalDate)+1):message.internalDate,payload:wrong?{...message.payload,headers:[{name:"Delivered-To",value:"other@gmail.com"}]}:message.payload});
};
assert.equal(await withAcceptanceRegistrationGmailCleanup(input,env,async(url)=>{assert.equal(url,link.href);return "ok";},transport),"ok");assert.equal(deletes,1);
for(const patch of [{APP_ENV:"production"},{ACCEPTANCE_GMAIL_CLEANUP_ENABLED:"false"},{ACCEPTANCE_REGISTRATION_CAPTURE_EMAIL:"other@gmail.com"},{ACCEPTANCE_SUPABASE_PROJECT_REF:"wrong"}]){
calls=0;await assert.rejects(withAcceptanceRegistrationGmailCleanup(input,{...env,...patch},async()=>"bad",transport));assert.equal(calls,0);
}
deleted=false;deletes=0;
await assert.rejects(withAcceptanceRegistrationGmailCleanup(input,env,async()=>{throw Error("private "+link.href);},transport),/^Error: acceptance_registration_gmail_cleanup_unavailable$/);assert.equal(deletes,1);
deleted=false;deletes=0;changed=false;
await assert.rejects(withAcceptanceRegistrationGmailCleanup(input,env,async()=>{changed=true;},transport));assert.equal(deletes,0);
changed=false;residue=true;deleted=false;
await assert.rejects(withAcceptanceRegistrationGmailCleanup(input,env,async()=>"ok",transport));
residue=false;deleted=false;failDelete=true;
await assert.rejects(withAcceptanceRegistrationGmailCleanup(input,env,async()=>"ok",transport));
failDelete=false;wrong=true;deletes=0;
await assert.rejects(withAcceptanceRegistrationGmailCleanup(input,env,async()=>"ok",transport));assert.equal(deletes,0);
console.log("Gmail cleanup runtime contracts PASS (mocked; no live deletion or signup).");
}
void main().catch(()=>{console.error("Gmail cleanup runtime contracts failed");process.exitCode=1;});
