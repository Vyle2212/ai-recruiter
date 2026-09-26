# Database surface cutover completion — 2026-09-23

## Read-only production verification

A fresh privilege and advisor audit confirms that the production authorization
defect remains open: 23 exposed public tables still have RLS disabled, the two
remaining RLS-enabled lookup tables retain broad public access, and all 25
tables allow direct `anon` and `authenticated` DML. This is a confirmed
configuration defect, not evidence of unauthorized use.

The same audit identified two candidate audit views that execute with their
owner's privileges and six candidate/search RPCs with mutable `search_path` and
public execution grants. The RPCs are used by server API routes already covered
by the v107 authorization registry; no browser RPC dependency was found.

## Completed GitHub artifact

The manual cutover now validates and hardens the full known database surface in
one transaction:

- 25 tables: remove permissive policies, enable and force RLS, revoke direct
  public/anonymous/authenticated DML, and retain service-role access;
- two audit views: enable `security_invoker`, revoke public selection, and
  retain service-role selection;
- six candidate/search RPCs: pin `search_path` to `pg_catalog, public`, revoke
  public/anonymous/authenticated execution, and retain service-role execution.

Static regression coverage requires every table, view and RPC boundary and the
preflight checks. The artifact remains outside automatic migrations and has not
been executed against production.

## Release status

Production remains **NO_GO**. Before execution, the exact application revision
must pass authenticated acceptance and a version-matched database backup plus
rollback checkpoint must exist. After controlled execution, RLS, view options,
table grants, function configuration and function grants must be read back;
Supabase security advisors must be rerun. Reviewed candidate backfill, live OCR
provenance and exact-artifact promotion remain independent release gates.
