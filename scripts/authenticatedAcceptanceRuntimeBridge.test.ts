import assert from "node:assert/strict";

import {
  acceptanceHash,
  acceptanceRequestHeaders,
  fetchAcceptanceReleaseEvidence,
  sanitizedBridgeEvidence,
  VERCEL_PROTECTION_BYPASS_HEADER,
} from "../lib/acceptanceDeploymentBridge";

async function main() {
  const secret = "synthetic-bypass-value-never-report";
  const config = {
    baseUrl: "https://preview.example.invalid",
    appEnvironment: "acceptance",
    protectionRequired: true,
    bypassSecret: secret,
  };
  const expected = {
    commitSha: "b".repeat(40),
    environmentId: "acceptance-environment",
    projectRef: "acceptance-project",
  };
  const release = {
    schemaVersion: "acceptance-release-evidence-v3",
    harnessVersion: "production-trust-authenticated-acceptance-v2",
    commitSha: expected.commitSha,
    classification: "acceptance",
    environmentHash: acceptanceHash(expected.environmentId),
    projectRefHash: acceptanceHash(expected.projectRef),
    buildId: "synthetic-build-id",
    deploymentHash: "0".repeat(16),
    externalTalentEnabled: false,
    externalProviderConfigured: false,
  };

  const direct = acceptanceRequestHeaders("/api/acceptance/release", config);
  assert.equal(direct.headers.get(VERCEL_PROTECTION_BYPASS_HEADER), secret);
  for (const target of [
    "https://sub.preview.example.invalid/api/acceptance/release",
    "https://preview.example.invalid.attacker.invalid/api/acceptance/release",
    "https://attacker.invalid/api/acceptance/release",
  ]) {
    assert.throws(
      () => acceptanceRequestHeaders(target, config),
      /cross_origin_request_denied/,
    );
  }

  await assert.rejects(
    () =>
      fetchAcceptanceReleaseEvidence(
        async () =>
          new Response(null, {
            status: 302,
            headers: { Location: "https://vercel.com/sso" },
          }),
        config,
        expected,
      ),
    /redirect_rejected/,
  );
  await assert.rejects(
    () =>
      fetchAcceptanceReleaseEvidence(
        async () =>
          new Response("<html>Log in</html>", {
            headers: { "Content-Type": "text/html" },
          }),
        config,
        expected,
      ),
    /application_evidence_missing/,
  );
  await assert.rejects(
    () =>
      fetchAcceptanceReleaseEvidence(
        async () => Response.json({ ...release, commitSha: "c".repeat(40) }),
        config,
        expected,
      ),
    /identity_mismatch/,
  );
  await fetchAcceptanceReleaseEvidence(
    async (_url, init) => {
      assert.equal(
        new Headers(init?.headers).get(VERCEL_PROTECTION_BYPASS_HEADER),
        secret,
      );
      assert.equal(init?.redirect, "manual");
      return Response.json(release);
    },
    config,
    expected,
  );
  await fetchAcceptanceReleaseEvidence(
    async () =>
      Response.json({
        ...release,
        externalTalentEnabled: true,
        externalProviderConfigured: true,
      }),
    config,
    { ...expected, externalMode: "required" },
  );
  await assert.rejects(
    () =>
      fetchAcceptanceReleaseEvidence(
        async () => Response.json(release),
        config,
        { ...expected, externalMode: "required" },
      ),
    /identity_mismatch/,
  );
  await assert.rejects(
    () =>
      fetchAcceptanceReleaseEvidence(
        async () => Response.json({ ...release, externalTalentEnabled: true }),
        config,
        { ...expected, externalMode: "disabled" },
      ),
    /identity_mismatch/,
  );

  assert.throws(
    () => acceptanceRequestHeaders("/", { ...config, bypassSecret: "" }),
    /bypass_configuration_missing/,
  );
  assert.doesNotThrow(() =>
    acceptanceRequestHeaders("/", {
      baseUrl: "http://127.0.0.1:3000",
      appEnvironment: "test",
      protectionRequired: false,
    }),
  );
  assert.throws(
    () =>
      acceptanceRequestHeaders("/", {
        baseUrl: "https://preview.example.invalid",
        appEnvironment: "acceptance",
        protectionRequired: false,
      }),
    /unprotected_target_denied/,
  );
  assert.deepEqual(sanitizedBridgeEvidence({ ok: true }), { ok: true });
  assert.throws(
    () => sanitizedBridgeEvidence({ bypassSecret: secret }),
    /contains_secret_metadata/,
  );
  assert.throws(
    () => sanitizedBridgeEvidence({ opaque: secret }, [secret]),
    /contains_secret_value/,
  );

  console.log("Authenticated acceptance deployment bridge tests passed.");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
