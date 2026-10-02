-- Search V2 shortlist, scoped to an authenticated recruiter and an optional job.
-- Candidate and job IDs are verified by the API before insertion. They are not
-- foreign keys here because acceptance does not contain the source domain tables.
begin;

create table if not exists public.recruiter_search_shortlist_items (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  owner_profile_id uuid not null references public.user_profiles(id) on delete cascade,
  scope_key text not null,
  job_id uuid,
  candidate_id uuid not null,
  created_at timestamptz not null default now(),
  unique (owner_profile_id, scope_key, candidate_id),
  check ((scope_key = 'general' and job_id is null) or
         (scope_key = 'job:' || job_id::text and job_id is not null))
);
create index if not exists recruiter_search_shortlist_scope_order_idx
  on public.recruiter_search_shortlist_items
  (owner_profile_id, scope_key, created_at desc, id desc);

alter table public.recruiter_search_shortlist_items enable row level security;
alter table public.recruiter_search_shortlist_items force row level security;
revoke all on public.recruiter_search_shortlist_items from public, anon, authenticated;
grant select, insert, delete on public.recruiter_search_shortlist_items to service_role;

commit;
