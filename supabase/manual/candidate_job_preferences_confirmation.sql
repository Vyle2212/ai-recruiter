-- Acceptance rollout: extend the existing atomic confirmation RPC.
-- Guarded patch preserves ownership, stale-version checks, invoker security and grants.
do $patch$
declare
  definition text;
  signature regprocedure := 'public.apply_candidate_profile_confirmation(uuid,uuid,uuid,timestamptz,timestamptz,boolean,boolean,jsonb,jsonb)'::regprocedure;
  allowed text := '''education'',''certifications'',''languages''';
  state_assignment text := 'profile_source_state = coalesce(c.profile_source_state, ''{}''::jsonb)';
begin
  select pg_get_functiondef(signature) into definition;
  if (select prosecdef from pg_proc where oid = signature) then raise exception 'confirmation_must_remain_security_invoker'; end if;
  if position('''job_preferences''' in definition) > 0 then raise exception 'job_preferences_patch_already_applied'; end if;
  if position(allowed in definition) = 0 or position(state_assignment in definition) = 0 then raise exception 'confirmation_definition_changed_review_required'; end if;
  definition := replace(definition, allowed, allowed || ',''job_preferences''');
  definition := replace(definition, state_assignment, state_assignment || E'\n    || case when p_payload ? ''job_preferences'' then jsonb_build_object(''job_preferences'', p_payload->''job_preferences'') else ''{}''::jsonb end');
  definition := replace(definition, '  for v_key in select jsonb_object_keys(p_payload) loop', E'  if p_payload ? ''job_preferences'' and (jsonb_typeof(p_payload->''job_preferences'') is distinct from ''object'' or octet_length((p_payload->''job_preferences'')::text) > 20000) then\n    raise exception ''candidate_job_preferences_invalid'';\n  end if;\n  for v_key in select jsonb_object_keys(p_payload) loop');
  execute definition;
end
$patch$;
