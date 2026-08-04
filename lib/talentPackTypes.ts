export type TalentPackSize=5|10|20;
export type TalentPackMode="top5"|"top10"|"top20";
export type TalentPackCandidate={candidateId:string;ranking:number;name?:string;score?:number;[key:string]:unknown};
export type TalentPackBuildRequest={candidates:TalentPackCandidate[];packSize:TalentPackSize};
export type TalentPackSummary={packSize:TalentPackSize;mode:TalentPackMode;label:string;requestedCandidates:number;candidateCount:number;candidates:TalentPackCandidate[];candidateIds:string[];duplicatesRemoved:number;readOnly:true};
