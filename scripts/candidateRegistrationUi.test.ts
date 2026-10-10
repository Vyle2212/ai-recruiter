import assert from "node:assert/strict";
import fs from "node:fs";

const form = fs.readFileSync(
  "app/auth/signup/CandidateRegistrationForm.tsx",
  "utf8",
);
const page = fs.readFileSync("app/auth/signup/page.tsx", "utf8");

assert.match(form, /^"use client";/);
assert.match(
  form,
  /challenges\.cloudflare\.com\/turnstile\/v0\/api\.js\?render=explicit/,
);
assert.match(form, /window\.turnstile\.reset\(widgetRef\.current\)/);
assert.match(form, /fetch\("\/api\/auth\/candidate\/register"/);
assert.match(form, /credentials: "same-origin"/);
assert.match(form, /captchaToken/);
assert.match(form, /aria-live="polite"/);
assert.doesNotMatch(
  form,
  /SERVICE_ROLE|candidateId|candidate_id|name=["']role["']/,
);
assert.doesNotMatch(form, /console\.|localStorage|sessionStorage/);
assert.match(page, /candidateRegistrationUiConfiguration\(\)/);
assert.match(page, /registration\.enabled/);
assert.match(page, /CandidateRegistrationForm/);
assert.match(page, /DisabledForm/);
assert.match(page, /status in callbackMessages/);
assert.match(page, /invalid:/);
assert.match(page, /review_required:/);
assert.match(page, /temporarily_unavailable:/);
assert.doesNotMatch(
  page,
  /redirect\([^)]*searchParams|href=\{[^}]*(?:searchParams|callbackMessage|status)/,
);

console.log("Candidate registration UI contract PASS (synthetic, default OFF)");
