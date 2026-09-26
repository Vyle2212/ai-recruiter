-- Read-only verification after the supervised original-CV entitlement and audit setup.
begin transaction isolation level repeatable read read only;

do $readback$
begin
  if not exists (
    select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname = 'recruiter_original_cv_access_events'
      and c.relkind = 'r' and c.relrowsecurity and c.relforcerowsecurity
  ) then
    raise exception 'original_cv_access_audit_rls_readback_failed';
  end if;

  if has_table_privilege('public', 'public.recruiter_original_cv_access_events', 'select')
     or has_table_privilege('public', 'public.recruiter_original_cv_access_events', 'insert')
     or has_table_privilege('anon', 'public.recruiter_original_cv_access_events', 'select')
     or has_table_privilege('anon', 'public.recruiter_original_cv_access_events', 'insert')
     or has_table_privilege('authenticated', 'public.recruiter_original_cv_access_events', 'select')
     or has_table_privilege('authenticated', 'public.recruiter_original_cv_access_events', 'insert') then
    raise exception 'original_cv_access_audit_browser_privilege_detected';
  end if;

  if not has_table_privilege('service_role', 'public.recruiter_original_cv_access_events', 'select')
     or not has_table_privilege('service_role', 'public.recruiter_original_cv_access_events', 'insert')
     or has_table_privilege('service_role', 'public.recruiter_original_cv_access_events', 'update')
     or has_table_privilege('service_role', 'public.recruiter_original_cv_access_events', 'delete') then
    raise exception 'original_cv_access_audit_service_privilege_readback_failed';
  end if;

  if not exists (
    select 1 from pg_trigger t
    join pg_class c on c.oid = t.tgrelid
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname = 'recruiter_original_cv_access_events'
      and t.tgname in (
        'recruiter_original_cv_access_event_validate',
        'recruiter_original_cv_access_event_immutable'
      )
      and not t.tgisinternal
    group by c.oid
    having count(*) = 2
  ) then
    raise exception 'original_cv_access_audit_trigger_readback_failed';
  end if;

  if to_regprocedure('public.validate_recruiter_original_cv_access_event()') is null
     or to_regprocedure('public.reject_recruiter_original_cv_access_event_change()') is null
     or has_function_privilege('public', to_regprocedure('public.validate_recruiter_original_cv_access_event()'), 'execute')
     or has_function_privilege('anon', to_regprocedure('public.validate_recruiter_original_cv_access_event()'), 'execute')
     or has_function_privilege('authenticated', to_regprocedure('public.validate_recruiter_original_cv_access_event()'), 'execute')
     or has_function_privilege('public', to_regprocedure('public.reject_recruiter_original_cv_access_event_change()'), 'execute')
     or has_function_privilege('anon', to_regprocedure('public.reject_recruiter_original_cv_access_event_change()'), 'execute')
     or has_function_privilege('authenticated', to_regprocedure('public.reject_recruiter_original_cv_access_event_change()'), 'execute') then
    raise exception 'original_cv_access_audit_function_privilege_readback_failed';
  end if;

  if exists (
    select 1 from public.recruiter_original_cv_access_events
    where (actor_role = 'admin' and (grant_id is not null or purpose <> 'administration' or client_id is not null))
       or (actor_role in ('recruiter_manager', 'recruiter') and (
         grant_id is null
         or (purpose = 'headhunting' and client_id is not null)
         or (purpose = 'client_support' and client_id is null)
         or purpose = 'administration'
       ))
  ) then
    raise exception 'original_cv_access_audit_scope_readback_failed';
  end if;

  -- Historical audit rows remain valid after a later lifecycle transition.
  -- Verify the installed trigger contract instead of comparing old events to
  -- the candidate's current status.
  if position(
       'from public.candidates c'
       in lower(pg_get_functiondef(
         to_regprocedure('public.validate_recruiter_original_cv_access_event()')
       ))
     ) = 0
     or position('deleted' in lower(pg_get_functiondef(to_regprocedure('public.validate_recruiter_original_cv_access_event()')))) = 0
     or position('non_sap' in lower(pg_get_functiondef(to_regprocedure('public.validate_recruiter_original_cv_access_event()')))) = 0
     or position('rejected_noise' in lower(pg_get_functiondef(to_regprocedure('public.validate_recruiter_original_cv_access_event()')))) = 0
     or position('hidden' in lower(pg_get_functiondef(to_regprocedure('public.validate_recruiter_original_cv_access_event()')))) = 0
     or position('archived' in lower(pg_get_functiondef(to_regprocedure('public.validate_recruiter_original_cv_access_event()')))) = 0
     or position('for share of c' in lower(pg_get_functiondef(to_regprocedure('public.validate_recruiter_original_cv_access_event()')))) = 0 then
    raise exception 'original_cv_access_audit_candidate_lifecycle_readback_failed';
  end if;

  raise notice 'original_cv_access_audit_readback_passed';
end
$readback$;

rollback;
