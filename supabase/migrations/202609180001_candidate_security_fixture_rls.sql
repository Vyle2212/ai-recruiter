-- STAGING-ONLY synthetic fixture for candidate-data RLS validation.
-- No production CVs or production candidate tables are created, copied, or changed.

begin;

create table public.candidate_security_fixture (
  id uuid primary key,
  display_name text not null check (btrim(display_name) <> ''),
  current_title text,
  current_company text,
  private_resume_text text not null check (btrim(private_resume_text) <> ''),
  created_at timestamptz not null default now()
);

comment on table public.candidate_security_fixture is
  'Synthetic-only staging RLS fixture. Production candidate data remains server-only.';

alter table public.candidate_security_fixture enable row level security;
alter table public.candidate_security_fixture force row level security;

revoke all on table public.candidate_security_fixture from public, anon, authenticated;

-- The only browser-side path allowed by this fixture is a signed-in candidate
-- reading the one synthetic record mapped to their candidate account. Recruiter
-- access stays server-side through a service-role client after API authorization.
grant select on table public.candidate_security_fixture to authenticated;

create policy candidate_security_fixture_candidate_reads_own_record
on public.candidate_security_fixture
for select
to authenticated
using (
  public.current_user_role() = 'candidate'
  and id = public.current_user_candidate_id()
);

commit;
