import assert from "node:assert/strict";
import fs from "node:fs";

const read = (path: string) =>
  fs.readFileSync(new URL(path, import.meta.url), "utf8");

const authorization = read("../lib/candidateCvAuthorization.ts");
const saveCandidate = read("../lib/saveCandidate.ts");
const processRoute = read("../app/api/candidate/profile/cv/route.ts");
const signRoute = read("../app/api/candidate/profile/cv/sign/route.ts");
const transaction = read(
  "../supabase/manual/202609240014_candidate_owned_cv_update.sql",
);
const readback = read(
  "../supabase/manual/202609240015_candidate_owned_cv_update_readback.sql",
);

for (const route of [processRoute, signRoute]) {
  assert.ok(
    route.indexOf("candidateCvUploadRuntimeEnabled()") <
      route.indexOf("authorizeCandidateCvUpload()"),
    "candidate upload must fail closed before creating an authenticated runtime client",
  );
  assert.match(route, /validateCandidateCvWriteRequest\(request\)/);
  assert.match(route, /Cache-Control": "private, no-store"/);
}

assert.match(authorization, /browserClient\.auth\.getUser\(\)/);
assert.match(authorization, /user\.email_confirmed_at/);
assert.match(authorization, /profile\.role !== "candidate"/);
assert.match(authorization, /profile\.status !== "active"/);
assert.match(authorization, /\.from\("candidate_accounts"\)/);
assert.match(authorization, /\.eq\("candidate_id", profile\.candidate_id\)/);
assert.match(authorization, /accountResult\.data\?\.length !== 1/);
assert.match(authorization, /candidateResult\.data\?\.length !== 1/);
assert.match(authorization, /origin !== expectedOrigin/);
assert.match(authorization, /CANDIDATE_CV_UPLOAD_ENABLED === "true"/);

assert.match(processRoute, /source: "candidate_upload"/);
assert.match(
  processRoute,
  /ownedOriginalCvObjectKey\(authorization\.scope\.authUserId/,
);
assert.match(processRoute, /candidate_owned_update_context/);
assert.match(
  processRoute,
  /expected_updated_at: authorization\.scope\.candidateUpdatedAt/,
);
assert.match(processRoute, /evaluateCandidateProfileCompletion\(saved/);
assert.match(processRoute, /missingRequiredFields/);
assert.match(processRoute, /candidateSourceFile === sourceReference/);
assert.match(processRoute, /alreadyProcessed: true/);
assert.match(processRoute, /cvContentDigestMatches\(buffer, contentDigest\)/);
assert.ok(
  processRoute.indexOf("cvContentDigestMatches(buffer, contentDigest)") <
    processRoute.indexOf("prepareCandidateCv({"),
  "candidate parser must not run before exact-byte integrity verification",
);
assert.match(processRoute, /content_digest_mismatch/);
assert.doesNotMatch(
  processRoute,
  /input\.(?:candidateId|candidate_id)/,
  "candidate id must come only from the verified ownership chain",
);
assert.match(signRoute, /authorization\.scope\.authUserId/);
assert.match(signRoute, /createSignedUploadUrl\(objectKey\)/);
assert.match(signRoute, /normalizeCvContentDigest\(input\.contentDigest\)/);

const portal = read("../app/candidate/portal/CandidatePortalClient.tsx");
assert.match(portal, /crypto\.subtle\.digest/);
assert.match(portal, /contentDigest/);

assert.match(saveCandidate, /apply_candidate_owned_cv_update/);
assert.match(
  saveCandidate,
  /safePayload\.profile_source_type !== "candidate_upload"/,
);
for (const field of [
  "email",
  "phone",
  "normalized_email",
  "normalized_phone",
]) {
  assert.match(
    saveCandidate,
    new RegExp(`"${field}"`),
    `candidate CV persistence must explicitly strip ${field}`,
  );
}
assert.match(saveCandidate, /CANDIDATE_OWNED_UPDATE_READBACK_MISMATCH/);

assert.match(transaction, /MANUAL, REVIEWED-RUN ONLY/);
assert.match(transaction, /candidate_owned_cv_preflight_forced_rls_missing/);
assert.match(transaction, /security invoker/);
assert.match(transaction, /set search_path = ''/);
assert.match(transaction, /for update/g);
assert.match(
  transaction,
  /v_candidate\.updated_at is distinct from p_expected_updated_at/,
);
assert.match(transaction, /candidate_owned_cv_stale_version/);
assert.match(
  transaction,
  /v_profile\.candidate_id is distinct from p_candidate_id/,
);
assert.match(transaction, /v_account\.status <> 'active'/);
assert.match(transaction, /profile_source_type = ''candidate_upload''/);
assert.match(
  transaction,
  /profile_confirmation_status = ''claimed_incomplete''/,
);
assert.match(transaction, /status = ''needs_review''/);
assert.match(transaction, /candidate_confirmed_at = null/);
assert.match(transaction, /delete from public\.candidate_search_index/);
assert.match(
  transaction,
  /source_file' is distinct from p_payload->>'source_file/,
);
assert.match(transaction, /in \('candidate_confirmed','recruiter_approved'\)/);
assert.match(
  transaction,
  /revoke all on function public\.apply_candidate_owned_cv_update/,
);
assert.match(transaction, /from public, anon, authenticated/);
assert.match(transaction, /to service_role/);
assert.doesNotMatch(
  transaction.match(
    /v_allowed constant text\[\] := array\[([\s\S]*?)\];/,
  )?.[1] || "",
  /'email'|'phone'|'normalized_email'|'normalized_phone'/,
  "CV parsing must not silently replace candidate-confirmed contact identity",
);

assert.match(readback, /repeatable read read only/);
assert.match(readback, /has_function_privilege\('anon'/);
assert.match(readback, /has_function_privilege\('authenticated'/);
assert.match(readback, /has_function_privilege\('service_role'/);
assert.match(readback, /candidate_owned_cv_must_be_security_invoker/);
assert.doesNotMatch(
  readback,
  /^\s*(?:alter|create|delete|drop|grant|insert|revoke|truncate|update)\b/im,
);

console.log("candidateOwnedCvUpdate.test.ts passed");
