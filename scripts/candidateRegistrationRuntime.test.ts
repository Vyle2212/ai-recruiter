import assert from "node:assert/strict";
import {
  candidateRegistrationCallbackConfiguration,
  candidateRegistrationConfiguration,
  candidateRegistrationResultUrl,
  candidateRegistrationUiConfiguration,
  readCandidateRegistrationInput,
} from "../lib/candidateRegistrationRuntime";

const origin = "https://acceptance.example.invalid";
const body = JSON.stringify({
  email: "fixture@example.invalid",
  password: "synthetic-password",
  fullName: "Synthetic Candidate",
  captchaToken: "synthetic-captcha",
});
const env = {
  CANDIDATE_REGISTRATION_ENABLED: "true",
  CANDIDATE_REGISTRATION_ORIGIN: origin,
  NEXT_PUBLIC_SUPABASE_URL: "https://project.example.invalid",
  NEXT_PUBLIC_SUPABASE_ANON_KEY: "synthetic-publishable-value",
  SUPABASE_SERVICE_ROLE_KEY: "synthetic-server-only-value",
};
function request(
  overrides: {
    url?: string;
    origin?: string;
    type?: string;
    length?: string;
    site?: string;
    body?: string;
  } = {},
) {
  const value = overrides.body ?? body;
  return new Request(overrides.url ?? `${origin}/api/auth/candidate/register`, {
    method: "POST",
    body: value,
    headers: {
      origin: overrides.origin ?? origin,
      "content-type": overrides.type ?? "application/json",
      "content-length":
        overrides.length ?? String(new TextEncoder().encode(value).byteLength),
      "sec-fetch-site": overrides.site ?? "same-origin",
    },
  });
}
assert.equal(
  candidateRegistrationConfiguration(request(), {}).code,
  "not_found",
);
assert.equal(
  candidateRegistrationConfiguration(request(), {
    ...env,
    CANDIDATE_REGISTRATION_ORIGIN: "invalid",
  }).code,
  "candidate_registration_not_configured",
);
assert.equal(
  candidateRegistrationConfiguration(
    request({ origin: "https://other.example.invalid" }),
    env,
  ).code,
  "same_origin_required",
);
assert.equal(
  candidateRegistrationConfiguration(request({ site: "cross-site" }), env).code,
  "same_origin_required",
);
assert.equal(
  candidateRegistrationConfiguration(request({ type: "text/plain" }), env).code,
  "json_request_required",
);
assert.equal(
  candidateRegistrationConfiguration(request({ length: "9000" }), env).code,
  "candidate_registration_request_too_large",
);
assert.equal(candidateRegistrationConfiguration(request(), env).enabled, true);
const callbackRequest = new Request(`${origin}/auth/candidate/callback?code=x`);
assert.equal(
  candidateRegistrationCallbackConfiguration(callbackRequest, {}).code,
  "not_found",
);
assert.equal(
  candidateRegistrationCallbackConfiguration(callbackRequest, env).enabled,
  true,
);
assert.equal(
  candidateRegistrationCallbackConfiguration(
    new Request("https://other.example.invalid/auth/candidate/callback?code=x"),
    env,
  ).code,
  "candidate_registration_callback_blocked",
);
assert.equal(
  candidateRegistrationResultUrl(origin, "ready").href,
  `${origin}/candidate/portal`,
);
assert.equal(
  candidateRegistrationResultUrl(origin, "review_required").href,
  `${origin}/auth/signup?status=review_required`,
);
assert.equal(candidateRegistrationUiConfiguration(env).enabled, false);
assert.equal(
  candidateRegistrationUiConfiguration({
    ...env,
    NEXT_PUBLIC_TURNSTILE_SITE_KEY: "synthetic-site-key",
  }).enabled,
  true,
);
assert.equal(
  candidateRegistrationUiConfiguration({
    ...env,
    NEXT_PUBLIC_TURNSTILE_SITE_KEY: "invalid site key",
  }).enabled,
  false,
);
async function main() {
  assert.equal(
    await readCandidateRegistrationInput(
      request({ body: "x".repeat(8193), length: "1" }),
    ),
    null,
  );
  assert.equal(
    await readCandidateRegistrationInput(request({ length: "1" })),
    null,
  );
  assert.equal(
    (await readCandidateRegistrationInput(request()))?.email,
    "fixture@example.invalid",
  );
  assert.equal(
    await readCandidateRegistrationInput(request({ body: "{" })),
    null,
  );
  console.log(
    "Candidate registration runtime boundary PASS (synthetic, no Auth calls)",
  );
}

void main();
