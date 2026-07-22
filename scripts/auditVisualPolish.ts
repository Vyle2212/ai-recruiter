import fs from "node:fs";
import path from "node:path";

const FILES={dashboard:"app/recruiter/dashboard/page.tsx",shortlist:"app/recruiter/smart-shortlist/page.tsx",compare:"app/recruiter/candidate-compare/page.tsx",submission:"app/recruiter/submission-generator/page.tsx",report:"app/recruiter/client-report/page.tsx",staging:"app/recruiter/import-staging/page.tsx",merge:"app/recruiter/import-merge/page.tsx",navigation:"app/recruiter/layout.tsx"} as const;
function read(baseDir:string,file:string){return fs.readFileSync(path.join(baseDir,file),"utf8");}
function hasAll(source:string,tokens:string[]){return tokens.every(token=>source.includes(token));}

export function buildVisualPolishAudit(baseDir=process.cwd()){
  const source=Object.fromEntries(Object.entries(FILES).map(([key,file])=>[key,read(baseDir,file)])) as Record<keyof typeof FILES,string>;
  const checks={
    smartShortlistLoadingFallback:hasAll(source.shortlist,["setTimeout","Smart Shortlist could not be loaded","Retry","setLoading(false)","No shortlist profiles match"]),
    dashboardPrimaryCta:hasAll(source.dashboard,["Start with Smart Shortlist","Compare candidates","Create client report"]),
    safetyLabelsNormalized:hasAll(source.dashboard,["Main DB deletion","Full reupload into main DB","Import staging required","Candidate confirmation recommended","Merge requires approval","OpenAI calls in deterministic v1"]),
    productHealthEncodingClean:Object.values(source).every(text=>!text.includes("\uFFFD"))&&hasAll(source.dashboard,["Route audit passed","Product health healthy"]),
    formHelperPanels:[source.compare,source.submission,source.report].every(text=>hasAll(text,["How to use","Use SAP Consultant sample","No DB writes"])),
    tableReadabilityHelpers:[source.staging,source.merge].every(text=>hasAll(text,["Scroll horizontally","sticky left-0"])),
    navigationLinksPresent:["/recruiter/dashboard","/recruiter/smart-shortlist","/recruiter/candidate-compare","/recruiter/submission-generator","/recruiter/client-report","/recruiter/import-staging","/recruiter/import-merge","/recruiter/workflow"].every(route=>source.navigation.includes(route)),
    emptyStatesPresent:hasAll(source.shortlist,["Smart Shortlist could not be loaded","No shortlist profiles match"])&&hasAll(source.compare,["Select at least 2 candidates.","No comparison has run yet"])&&source.submission.includes("Enter a candidate ID")&&hasAll(source.report,["Select at least 2 candidates.","Select 2"])&&source.staging.includes("No staged candidates match")&&source.merge.includes("No merge proposals match"),
  };
  return{generatedAt:new Date().toISOString(),mode:"read-only Visual Polish audit; no candidate DB writes; no OpenAI calls",...checks,noOpenAiCalls:true,candidateDbWrites:0,workflowWrites:0,passed:Object.values(checks).every(Boolean)};
}

async function main(){const report=buildVisualPolishAudit();fs.writeFileSync(path.join(process.cwd(),"reports","visual-polish-audit.json"),`${JSON.stringify(report,null,2)}\n`);console.log(`Mode: ${report.mode}`);console.log(`Smart Shortlist loading fallback: ${report.smartShortlistLoadingFallback?"yes":"no"}`);console.log(`Dashboard primary CTA: ${report.dashboardPrimaryCta?"yes":"no"}`);console.log(`Safety labels normalized: ${report.safetyLabelsNormalized?"yes":"no"}`);console.log(`Product health encoding clean: ${report.productHealthEncodingClean?"yes":"no"}`);console.log(`Form helper panels: ${report.formHelperPanels?"yes":"no"}`);console.log(`Table readability helpers: ${report.tableReadabilityHelpers?"yes":"no"}`);console.log(`Navigation links present: ${report.navigationLinksPresent?"yes":"no"}`);console.log(`Empty states present: ${report.emptyStatesPresent?"yes":"no"}`);console.log("No OpenAI calls: yes");console.log("Candidate DB writes: 0");if(!report.passed)process.exitCode=1;}
if(process.argv[1]?.replace(/\\/g,"/").endsWith("scripts/auditVisualPolish.ts"))main().catch(error=>{console.error(error);process.exitCode=1});
