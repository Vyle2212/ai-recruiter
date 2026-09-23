# Executable database cutover readback — 2026-09-23

## Gap closed

The v108 cutover transaction covered the known private database surface, but its
post-cutover evidence consisted of sample queries for only a subset of objects.
A successful SQL commit could therefore be mistaken for a successful security
cutover without proving every grant, policy and object option.

## GitHub artifact

A separate read-only verification artifact now fails closed across the complete
surface after the manual cutover:

- all 25 tables must exist, have both enabled and forced RLS, have no remaining
  policies, deny SELECT/INSERT/UPDATE/DELETE to anon and authenticated, and
  grant those operations to service_role;
- both audit views must exist as security-invoker views, deny direct anon and
  authenticated selection, and remain selectable by service_role;
- all six exact RPC signatures must keep a pinned
  `search_path=pg_catalog, public`, remain security-invoker functions, deny
  anon and authenticated execution, and allow service_role execution.

The readback script contains no DDL or DML. Static regression coverage requires
all objects and all fail-closed assertions, and also rejects mutating statements
from the readback artifact.

## Release status

This batch does not execute the cutover or readback against production and does
not change the 737/970-source, 2,160-row projection. Production remains
**NO_GO** pending exact-head authenticated acceptance, a version-matched backup
and rollback checkpoint, controlled cutover plus a passing executable readback
and advisor rerun, reviewed backfill, live OCR provenance and exact-artifact
promotion.
