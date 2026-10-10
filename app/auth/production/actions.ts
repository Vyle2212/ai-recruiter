"use server";

import { productionAuthConfigured } from "@/lib/productionAuthConfiguration";
import { createClient } from "@/utils/supabase/server";
import { createClient as createPublicAuthClient } from "@supabase/supabase-js";
import { redirect } from "next/navigation";

export type ProductionSignInState = { ok: boolean; message: string };

async function activeAdmin(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data: userResult, error: userError } = await supabase.auth.getUser();
  if (userError || !userResult.user) return false;
  const { data: profile, error } = await supabase
    .from("user_profiles")
    .select("auth_user_id,role,status")
    .eq("auth_user_id", userResult.user.id)
    .maybeSingle();
  return (
    !error &&
    profile?.auth_user_id === userResult.user.id &&
    profile.role === "admin" &&
    profile.status === "active"
  );
}

export async function productionAdminSignIn(
  _state: ProductionSignInState,
  formData: FormData,
): Promise<ProductionSignInState> {
  if (!productionAuthConfigured()) {
    return { ok: false, message: "Production sign-in is not enabled yet." };
  }

  const email = String(formData.get("email") || "").trim();
  const password = String(formData.get("password") || "");
  if (!email || !password) {
    return { ok: false, message: "Enter your email and password." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    return { ok: false, message: "Sign-in failed. Check your credentials." };
  }

  if (!(await activeAdmin(supabase))) {
    await supabase.auth.signOut();
    return { ok: false, message: "An active admin profile is required." };
  }

  return { ok: true, message: "Signed in." };
}

export async function productionAdminAcceptInvite(input: {
  accessToken?: string;
  refreshToken?: string;
}): Promise<boolean> {
  if (!productionAuthConfigured()) return false;
  const supabase = await createClient();
  if (input.accessToken || input.refreshToken) {
    if (!input.accessToken || !input.refreshToken) return false;
    const { error } = await supabase.auth.setSession({
      access_token: input.accessToken,
      refresh_token: input.refreshToken,
    });
    if (error) return false;
  }
  if (await activeAdmin(supabase)) return true;
  await supabase.auth.signOut();
  return false;
}

export async function productionAdminSetPassword(
  password: string,
): Promise<boolean> {
  if (
    !productionAuthConfigured() ||
    password.length < 12 ||
    password.length > 128
  )
    return false;
  const supabase = await createClient();
  if (!(await activeAdmin(supabase))) return false;
  const { error } = await supabase.auth.updateUser({ password });
  return !error;
}

export async function productionAdminSignOut() {
  if (!productionAuthConfigured()) return;
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/auth/login");
}

export async function productionAdminRequestRecovery(emailInput: string) {
  if (!productionAuthConfigured()) return false;
  const email = emailInput.trim();
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    return false;

  // The SSR client uses PKCE, whose verifier cookie would tie the email link
  // to this browser. Use an ephemeral public-key client for the email request
  // so the recovery link carries the same implicit hash as admin invitations.
  const supabase = createPublicAuthClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: {
        flowType: "implicit",
        persistSession: false,
        autoRefreshToken: false,
      },
    },
  );
  // The production Site URL is the root page, which handles the recovery hash.
  // Keep the response identical whether or not the account exists.
  await supabase.auth.resetPasswordForEmail(email);
  return true;
}
