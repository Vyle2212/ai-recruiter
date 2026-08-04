-- STAGING AUTH HELPERS v3 - AUTHORITATIVE PENDING-MANUAL-REVIEW ARTIFACT
-- VERSIONED, ONE-SHOT, STAGING-ONLY, NOT RERUNNABLE, NOT EXECUTED. PRODUCTION BLOCKED.
-- Preflight requires current_user = postgres; functions are created and owned by postgres without ALTER OWNER.
-- SECURITY DEFINER owner postgres is chosen for controlled Supabase staging migration execution and BYPASSRLS lookup.
-- Fixed search_path is mandatory. No dynamic SQL, user-supplied role/ownership value, service-role key, or secret is used.
-- FORCE RLS behavior and recursion safety still require real controlled staging validation.

begin;

create function public.set_staging_auth_updated_at()
returns trigger language plpgsql security invoker set search_path = pg_catalog, public
as $function$
begin
  new.updated_at := statement_timestamp();
  return new;
end;
$function$;

create function public.current_user_profile_id()
returns uuid language sql stable security definer set search_path = pg_catalog, public
as $function$ select p.id from public.user_profiles p where p.auth_user_id = auth.uid() and p.status = 'active' limit 1 $function$;
create function public.current_user_role()
returns text language sql stable security definer set search_path = pg_catalog, public
as $function$ select p.role from public.user_profiles p where p.auth_user_id = auth.uid() and p.status = 'active' limit 1 $function$;
create function public.current_user_organization_id()
returns uuid language sql stable security definer set search_path = pg_catalog, public
as $function$ select p.organization_id from public.user_profiles p where p.auth_user_id = auth.uid() and p.status = 'active' limit 1 $function$;
create function public.current_user_client_id()
returns uuid language sql stable security definer set search_path = pg_catalog, public
as $function$ select p.client_id from public.user_profiles p where p.auth_user_id = auth.uid() and p.status = 'active' limit 1 $function$;
create function public.current_user_candidate_id()
returns uuid language sql stable security definer set search_path = pg_catalog, public
as $function$ select p.candidate_id from public.user_profiles p where p.auth_user_id = auth.uid() and p.status = 'active' limit 1 $function$;
create function public.current_user_is_admin()
returns boolean language sql stable security definer set search_path = pg_catalog, public
as $function$ select coalesce(public.current_user_role() = 'admin', false) $function$;

create function public.guard_user_profile_protected_columns()
returns trigger language plpgsql security definer set search_path = pg_catalog, public
as $function$
begin
  if public.current_user_profile_id() is null then
    raise exception using errcode = '42501', message = 'profile_update_denied';
  end if;
  if not public.current_user_is_admin() and (
    new.role is distinct from old.role or new.status is distinct from old.status or
    new.auth_user_id is distinct from old.auth_user_id or new.organization_id is distinct from old.organization_id or
    new.client_id is distinct from old.client_id or new.candidate_id is distinct from old.candidate_id or
    new.created_at is distinct from old.created_at
  ) then
    raise exception using errcode = '42501', message = 'protected_profile_change_denied';
  end if;
  return new;
end;
$function$;

create function public.reject_access_audit_log_mutation()
returns trigger language plpgsql security invoker set search_path = pg_catalog, public
as $function$
begin
  raise exception using errcode = '42501', message = 'audit_log_mutation_denied';
end;
$function$;

revoke all on function public.set_staging_auth_updated_at() from public;
revoke all on function public.guard_user_profile_protected_columns() from public;
revoke all on function public.reject_access_audit_log_mutation() from public;
revoke all on function public.current_user_profile_id() from public;
revoke all on function public.current_user_role() from public;
revoke all on function public.current_user_organization_id() from public;
revoke all on function public.current_user_client_id() from public;
revoke all on function public.current_user_candidate_id() from public;
revoke all on function public.current_user_is_admin() from public;
grant execute on function public.current_user_profile_id() to authenticated;
grant execute on function public.current_user_role() to authenticated;
grant execute on function public.current_user_organization_id() to authenticated;
grant execute on function public.current_user_client_id() to authenticated;
grant execute on function public.current_user_candidate_id() to authenticated;
grant execute on function public.current_user_is_admin() to authenticated;

create trigger organizations_set_updated_at before update on public.organizations for each row execute function public.set_staging_auth_updated_at();
create trigger user_profiles_set_updated_at before update on public.user_profiles for each row execute function public.set_staging_auth_updated_at();
create trigger user_profiles_guard_protected before update on public.user_profiles for each row execute function public.guard_user_profile_protected_columns();
create trigger user_invites_set_updated_at before update on public.user_invites for each row execute function public.set_staging_auth_updated_at();
create trigger client_memberships_set_updated_at before update on public.client_memberships for each row execute function public.set_staging_auth_updated_at();
create trigger candidate_accounts_set_updated_at before update on public.candidate_accounts for each row execute function public.set_staging_auth_updated_at();
create trigger access_audit_logs_reject_update before update on public.access_audit_logs for each row execute function public.reject_access_audit_log_mutation();
create trigger access_audit_logs_reject_delete before delete on public.access_audit_logs for each row execute function public.reject_access_audit_log_mutation();

commit;

-- REQUIRED STAGING VALIDATION - NOT EXECUTED:
-- unauthenticated, missing, invited, inactive, suspended, disabled, and every active application role;
-- function owner, grants, FORCE RLS direct-table behavior, policy recursion/stack behavior, and protected updates.
