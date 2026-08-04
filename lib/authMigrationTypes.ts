import type {UserRole} from "./roleAccessTypes";
export type AuthMigrationColumnPreview={name:string;type:string;nullable:boolean;defaultValue?:string;references?:string;sensitive:boolean;description:string};
export type AuthMigrationTablePreview={tableName:string;purpose:string;columns:AuthMigrationColumnPreview[];primaryKey:string;foreignKeys:string[];uniqueConstraints:string[];indexes:string[];rlsRequired:boolean;notes:string[]};
export type AuthRlsPolicyPreview={tableName:string;policyName:string;operation:"select"|"insert"|"update"|"delete"|"all";roles:UserRole[];usingExpression:string;withCheckExpression?:string;status:"draft_preview"};
export type AuthSeedRolePreview={role:UserRole;description:string;defaultLandingRoute:string;status:"preview_only"};
export type AuthMigrationSafety={migrationExecuted:false;dbWrites:0;supabaseCalls:0;secretsPrinted:false;rollbackRequiredBeforeRealRun:true;reviewRequired:true};
export type AuthMigrationPreview={id:string;name:string;version:string;status:"preview_only";generatedAt:string;tables:AuthMigrationTablePreview[];indexes:string[];constraints:string[];rlsPolicies:AuthRlsPolicyPreview[];seedData:AuthSeedRolePreview[];rollbackNotes:string[];safety:AuthMigrationSafety};
