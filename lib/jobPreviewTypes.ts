import type {TalentPackSize} from "./talentPackTypes";
export type JobPriority="low"|"medium"|"high"|"urgent";
export type JobPreviewStatus="preview_only"|"draft"|"active_preview"|"closed_preview";
export type JobWorkMode="onsite"|"hybrid"|"remote"|"unknown";
export type JobSafety={previewOnly:true;candidateDbWrites:0;jobDbWrites:0;supabaseWrites:0;workflowWrites:0;openAiCalls:0;databasePersistence:false};
export type JobPreview={id:string;jobTitle:string;clientName:string;employmentType?:string;seniority?:string;country?:string;city?:string;workMode?:JobWorkMode;salaryMin?:number;salaryMax?:number;currency?:string;contractDuration?:string;priority?:JobPriority;status:JobPreviewStatus;jdText?:string;mustHaveSkills:string[];niceToHaveSkills:string[];modules:string[];industries:string[];targetCompanies:string[];notes:string;createdAt:string;createdByRole:"recruiter"|"admin";safety:JobSafety};
export type JobSearchContext={jobId:string;jobTitle:string;clientName:string;keyword:string;module:string;country:string;location:string;yearsMin?:number;searchParams:Record<string,string|string[]>};
export type JobPackContext={jobId:string;savedSearchId?:string;packSize:TalentPackSize;candidateIds:string[];packCompareUrl:string;savedPackUrl:string;reportUrl?:string};
export type JobPreviewState={jobs:JobPreview[];activeJob:JobPreview;safety:JobSafety};
