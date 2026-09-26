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

## Durable ingestion rollout

The reviewed SQL in `supabase/manual/202609260001_candidate_ingestion_jobs.sql`
prepares a private job ledger. It does not activate a worker or change the
current upload route. Apply only after its target-environment preflight and
readback pass; keep the existing route until the full worker is proven.

- Verify bytes, size, and SHA-256 in private Storage before enqueueing. The
  unique `(actor, digest, parser revision)` key makes a retry idempotent while
  permitting deliberate re-extraction after a parser upgrade. Keep one source
  object and canonical candidate identity across those revisions.
- Workers atomically claim a small batch with `FOR UPDATE SKIP LOCKED`, a lease
  token, renewal for slow parsing, and bounded retry count. A crashed worker's
  lease expires. Before any save, inspect the source-file and parser-revision
  readback so an ambiguous
  previous commit cannot create a duplicate. A stale token cannot acknowledge
  a job claimed by another worker.
- Parse outside the request that accepts the upload. Persist only fixed outcome
  codes in the job ledger; raw CV and parser details remain private. Add an
  authorized progress endpoint and a dead-letter review path before enabling
  this workflow for admin batches or candidate signups.
- Limit concurrency by observed database, Storage, and parser capacity. A
  million documents require load tests and operational throughput budgets,
  rather than a browser tab or one server request processing the collection.
- A retried upload may leave a second private Storage object even when the
  digest key resolves to an existing job. Reconcile those unattached objects
  by digest and reference before retention or deletion; never discard a file
  after an ambiguous candidate save.

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
