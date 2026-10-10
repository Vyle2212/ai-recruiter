-- Acceptance only: remove approval/request audit owned entirely by one
-- synthetic run. This is intentionally separate from production migrations.
begin;
do $$
begin
  if not exists (select 1 from public.acceptance_environment_markers
    where singleton and project_ref = 'iujucosewivndjpcjbuz'
      and classification = 'acceptance' and acceptance_enabled
      and harness_version = 'production-trust-authenticated-acceptance-v2') then
    raise exception 'acceptance_original_cv_approval_cleanup_environment_blocked';
  end if;
end $$;

create function public.acceptance_original_cv_approval_cleanup_allowed(
  p_candidate_id uuid,
  p_recruiter_profile_id uuid,
  p_actor_profile_id uuid,
  p_client_id uuid
) returns boolean language sql stable security invoker set search_path = '' as $$
  select current_setting('app.acceptance_cv_approval_cleanup_run', true)
      ~ '^ptf1c2-[a-zA-Z0-9._-]+$'
    and exists (select 1 from public.acceptance_environment_markers marker
      where marker.singleton and marker.project_ref = 'iujucosewivndjpcjbuz'
        and marker.classification = 'acceptance' and marker.acceptance_enabled
        and marker.harness_version = 'production-trust-authenticated-acceptance-v2')
    and exists (select 1 from public.acceptance_test_runs run
      where run.run_id = current_setting('app.acceptance_cv_approval_cleanup_run', true)
        and run.synthetic_namespace = 'ptf1c2/' || run.run_id
        and run.status in ('provisioning','ready','running','failed'))
    and exists (select 1 from public.acceptance_synthetic_candidates fixture
      join public.acceptance_environment_markers marker on marker.singleton
      where fixture.owner_run_id = current_setting('app.acceptance_cv_approval_cleanup_run', true)
        and fixture.candidate_id = p_candidate_id and fixture.active
        and fixture.synthetic_namespace = 'ptf1c2/' || fixture.owner_run_id
        and fixture.project_ref = marker.project_ref
        and fixture.environment_id = marker.environment_id)
    and exists (select 1 from public.acceptance_test_entities entity
      where entity.run_id = current_setting('app.acceptance_cv_approval_cleanup_run', true)
        and entity.entity_type = 'user_profile'
        and entity.entity_id = p_recruiter_profile_id::text)
    and exists (select 1 from public.acceptance_test_entities entity
      where entity.run_id = current_setting('app.acceptance_cv_approval_cleanup_run', true)
        and entity.entity_type = 'user_profile'
        and entity.entity_id = p_actor_profile_id::text)
    and (p_client_id is null or exists (
      select 1 from public.acceptance_test_entities entity
      join public.user_profiles profile on profile.id::text = entity.entity_id
      where entity.run_id = current_setting('app.acceptance_cv_approval_cleanup_run', true)
        and entity.entity_type = 'user_profile'
        and profile.role = 'client' and profile.client_id = p_client_id));
$$;
revoke all on function public.acceptance_original_cv_approval_cleanup_allowed(uuid,uuid,uuid,uuid)
  from public, anon, authenticated;
grant execute on function public.acceptance_original_cv_approval_cleanup_allowed(uuid,uuid,uuid,uuid)
  to service_role;

create or replace function public.reject_recruiter_original_cv_grant_event_change()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  if tg_op = 'DELETE' and public.acceptance_original_cv_approval_cleanup_allowed(
    old.candidate_id, old.recruiter_profile_id, old.actor_profile_id, old.client_id
  ) then
    return old;
  end if;
  raise exception 'Original CV approval audit is append-only';
end $$;

create function public.cleanup_acceptance_original_cv_approval_run(p_run_id text)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  v_actor_ids uuid[];
  v_candidate_ids uuid[];
  v_requests integer;
  v_events integer;
  v_grants integer;
