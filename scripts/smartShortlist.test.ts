import assert from "node:assert/strict";
import fs from "node:fs";
import { buildSmartShortlistCards, filterAndSortSmartShortlist, summarizeSmartShortlist } from "../lib/smartShortlist";

const states: any[] = [
  { candidateId:"ready-1",displayName:"Ana",currentStatus:"ready_for_shortlist",lastUpdatedAt:"2026-01-02T00:00:00Z" },
  { candidateId:"repair-1",displayName:"Ben",currentStatus:"needs_repair",lastUpdatedAt:"2026-01-01T00:00:00Z" },
];
const candidates = [
  { id:"ready-1",name:"Ana Lee",current_title:"SAP Lead",current_company:"Acme",location:"Singapore",email:"ana@example.com",phone:"1",years_of_experience:8,sap_modules:["S/4HANA"],work_experience:[{title:"SAP Lead",company:"Acme"}] },
  { id:"repair-1",name:"Ben",current_title:"Consultant" },
];
const cards=buildSmartShortlistCards(candidates,states);
assert.equal(cards.length,1,"only ready_for_shortlist candidates are included by default");
assert.equal(cards[0].candidate360Href,"/recruiter/candidate360/ready-1");
assert.equal(cards[0].selfConfirmHref,"/candidate/self-confirm/ready-1");
assert.equal(filterAndSortSmartShortlist(cards,{search:"acme"}).length,1);
assert.equal(filterAndSortSmartShortlist(cards,{search:"SAP Lead"}).length,1);
assert.equal(filterAndSortSmartShortlist(cards,{location:"Singapore"}).length,1);
assert.equal(summarizeSmartShortlist(cards,2,1).missingCurrentCompany,0);
assert.equal(buildSmartShortlistCards(candidates,states,{includeNeedsRepair:true}).length,2);
const api=fs.readFileSync("app/api/recruiter/smart-shortlist/route.ts","utf8");
assert.match(api,/export async function GET/); assert.doesNotMatch(api,/export async function (POST|PUT|PATCH|DELETE)/);
for(const file of ["lib/smartShortlist.ts","lib/smartShortlistData.ts", "app/api/recruiter/smart-shortlist/route.ts"]){const source=fs.readFileSync(file,"utf8");assert.doesNotMatch(source,/\.insert\(|\.update\(|\.upsert\(|\.delete\(|openai/i);}
console.log("smartShortlist.test.ts passed");

