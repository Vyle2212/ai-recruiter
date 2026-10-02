-- Recruiter work shared by clients. Apply only after the entitlement schema,
-- candidates and jobs exist in the target project.
begin;

create index if not exists client_candidate_shares_recruiter_recent_idx
  on public.client_candidate_shares (recruiter_profile_id, created_at desc, id desc)
  where status = 'active';
create index if not exists client_job_shares_recruiter_recent_idx
  on public.client_job_shares (recruiter_profile_id, created_at desc, id desc)
  where status = 'active';

create or replace function public.recruiter_shared_candidates(
  p_recruiter_profile_id uuid, p_before timestamptz default null,
  p_before_id uuid default null, p_limit integer default 20
)
returns table (share_id uuid, client_id uuid, candidate_id uuid,
  candidate_name text, current_title text, shared_at timestamptz)
language sql stable set search_path = '' as $function$
  select s.id, s.client_id, c.id, c.name::text, c.current_title::text, s.created_at
  from public.client_candidate_shares s
  join public.client_recruiter_assignments a on a.client_id = s.client_id
    and a.recruiter_profile_id = s.recruiter_profile_id and a.status = 'active'
  join public.client_candidate_access x on x.client_id = s.client_id
    and x.candidate_id = s.candidate_id and x.status = 'active'
  join public.client_feature_entitlements e on e.client_id = s.client_id
    and e.feature = 'recruiter_support' and e.status = 'active'
    and e.valid_from <= now() and (e.valid_until is null or e.valid_until > now())
  join public.candidates c on c.id = s.candidate_id
  where s.recruiter_profile_id = p_recruiter_profile_id and s.status = 'active'
    and (p_before is null or (s.created_at, s.id) < (p_before, p_before_id))
  order by s.created_at desc, s.id desc
  limit least(greatest(coalesce(p_limit, 20), 1), 21)
$function$;

create or replace function public.recruiter_shared_jobs(
  p_recruiter_profile_id uuid, p_before timestamptz default null,
  p_before_id uuid default null, p_limit integer default 20
)
returns table (share_id uuid, client_id uuid, job_id uuid,
  job_title text, company text, shared_at timestamptz)
language sql stable set search_path = '' as $function$
  select s.id, s.client_id, j.id, j.title::text, j.company::text, s.created_at
  from public.client_job_shares s
  join public.client_recruiter_assignments a on a.client_id = s.client_id
    and a.recruiter_profile_id = s.recruiter_profile_id and a.status = 'active'
  join public.client_job_ownership x on x.client_id = s.client_id
    and x.job_id = s.job_id and x.status = 'active'
  join public.client_feature_entitlements e on e.client_id = s.client_id
    and e.feature = 'recruiter_support' and e.status = 'active'
    and e.valid_from <= now() and (e.valid_until is null or e.valid_until > now())
  join public.jobs j on j.id = s.job_id
  where s.recruiter_profile_id = p_recruiter_profile_id and s.status = 'active'
    and (p_before is null or (s.created_at, s.id) < (p_before, p_before_id))
  order by s.created_at desc, s.id desc
  limit least(greatest(coalesce(p_limit, 20), 1), 21)
$function$;

revoke all on function public.recruiter_shared_candidates(uuid,timestamptz,uuid,integer),
  public.recruiter_shared_jobs(uuid,timestamptz,uuid,integer)
  from public, anon, authenticated;
grant execute on function public.recruiter_shared_candidates(uuid,timestamptz,uuid,integer),
  public.recruiter_shared_jobs(uuid,timestamptz,uuid,integer)
  to service_role;

commit;
