import type {UserRole} from "./roleAccessTypes";
export type PortalKey="recruiter"|"client"|"candidate"|"admin";
export type PortalEntryPreview={key:PortalKey;label:string;intendedRoles:UserRole[];route:string;authPreviewRoute:string;mockSessionRoute:string;description:string;capabilities:string[];safetyNotes:string[];status:"preview_only"};
export type PortalRoleEntryPreview={role:UserRole;portalKey:PortalKey|"public";defaultRoute:string;loginPreviewRoute:string;mockSessionRoute:string;allowedPreviewRoutes:string[];notes:string[]};
export type PortalRecommendedFlowPreview={flowKey:string;label:string;steps:string[];intendedRole:UserRole;previewOnly:true};
export type PortalNavigationSafety={authEnabled:false;dbWrites:0;workflowWrites:0;emailSends:0;openAiCalls:0;middlewareEnforced:false;sessionsCreated:0;cookiesSet:0};
export type PortalNavigationPreview={id:string;status:"preview_only";portals:PortalEntryPreview[];roleEntryPoints:PortalRoleEntryPreview[];recommendedFlows:PortalRecommendedFlowPreview[];safety:PortalNavigationSafety};
