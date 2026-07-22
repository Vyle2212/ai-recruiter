import type {AccessArea,UserRole} from "./roleAccessTypes";
export type AuthHelperSafetyPreview={supabaseAuthCalls:0;sessionReads:0;sessionsCreated:0;cookiesRead:0;cookiesSet:0;userDbReads:0;userDbWrites:0;middlewareEnforced:false;emailSends:0;openAiCalls:0};
export type AuthSessionPreview={status:"unauthenticated_preview"|"authenticated_preview"|"disabled_preview";userId?:string;email?:string;role:UserRole;organizationId?:string;clientId?:string;candidateId?:string;sessionSource:"preview_only";expiresAt?:string;safety:AuthHelperSafetyPreview};
export type AuthUserProfilePreview={id:string;authUserId?:string;email:string;fullName?:string;role:UserRole;organizationId?:string;clientId?:string;candidateId?:string;status:"preview_only"|"invited_preview"|"active_preview";source:"preview_only"};
export type AuthRoleResolutionPreview={inputRole:string;resolvedRole:UserRole;defaultLandingRoute:string;allowedAreas:AccessArea[];deniedAreas:AccessArea[];warnings:string[]};
export type AuthRouteGuardDecisionPreview={pathname:string;role:UserRole;allowed:boolean;reason:string;redirectTo?:string;advisoryOnly:true;middlewareEnforced:false};
export type AuthRedirectPreview={role:UserRole;fromRoute:string;defaultLandingRoute:string;redirectTarget:string;reason:string;enabledNow:false};
export type AuthClientServerBoundaryPreview={helperName:string;intendedRuntime:"client"|"server"|"middleware";enabledNow:false;supabaseCalls:0;cookieReads:0;cookieWrites:0;dbReads:0;dbWrites:0;notes:string[]};
