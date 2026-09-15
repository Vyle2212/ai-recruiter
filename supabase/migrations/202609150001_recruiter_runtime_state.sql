-- Durable app metadata. Candidate source records are never written here.
begin;
create table public.recruiter_runtime_state (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  owner_key text not null,
  owner_profile_id uuid references public.user_profiles(id) on delete cascade,
  kind text not null check (kind in ('copilot_history', 'automation_decisions', 'automation_rules')),
  revision bigint not null default 1 check (revision > 0),
  payload jsonb not null check (jsonb_typeof(payload) = 'object'),
  updated_at timestamptz not null default now(),
  primary key (organization_id, owner_key, kind),
  check ((kind = 'copilot_history' and owner_profile_id is not null and owner_key = owner_profile_id::text)
    or (kind <> 'copilot_history' and owner_profile_id is null and owner_key = 'organization'))
);
alter table public.recruiter_runtime_state enable row level security;
alter table public.recruiter_runtime_state force row level security;
-- Only server-side code with a freshly authorized organization/profile scope accesses this table.
revoke all on public.recruiter_runtime_state from public, anon, authenticated;
grant select, insert, update, delete on public.recruiter_runtime_state to service_role;
commit;
