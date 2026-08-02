"use server";

import { executeCurrentStagingAuthRuntimeAction } from "../../lib/stagingAuthRuntimeActionServiceServer";
import type { StagingAuthRuntimeActionResult } from "../../lib/stagingAuthRuntimeActionTypes";

function value(formData: FormData, key: string): string {
  return String(formData.get(key) || "");
}

export async function stagingRuntimeSignInAction(
  _previousState: StagingAuthRuntimeActionResult | null,
  formData: FormData,
): Promise<StagingAuthRuntimeActionResult> {
  return executeCurrentStagingAuthRuntimeAction({
    operation: "sign_in",
    email: value(formData, "email"),
    password: value(formData, "password"),
  });
}

export async function stagingRuntimeSignOutAction(
  _previousState?: StagingAuthRuntimeActionResult | null,
  _formData?: FormData,
): Promise<StagingAuthRuntimeActionResult> {
  return executeCurrentStagingAuthRuntimeAction({
    operation: "sign_out",
  });
}

export async function stagingRuntimePasswordResetAction(
  _previousState: StagingAuthRuntimeActionResult | null,
  formData: FormData,
): Promise<StagingAuthRuntimeActionResult> {
  return executeCurrentStagingAuthRuntimeAction({
    operation: "request_password_reset",
    email: value(formData, "email"),
  });
}

export async function stagingRuntimeInvitationAction(
  _previousState: StagingAuthRuntimeActionResult | null,
  formData: FormData,
): Promise<StagingAuthRuntimeActionResult> {
  return executeCurrentStagingAuthRuntimeAction({
    operation: "accept_invitation",
    invitationToken: value(formData, "invitationToken"),
  });
}

export async function stagingRuntimeSessionAction(
  _previousState?: StagingAuthRuntimeActionResult | null,
  _formData?: FormData,
): Promise<StagingAuthRuntimeActionResult> {
  return executeCurrentStagingAuthRuntimeAction({
    operation: "get_session",
  });
}

export async function stagingRuntimeUserAction(
  _previousState?: StagingAuthRuntimeActionResult | null,
  _formData?: FormData,
): Promise<StagingAuthRuntimeActionResult> {
  return executeCurrentStagingAuthRuntimeAction({
    operation: "get_user",
  });
}

export async function stagingRuntimeProfileAction(
  _previousState?: StagingAuthRuntimeActionResult | null,
  _formData?: FormData,
): Promise<StagingAuthRuntimeActionResult> {
  return executeCurrentStagingAuthRuntimeAction({
    operation: "get_profile",
  });
}

export async function stagingRuntimeRefreshAction(
  _previousState?: StagingAuthRuntimeActionResult | null,
  _formData?: FormData,
): Promise<StagingAuthRuntimeActionResult> {
  return executeCurrentStagingAuthRuntimeAction({
    operation: "refresh_session",
  });
}