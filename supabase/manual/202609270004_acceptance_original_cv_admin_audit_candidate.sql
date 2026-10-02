-- ACCEPTANCE ONLY: bring the installed audit trigger in line with the reviewed
-- source migration. Keep admin access independent of lifecycle status.
begin;

do $preflight$
begin
  if to_regclass('public.candidates') is null
     or to_regclass('public.recruiter_original_cv_access_events') is null
     or not exists (
       select 1 from pg_trigger t
       where t.tgname = 'recruiter_original_cv_access_event_validate'
         and t.tgfoid = to_regprocedure('public.validate_recruiter_original_cv_access_event()')
         and not t.tgisinternal
     ) then
    raise exception 'acceptance_original_cv_admin_audit_preflight_failed';
  end if;
end
$preflight$;

create or replace function public.validate_recruiter_original_cv_access_event()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  if new.actor_role = 'admin' then
    if not exists (
      select 1 from public.user_profiles p
      where p.id = new.actor_profile_id and p.role = 'admin' and p.status = 'active'
    ) then
      raise exception 'Active admin required for original CV access';
    end if;
    if not exists (
      select 1 from public.candidates c
      where c.id = new.candidate_id
      for share of c
    ) then
      raise exception 'Current candidate required for original CV access';
    end if;
    return new;
  end if;

  if not exists (
    select 1
    from public.recruiter_original_cv_grants g
    join public.user_profiles p on p.id = g.recruiter_profile_id
    where g.id = new.grant_id
      and g.candidate_id = new.candidate_id
      and g.recruiter_profile_id = new.actor_profile_id
      and p.role = new.actor_role and p.status = 'active'
      and g.status = 'active' and g.revoked_at is null
      and g.approved_at <= clock_timestamp()
      and g.expires_at > clock_timestamp()
      and g.purpose = new.purpose
      and g.client_id is not distinct from new.client_id
      -- The API checks lifecycle before reading Storage, but the candidate can
      -- be hidden or archived while that read is in flight. Recheck it in the
      -- same database statement that appends the audit event so a stale grant
      -- cannot authorize delivery after a terminal lifecycle transition.
      and exists (
        select 1 from public.candidates c
        where c.id = g.candidate_id
          and lower(btrim(coalesce(c.status, ''))) not in (
            'deleted', 'non_sap', 'rejected_noise', 'hidden', 'archived'
          )
        for share of c
      )
      and (
        g.purpose = 'headhunting'
        or (
          g.purpose = 'client_support'
          and exists (
            select 1 from public.client_recruiter_assignments a
            where a.client_id = g.client_id
              and a.recruiter_profile_id = g.recruiter_profile_id
              and a.status = 'active'
          )
          and exists (
            select 1 from public.client_candidate_shares s
            where s.client_id = g.client_id
              and s.recruiter_profile_id = g.recruiter_profile_id
              and s.candidate_id = g.candidate_id
              and s.status = 'active'
          )
          and exists (
            select 1 from public.client_candidate_access a
            where a.client_id = g.client_id
              and a.candidate_id = g.candidate_id
              and a.status = 'active'
          )
          and exists (
            select 1 from public.client_feature_entitlements e
            where e.client_id = g.client_id
              and e.feature = 'recruiter_support'
              and e.status = 'active'
              and e.valid_from <= clock_timestamp()
              and (e.valid_until is null or e.valid_until > clock_timestamp())
          )
        )
      )
  ) then
    raise exception 'Current original CV entitlement required';
  end if;
  return new;
end;
$$;

do $postcondition$
begin
  if position(
    'Current candidate required for original CV access'
    in pg_get_functiondef('public.validate_recruiter_original_cv_access_event()'::regprocedure)
  ) = 0
     or not exists (
       select 1 from pg_proc p
       where p.oid = 'public.validate_recruiter_original_cv_access_event()'::regprocedure
         and not p.prosecdef and p.proconfig = array['search_path=""']
         and not has_function_privilege('anon', p.oid, 'EXECUTE')
         and not has_function_privilege('authenticated', p.oid, 'EXECUTE')
     ) then
    raise exception 'acceptance_original_cv_admin_audit_postcondition_failed';
  end if;
end
$postcondition$;

commit;
