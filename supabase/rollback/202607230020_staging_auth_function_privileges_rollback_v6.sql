-- STAGING AUTH FUNCTION PRIVILEGES ROLLBACK v6 - REVIEW ONLY - NOT EXECUTED
-- SECURITY REGRESSION RISK - MANUAL APPROVAL REQUIRED.
-- This safe rollback intentionally does not restore the insecure observed grants.
-- It preserves all function definitions and triggers and leaves application roles denied.

begin;

revoke execute on function public.set_staging_auth_updated_at() from public;
revoke execute on function public.set_staging_auth_updated_at() from anon;
revoke execute on function public.set_staging_auth_updated_at() from authenticated;
revoke execute on function public.set_staging_auth_updated_at() from service_role;

revoke execute on function public.current_user_profile_id() from public;
revoke execute on function public.current_user_profile_id() from anon;
revoke execute on function public.current_user_profile_id() from authenticated;
revoke execute on function public.current_user_profile_id() from service_role;

revoke execute on function public.current_user_role() from public;
revoke execute on function public.current_user_role() from anon;
revoke execute on function public.current_user_role() from authenticated;
revoke execute on function public.current_user_role() from service_role;

revoke execute on function public.current_user_organization_id() from public;
revoke execute on function public.current_user_organization_id() from anon;
revoke execute on function public.current_user_organization_id() from authenticated;
revoke execute on function public.current_user_organization_id() from service_role;

revoke execute on function public.current_user_client_id() from public;
revoke execute on function public.current_user_client_id() from anon;
revoke execute on function public.current_user_client_id() from authenticated;
revoke execute on function public.current_user_client_id() from service_role;

revoke execute on function public.current_user_candidate_id() from public;
revoke execute on function public.current_user_candidate_id() from anon;
revoke execute on function public.current_user_candidate_id() from authenticated;
revoke execute on function public.current_user_candidate_id() from service_role;

revoke execute on function public.current_user_is_admin() from public;
revoke execute on function public.current_user_is_admin() from anon;
revoke execute on function public.current_user_is_admin() from authenticated;
revoke execute on function public.current_user_is_admin() from service_role;

revoke execute on function public.guard_user_profile_protected_columns() from public;
revoke execute on function public.guard_user_profile_protected_columns() from anon;
revoke execute on function public.guard_user_profile_protected_columns() from authenticated;
revoke execute on function public.guard_user_profile_protected_columns() from service_role;

revoke execute on function public.reject_access_audit_log_mutation() from public;
revoke execute on function public.reject_access_audit_log_mutation() from anon;
revoke execute on function public.reject_access_audit_log_mutation() from authenticated;
revoke execute on function public.reject_access_audit_log_mutation() from service_role;

commit;
