-- STAGING AUTH SCHEMA ROLLBACK v4 - REVIEW ONLY - NOT EXECUTED
-- STAGING ONLY. DESTRUCTIVE. Run last. Backup and explicit human approval required. PRODUCTION BLOCKED.
begin;
drop table if exists public.staging_auth_bootstrap_provenance;
drop table if exists public.access_audit_logs;
drop table if exists public.candidate_accounts;
drop table if exists public.client_memberships;
drop table if exists public.user_invites;
drop table if exists public.user_profiles;
drop table if exists public.organizations;
commit;
-- Auth users, domain candidates, jobs, submissions, packs, reports, and production objects are untouched.
