import assert from "node:assert/strict";
import {
  verifyAcceptanceAuthConfirmation,
  type AcceptancePreconfirmationProjectionGate,
} from "../lib/acceptanceAuthConfirmation";

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
  const projectionCalls: string[] = [];
  const projectionGate: AcceptancePreconfirmationProjectionGate = {
    setConsent: async (consent) => {
      projectionCalls.push(consent ? "consent-on" : "consent-off");
      return {
        error:
          (mode === "consent-prepare-error" && consent) ||
          (mode === "consent-reset-error" && !consent)
            ? new Error("private error")
            : null,
      };
    },
    attemptConversation: async () => {
      projectionCalls.push("conversation");
      return mode === "projection-open"
        ? { data: "unexpected-conversation", error: null }
        : mode === "projection-other-error"
          ? { error: new Error("private error") }
          : { error: new Error("chat_scope_not_available") };
    },
  };
  if (mode === "pass") {
    await verifyAcceptanceAuthConfirmation(
      admin,
      user.id,
      "owned-run",
      projectionGate,
    );
    assert.deepEqual(calls, ["read", "confirm", "read"]);
    assert.deepEqual(projectionCalls, [
      "consent-on",
      "conversation",
      "consent-off",
    ]);
  } else {
    await assert.rejects(
      verifyAcceptanceAuthConfirmation(
        admin,
        user.id,
        "owned-run",
        projectionGate,
      ),
      /^Error: acceptance_auth_/,
    );
    if (
      ["other-user", "other-run", "already-confirmed", "read-error"].includes(
        mode,
      )
    )
      assert.deepEqual(calls, ["read"]);
    if (mode === "update-error") assert.deepEqual(calls, ["read", "confirm"]);
    if (["projection-open", "projection-other-error"].includes(mode)) {
      assert.deepEqual(calls, ["read"]);
      assert.deepEqual(projectionCalls, [
        "consent-on",
        "conversation",
        "consent-off",
      ]);
    }
    if (mode === "consent-prepare-error") {
      assert.deepEqual(calls, ["read"]);
      assert.deepEqual(projectionCalls, ["consent-on"]);
    }
    if (mode === "consent-reset-error") {
      assert.deepEqual(calls, ["read"]);
      assert.deepEqual(projectionCalls, [
        "consent-on",
        "conversation",
        "consent-off",
      ]);
    }
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
    "projection-open",
    "projection-other-error",
    "consent-prepare-error",
    "consent-reset-error",
  ])
    await scenario(mode);
  console.log(
    "Acceptance Auth confirmation readback and ownership boundaries passed.",
  );
}
void main();
