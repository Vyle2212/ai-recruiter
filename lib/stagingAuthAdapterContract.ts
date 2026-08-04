import type {StagingAuthExecutionCapability} from "./stagingAuthExecutionGateTypes";import type {StagingAuthOperationKey} from "./stagingAuthAdapterTypes";
export type StagingAuthOperationContract={operation:StagingAuthOperationKey;label:string;requiredCapability:StagingAuthExecutionCapability;eligibility:"server_only"|"server_preferred"|"future_server_action_or_client_flow";sensitiveInput:"none"|"email_password"|"email"|"invitation_token";disabledBehavior:string;futureProviderRequirements:string[];productionBehavior:"blocked"};
export const STAGING_AUTH_ADAPTER_OPERATION_CONTRACT:StagingAuthOperationContract[]=[
["get_session","Get Session","auth_helpers","server_preferred","none","no_session",["approved staging provider"],"blocked"],
["get_user","Get User","auth_helpers","server_preferred","none","unauthenticated",["approved staging provider"],"blocked"],
["get_profile","Get Profile","auth_helpers","server_only","none","no_profile",["ownership context","profile lookup"],"blocked"],
["sign_in","Sign In","login","future_server_action_or_client_flow","email_password","disabled",["approved credential validation"],"blocked"],
["sign_out","Sign Out","login","server_preferred","none","disabled",["approved session invalidation"],"blocked"],
["request_password_reset","Password Reset","password_reset","future_server_action_or_client_flow","email","disabled",["email provider approval"],"blocked"],
["accept_invitation","Accept Invitation","invitation","future_server_action_or_client_flow","invitation_token","disabled",["secure token validation"],"blocked"],
["refresh_session","Refresh Session","auth_helpers","server_preferred","none","disabled",["approved session refresh"],"blocked"]
].map(([operation,label,requiredCapability,eligibility,sensitiveInput,disabledBehavior,futureProviderRequirements,productionBehavior])=>({operation,label,requiredCapability,eligibility,sensitiveInput,disabledBehavior,futureProviderRequirements,productionBehavior})) as StagingAuthOperationContract[];
export const STAGING_AUTH_ADAPTER_CONTRACT={id:"staging-auth-adapter-contract-v1",operations:STAGING_AUTH_ADAPTER_OPERATION_CONTRACT,defaultProvider:"disabled" as const,realProviderImplemented:false,executionGateAuthoritative:true,productionBlocked:true};
