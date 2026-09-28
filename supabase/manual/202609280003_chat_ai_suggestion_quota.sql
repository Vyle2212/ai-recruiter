-- Apply after 202609280002_chat_conversation_store.sql on acceptance only.
-- No prompt, message body or model response is retained in this request audit.
begin;

do $$ begin
  if to_regclass('public.chat_conversations') is null
     or to_regclass('public.chat_ai_suggestion_requests') is not null then
    raise exception 'Chat base migration missing or suggestion quota already installed';
  end if;
end $$;

create table public.chat_ai_suggestion_requests (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.chat_conversations(id) on delete restrict,
  actor_profile_id uuid not null references public.user_profiles(id) on delete restrict,
  created_at timestamptz not null default now()
);
create index chat_ai_suggestion_actor_time_idx
  on public.chat_ai_suggestion_requests(actor_profile_id, created_at desc);

create function public.claim_chat_ai_suggestion(p_conversation_id uuid, p_actor_profile_id uuid)
returns boolean language plpgsql security invoker set search_path = '' as $$
declare
  v_now timestamptz := clock_timestamp();
  v_count integer;
begin
  if p_conversation_id is null or p_actor_profile_id is null then
    return false;
  end if;
  -- Serialize concurrent requests from the same actor across app instances.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_actor_profile_id::text, 0));
  select count(*) into v_count from public.chat_ai_suggestion_requests
    where actor_profile_id = p_actor_profile_id and created_at > v_now - interval '60 seconds';
  if v_count >= 1 then return false; end if;
  select count(*) into v_count from public.chat_ai_suggestion_requests
    where actor_profile_id = p_actor_profile_id and created_at > v_now - interval '24 hours';
  if v_count >= 30 then return false; end if;
  insert into public.chat_ai_suggestion_requests(conversation_id, actor_profile_id)
    values (p_conversation_id, p_actor_profile_id);
  return true;
end $$;
revoke all on function public.claim_chat_ai_suggestion(uuid, uuid) from public, anon, authenticated;
grant execute on function public.claim_chat_ai_suggestion(uuid, uuid) to service_role;

alter table public.chat_ai_suggestion_requests enable row level security;
alter table public.chat_ai_suggestion_requests force row level security;
revoke all on public.chat_ai_suggestion_requests from public, anon, authenticated;
grant select, insert on public.chat_ai_suggestion_requests to service_role;

create function public.reject_chat_ai_suggestion_change()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  raise exception 'Chat AI suggestion request audit is append-only';
end $$;
revoke all on function public.reject_chat_ai_suggestion_change() from public, anon, authenticated;
create trigger chat_ai_suggestion_immutable
before update or delete on public.chat_ai_suggestion_requests
for each row execute function public.reject_chat_ai_suggestion_change();

commit;
