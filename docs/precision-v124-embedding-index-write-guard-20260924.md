# v124 embedding and index write guard

The v123 search-index guard did not cover the legacy embedding endpoint and
two exported candidate-index helpers. The endpoint wrote candidate embeddings
and search-index rows as separate operations, ignored write failures, and
could report success with a stale or incomplete index. This batch makes the
endpoint return a no-store 503 before opening a production connection; both
helpers refuse writes before fetching candidates or computing rows. Existing
recruiter authorization for the endpoint remains required.

The regression exercises the endpoint and both helpers without private
fixtures. Source projection and production inventory are unchanged: 737/970
sources and 2,160 projected employment rows, 233 projected sources without
employment; 231/970 stored sources and 715 stored employment rows. The
previously classified 739 stored gaps remain 416 heading/date boundary,
227 project/client-heavy, 57 employer label, 26 table, nine other layout and
four insufficient source. The 533 additive sources require private review;
108 conflicting sources require adjudication. The private full-source archive
transfer remained unavailable, so no new source comparison is claimed.

No production SQL, embedding, Supabase or Vercel write occurred. Production
remains NO_GO until reviewed manifest and backup, safe index reconstruction
and readback, conflict review, RLS cutover/readback, live OCR, and authenticated
acceptance on the promoted artifact are complete.
