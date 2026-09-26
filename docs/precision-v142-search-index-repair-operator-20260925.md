# Precision v142 — supervised search-index repair operator

Date: 2026-09-25

## Result

The delete-only exact-set repair now has a fail-closed operator. The operator does not execute by default and never prints candidate identifiers.

Before write mode can start, it requires:

- a private, owner-only exact-set request outside the repository;
- a private, owner-only production cutover plan outside the repository;
- an unmodified SQL artifact fingerprinted by that cutover plan;
- recovery, isolated restore and original-CV collection evidence bound to the checked-out commit;
- a plan generated within the previous 24 hours;
- the verified Supabase project reference and a server-only service-role credential;
- explicit write enablement and a confirmation string bound to the commit, request fingerprint and aggregate row counts.

The operator revalidates the request fingerprint before use. After the one-transaction RPC returns, it performs an independent aggregate row-count readback and refuses a mismatched result.

## Production status

No RPC was installed or called and no production data or configuration changed. The historical aggregate target remains zero rows to add and 93 noncanonical rows to remove, but execution remains blocked until the recovery and cutover evidence exists. Production remains `NO_GO`; bulk CV upload is not open.
