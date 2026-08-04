-- STAGING AUTH SCHEMA ROLLBACK v2 - REVIEW ONLY - NOT EXECUTED
-- VERSIONED, PHASE-SPECIFIC, STAGING-ONLY, DESTRUCTIVE. BACKUP AND EXPLICIT MANUAL APPROVAL REQUIRED.
-- Use only after RLS and helper rollback phases where those phases were started.
begin;

drop table if exists public.access_audit_logs;
drop table if exists public.candidate_accounts;
drop table if exists public.client_memberships;
drop table if exists public.user_invites;
drop table if exists public.user_profiles;
drop table if exists public.organizations;

commit;
-- Reverse dependency order only. pgcrypto is retained. Candidate-domain tables, jobs, submissions, packs,
-- reports, Auth users, and production objects are never modified or dropped.