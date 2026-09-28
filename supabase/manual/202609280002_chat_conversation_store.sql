-- Reviewed-run chat persistence foundation. Acceptance first.
-- Direct Data API access stays closed; server APIs must authorize every request.
begin;

do $preflight$
begin
  if to_regclass('public.user_profiles') is null
     or to_regclass('public.candidates') is null
     or to_regclass('public.candidate_chat_contact_consents') is null
     or to_regclass('public.client_feature_entitlements') is null
     or to_regclass('public.client_recruiter_assignments') is null then
    raise exception 'chat_store_dependencies_missing';
  end if;
  if to_regclass('public.chat_conversations') is not null
     or to_regclass('public.chat_conversation_participants') is not null
     or to_regclass('public.chat_messages') is not null
     or to_regclass('public.chat_message_events') is not null
     or to_regclass('public.chat_message_receipts') is not null then
    raise exception 'chat_store_already_installed';
  end if;
end
$preflight$;

create table public.chat_conversations (
  id uuid primary key default gen_random_uuid(),
  channel_kind text not null check (channel_kind in (
    'client_candidate', 'recruiter_candidate',
    'client_recruiter', 'recruiter_admin'
  )),
  organization_id uuid references public.organizations(id) on delete restrict,
  client_id uuid,
  job_id uuid,
  candidate_id uuid references public.candidates(id) on delete restrict,
  status text not null default 'active' check (status in ('active','closed')),
  created_by_profile_id uuid not null references public.user_profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_message_at timestamptz,
  check (
    (channel_kind = 'client_candidate' and client_id is not null and candidate_id is not null)
    or (channel_kind = 'recruiter_candidate' and candidate_id is not null)
    or (channel_kind = 'client_recruiter' and client_id is not null)
    or (channel_kind = 'recruiter_admin' and organization_id is not null)
  ),
  check (last_message_at is null or last_message_at >= created_at)
);
create index chat_conversations_candidate_idx
  on public.chat_conversations(candidate_id, updated_at desc)
  where candidate_id is not null;
create index chat_conversations_client_idx
  on public.chat_conversations(client_id, updated_at desc)
  where client_id is not null;
create index chat_conversations_job_idx
  on public.chat_conversations(job_id, updated_at desc)
  where job_id is not null;
create index chat_conversations_organization_idx
  on public.chat_conversations(organization_id, updated_at desc)
  where organization_id is not null;

create table public.chat_conversation_participants (
  conversation_id uuid not null references public.chat_conversations(id) on delete restrict,
  user_profile_id uuid not null references public.user_profiles(id) on delete restrict,
  role_snapshot text not null check (role_snapshot in (
    'admin','recruiter_manager','recruiter','client','candidate'
  )),
  status text not null default 'active' check (status in ('active','left')),
  joined_at timestamptz not null default now(),
  left_at timestamptz,
  primary key (conversation_id, user_profile_id),
  check ((status = 'active' and left_at is null)
    or (status = 'left' and left_at is not null and left_at >= joined_at))
);
create index chat_participants_profile_idx
  on public.chat_conversation_participants(user_profile_id, status, conversation_id);

create table public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.chat_conversations(id) on delete restrict,
  sender_profile_id uuid not null references public.user_profiles(id) on delete restrict,
  client_message_id uuid not null,
  message_type text not null default 'user' check (message_type in ('user','system')),
  body text not null check (btrim(body) <> '' and char_length(body) <= 8000),
  created_at timestamptz not null default now(),
  constraint chat_messages_sender_membership
    foreign key (conversation_id, sender_profile_id)
    references public.chat_conversation_participants(conversation_id, user_profile_id)
    on delete restrict,
  unique (id, conversation_id),
  unique (conversation_id, sender_profile_id, client_message_id)
);
create index chat_messages_conversation_idx
  on public.chat_messages(conversation_id, created_at, id);

create table public.chat_message_events (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references public.chat_messages(id) on delete restrict,
  conversation_id uuid not null references public.chat_conversations(id) on delete restrict,
  actor_profile_id uuid not null references public.user_profiles(id) on delete restrict,
  action text not null check (action = 'sent'),
  created_at timestamptz not null default now()
);
create index chat_message_events_conversation_idx
  on public.chat_message_events(conversation_id, created_at, id);

