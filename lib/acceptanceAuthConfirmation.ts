import type { SupabaseClient } from "@supabase/supabase-js";

type AuthAdmin = Pick<
  SupabaseClient["auth"]["admin"],
  "getUserById" | "updateUserById"
>;

// Called only after the new synthetic identity has been written to the run ledger.
// No email is sent; this verifies the Auth API transition, not email-link delivery.
export async function verifyAcceptanceAuthConfirmation(
  admin: AuthAdmin,
  userId: string,
  runHash: string,
) {
  const before = await admin.getUserById(userId);
  const owned = (user: typeof before.data.user) =>
    user?.id === userId &&
    user.user_metadata?.synthetic === true &&
    user.user_metadata?.acceptance_run_hash === runHash;
  if (
    before.error ||
    !owned(before.data.user) ||
    before.data.user?.email_confirmed_at
  )
    throw new Error("acceptance_auth_unconfirmed_readback_failed");
  const changed = await admin.updateUserById(userId, { email_confirm: true });
  if (changed.error || !owned(changed.data.user))
    throw new Error("acceptance_auth_confirmation_failed");
  const after = await admin.getUserById(userId);
  if (
    after.error ||
    !owned(after.data.user) ||
    !after.data.user?.email_confirmed_at
  )
    throw new Error("acceptance_auth_confirmed_readback_failed");
}
