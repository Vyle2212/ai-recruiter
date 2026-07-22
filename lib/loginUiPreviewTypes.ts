import type {UserRole} from "./roleAccessTypes";
export type AuthUiRoutePreview={route:string;label:string;purpose:string;intendedUsers:UserRole[];enabledNow:false;previewOnly:true;supabaseAuthCalls:0;dbWrites:0;emailSends:0};
export type AuthFormFieldPreview={name:string;label:string;type:string;requiredEventually:boolean;sensitive:boolean;valuePrinted:false};
export type AuthFormPreview={formKey:string;label:string;fields:AuthFormFieldPreview[];submitEnabled:false;submitMode:"disabled_preview";helperText:string;safety:{supabaseAuthCalls:0;dbWrites:0;emailSends:0;sessionsCreated:0;cookiesSet:0}};
export type RoleLandingRoutePreview={role:UserRole;defaultLandingRoute:string;description:string;requiresAuthEventually:true};
export type InviteAcceptPreview={inviteType:string;invitedRole:UserRole;tokenHandling:"disabled_preview";tokenPrinted:false;emailSendEnabled:false;dbWrites:0;status:"preview_only"};
export type LoginUiSafetyPreview={realAuthEnabled:false;supabaseAuthCalls:0;sessionsCreated:0;cookiesSet:0;userDbWrites:0;emailSends:0;openAiCalls:0};
export type LoginUiPreviewState={routes:AuthUiRoutePreview[];forms:AuthFormPreview[];roleLandingRoutes:RoleLandingRoutePreview[];invitePreview:InviteAcceptPreview;safety:LoginUiSafetyPreview};
