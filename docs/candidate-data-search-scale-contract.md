# Candidate data and search scale contract

## Current boundary

The existing Search V2 ranking path projects the entire search index and
source CV text into an in-process snapshot. Keyset pagination prevents a
fixed database result cap from hiding profiles, but the snapshot still costs
memory and CPU proportional to the full population. It is a correctness fix
for the current corpus, **not** a million-profile search architecture.

The original document is a private Storage object identified by a validated
`candidates.source_file` reference. A filename or external URL is not proof
that the original is archived. Search, detail, and access decisions must use
the candidate ID, not a client-provided path or subscription query parameter.

## Durable data model

1. `candidates`: stable identity, ownership, source/version/confirmation state,
   current employer evidence, and search eligibility. Keep one canonical
   candidate ID across admin uploads and future candidate-owned revisions.
2. Employment records: employer, role, independent start/end/current values,
   source span, evidence state, and candidate/version foreign key. A client
   named in a project cannot create an employer or its tenure.
3. Project records: project name, client, role, SAP modules, lifecycle, optional
   start/end, source span, evidence state, and candidate/version foreign key.
   Two absent dates mean undated, not invalid; a partial or contradictory range
   needs review. Persist every source-grounded record before deriving counts.
4. Original CV manifest: private object key, SHA-256 digest, byte size, MIME
   type, parser version, candidate/version, and archival readback state. Keep
   objects private and immutable. A database transaction references an object
   only after its bytes and digest have been verified.
5. Search projection: one row per eligible canonical candidate with versioned
   normalized facets, source-backed evidence, searchable tokens, and an
   update watermark. The detail view always resolves the canonical record.
6. Entitlements: viewer, organization, plan, candidate/action, validity window,
   and audit event. CV reads and contacts require server-side authorization;
   UI state, URL parameters, and client-side caches do not grant access.

## Query path for large populations

- Use PostgreSQL GIN full-text/facet indexes to retrieve a **recall-safe
  candidate set** for a query. Expand SAP aliases before querying. Keep the
  source-record relationship needed for combinations such as FICO plus an
  implementation on the same project.
- Apply lifecycle and tenant/entitlement restrictions in the database query.
  Rank the bounded relevant set with the existing evidence-aware scorer, then
  paginate by a stable `(score, candidate_id)` cursor. Never load all CV text
  or a million candidate projections into a request or one process snapshot.
- A preliminary filter must be proven to contain every candidate accepted by
  the reference scorer. Shadow-run both paths on a frozen corpus, compare
  identity sets, order, explanations, and total counts, and keep the reference
  path until recall parity passes. Empty/generic queries need an indexed
  browse path with stable ordering, not an unbounded fallback scan.
- Version and atomically replace projections after a candidate revision.
  Deactivate deleted, non-SAP, or unreviewed rows before they can appear in a
  new query. Reconciliation checks source IDs against search IDs in batches.

## Release evidence

- Run synthetic 10k, 100k, and 1M candidate loads without private CVs;
  measure ingestion throughput, search latency, memory, pagination stability,
  and restart recovery. Include late updates and concurrent uploads.
- Demonstrate no missing or duplicate search candidates across page
  boundaries and exact provenance for employer, client, role, project dates,
  and SAP-only tenure. Compare new search results with the reference scorer.
- Verify original CV byte digest after upload and through an authorized admin
  open. Then add persisted client/recruiter subscription grants and test
  denied, expired, cross-organization, and revoked access before exposing
  original CVs to those roles.
- Only request a full re-upload after parser acceptance, database fields and
  policies, original Storage, index reconciliation, and authenticated readback
  pass in the target environment. Resume uploads idempotently by document
  digest and candidate identity; never equate unique files with unique people.
