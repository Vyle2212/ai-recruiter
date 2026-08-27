import { NextRequest, NextResponse } from "next/server";
import { authorizeRecruiterJobsRead } from "@/lib/recruiterJobsAuthorization";
import { GUIDED_SOURCING_MODEL, guidedProviderConfigured, guidedSourcingTimeoutMs, proposeGuidedSourcingPlan, type GuidedRuntimeReason } from "@/lib/guidedSourcingProvider";
import { guidedSourcingEnabled, validateGuidedBrief } from "@/lib/guidedSourcingValidation";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const WINDOW_MS=60_000,MAX_REQUESTS=6;
type Entry={startedAt:number;count:number};
const state=globalThis as typeof globalThis&{__guidedSourcingRateV1?:Map<string,Entry>};
const rates=state.__guidedSourcingRateV1??=new Map<string,Entry>();
function rate(key:string){const now=Date.now(),found=rates.get(key);if(!found||now-found.startedAt>=WINDOW_MS){rates.set(key,{startedAt:now,count:1});return true;}if(found.count>=MAX_REQUESTS)return false;found.count+=1;return true;}
type Status="disabled"|"rejected"|"config_error"|"auth_error"|"source_error"|"timeout"|"model_error"|"invalid_output"|"rate_limited"|"aborted"|"internal_error"|"success";
type Timing={auth?:number;validation?:number;prompt?:number;provider?:number;parse?:number;normalization?:number;total:number};
function headers(status:Status,reason:string,timing:Timing){return{
  "Cache-Control":"no-store",
  "X-Guided-Intent-Status":status,
  "X-Guided-Intent-Reason":reason,
  "X-Guided-Intent-Fallback":"available",
  "X-Guided-Intent-Model":GUIDED_SOURCING_MODEL,
  "X-Guided-Intent-Timeout":String(guidedSourcingTimeoutMs()),
  "Server-Timing":`auth;dur=${(timing.auth||0).toFixed(1)}, validation;dur=${(timing.validation||0).toFixed(1)}, prompt;dur=${(timing.prompt||0).toFixed(1)}, provider;dur=${(timing.provider||0).toFixed(1)}, parse;dur=${(timing.parse||0).toFixed(1)}, normalization;dur=${(timing.normalization||0).toFixed(1)}, total;dur=${timing.total.toFixed(1)}`,
};}
function statusFor(code:string){
  if(code==="GUIDED_CONFIG_MISSING")return{http:503,status:"config_error" as const};
  if(code==="GUIDED_AUTH_FAILED")return{http:401,status:"auth_error" as const};
  if(code==="GUIDED_SOURCE_EMPTY")return{http:400,status:"source_error" as const};
  if(code==="GUIDED_UPSTREAM_TIMEOUT")return{http:504,status:"timeout" as const};
  if(code==="GUIDED_UPSTREAM_RATE_LIMITED")return{http:429,status:"rate_limited" as const};
  if(code==="GUIDED_RESPONSE_INVALID")return{http:502,status:"invalid_output" as const};
  if(code==="GUIDED_REQUEST_ABORTED")return{http:499,status:"aborted" as const};
  if(code==="GUIDED_UPSTREAM_ERROR")return{http:502,status:"model_error" as const};
  if(code==="GUIDED_INTERNAL_ERROR")return{http:500,status:"internal_error" as const};
  return{http:503,status:"model_error" as const};
}
function message(code:string){
  if(code==="GUIDED_CONFIG_MISSING")return"AI guidance is not configured. Continue with deterministic manual search.";
  if(code==="GUIDED_AUTH_FAILED")return"AI guidance authorization failed. Sign in again or continue with deterministic manual search.";
  if(code==="GUIDED_SOURCE_EMPTY")return"No usable sourcing content was provided.";
  if(code==="GUIDED_UPSTREAM_TIMEOUT")return"AI guidance timed out. Retry or continue with deterministic manual search.";
  if(code==="GUIDED_UPSTREAM_RATE_LIMITED")return"AI guidance is temporarily rate limited. Retry shortly.";
  if(code==="GUIDED_RESPONSE_INVALID")return"AI guidance returned an invalid plan. Retry or continue with deterministic manual search.";
  if(code==="GUIDED_REQUEST_ABORTED")return"AI guidance was cancelled.";
  return"AI guidance is temporarily unavailable. Retry or continue with deterministic manual search.";
}
function failure(start:number,code:string,inputCharacters=0,timing:Omit<Timing,"total">={}){
  const classified=statusFor(code),total=performance.now()-start;
  return NextResponse.json({ok:false,error:{code,message:message(code),fallbackAvailable:true},telemetry:{latencyMs:Math.round(total),status:classified.status,model:guidedSourcingEnabled()?GUIDED_SOURCING_MODEL:null,inputCharacters,outputTokens:null}},{status:classified.http,headers:headers(classified.status,code,{...timing,total})});
}
export async function POST(request:NextRequest){
  const started=performance.now();
  if(!guidedSourcingEnabled())return failure(started,"GUIDED_CONFIG_MISSING");
  const authStarted=performance.now();
  const authorization=await authorizeRecruiterJobsRead();
  const authMs=performance.now()-authStarted;
  if(!authorization.allowed)return failure(started,"GUIDED_AUTH_FAILED",0,{auth:authMs});
  if(!guidedProviderConfigured())return failure(started,"GUIDED_CONFIG_MISSING",0,{auth:authMs});
  const key=authorization.actor.id||request.headers.get("x-user-id")||request.headers.get("x-forwarded-for")||"local-preview";
  if(!rate(key))return failure(started,"GUIDED_UPSTREAM_RATE_LIMITED",0,{auth:authMs});
  let body:unknown;
  try{body=await request.json();}catch{return failure(started,"GUIDED_RESPONSE_INVALID",0,{auth:authMs});}
  if(!body||typeof body!=="object"||Array.isArray(body)||Object.keys(body).some(item=>item!=="brief"))return failure(started,"GUIDED_RESPONSE_INVALID",0,{auth:authMs});
  const validationStarted=performance.now();
  const validated=validateGuidedBrief((body as {brief?:unknown}).brief);
  const validationMs=performance.now()-validationStarted;
  if(!validated.ok)return failure(started,"GUIDED_SOURCE_EMPTY",0,{auth:authMs,validation:validationMs});
  try{
    const result=await proposeGuidedSourcingPlan(validated.brief,request.signal);
    const total=performance.now()-started;
    return NextResponse.json({ok:true,plan:result.plan,telemetry:{latencyMs:Math.round(total),status:"success",model:GUIDED_SOURCING_MODEL,inputCharacters:validated.brief.length,outputTokens:result.outputTokens}},{headers:headers("success","none",{auth:authMs,validation:validationMs,prompt:result.timing.promptMs,provider:result.timing.providerMs,parse:result.timing.parseMs,normalization:result.timing.normalizationMs,total})});
  }catch(error){
    const code=String((error as {code?:unknown})?.code||"GUIDED_INTERNAL_ERROR") as GuidedRuntimeReason;
    return failure(started,code,validated.brief.length,{auth:authMs,validation:validationMs});
  }
}
