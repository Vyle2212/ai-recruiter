-- ACCEPTANCE ONLY. Synthetic data lives only inside this transaction.
-- This verifies the trigger, then rolls back every candidate/grant/audit row.
-- The synthetic grant bypasses the request/approval route; this probe does not
-- validate admin authentication, Storage download, or browser API behavior.
begin;

do $probe$
declare
  v_recruiter uuid;
  v_candidate uuid;
  v_grant uuid;
  v_client uuid := gen_random_uuid();
  v_support_candidate uuid;
  v_support_grant uuid;
  v_denied boolean := false;
begin
  if (select count(*) from public.user_profiles
      where role = 'recruiter' and status = 'active') <> 1 then
    raise exception 'acceptance_recruiter_fixture_contract_changed';
  end if;
  select id into v_recruiter from public.user_profiles
    where role = 'recruiter' and status = 'active';

  insert into public.candidates (name, status)
    values ('Synthetic audit transaction probe', 'needs_review')
    returning id into v_candidate;
  insert into public.recruiter_original_cv_grants (
    candidate_id, recruiter_profile_id, approved_by_profile_id,
    updated_by_profile_id, purpose, expires_at
  ) values (
    v_candidate, v_recruiter, v_recruiter,
    v_recruiter, 'headhunting', now() + interval '1 hour'
  ) returning id into v_grant;

  insert into public.recruiter_original_cv_access_events (
    candidate_id, actor_profile_id, actor_role, grant_id, purpose
  ) values (v_candidate, v_recruiter, 'recruiter', v_grant, 'headhunting');

  update public.candidates set status = 'hidden' where id = v_candidate;
  begin
    insert into public.recruiter_original_cv_access_events (
      candidate_id, actor_profile_id, actor_role, grant_id, purpose
    ) values (v_candidate, v_recruiter, 'recruiter', v_grant, 'headhunting');
  exception when others then
    if sqlerrm <> 'Current original CV entitlement required' then
      raise;
    end if;
    v_denied := true;
  end;
  if not v_denied then
    raise exception 'hidden_candidate_audit_was_not_denied';
  end if;
  if (select count(*) from public.recruiter_original_cv_access_events
      where candidate_id = v_candidate) <> 1 then
    raise exception 'audit_event_count_mismatch';
  end if;

  insert into public.candidates (name, status)
    values ('Synthetic client support transaction probe', 'needs_review')
    returning id into v_support_candidate;
  insert into public.client_recruiter_assignments
    (client_id, recruiter_profile_id, assigned_by_profile_id)
    values (v_client, v_recruiter, v_recruiter);
  insert into public.client_candidate_access
    (client_id, candidate_id, status)
    values (v_client, v_support_candidate, 'active');
  insert into public.client_candidate_shares
    (client_id, recruiter_profile_id, candidate_id, shared_by_profile_id)
    values (v_client, v_recruiter, v_support_candidate, v_recruiter);
  insert into public.client_feature_entitlements
    (client_id, plan_code, feature)
    values (v_client, 'synthetic_probe', 'recruiter_support');
  insert into public.recruiter_original_cv_grants (
    candidate_id, recruiter_profile_id, approved_by_profile_id,
    updated_by_profile_id, purpose, client_id, expires_at
  ) values (
    v_support_candidate, v_recruiter, v_recruiter,
    v_recruiter, 'client_support', v_client, now() + interval '1 hour'
  ) returning id into v_support_grant;

  insert into public.recruiter_original_cv_access_events (
    candidate_id, actor_profile_id, actor_role, grant_id, purpose, client_id
  ) values (
    v_support_candidate, v_recruiter, 'recruiter',
    v_support_grant, 'client_support', v_client
  );
  update public.client_feature_entitlements set status = 'revoked'
    where client_id = v_client and feature = 'recruiter_support';
  v_denied := false;
  begin
    insert into public.recruiter_original_cv_access_events (
      candidate_id, actor_profile_id, actor_role, grant_id, purpose, client_id
    ) values (
      v_support_candidate, v_recruiter, 'recruiter',
      v_support_grant, 'client_support', v_client
    );
  exception when others then
    if sqlerrm <> 'Current original CV entitlement required' then
      raise;
    end if;
    v_denied := true;
  end;
  if not v_denied then
    raise exception 'revoked_client_support_audit_was_not_denied';
  end if;
  if (select count(*) from public.recruiter_original_cv_access_events
      where candidate_id = v_support_candidate) <> 1 then
    raise exception 'client_support_audit_event_count_mismatch';
  end if;
end
$probe$;

rollback;
