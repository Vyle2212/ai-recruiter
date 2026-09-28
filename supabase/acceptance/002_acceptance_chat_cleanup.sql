-- Acceptance-only cleanup for immutable chat/consent audit fixtures.
-- Never apply to staging or production. The preflight and RPC both require
-- the authenticated acceptance control plane classification.
begin;

do $preflight$
begin
  if not exists (
    select 1
    from public.acceptance_environment_markers
    where singleton = true
      and classification = 'acceptance'
      and acceptance_enabled = true
      and harness_version = 'production-trust-authenticated-acceptance-v2'
  ) then
    raise exception 'acceptance_chat_cleanup_environment_blocked';
  end if;
  if to_regclass('public.acceptance_test_runs') is null
     or to_regclass('public.acceptance_test_entities') is null
     or to_regclass('public.acceptance_synthetic_candidates') is null
     or to_regclass('public.candidate_chat_contact_consents') is null
     or to_regclass('public.candidate_chat_contact_consent_events') is null
     or to_regclass('public.chat_conversations') is null
     or to_regclass('public.chat_conversation_participants') is null
     or to_regclass('public.chat_messages') is null
     or to_regclass('public.chat_message_events') is null
     or to_regclass('public.chat_message_receipts') is null
     or to_regclass('public.chat_message_receipt_events') is null then
    raise exception 'acceptance_chat_cleanup_dependencies_missing';
  end if;
end
$preflight$;

create or replace function private.acceptance_chat_cleanup_allowed()
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select
    current_setting('app.acceptance_cleanup_run', true) like 'ptf1c2-%'
    and exists (
      select 1
      from public.acceptance_environment_markers marker
      where marker.singleton = true
        and marker.classification = 'acceptance'
        and marker.acceptance_enabled = true
        and marker.harness_version =
          'production-trust-authenticated-acceptance-v2'
    )
    and exists (
      select 1
      from public.acceptance_test_runs run
      where run.run_id =
        current_setting('app.acceptance_cleanup_run', true)
        and run.synthetic_namespace = 'ptf1c2/' || run.run_id
        and run.status in ('provisioning', 'ready', 'running', 'failed')
    );
$$;
revoke all on function private.acceptance_chat_cleanup_allowed()
  from public, anon, authenticated;

create or replace function public.reject_candidate_chat_contact_consent_event_change()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' and private.acceptance_chat_cleanup_allowed() then
    return old;
  end if;
  raise exception 'Candidate chat contact consent audit is append-only';
end
$$;

create or replace function public.reject_chat_receipt_event_change()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' and private.acceptance_chat_cleanup_allowed() then
    return old;
  end if;
  raise exception 'Chat receipt audit is append-only';
end
$$;

create or replace function public.reject_chat_message_change()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' and private.acceptance_chat_cleanup_allowed() then
    return old;
  end if;
  raise exception 'Chat messages are immutable';
end
$$;

create or replace function public.reject_chat_message_event_change()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' and private.acceptance_chat_cleanup_allowed() then
    return old;
  end if;
  raise exception 'Chat message audit is append-only';
end
$$;

create or replace function public.cleanup_acceptance_chat_run(p_run_id text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_profile_ids uuid[];
  v_candidate_ids uuid[];
  v_conversation_ids uuid[];
  v_deleted_conversations integer := 0;
  v_deleted_messages integer := 0;
  v_deleted_consents integer := 0;
begin
  if p_run_id is null or p_run_id !~ '^ptf1c2-[a-zA-Z0-9._-]+$' then
    raise exception 'acceptance_chat_cleanup_run_invalid';
  end if;
  if not exists (
    select 1
    from public.acceptance_environment_markers marker
    where marker.singleton = true
      and marker.classification = 'acceptance'
      and marker.acceptance_enabled = true
      and marker.harness_version =
        'production-trust-authenticated-acceptance-v2'
  ) then
    raise exception 'acceptance_chat_cleanup_environment_blocked';
  end if;
  if not exists (
    select 1
    from public.acceptance_test_runs run
    where run.run_id = p_run_id
      and run.synthetic_namespace = 'ptf1c2/' || p_run_id
      and run.status in ('provisioning', 'ready', 'running', 'failed')
  ) then
    raise exception 'acceptance_chat_cleanup_run_not_active';
  end if;

  select array_agg(entity.entity_id::uuid)
    into v_profile_ids
  from public.acceptance_test_entities entity
  where entity.run_id = p_run_id
    and entity.entity_type = 'user_profile'
    and entity.entity_id ~
      '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$';

  select array_agg(fixture.candidate_id)
    into v_candidate_ids
  from public.acceptance_synthetic_candidates fixture
  where fixture.owner_run_id = p_run_id
    and fixture.synthetic_namespace = 'ptf1c2/' || p_run_id
    and fixture.active = true;

  if coalesce(array_length(v_profile_ids, 1), 0) = 0
     or coalesce(array_length(v_candidate_ids, 1), 0) = 0 then
    raise exception 'acceptance_chat_cleanup_fixture_scope_missing';
  end if;

  select array_agg(conversation.id)
    into v_conversation_ids
  from public.chat_conversations conversation
  where conversation.created_by_profile_id = any(v_profile_ids)
    and (
      conversation.candidate_id is null
      or conversation.candidate_id = any(v_candidate_ids)
    )
    and not exists (
      select 1
      from public.chat_conversation_participants participant
      where participant.conversation_id = conversation.id
        and not (participant.user_profile_id = any(v_profile_ids))
    );

  perform set_config('app.acceptance_cleanup_run', p_run_id, true);

  if coalesce(array_length(v_conversation_ids, 1), 0) > 0 then
    delete from public.chat_message_receipt_events
    where conversation_id = any(v_conversation_ids);
    delete from public.chat_message_receipts
    where conversation_id = any(v_conversation_ids);
    delete from public.chat_message_events
    where conversation_id = any(v_conversation_ids);
    delete from public.chat_messages
    where conversation_id = any(v_conversation_ids);
    get diagnostics v_deleted_messages = row_count;
    delete from public.chat_conversation_participants
    where conversation_id = any(v_conversation_ids);
    delete from public.chat_conversations
    where id = any(v_conversation_ids);
    get diagnostics v_deleted_conversations = row_count;
  end if;

  delete from public.candidate_chat_contact_consent_events
  where user_profile_id = any(v_profile_ids)
    and candidate_id = any(v_candidate_ids);
  delete from public.candidate_chat_contact_consents
  where user_profile_id = any(v_profile_ids)
    and candidate_id = any(v_candidate_ids);
  get diagnostics v_deleted_consents = row_count;

  perform set_config('app.acceptance_cleanup_run', '', true);

  if exists (
    select 1
    from public.chat_conversations conversation
    where conversation.created_by_profile_id = any(v_profile_ids)
  ) or exists (
    select 1
    from public.candidate_chat_contact_consents consent
    where consent.user_profile_id = any(v_profile_ids)
  ) then
    raise exception 'acceptance_chat_cleanup_residue_detected';
  end if;

  return jsonb_build_object(
    'run_id', p_run_id,
    'deleted_conversations', v_deleted_conversations,
    'deleted_messages', v_deleted_messages,
    'deleted_consents', v_deleted_consents
  );
exception
  when others then
    perform set_config('app.acceptance_cleanup_run', '', true);
    raise;
end
$$;

revoke all on function public.cleanup_acceptance_chat_run(text)
  from public, anon, authenticated;
grant execute on function public.cleanup_acceptance_chat_run(text)
  to service_role;

commit;