begin
  if p_run_id is null or p_run_id !~ '^ptf1c2-[a-zA-Z0-9._-]+$' then
    raise exception 'acceptance_original_cv_approval_cleanup_run_invalid';
  end if;
  if not exists (select 1 from public.acceptance_environment_markers
    where singleton and project_ref = 'iujucosewivndjpcjbuz'
      and classification = 'acceptance' and acceptance_enabled
      and harness_version = 'production-trust-authenticated-acceptance-v2') then
    raise exception 'acceptance_original_cv_approval_cleanup_environment_blocked';
  end if;
  perform 1 from public.acceptance_test_runs where run_id = p_run_id
    and synthetic_namespace = 'ptf1c2/' || p_run_id
    and status in ('provisioning','ready','running','failed') for update;
  if not found then
    raise exception 'acceptance_original_cv_approval_cleanup_run_not_active';
  end if;
  select array_agg(entity_id::uuid) into v_actor_ids
    from public.acceptance_test_entities
    where run_id = p_run_id and entity_type = 'user_profile';
  select array_agg(candidate_id) into v_candidate_ids
    from public.acceptance_synthetic_candidates
    where owner_run_id = p_run_id and active
      and synthetic_namespace = 'ptf1c2/' || owner_run_id;
  if coalesce(array_length(v_actor_ids,1),0) = 0
     or coalesce(array_length(v_candidate_ids,1),0) <> 1 then
    raise exception 'acceptance_original_cv_approval_cleanup_fixture_scope_missing';
  end if;
  perform set_config('app.acceptance_cv_approval_cleanup_run',p_run_id,true);

  -- Abort the entire transaction if any row touching this run crosses into a
  -- non-owned candidate, actor or client scope.
  if exists (select 1 from public.recruiter_original_cv_requests request
      where (request.candidate_id = any(v_candidate_ids)
        or request.recruiter_profile_id = any(v_actor_ids)
        or request.resolved_by_profile_id = any(v_actor_ids))
        and not public.acceptance_original_cv_approval_cleanup_allowed(
          request.candidate_id, request.recruiter_profile_id,
          coalesce(request.resolved_by_profile_id, request.recruiter_profile_id),
          request.client_id))
    or exists (select 1 from public.recruiter_original_cv_grants grant_row
      where (grant_row.candidate_id = any(v_candidate_ids)
        or grant_row.recruiter_profile_id = any(v_actor_ids)
        or grant_row.approved_by_profile_id = any(v_actor_ids)
        or grant_row.updated_by_profile_id = any(v_actor_ids))
        and (not public.acceptance_original_cv_approval_cleanup_allowed(
          grant_row.candidate_id, grant_row.recruiter_profile_id,
          grant_row.approved_by_profile_id, grant_row.client_id)
        or not public.acceptance_original_cv_approval_cleanup_allowed(
          grant_row.candidate_id, grant_row.recruiter_profile_id,
          grant_row.updated_by_profile_id, grant_row.client_id)))
    or exists (select 1 from public.recruiter_original_cv_grant_events event
      where (event.candidate_id = any(v_candidate_ids)
        or event.recruiter_profile_id = any(v_actor_ids)
        or event.actor_profile_id = any(v_actor_ids))
        and not public.acceptance_original_cv_approval_cleanup_allowed(
          event.candidate_id, event.recruiter_profile_id,
          event.actor_profile_id, event.client_id)) then
    raise exception 'acceptance_original_cv_approval_cleanup_external_reference_detected';
  end if;
  if exists (select 1 from public.recruiter_original_cv_access_events access
    join public.recruiter_original_cv_grants grant_row on grant_row.id = access.grant_id
    where grant_row.candidate_id = any(v_candidate_ids)
      or grant_row.recruiter_profile_id = any(v_actor_ids)) then
    raise exception 'acceptance_original_cv_approval_cleanup_access_audit_present';
  end if;

  delete from public.recruiter_original_cv_requests request
    where request.candidate_id = any(v_candidate_ids)
      and public.acceptance_original_cv_approval_cleanup_allowed(
        request.candidate_id, request.recruiter_profile_id,
        coalesce(request.resolved_by_profile_id, request.recruiter_profile_id),
        request.client_id);
  get diagnostics v_requests = row_count;
  delete from public.recruiter_original_cv_grant_events event
    where event.candidate_id = any(v_candidate_ids)
      and public.acceptance_original_cv_approval_cleanup_allowed(
        event.candidate_id, event.recruiter_profile_id,
        event.actor_profile_id, event.client_id);
  get diagnostics v_events = row_count;
  delete from public.recruiter_original_cv_grants grant_row
    where grant_row.candidate_id = any(v_candidate_ids)
      and public.acceptance_original_cv_approval_cleanup_allowed(
        grant_row.candidate_id, grant_row.recruiter_profile_id,
        grant_row.updated_by_profile_id, grant_row.client_id);
  get diagnostics v_grants = row_count;

  if exists (select 1 from public.recruiter_original_cv_requests
      where candidate_id = any(v_candidate_ids) or recruiter_profile_id = any(v_actor_ids))
    or exists (select 1 from public.recruiter_original_cv_grants
      where candidate_id = any(v_candidate_ids) or recruiter_profile_id = any(v_actor_ids))
    or exists (select 1 from public.recruiter_original_cv_grant_events
      where candidate_id = any(v_candidate_ids) or recruiter_profile_id = any(v_actor_ids)
        or actor_profile_id = any(v_actor_ids)) then
    raise exception 'acceptance_original_cv_approval_cleanup_residue_detected';
  end if;
  perform set_config('app.acceptance_cv_approval_cleanup_run','',true);
  return jsonb_build_object(
    'deletedRequests',v_requests,'deletedGrantEvents',v_events,
    'deletedGrants',v_grants,'remainingApprovalRows',0);
end $$;
revoke all on function public.cleanup_acceptance_original_cv_approval_run(text)
  from public, anon, authenticated;
grant execute on function public.cleanup_acceptance_original_cv_approval_run(text)
  to service_role;
grant delete on public.recruiter_original_cv_requests,
  public.recruiter_original_cv_grant_events,
  public.recruiter_original_cv_grants to service_role;
commit;
