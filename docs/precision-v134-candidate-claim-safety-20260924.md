# Precision v134 — candidate claim remains private until production auth is ready

The owner clarified the operational sequence: the admin uploads the complete existing collection once; only a candidate who later signs up may upload a newer CV and update their own canonical profile. No candidate account presently exists in production. This checkpoint changes no candidate, Auth or Storage data.

## Claim contract corrected

The unexecuted candidate-claim SQL now checks a verified `auth.users` email against the active candidate profile email, locks the matching candidate and both account-link directions, rejects a profile already linked to a different candidate, and rejects a candidate already owned by another account. A unique-key conflict never reassigns `candidate_accounts.user_profile_id` or `candidate_id`; it fails closed. Anonymous and authenticated roles receive no EXECUTE grant for this private primitive.

The earlier artifact was unsafe as a production signup path: it used `ON CONFLICT DO UPDATE` to reassign a link, did not require email verification, and granted authenticated EXECUTE on a function in a private, non-exposed schema. The staging-only `user_profiles` constraint also requires a candidate ID before a candidate can claim one, while its protected-column trigger blocks the claim update. These are integration blockers, not an instruction to loosen RLS or use an admin upload as candidate signup.

## Remaining before a candidate can sign up

Prepare a separately reviewed production Auth foundation that allows an active, verified candidate account to exist temporarily without a claimed candidate ID; a server-only claim entry point must verify the session and invoke the private claim primitive without exposing direct candidate-table writes. Review the ownership trigger, test zero/one/multiple identity matches and concurrent claims against a disposable restored environment, then verify RLS and audit events. Until these pass, candidate signup, claim and self-confirm submission remain disabled.

The pending admin upload path is separate. It still requires a restorable current backup, reviewed production schema/RLS and original-CV bucket, a real authenticated live OCR upload and full-population readback before asking the owner to upload 970+ files. The historic 533 additive, 108 conflict and 233 unresolved groups have not been written or discarded. Production remains **NO_GO**.
