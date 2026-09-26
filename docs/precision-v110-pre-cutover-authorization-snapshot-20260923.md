# Pre-cutover authorization snapshot — 2026-09-23

## Gap closed

The v109 readback fails closed after the private-data authorization cutover,
but the runbook did not provide an executable way to preserve the exact access
state that the cutover removes. Retaining only screenshots or sample queries
would make rollback review incomplete if production differs from assumptions.

## GitHub artifact

`supabase/manual/202609230000_production_private_data_rls_snapshot.sql` is a
read-only, fail-closed pre-cutover artifact. It verifies that the expected 25
tables, two audit views, six exact RPC signatures and three database roles
exist, then emits one JSON document containing:

- table owners, RLS flags, raw ACLs and effective privileges for anon,
  authenticated and service_role;
- every policy's roles, command, USING expression and WITH CHECK expression;
- view owners, options, raw ACLs and effective SELECT privileges;
- function owners, security mode, configuration, raw ACLs and effective
  EXECUTE privileges.

The cutover header now requires operators to retain this JSON before execution.
The regression rejects state-changing statements in the snapshot and verifies
that the cutover points to it.

## Release status

The snapshot captures authorization metadata only. It does not contain
candidate records, execute against production, generate an automatic rollback,
or replace a verified version-matched data backup/restore point. The private
970-source projection remains 737 sources / 2,160 employment rows, with 233
sources in review queues.

Production remains **NO_GO** pending exact-head authenticated acceptance, a
verified backup and retained snapshot output, controlled cutover plus passing
readback and advisor rerun, reviewed backfill, live OCR provenance and
exact-artifact promotion.
