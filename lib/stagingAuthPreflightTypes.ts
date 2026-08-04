import type {StagingAuthExecutionCapability,StagingAuthExecutionEnvironment,StagingAuthExecutionMode} from "./stagingAuthExecutionGateTypes";
export type StagingAuthPreflightMode="current_safe_flags"|"empty_configuration"|"local_simulation"|"test_simulation"|"production_simulation"|"staging_requested_simulation"|"incomplete_staging_simulation"|"fully_approved_staging_simulation";
export type StagingAuthPreflightStatus="ready_for_staging_implementation"|"blocked"|"production_blocked"|"invalid_configuration";
export type StagingAuthPreflightCapabilitySummary={total:number;allowed:number;blocked:number;allowedCapabilities:StagingAuthExecutionCapability[];blockedCapabilities:StagingAuthExecutionCapability[]};
export type StagingAuthPreflightSafety={rawEnvironmentValuesExposed:false;secretValuesInspected:false;environmentFilesModified:false;commandsExecuted:0;supabaseCalls:0;authCalls:0;sqlStatementsExecuted:0;migrationsExecuted:0;rlsPoliciesExecuted:0;middlewareCreated:false;middlewareEnforced:false;sessionsCreated:0;cookiesRead:0;cookiesSet:0;databaseWrites:0;approvalDbWrites:0;emailSends:0;openAiCalls:0;productionBlocked:true};
export type StagingAuthPreflightReport={id:string;generatedAt:string;mode:StagingAuthPreflightMode;status:StagingAuthPreflightStatus;environment:StagingAuthExecutionEnvironment;authMode:StagingAuthExecutionMode;globallyAllowed:boolean;capabilitySummary:StagingAuthPreflightCapabilitySummary;blockers:string[];warnings:string[];nextActions:string[];productionBlocked:true;simulationOnly:boolean;safety:StagingAuthPreflightSafety};


