-- Acceptance only: remove access audit rows owned entirely by one synthetic run.
-- Approval/grant cleanup is deliberately not included in this RPC.
begin;
do $$
begin
  if not exists (select 1 from public.acceptance_environment_markers
    where singleton and project_ref = 'iujucosewivndjpcjbuz'
      and classification = 'acceptance' and acceptance_enabled
      and harness_version = 'production-trust-authenticated-acceptance-v2') then
    raise exception 'acceptance_original_cv_cleanup_environment_blocked';
  end if;
end $$;

create function public.acceptance_original_cv_cleanup_allowed(p_candidate_id uuid, p_actor_id uuid)
returns boolean language sql stable security invoker set search_path = '' as $$
  select current_setting('app.acceptance_cv_cleanup_run', true) ~ '^ptf1c2-[a-zA-Z0-9._-]+$'
    and exists (select 1 from public.acceptance_environment_markers marker
      where marker.singleton and marker.project_ref = 'iujucosewivndjpcjbuz'
        and marker.classification = 'acceptance' and marker.acceptance_enabled
        and marker.harness_version = 'production-trust-authenticated-acceptance-v2')
    and exists (select 1 from public.acceptance_test_runs run
      where run.run_id = current_setting('app.acceptance_cv_cleanup_run', true)
        and run.synthetic_namespace = 'ptf1c2/' || run.run_id
        and run.status in ('provisioning','ready','running','failed'))
    and exists (select 1 from public.acceptance_test_entities entity
      where entity.run_id = current_setting('app.acceptance_cv_cleanup_run', true)
        and entity.entity_type = 'user_profile' and entity.entity_id = p_actor_id::text)
    and exists (select 1 from public.acceptance_synthetic_candidates fixture
      join public.acceptance_environment_markers marker on marker.singleton
      where fixture.owner_run_id = current_setting('app.acceptance_cv_cleanup_run', true)
        and fixture.candidate_id = p_candidate_id and fixture.active
        and fixture.synthetic_namespace = 'ptf1c2/' || fixture.owner_run_id
        and fixture.project_ref = marker.project_ref
        and fixture.environment_id = marker.environment_id);
$$;
revoke all on function public.acceptance_original_cv_cleanup_allowed(uuid,uuid) from public, anon, authenticated;
grant execute on function public.acceptance_original_cv_cleanup_allowed(uuid,uuid) to service_role;

create or replace function public.reject_recruiter_original_cv_access_event_change()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  if tg_op = 'DELETE' and public.acceptance_original_cv_cleanup_allowed(old.candidate_id,old.actor_profile_id) then
    return old;
  end if;
  raise exception 'Original CV access audit is append-only';
end $$;

create function public.cleanup_acceptance_original_cv_run(p_run_id text)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  v_actor_ids uuid[];
  v_deleted integer;
begin
  if p_run_id is null or p_run_id !~ '^ptf1c2-[a-zA-Z0-9._-]+$' then
    raise exception 'acceptance_original_cv_cleanup_run_invalid';
  end if;
  if not exists (select 1 from public.acceptance_environment_markers
    where singleton and project_ref = 'iujucosewivndjpcjbuz'
      and classification = 'acceptance' and acceptance_enabled
      and harness_version = 'production-trust-authenticated-acceptance-v2') then
    raise exception 'acceptance_original_cv_cleanup_environment_blocked';
  end if;
  perform 1 from public.acceptance_test_runs where run_id = p_run_id
    and synthetic_namespace = 'ptf1c2/' || p_run_id
    and status in ('provisioning','ready','running','failed') for update;
  if not found then raise exception 'acceptance_original_cv_cleanup_run_not_active'; end if;
  select array_agg(entity_id::uuid) into v_actor_ids
    from public.acceptance_test_entities where run_id = p_run_id and entity_type = 'user_profile';
  if coalesce(array_length(v_actor_ids,1),0) = 0 then
    raise exception 'acceptance_original_cv_cleanup_fixture_scope_missing';
  end if;
  perform set_config('app.acceptance_cv_cleanup_run',p_run_id,true);
  -- Any audit referencing this run's profiles must also reference this run's
  -- exact active candidate lease. Abort the whole transaction on a mixed row.
  if exists (select 1 from public.recruiter_original_cv_access_events audit
    where (audit.actor_profile_id = any(v_actor_ids)
      or audit.candidate_id in (select candidate_id from public.acceptance_synthetic_candidates
        where owner_run_id = p_run_id and active))
      and not public.acceptance_original_cv_cleanup_allowed(audit.candidate_id,audit.actor_profile_id)) then
    raise exception 'acceptance_original_cv_cleanup_external_reference_detected';
  end if;
  delete from public.recruiter_original_cv_access_events
    where actor_profile_id = any(v_actor_ids)
      and public.acceptance_original_cv_cleanup_allowed(candidate_id,actor_profile_id);
  get diagnostics v_deleted = row_count;
  if exists (select 1 from public.recruiter_original_cv_access_events where actor_profile_id = any(v_actor_ids)) then
    raise exception 'acceptance_original_cv_cleanup_residue_detected';
  end if;
  perform set_config('app.acceptance_cv_cleanup_run','',true);
  return jsonb_build_object('deletedAccessEvents',v_deleted,'remainingAccessEvents',0);
end $$;
revoke all on function public.cleanup_acceptance_original_cv_run(text) from public, anon, authenticated;
grant execute on function public.cleanup_acceptance_original_cv_run(text) to service_role;
-- The immutable trigger still rejects non-fixture DELETE and all UPDATE.
grant delete on public.recruiter_original_cv_access_events to service_role;
commit;
