-- Sanitized live function definitions, read-only snapshot. No user rows.
CREATE OR REPLACE FUNCTION public.create_client_candidate_chat_conversation(p_client_profile_id uuid, p_candidate_id uuid, p_job_id uuid DEFAULT NULL::uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.create_recruiter_candidate_chat_conversation(p_recruiter_profile_id uuid, p_candidate_id uuid, p_client_id uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare
  v_organization_id uuid;
  v_candidate_profile_id uuid;
  v_recruiter_role text;
  v_conversation_id uuid;
begin
  select client.organization_id, candidate.id, recruiter.role
    into v_organization_id, v_candidate_profile_id, v_recruiter_role
  from public.user_profiles recruiter
  join public.client_recruiter_assignments assignment
    on assignment.recruiter_profile_id = recruiter.id
   and assignment.client_id = p_client_id and assignment.status = 'active'
  join public.client_candidate_shares share
    on share.recruiter_profile_id = recruiter.id
   and share.client_id = p_client_id
   and share.candidate_id = p_candidate_id and share.status = 'active'
  join public.client_candidate_access access
    on access.client_id = p_client_id
   and access.candidate_id = p_candidate_id and access.status = 'active'
  join public.user_profiles client
    on client.client_id = p_client_id
   and client.role = 'client' and client.status = 'active'
  join public.organizations org
    on org.id = client.organization_id
   and org.organization_type = 'client' and org.status = 'active'
  join public.client_memberships membership
    on membership.user_profile_id = client.id
   and membership.organization_id = client.organization_id
   and membership.client_id = p_client_id and membership.status = 'active'
  join public.user_profiles candidate
    on candidate.candidate_id = p_candidate_id
   and candidate.role = 'candidate' and candidate.status = 'active'
  join public.candidate_accounts account
    on account.user_profile_id = candidate.id
   and account.candidate_id = p_candidate_id and account.status = 'active'
  join public.candidate_chat_contact_consents consent
    on consent.user_profile_id = candidate.id
   and consent.candidate_id = p_candidate_id and consent.consent = true
  join auth.users candidate_auth
    on candidate_auth.id = candidate.auth_user_id
   and candidate_auth.email_confirmed_at is not null
  where recruiter.id = p_recruiter_profile_id
    and recruiter.role in ('recruiter', 'recruiter_manager')
    and recruiter.status = 'active'
    and exists (
      select 1 from public.client_feature_entitlements entitlement
      where entitlement.client_id = p_client_id
        and entitlement.feature = 'recruiter_support'
        and entitlement.status = 'active' and btrim(entitlement.plan_code) <> ''
        and entitlement.valid_from <= now()
        and (entitlement.valid_until is null or entitlement.valid_until > now())
    )
  limit 1;
  if v_organization_id is null or v_candidate_profile_id is null then
    raise exception using errcode = 'P0001', message = 'chat_scope_not_available';
  end if;
  insert into public.chat_conversations
    (channel_kind, organization_id, client_id, candidate_id,
     created_by_profile_id, recipient_profile_id)
  values ('recruiter_candidate', v_organization_id, p_client_id, p_candidate_id,
          p_recruiter_profile_id, v_candidate_profile_id)
  on conflict do nothing returning id into v_conversation_id;
  if v_conversation_id is null then
    select id into v_conversation_id from public.chat_conversations
    where channel_kind = 'recruiter_candidate' and status = 'active'
      and created_by_profile_id = p_recruiter_profile_id
      and recipient_profile_id = v_candidate_profile_id
      and client_id = p_client_id;
    if v_conversation_id is null
       or (select count(*) from public.chat_conversation_participants
           where conversation_id = v_conversation_id) <> 2
       or not exists (
         select 1 from public.chat_conversation_participants
         where conversation_id = v_conversation_id
           and user_profile_id = p_recruiter_profile_id
           and role_snapshot = v_recruiter_role and status = 'active'
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
    values (v_conversation_id, p_recruiter_profile_id, v_recruiter_role),
           (v_conversation_id, v_candidate_profile_id, 'candidate');
  end if;
  return v_conversation_id;
end
$function$
;

CREATE OR REPLACE FUNCTION public.enforce_chat_message_active_scope()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
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
  ) then
    if not exists (
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
  end if;
  if exists (
    select 1 from public.chat_conversations c
    where c.id = new.conversation_id and c.channel_kind = 'client_recruiter'
  ) then
    if not exists (
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
  end if;
  if exists (
    select 1 from public.chat_conversations c
    where c.id = new.conversation_id and c.channel_kind = 'recruiter_candidate'
  ) then
    if not exists (
    select 1 from public.chat_conversations c
    join public.organizations org
      on org.id = c.organization_id
     and org.organization_type = 'client' and org.status = 'active'
    join public.user_profiles recruiter
      on recruiter.id = c.created_by_profile_id
     and recruiter.role in ('recruiter', 'recruiter_manager')
     and recruiter.status = 'active'
    join public.user_profiles candidate
      on candidate.id = c.recipient_profile_id
     and candidate.candidate_id = c.candidate_id
     and candidate.role = 'candidate' and candidate.status = 'active'
    join public.candidate_accounts account
      on account.user_profile_id = candidate.id
     and account.candidate_id = c.candidate_id and account.status = 'active'
    join public.candidate_chat_contact_consents consent
      on consent.user_profile_id = candidate.id
     and consent.candidate_id = c.candidate_id and consent.consent = true
    join auth.users candidate_auth
      on candidate_auth.id = candidate.auth_user_id
     and candidate_auth.email_confirmed_at is not null
    join public.chat_conversation_participants recruiter_participant
      on recruiter_participant.conversation_id = c.id
     and recruiter_participant.user_profile_id = recruiter.id
     and recruiter_participant.role_snapshot = recruiter.role
     and recruiter_participant.status = 'active'
    join public.chat_conversation_participants candidate_participant
      on candidate_participant.conversation_id = c.id
     and candidate_participant.user_profile_id = candidate.id
     and candidate_participant.role_snapshot = 'candidate'
     and candidate_participant.status = 'active'
    join public.client_recruiter_assignments assignment
      on assignment.client_id = c.client_id
     and assignment.recruiter_profile_id = recruiter.id
     and assignment.status = 'active'
    join public.client_candidate_shares share
      on share.client_id = c.client_id
     and share.recruiter_profile_id = recruiter.id
     and share.candidate_id = c.candidate_id and share.status = 'active'
    join public.client_candidate_access access
      on access.client_id = c.client_id
     and access.candidate_id = c.candidate_id and access.status = 'active'
    where c.id = new.conversation_id
      and new.sender_profile_id in (recruiter.id, candidate.id)
      and (select count(*) from public.chat_conversation_participants participant
           where participant.conversation_id = c.id) = 2
      and exists (
        select 1 from public.client_memberships membership
        join public.user_profiles client
          on client.id = membership.user_profile_id
         and client.role = 'client' and client.status = 'active'
         and client.client_id = c.client_id
         and client.organization_id = c.organization_id
        where membership.client_id = c.client_id
          and membership.organization_id = c.organization_id
          and membership.status = 'active'
      )
      and exists (
        select 1 from public.client_feature_entitlements entitlement
        where entitlement.client_id = c.client_id
          and entitlement.status = 'active'
          and btrim(entitlement.plan_code) <> ''
          and entitlement.valid_from <= now()
          and (entitlement.valid_until is null or entitlement.valid_until > now())
      )
  ) then
    raise exception 'Recruiter candidate chat permission changed';
    end if;
  end if;
  if exists (
    select 1 from public.chat_conversations c
    where c.id = new.conversation_id and c.channel_kind = 'recruiter_admin'
  ) then
    if not exists (
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
  end if;
  return new;
end
$function$
;
