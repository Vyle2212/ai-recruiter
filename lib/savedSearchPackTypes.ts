import type {RecruiterPackCompareMode} from "./recruiterPackCompare";
import type {TalentPackSize} from "./talentPackTypes";
export type PreviewStatus="preview_only";
export type SavedSearchPreview={id:string;name:string;roleTitle:string;clientName?:string;keyword:string;module:string;country:string;location:string;yearsMin?:number;filters:Record<string,string|string[]>;searchParams:Record<string,string|string[]>;resultCount:number;createdAt:string;createdByRole:"recruiter";status:PreviewStatus};
export type SavedPackPreview={id:string;savedSearchId:string;name:string;packSize:TalentPackSize;mode:RecruiterPackCompareMode;candidateIds:string[];candidateCount:number;searchContext:Record<string,string|undefined>;packCompareUrl:string;recruiterResultsUrl:string;quickCompareUrl?:string;clientReportUrl?:string;createdAt:string;status:PreviewStatus};
export type SavedSearchPackPreviewState={savedSearches:SavedSearchPreview[];savedPacks:SavedPackPreview[];safety:{previewOnly:true;candidateDbWrites:0;workflowWrites:0;supabaseWrites:0;shortlistWrites:0;openAiCalls:0;databasePersistence:false}};
