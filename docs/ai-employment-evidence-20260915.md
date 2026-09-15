# AI employment evidence gate

Validated AI extraction previously forwarded raw employment arrays without row-level evidence checks. It also used `primary || alternate`, so an empty primary array hid a populated alternate employer history.

The validated top-level employment history now selects a nonempty primary array or the alternate array. For OpenAI output, rows require a contiguous source excerpt, matching employer/title/date literals, a single explicit employer label, an explicit matching role label, an adjacent valid date pair and consistent current status. Client-labelled or unsupported evidence requires review. Unsupported proposals remain in raw extraction for review; the validated history excludes them and safeToApply is false. This is a conservative gate: unlabelled or differently normalized valid CV layouts may require review. It is not proof of complete extraction and must not be marketed as such.

The prompt documents row fields and exact evidence, and the cache version is bumped. Existing deterministic/mock paths are preserved. No automatic writes or upload-to-AI integration were added.

Verification: new evidence/alternate-array test, AI source-coverage test, existing AI engine/provider tests and typecheck pass. Synthetic tests cover fabricated employer/evidence, client attribution, reversed dates, current-date conflict and preservation of alternate history. Deterministic 277-source audit counts remain unchanged.

Still required: full-source re-extraction, review of unresolved/ambiguous proposals, end-to-end upload persistence integration and exact deployed-artifact authenticated acceptance. Vercel/Supabase are connected but their callable operations remain unavailable in this runtime; live data/configuration has not been accessed. Production is not verified.
