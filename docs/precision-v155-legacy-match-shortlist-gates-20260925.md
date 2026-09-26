# Legacy match and shortlist lifecycle gates

OCR-recovered and otherwise incomplete profiles must remain in recruiter review.
This batch closes legacy API paths that previously bypassed the shared current
candidate lifecycle decision even after Search V2 and the primary match paths
were protected.

The same recruiter authorization gate now protects legacy match generation,
vector matching, persisted match writes, job matching and shortlist APIs. The
legacy `match_candidates` RPC output is treated only as a ranking hint: current
candidate rows are read back and filtered before any result is returned.
Shortlist creation, addition and update require the exact requested candidate
set to be currently search-eligible. Missing, OCR-review, incomplete,
non-SAP, deleted or otherwise blocked candidates make the whole write fail;
partial shortlist writes are not allowed. Shortlist reads that include members
remove entries no longer eligible under current state.

The shared gate reads only candidate ID and lifecycle columns. It does not
serialize names, contact fields, CV text or per-candidate evidence. The batch
adds deterministic positive, review and missing-ID regression coverage and does
not change parser extraction counts.

No production database, Storage object, runtime configuration or candidate row
was changed. Production remains `NO_GO`: the archive has only 892 unique
originals, at least 78 below the 970 target; production-provider OCR, a current
isolated restore, private Storage/RLS/Auth cutover and authenticated exact
readback remain outstanding.
