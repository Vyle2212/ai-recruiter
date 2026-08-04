import type {UserRole} from "./roleAccessTypes";
export type MockSessionSafety={realAuthEnabled:false;supabaseAuthCalls:0;sessionsCreated:0;cookiesRead:0;cookiesSet:0;localStorageWrites:0;userDbReads:0;userDbWrites:0;middlewareEnforced:false;emailSends:0;openAiCalls:0};
export type MockSessionRouteContext={pathname:string;role:UserRole;allowed:boolean;redirectPreview?:string;reason:string;advisoryOnly:true;middlewareEnforced:false;warnings:string[]};
export type MockAuthUserPreview={id:string;email:string;fullName:string;role:UserRole;organizationId?:string;clientId?:string;candidateId?:string;source:"mock_preview";realAuthUser:false};
export type MockVisibleNavPreview={primary:string[];adminData:string[];client:string[];candidate:string[];publicLegacy:string[]};
export type MockAuthSessionPreview={id:string;status:"preview_only";role:UserRole;email:string;fullName:string;organizationId?:string;clientId?:string;candidateId?:string;defaultLandingRoute:string;visibleNav:MockVisibleNavPreview;routeAccessSummary:MockSessionRouteContext;safety:MockSessionSafety};
export type MockRoleSwitcherPreview={roles:UserRole[];selectedRole:UserRole;selectedUser:MockAuthUserPreview;roleSwitchUrl:string;landingUrl:string;safety:MockSessionSafety};
