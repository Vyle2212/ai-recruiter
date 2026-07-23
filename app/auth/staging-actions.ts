"use server";
import {executeInvitationAccept,executePasswordReset,executeSignIn,executeSignOut} from "../../lib/stagingAuthOperationServiceServer";
const base=<T extends "sign_in"|"sign_out"|"request_password_reset"|"accept_invitation">(operation:T)=>({requestId:`server-action-preview-${operation}`,operation,source:"auth_ui_future" as const,requestedAt:"1970-01-01T00:00:00.000Z",simulationOnly:true,productionAllowed:false as const});
export async function previewStagingSignInAction(formData:FormData){const email=String(formData.get("email")||""),password=String(formData.get("password")||"");return executeSignIn({...base("sign_in"),email,password})}
export async function previewStagingSignOutAction(){return executeSignOut(base("sign_out"))}
export async function previewStagingPasswordResetAction(formData:FormData){const email=String(formData.get("email")||"");return executePasswordReset({...base("request_password_reset"),email})}
export async function previewStagingInvitationAction(formData:FormData){const invitationToken=String(formData.get("invitationToken")||"");return executeInvitationAccept({...base("accept_invitation"),invitationToken})}

