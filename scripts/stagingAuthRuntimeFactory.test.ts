import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { buildStagingAuthAdapterForGate } from "../lib/stagingAuthAdapterFactory";
import { buildStagingAuthExecutionGate } from "../lib/stagingAuthExecutionGate";
import {
  buildStagingAuthRuntimeAdapter,
  canUseSupabaseStagingRuntimeProvider,
} from "../lib/stagingAuthRuntimeFactory";
import type { SupabaseStagingAuthClient } from "../lib/stagingAuthSupabaseRuntimeAdapter";

const full = {
  appEnvironment: "staging" as const,
  authMode: "staging_approved" as const,
  stagingAuthEnabled: true,
  stagingAuthApproved: true,
  productionAuthEnabled: false,
  evidencePackAvailable: true,
  runbookAvailable: true,
  stagingBackupConfirmed: true,
  migrationReviewed: true,
  rlsReviewed: true,
  ownershipApproved: true,
  rollbackApproved: true,
};

const unusedClientFactory = async () => {
  throw new Error("client_factory_must_not_run_during_selection");
};

function build(input: Partial<typeof full> = {}) {
  const gate = buildStagingAuthExecutionGate({
    ...full,
    ...input,
  });

  const adapter = buildStagingAuthRuntimeAdapter({
    gate,
    fallbackAdapter: buildStagingAuthAdapterForGate(gate),
    createSupabaseClient:
      unusedClientFactory as () => Promise<SupabaseStagingAuthClient>,
  });

  return { gate, adapter };
}

function main() {
  const approved = build();

  assert.equal(
    canUseSupabaseStagingRuntimeProvider(approved.gate),
    true,
  );
  assert.equal(
    approved.adapter.provider,
    "supabase_staging",
  );

  const production = build({
    appEnvironment: "production",
  });

  assert.equal(
    canUseSupabaseStagingRuntimeProvider(production.gate),
    false,
  );
  assert.equal(production.gate.status, "production_blocked");
  assert.equal(production.adapter.provider, "disabled");

  const productionFlag = build({
    productionAuthEnabled: true,
  });

  assert.equal(
    productionFlag.gate.status,
    "production_blocked",
  );
  assert.equal(productionFlag.adapter.provider, "disabled");

  const missingApproval = build({
    stagingAuthApproved: false,
  });

  assert.equal(
    canUseSupabaseStagingRuntimeProvider(missingApproval.gate),
    false,
  );
  assert.notEqual(
    missingApproval.adapter.provider,
    "supabase_staging",
  );

  const previewMode = build({
    authMode: "preview",
  });

  assert.equal(
    canUseSupabaseStagingRuntimeProvider(previewMode.gate),
    false,
  );
  assert.notEqual(
    previewMode.adapter.provider,
    "supabase_staging",
  );

  const missingEvidence = build({
    evidencePackAvailable: false,
  });

  assert.equal(
    canUseSupabaseStagingRuntimeProvider(missingEvidence.gate),
    false,
  );
  assert.notEqual(
    missingEvidence.adapter.provider,
    "supabase_staging",
  );

  const missingOwnership = build({
    ownershipApproved: false,
  });

  assert.equal(
    canUseSupabaseStagingRuntimeProvider(missingOwnership.gate),
    false,
  );
  assert.notEqual(
    missingOwnership.adapter.provider,
    "supabase_staging",
  );

  const noInjectedClientGate =
    buildStagingAuthExecutionGate(full);

  const withoutClient =
    buildStagingAuthRuntimeAdapter({
      gate: noInjectedClientGate,
      fallbackAdapter:
        buildStagingAuthAdapterForGate(noInjectedClientGate),
    });

  assert.notEqual(
    withoutClient.provider,
    "supabase_staging",
  );

  const serverSource = readFileSync(
    "lib/stagingAuthRuntimeFactoryServer.ts",
    "utf8",
  );

  assert.match(serverSource, /import "server-only"/);
  assert.match(
    serverSource,
    /buildCurrentStagingAuthExecutionGate/,
  );
  assert.match(
    serverSource,
    /createSupabaseServerClient/,
  );
  assert.doesNotMatch(
    readFileSync(
      "lib/stagingAuthRuntimeFactory.ts",
      "utf8",
    ),
    /process\.env|cookies\s*\(|@supabase\/ssr/,
  );

  console.log(
    "stagingAuthRuntimeFactory.test.ts passed",
  );
}

main();