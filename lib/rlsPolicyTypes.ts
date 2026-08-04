import type {UserRole} from "./roleAccessTypes";
export type RlsRolePolicyPreview={role:UserRole;tableName:string;canSelect:boolean;canInsert:boolean;canUpdate:boolean;canDelete:boolean;ownershipRule:string;usingExpression:string;withCheckExpression?:string;notes:string[]};
export type RlsTablePolicyPreview={tableName:string;purpose:string;rlsEnabledRequired:true;rolePolicies:RlsRolePolicyPreview[];sensitiveColumns:string[];ownershipColumns:string[];riskLevel:"low"|"medium"|"high";notes:string[]};
export type RlsSqlPolicyPreview={tableName:string;policyName:string;operation:"select"|"insert"|"update"|"delete"|"all";roles:UserRole[];sql:string;status:"draft_preview";destructive:false};
export type RlsForbiddenOperation={role:UserRole;tableName:string;operation:string;reason:string};
export type RlsSafetyPreview={rlsExecuted:false;migrationsExecuted:false;supabaseCalls:0;dbWrites:0;secretsPrinted:false;reviewRequired:true;testRequiredBeforeRealRun:true};
export type RlsPolicyPreview={id:string;name:string;version:string;status:"preview_only";generatedAt:string;tables:RlsTablePolicyPreview[];policies:RlsSqlPolicyPreview[];forbiddenOperations:RlsForbiddenOperation[];safety:RlsSafetyPreview;reviewChecklist:string[]};
