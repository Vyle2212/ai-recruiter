-- Additive production client membership foundation. No user, client,
-- candidate, job, entitlement or membership row is created by this file.
begin;

do $preflight$
begin
  if to_regclass('public.user_profiles') is null
     or to_regclass('public.organizations') is null then
    raise exception 'production_client_membership_auth_dependencies_missing';
  end if;
end
$preflight$;

create table if not exists public.client_memberships (
  id uuid primary key default gen_random_uuid(),
  user_profile_id uuid not null references public.user_profiles(id) on delete restrict,
  organization_id uuid not null references public.organizations(id) on delete restrict,
  client_id uuid not null,
  status text not null default 'inactive'
    check (status in ('active','inactive','suspended','disabled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_profile_id, organization_id, client_id)
);
create index if not exists client_memberships_active_profile_client_idx
  on public.client_memberships (user_profile_id, client_id)
  where status = 'active';

alter table public.client_memberships enable row level security;
alter table public.client_memberships force row level security;
revoke all on table public.client_memberships from public, anon, authenticated;
grant select, insert, update, delete on table public.client_memberships to service_role;

commit;