create table public.chat_message_receipts (
  message_id uuid not null,
  conversation_id uuid not null,
  user_profile_id uuid not null,
  delivered_at timestamptz,
  read_at timestamptz,
  primary key (message_id, user_profile_id),
  constraint chat_message_receipts_message_scope
    foreign key (message_id, conversation_id)
    references public.chat_messages(id, conversation_id)
    on delete restrict,
  constraint chat_message_receipts_participant
    foreign key (conversation_id, user_profile_id)
    references public.chat_conversation_participants(conversation_id, user_profile_id)
    on delete restrict,
  check (read_at is null or delivered_at is not null),
  check (read_at is null or read_at >= delivered_at)
);
create index chat_message_receipts_unread_idx
  on public.chat_message_receipts(user_profile_id, conversation_id)
  where read_at is null;

create function public.enforce_chat_message_active_scope()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  if not exists (
    select 1
    from public.chat_conversations c
    join public.chat_conversation_participants p
      on p.conversation_id = c.id
     and p.user_profile_id = new.sender_profile_id
    where c.id = new.conversation_id
      and c.status = 'active'
      and p.status = 'active'
  ) then
    raise exception 'Chat conversation or sender membership is inactive';
  end if;
  return new;
end
$$;
revoke all on function public.enforce_chat_message_active_scope()
  from public, anon, authenticated;
create trigger chat_message_active_scope
before insert on public.chat_messages
for each row execute function public.enforce_chat_message_active_scope();

create function public.record_chat_message_event()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  insert into public.chat_message_events
    (message_id, conversation_id, actor_profile_id, action)
  values (new.id, new.conversation_id, new.sender_profile_id, 'sent');
  update public.chat_conversations
    set last_message_at = new.created_at,
        updated_at = new.created_at
    where id = new.conversation_id and status = 'active';
  return new;
end
$$;
revoke all on function public.record_chat_message_event()
  from public, anon, authenticated;
create trigger chat_message_event
after insert on public.chat_messages
for each row execute function public.record_chat_message_event();

create function public.reject_chat_message_change()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  raise exception 'Chat messages are immutable';
end
$$;
revoke all on function public.reject_chat_message_change()
  from public, anon, authenticated;
create trigger chat_messages_immutable
before update or delete on public.chat_messages
for each row execute function public.reject_chat_message_change();

create function public.reject_chat_message_event_change()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  raise exception 'Chat message audit is append-only';
end
$$;
revoke all on function public.reject_chat_message_event_change()
  from public, anon, authenticated;
create trigger chat_message_events_immutable
before update or delete on public.chat_message_events
for each row execute function public.reject_chat_message_event_change();

create function public.protect_chat_conversation_scope()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  if old.channel_kind is distinct from new.channel_kind
     or old.organization_id is distinct from new.organization_id
     or old.client_id is distinct from new.client_id
     or old.job_id is distinct from new.job_id
     or old.candidate_id is distinct from new.candidate_id
     or old.created_by_profile_id is distinct from new.created_by_profile_id
     or old.created_at is distinct from new.created_at then
    raise exception 'Chat conversation scope is immutable';
  end if;
  return new;
end
$$;
revoke all on function public.protect_chat_conversation_scope()
  from public, anon, authenticated;
create trigger chat_conversation_scope_immutable
before update on public.chat_conversations
for each row execute function public.protect_chat_conversation_scope();

alter table public.chat_conversations enable row level security;
alter table public.chat_conversations force row level security;
alter table public.chat_conversation_participants enable row level security;
alter table public.chat_conversation_participants force row level security;
alter table public.chat_messages enable row level security;
alter table public.chat_messages force row level security;
alter table public.chat_message_events enable row level security;
alter table public.chat_message_events force row level security;
alter table public.chat_message_receipts enable row level security;
alter table public.chat_message_receipts force row level security;

revoke all on public.chat_conversations,
  public.chat_conversation_participants, public.chat_messages,
  public.chat_message_events, public.chat_message_receipts
  from public, anon, authenticated;
grant select, insert, update on public.chat_conversations,
  public.chat_conversation_participants, public.chat_message_receipts
  to service_role;
grant select, insert on public.chat_messages, public.chat_message_events
  to service_role;

commit;
