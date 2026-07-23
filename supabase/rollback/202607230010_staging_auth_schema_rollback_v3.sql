-- STAGING AUTH SCHEMA ROLLBACK v3 - REVIEW ONLY - NOT EXECUTED
-- STAGING ONLY. DESTRUCTIVE. Run last in reverse phase order. Backup and explicit human approval required.
begin;
drop table if exists public.access_audit_logs;
drop table if exists public.candidate_accounts;
drop table if exists public.client_memberships;
drop table if exists public.user_invites;
drop table if exists public.user_profiles;
drop table if exists public.organizations;
commit;
-- Candidate-domain tables, jobs, submissions, packs, reports, Auth users, and production objects are untouched.
