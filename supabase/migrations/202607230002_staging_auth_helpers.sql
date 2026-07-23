-- STAGING AUTH HELPERS v1 � AUTHORITATIVE REVIEW ARTIFACT
-- REVIEW ONLY. NOT EXECUTED. STAGING TARGET ONLY. PRODUCTION BLOCKED.
-- SECURITY DEFINER is deliberate: policy helpers must read the active profile without recursive user_profiles RLS.
-- Functions use a fixed search_path, schema-qualified objects, no dynamic SQL, and minimum authenticated EXECUTE grants.

create or replace function public.set_staging_auth_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
begin
  new.updated_at := statement_timestamp();
  return new;
end;
$$;

create or replace function public.current_user_profile_id()
returns uuid
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select p.id from public.user_profiles p
  where p.auth_user_id = auth.uid() and p.status = 'active'
  limit 1
$$;

create or replace function public.current_user_role()
returns text
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select p.role from public.user_profiles p
  where p.auth_user_id = auth.uid() and p.status = 'active'
  limit 1
$$;

create or replace function public.current_user_organization_id()
returns uuid
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select p.organization_id from public.user_profiles p
  where p.auth_user_id = auth.uid() and p.status = 'active'
  limit 1
$$;

create or replace function public.current_user_client_id()
returns uuid
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select p.client_id from public.user_profiles p
  where p.auth_user_id = auth.uid() and p.status = 'active'
  limit 1
$$;

create or replace function public.current_user_candidate_id()
returns uuid
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select p.candidate_id from public.user_profiles p
  where p.auth_user_id = auth.uid() and p.status = 'active'
  limit 1
$$;

create or replace function public.current_user_is_admin()
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select coalesce(public.current_user_role() = 'admin', false)
$$;

create or replace function public.guard_user_profile_protected_columns()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
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
$$;

revoke all on function public.set_staging_auth_updated_at() from public;
revoke all on function public.guard_user_profile_protected_columns() from public;
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
