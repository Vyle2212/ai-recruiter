import assert from "node:assert/strict";
import { verifyAcceptanceAuthConfirmation } from "../lib/acceptanceAuthConfirmation";

type Admin = Parameters<typeof verifyAcceptanceAuthConfirmation>[0];
async function scenario(mode: string) {
  const calls: string[] = [];
  const user = {
    id: "synthetic-user",
    user_metadata: { synthetic: true, acceptance_run_hash: "owned-run" },
    email_confirmed_at: undefined as string | undefined,
  };
  const admin = {
    getUserById: async (id: string) => {
      calls.push("read");
      assert.equal(id, user.id);
      return {
        data: {
          user: {
            ...user,
            id: mode === "other-user" ? "other" : user.id,
            user_metadata:
              mode === "other-run"
                ? { ...user.user_metadata, acceptance_run_hash: "other" }
                : user.user_metadata,
            email_confirmed_at:
              mode === "already-confirmed"
                ? "2026-10-08T00:00:00Z"
                : user.email_confirmed_at,
          },
        },
        error: mode === "read-error" ? new Error("private error") : null,
      };
    },
    updateUserById: async (id: string, attributes: unknown) => {
      calls.push("confirm");
      assert.equal(id, user.id);
      assert.deepEqual(attributes, { email_confirm: true });
      if (mode !== "unchanged")
        user.email_confirmed_at = "2026-10-08T00:00:00Z";
      return {
        data: { user },
        error: mode === "update-error" ? new Error("private error") : null,
      };
    },
  } as unknown as Admin;
  if (mode === "pass") {
    await verifyAcceptanceAuthConfirmation(admin, user.id, "owned-run");
    assert.deepEqual(calls, ["read", "confirm", "read"]);
  } else {
    await assert.rejects(
      verifyAcceptanceAuthConfirmation(admin, user.id, "owned-run"),
      /^Error: acceptance_auth_/,
    );
    if (
      ["other-user", "other-run", "already-confirmed", "read-error"].includes(
        mode,
      )
    )
      assert.deepEqual(calls, ["read"]);
    if (mode === "update-error") assert.deepEqual(calls, ["read", "confirm"]);
  }
}
async function main() {
  for (const mode of [
    "pass",
    "other-user",
    "other-run",
    "already-confirmed",
    "read-error",
    "update-error",
    "unchanged",
  ])
    await scenario(mode);
  console.log(
    "Acceptance Auth confirmation readback and ownership boundaries passed.",
  );
}
void main();
