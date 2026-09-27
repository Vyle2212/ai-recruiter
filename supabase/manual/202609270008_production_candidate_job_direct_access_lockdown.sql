-- PROPOSED, NOT APPLIED. Production auto-review rejected the live operation
-- pending explicit approval of its broad candidates/jobs access impact.
-- Production direct-API lockdown. Existing app API handlers access these
-- tables through the server-only service role; user access goes through
-- authenticated, scoped endpoints. This migration does not alter rows.
begin;

alter table public.candidates enable row level security;
alter table public.candidates force row level security;
alter table public.jobs enable row level security;
alter table public.jobs force row level security;

drop policy if exists "Allow read candidates" on public.candidates;

revoke all on table public.candidates, public.jobs
  from public, anon, authenticated;
grant select, insert, update, delete on table public.candidates, public.jobs
  to service_role;

commit;
