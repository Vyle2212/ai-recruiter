-- Reviewed-run chat persistence foundation. Acceptance first.
-- Direct Data API access stays closed; server APIs must authorize every request.
begin;

do $preflight$
begin
  if to_regclass('public.user_profiles') is null
     or to_regclass('public.candidates') is null
     or to_regclass('public.candidate_accounts') is null
     or to_regclass('public.candidate_chat_contact_consents') is null
     or to_regclass('public.client_feature_entitlements') is null
     or to_regclass('public.client_recruiter_assignments') is null
     or to_regclass('public.client_memberships') is null
     or to_regclass('public.client_candidate_access') is null
     or to_regclass('public.client_job_ownership') is null then
    raise exception 'chat_store_dependencies_missing';
  end if;
  if to_regclass('public.chat_conversations') is not null
     or to_regclass('public.chat_conversation_participants') is not null
     or to_regclass('public.chat_messages') is not null
     or to_regclass('public.chat_message_events') is not null
     or to_regclass('public.chat_message_receipts') is not null
     or to_regclass('public.chat_message_receipt_events') is not null then
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
  recipient_profile_id uuid references public.user_profiles(id) on delete restrict,
  status text not null default 'active' check (status in ('active','closed')),
  created_by_profile_id uuid not null references public.user_profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_message_at timestamptz,
  check (
    (channel_kind = 'client_candidate' and client_id is not null and candidate_id is not null)
    or (channel_kind = 'recruiter_candidate' and candidate_id is not null)
    or (channel_kind = 'client_recruiter' and organization_id is not null
        and client_id is not null and recipient_profile_id is not null)
    or (channel_kind = 'recruiter_admin' and organization_id is not null
        and recipient_profile_id is not null)
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
create unique index chat_client_candidate_active_without_job_key
  on public.chat_conversations(created_by_profile_id, candidate_id)
  where channel_kind = 'client_candidate' and status = 'active' and job_id is null;
create unique index chat_client_candidate_active_with_job_key
  on public.chat_conversations(created_by_profile_id, candidate_id, job_id)
  where channel_kind = 'client_candidate' and status = 'active' and job_id is not null;
create unique index chat_recruiter_admin_active_pair_key
  on public.chat_conversations(created_by_profile_id, recipient_profile_id)
  where channel_kind = 'recruiter_admin' and status = 'active';
create unique index chat_client_recruiter_active_without_job_key
  on public.chat_conversations(created_by_profile_id, recipient_profile_id)
  where channel_kind = 'client_recruiter' and status = 'active' and job_id is null;
create unique index chat_client_recruiter_active_with_job_key
  on public.chat_conversations(created_by_profile_id, recipient_profile_id, job_id)
  where channel_kind = 'client_recruiter' and status = 'active' and job_id is not null;

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
  unique (message_id, conversation_id, user_profile_id),
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

create table public.chat_message_receipt_events (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null,
  conversation_id uuid not null,
  user_profile_id uuid not null,
  action text not null check (action = 'read'),
  created_at timestamptz not null default now(),
  constraint chat_receipt_events_receipt
    foreign key (message_id, conversation_id, user_profile_id)
    references public.chat_message_receipts(message_id, conversation_id, user_profile_id)
    on delete restrict
);
create index chat_receipt_events_profile_idx
  on public.chat_message_receipt_events(user_profile_id, created_at desc);

create function public.record_chat_receipt_read()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  if old.message_id is distinct from new.message_id
     or old.conversation_id is distinct from new.conversation_id
     or old.user_profile_id is distinct from new.user_profile_id
     or (old.read_at is not null and old.read_at is distinct from new.read_at)
     or (old.delivered_at is not null
         and old.delivered_at is distinct from new.delivered_at)
     or (new.read_at is not null and new.read_at < new.delivered_at) then
    raise exception 'Chat receipt identity and timestamps are immutable';
  end if;
  if old.read_at is null and new.read_at is not null then
    insert into public.chat_message_receipt_events
      (message_id, conversation_id, user_profile_id, action)
    values (new.message_id, new.conversation_id, new.user_profile_id, 'read');
  end if;
  return new;
end
$$;
revoke all on function public.record_chat_receipt_read()
  from public, anon, authenticated;
create trigger chat_receipt_read_audit
before update on public.chat_message_receipts
for each row execute function public.record_chat_receipt_read();

create function public.reject_chat_receipt_event_change()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  raise exception 'Chat receipt audit is append-only';
end
$$;
revoke all on function public.reject_chat_receipt_event_change()
  from public, anon, authenticated;
create trigger chat_receipt_events_immutable
before update or delete on public.chat_message_receipt_events
for each row execute function public.reject_chat_receipt_event_change();

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
  if exists (
    select 1 from public.chat_conversations c
    where c.id = new.conversation_id and c.channel_kind = 'client_candidate'
  ) and not exists (
    select 1 from public.chat_conversations c
    join public.organizations org
      on org.id = c.organization_id
     and org.organization_type = 'client' and org.status = 'active'
    join public.user_profiles client
      on client.id = c.created_by_profile_id
     and client.role = 'client' and client.status = 'active'
     and client.client_id = c.client_id
     and client.organization_id = c.organization_id
    join public.user_profiles candidate
      on candidate.candidate_id = c.candidate_id
     and candidate.role = 'candidate' and candidate.status = 'active'
    join public.chat_conversation_participants client_participant
      on client_participant.conversation_id = c.id
     and client_participant.user_profile_id = client.id
     and client_participant.role_snapshot = 'client'
     and client_participant.status = 'active'
    join public.chat_conversation_participants candidate_participant
      on candidate_participant.conversation_id = c.id
     and candidate_participant.user_profile_id = candidate.id
     and candidate_participant.role_snapshot = 'candidate'
     and candidate_participant.status = 'active'
    join public.candidate_accounts account
      on account.user_profile_id = candidate.id
     and account.candidate_id = c.candidate_id and account.status = 'active'
    join public.candidate_chat_contact_consents consent
      on consent.user_profile_id = candidate.id
     and consent.candidate_id = c.candidate_id and consent.consent = true
    join auth.users candidate_auth
      on candidate_auth.id = candidate.auth_user_id
     and candidate_auth.email_confirmed_at is not null
    join public.client_memberships membership
      on membership.user_profile_id = client.id
     and membership.organization_id = c.organization_id
     and membership.client_id = c.client_id and membership.status = 'active'
    join public.client_candidate_access access
      on access.client_id = c.client_id
     and access.candidate_id = c.candidate_id and access.status = 'active'
    where c.id = new.conversation_id
      and (select count(*) from public.chat_conversation_participants participant
           where participant.conversation_id = c.id) = 2
      and exists (
        select 1 from public.client_feature_entitlements entitlement
        where entitlement.client_id = c.client_id
          and entitlement.status = 'active'
          and btrim(entitlement.plan_code) <> ''
          and entitlement.valid_from <= now()
          and (entitlement.valid_until is null or entitlement.valid_until > now())
      )
      and (c.job_id is null or exists (
        select 1 from public.client_job_ownership ownership
        where ownership.client_id = c.client_id
          and ownership.job_id = c.job_id and ownership.status = 'active'
      ))
  ) then
    raise exception 'Client candidate chat permission changed';
  end if;
  if exists (
    select 1 from public.chat_conversations c
    where c.id = new.conversation_id and c.channel_kind = 'client_recruiter'
  ) and not exists (
    select 1 from public.chat_conversations c
    join public.organizations org
      on org.id = c.organization_id
     and org.organization_type = 'client' and org.status = 'active'
    join public.user_profiles client
      on client.id = c.created_by_profile_id
     and client.role = 'client' and client.status = 'active'
     and client.client_id = c.client_id
     and client.organization_id = c.organization_id
    join public.user_profiles recruiter
      on recruiter.id = c.recipient_profile_id
     and recruiter.role in ('recruiter', 'recruiter_manager')
     and recruiter.status = 'active'
    join public.chat_conversation_participants client_participant
      on client_participant.conversation_id = c.id
     and client_participant.user_profile_id = client.id
     and client_participant.role_snapshot = 'client'
     and client_participant.status = 'active'
    join public.chat_conversation_participants recruiter_participant
      on recruiter_participant.conversation_id = c.id
     and recruiter_participant.user_profile_id = recruiter.id
     and recruiter_participant.role_snapshot = recruiter.role
     and recruiter_participant.status = 'active'
    join public.client_memberships membership
      on membership.user_profile_id = client.id
     and membership.organization_id = c.organization_id
     and membership.client_id = c.client_id and membership.status = 'active'
    join public.client_recruiter_assignments assignment
      on assignment.client_id = c.client_id
     and assignment.recruiter_profile_id = recruiter.id
     and assignment.status = 'active'
    where c.id = new.conversation_id
      and new.sender_profile_id in (client.id, recruiter.id)
      and (select count(*) from public.chat_conversation_participants participant
           where participant.conversation_id = c.id) = 2
      and exists (
        select 1 from public.client_feature_entitlements entitlement
        where entitlement.client_id = c.client_id
          and entitlement.status = 'active'
          and btrim(entitlement.plan_code) <> ''
          and entitlement.valid_from <= now()
          and (entitlement.valid_until is null or entitlement.valid_until > now())
      )
      and (c.job_id is null or exists (
        select 1 from public.client_job_ownership ownership
        where ownership.client_id = c.client_id
          and ownership.job_id = c.job_id and ownership.status = 'active'
      ))
  ) then
    raise exception 'Client recruiter chat permission changed';
  end if;
  if exists (
    select 1 from public.chat_conversations c
    where c.id = new.conversation_id and c.channel_kind = 'recruiter_admin'
  ) and not exists (
    select 1 from public.chat_conversations c
    join public.organizations org
      on org.id = c.organization_id
     and org.organization_type = 'internal' and org.status = 'active'
    join public.user_profiles recruiter
      on recruiter.id = c.created_by_profile_id
     and recruiter.role in ('recruiter', 'recruiter_manager')
     and recruiter.status = 'active'
     and recruiter.organization_id = c.organization_id
    join public.user_profiles admin
      on admin.id = c.recipient_profile_id
     and admin.role = 'admin' and admin.status = 'active'
     and admin.organization_id = c.organization_id
    join public.chat_conversation_participants recruiter_participant
      on recruiter_participant.conversation_id = c.id
     and recruiter_participant.user_profile_id = recruiter.id
     and recruiter_participant.role_snapshot = recruiter.role
     and recruiter_participant.status = 'active'
    join public.chat_conversation_participants admin_participant
      on admin_participant.conversation_id = c.id
     and admin_participant.user_profile_id = admin.id
     and admin_participant.role_snapshot = 'admin'
     and admin_participant.status = 'active'
    where c.id = new.conversation_id
      and (select count(*) from public.chat_conversation_participants participant
           where participant.conversation_id = c.id) = 2
      and new.sender_profile_id in (recruiter.id, admin.id)
  ) then
    raise exception 'Recruiter admin chat permission changed';
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
  insert into public.chat_message_receipts
    (message_id, conversation_id, user_profile_id, delivered_at)
  select new.id, new.conversation_id, p.user_profile_id, new.created_at
  from public.chat_conversation_participants p
  where p.conversation_id = new.conversation_id
    and p.status = 'active' and p.user_profile_id <> new.sender_profile_id;
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
     or old.recipient_profile_id is distinct from new.recipient_profile_id
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

-- The invoker is service_role only. One RPC call atomically creates the
-- conversation and both participants. Every mutable permission is rechecked
-- inside this transaction immediately before the write.
create function public.create_client_candidate_chat_conversation(
  p_client_profile_id uuid, p_candidate_id uuid, p_job_id uuid default null
) returns uuid language plpgsql security invoker set search_path = '' as $$
declare
  v_client_id uuid;
  v_organization_id uuid;
  v_candidate_profile_id uuid;
  v_conversation_id uuid;
begin
  if p_client_profile_id is null or p_candidate_id is null then
    raise exception using errcode = 'P0001', message = 'chat_scope_not_available';
  end if;

  select client.client_id, client.organization_id, candidate.id
    into v_client_id, v_organization_id, v_candidate_profile_id
  from public.user_profiles client
  join public.organizations org
    on org.id = client.organization_id
   and org.organization_type = 'client' and org.status = 'active'
  join public.user_profiles candidate
    on candidate.candidate_id = p_candidate_id
   and candidate.role = 'candidate' and candidate.status = 'active'
  join public.candidate_accounts account
    on account.user_profile_id = candidate.id
   and account.candidate_id = p_candidate_id and account.status = 'active'
  join public.candidate_chat_contact_consents consent
    on consent.user_profile_id = candidate.id
   and consent.candidate_id = p_candidate_id and consent.consent = true
  join auth.users auth_user
    on auth_user.id = candidate.auth_user_id
   and auth_user.email_confirmed_at is not null
  where client.id = p_client_profile_id
    and client.role = 'client' and client.status = 'active';
  if v_client_id is null or v_organization_id is null or v_candidate_profile_id is null then
    raise exception using errcode = 'P0001', message = 'chat_scope_not_available';
  end if;
  if not exists (
    select 1 from public.client_memberships m
    where m.user_profile_id = p_client_profile_id
      and m.organization_id = v_organization_id
      and m.client_id = v_client_id and m.status = 'active'
  ) or not exists (
    select 1 from public.client_candidate_access access
    where access.client_id = v_client_id
      and access.candidate_id = p_candidate_id and access.status = 'active'
  ) or not exists (
    select 1 from public.client_feature_entitlements entitlement
    where entitlement.client_id = v_client_id
      and entitlement.status = 'active' and btrim(entitlement.plan_code) <> ''
      and entitlement.valid_from <= now()
      and (entitlement.valid_until is null or entitlement.valid_until > now())
  ) or (p_job_id is not null and not exists (
    select 1 from public.client_job_ownership ownership
    where ownership.client_id = v_client_id
      and ownership.job_id = p_job_id and ownership.status = 'active'
  )) then
    raise exception using errcode = 'P0001', message = 'chat_scope_not_available';
  end if;

  insert into public.chat_conversations
    (channel_kind, organization_id, client_id, job_id, candidate_id,
     created_by_profile_id)
  values ('client_candidate', v_organization_id, v_client_id, p_job_id,
          p_candidate_id, p_client_profile_id)
  on conflict do nothing returning id into v_conversation_id;
  if v_conversation_id is null then
    select id into v_conversation_id from public.chat_conversations
    where channel_kind = 'client_candidate' and status = 'active'
      and created_by_profile_id = p_client_profile_id
      and candidate_id = p_candidate_id
      and job_id is not distinct from p_job_id;
    if v_conversation_id is null then
      raise exception using errcode = 'P0001', message = 'chat_conversation_inconsistent';
    end if;
    if (select count(*) from public.chat_conversation_participants
        where conversation_id = v_conversation_id) <> 2
       or not exists (
         select 1 from public.chat_conversation_participants
         where conversation_id = v_conversation_id
           and user_profile_id = p_client_profile_id
           and role_snapshot = 'client' and status = 'active'
       ) or not exists (
         select 1 from public.chat_conversation_participants
         where conversation_id = v_conversation_id
           and user_profile_id = v_candidate_profile_id
           and role_snapshot = 'candidate' and status = 'active'
       ) then
      raise exception using errcode = 'P0001', message = 'chat_conversation_inconsistent';
    end if;
  else
    insert into public.chat_conversation_participants
      (conversation_id, user_profile_id, role_snapshot)
    values (v_conversation_id, p_client_profile_id, 'client'),
           (v_conversation_id, v_candidate_profile_id, 'candidate');
  end if;
  return v_conversation_id;
end
$$;
revoke all on function public.create_client_candidate_chat_conversation(uuid, uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.create_client_candidate_chat_conversation(uuid, uuid, uuid)
  to service_role;

-- A client may contact only an actively assigned recruiter while any paid
-- subscription is active. An optional job remains inside the client's scope.
create function public.create_client_recruiter_chat_conversation(
  p_client_profile_id uuid, p_recruiter_profile_id uuid, p_job_id uuid default null
) returns uuid language plpgsql security invoker set search_path = '' as $$
declare
  v_client_id uuid;
  v_organization_id uuid;
  v_conversation_id uuid;
  v_recruiter_role text;
begin
  select client.client_id, client.organization_id, recruiter.role
    into v_client_id, v_organization_id, v_recruiter_role
  from public.user_profiles client
  join public.organizations org
    on org.id = client.organization_id
   and org.organization_type = 'client' and org.status = 'active'
  join public.user_profiles recruiter
    on recruiter.id = p_recruiter_profile_id
   and recruiter.role in ('recruiter', 'recruiter_manager')
   and recruiter.status = 'active'
  join public.client_memberships membership
    on membership.user_profile_id = client.id
   and membership.organization_id = client.organization_id
   and membership.client_id = client.client_id
   and membership.status = 'active'
  join public.client_recruiter_assignments assignment
    on assignment.client_id = client.client_id
   and assignment.recruiter_profile_id = recruiter.id
   and assignment.status = 'active'
  where client.id = p_client_profile_id
    and client.role = 'client' and client.status = 'active'
    and exists (
      select 1 from public.client_feature_entitlements entitlement
      where entitlement.client_id = client.client_id
        and entitlement.status = 'active' and btrim(entitlement.plan_code) <> ''
        and entitlement.valid_from <= now()
        and (entitlement.valid_until is null or entitlement.valid_until > now())
    )
    and (p_job_id is null or exists (
      select 1 from public.client_job_ownership ownership
      where ownership.client_id = client.client_id
        and ownership.job_id = p_job_id and ownership.status = 'active'
    ));
  if v_client_id is null or v_organization_id is null or v_recruiter_role is null then
    raise exception using errcode = 'P0001', message = 'chat_scope_not_available';
  end if;

  insert into public.chat_conversations
    (channel_kind, organization_id, client_id, job_id,
     created_by_profile_id, recipient_profile_id)
  values ('client_recruiter', v_organization_id, v_client_id, p_job_id,
          p_client_profile_id, p_recruiter_profile_id)
  on conflict do nothing returning id into v_conversation_id;
  if v_conversation_id is null then
    select id into v_conversation_id from public.chat_conversations
    where channel_kind = 'client_recruiter' and status = 'active'
      and created_by_profile_id = p_client_profile_id
      and recipient_profile_id = p_recruiter_profile_id
      and job_id is not distinct from p_job_id;
    if v_conversation_id is null
       or (select count(*) from public.chat_conversation_participants
           where conversation_id = v_conversation_id) <> 2
       or not exists (
         select 1 from public.chat_conversation_participants
         where conversation_id = v_conversation_id
           and user_profile_id = p_client_profile_id
           and role_snapshot = 'client' and status = 'active'
       ) or not exists (
         select 1 from public.chat_conversation_participants
         where conversation_id = v_conversation_id
           and user_profile_id = p_recruiter_profile_id
           and role_snapshot = v_recruiter_role and status = 'active'
       ) then
      raise exception using errcode = 'P0001', message = 'chat_conversation_inconsistent';
    end if;
  else
    insert into public.chat_conversation_participants
      (conversation_id, user_profile_id, role_snapshot)
    values (v_conversation_id, p_client_profile_id, 'client'),
           (v_conversation_id, p_recruiter_profile_id, v_recruiter_role);
  end if;
  return v_conversation_id;
end
$$;
revoke all on function public.create_client_recruiter_chat_conversation(uuid, uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.create_client_recruiter_chat_conversation(uuid, uuid, uuid)
  to service_role;

-- Recruiter initiates one private thread with an active admin in the same
-- internal organization. No client or candidate record is inferred here.
create function public.create_recruiter_admin_chat_conversation(
  p_recruiter_profile_id uuid, p_admin_profile_id uuid
) returns uuid language plpgsql security invoker set search_path = '' as $$
declare
  v_organization_id uuid;
  v_conversation_id uuid;
begin
  select recruiter.organization_id into v_organization_id
  from public.user_profiles recruiter
  join public.user_profiles admin
    on admin.id = p_admin_profile_id
   and admin.role = 'admin' and admin.status = 'active'
   and admin.organization_id = recruiter.organization_id
  join public.organizations org
    on org.id = recruiter.organization_id
   and org.organization_type = 'internal' and org.status = 'active'
  where recruiter.id = p_recruiter_profile_id
    and recruiter.role in ('recruiter', 'recruiter_manager')
    and recruiter.status = 'active';
  if v_organization_id is null then
    raise exception 'Recruiter admin chat scope unavailable';
  end if;
  insert into public.chat_conversations
    (channel_kind, organization_id, created_by_profile_id, recipient_profile_id)
  values ('recruiter_admin', v_organization_id,
          p_recruiter_profile_id, p_admin_profile_id)
  on conflict do nothing returning id into v_conversation_id;
  if v_conversation_id is null then
    select id into v_conversation_id from public.chat_conversations
    where channel_kind = 'recruiter_admin' and status = 'active'
      and created_by_profile_id = p_recruiter_profile_id
      and recipient_profile_id = p_admin_profile_id;
    if v_conversation_id is null then
      raise exception 'Recruiter admin conversation conflict';
    end if;
    if (select count(*) from public.chat_conversation_participants
        where conversation_id = v_conversation_id) <> 2
       or not exists (
         select 1 from public.chat_conversation_participants
         where conversation_id = v_conversation_id
           and user_profile_id = p_recruiter_profile_id
           and role_snapshot = (select role from public.user_profiles
                                where id = p_recruiter_profile_id)
           and status = 'active'
       ) or not exists (
         select 1 from public.chat_conversation_participants
         where conversation_id = v_conversation_id
           and user_profile_id = p_admin_profile_id
           and role_snapshot = 'admin' and status = 'active'
       ) then
      raise exception 'Recruiter admin participants invalid';
    end if;
  else
    insert into public.chat_conversation_participants
      (conversation_id, user_profile_id, role_snapshot)
    select v_conversation_id, id, role from public.user_profiles
    where id in (p_recruiter_profile_id, p_admin_profile_id);
    if (select count(*) from public.chat_conversation_participants
        where conversation_id = v_conversation_id) <> 2 then
      raise exception 'Recruiter admin participant insert failed';
    end if;
  end if;
  return v_conversation_id;
end
$$;
revoke all on function public.create_recruiter_admin_chat_conversation(uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.create_recruiter_admin_chat_conversation(uuid, uuid)
  to service_role;

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
alter table public.chat_message_receipt_events enable row level security;
alter table public.chat_message_receipt_events force row level security;

revoke all on public.chat_conversations,
  public.chat_conversation_participants, public.chat_messages,
  public.chat_message_events, public.chat_message_receipts,
  public.chat_message_receipt_events
  from public, anon, authenticated;
grant select, insert, update on public.chat_conversations,
  public.chat_conversation_participants, public.chat_message_receipts
  to service_role;
grant select, insert on public.chat_messages, public.chat_message_events
  to service_role;
grant select, insert on public.chat_message_receipt_events to service_role;

commit;
