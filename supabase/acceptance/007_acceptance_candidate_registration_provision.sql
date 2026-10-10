-- MANUAL REVIEW ONLY. Acceptance-only candidate registration provisioning.
-- Never claims an imported candidate. Exact-email collisions require review.
-- The caller must first obtain a fresh server-confirmed Auth user.
begin;

do $$
begin
  if not exists (select 1 from public.acceptance_environment_markers
    where singleton and project_ref = 'iujucosewivndjpcjbuz'
      and classification = 'acceptance' and acceptance_enabled
      and harness_version = 'production-trust-authenticated-acceptance-v2') then
    raise exception 'acceptance_candidate_registration_environment_blocked';
  end if;
  if has_table_privilege('service_role', 'auth.users', 'SELECT') then
    raise exception 'acceptance_candidate_registration_auth_grant_unexpected';
  end if;
  if md5(pg_get_functiondef('chat_auth_private.sync_verified_identity()'::regprocedure))
       <> '9cb97624874122a3e522e13cd4452cfc' then
    raise exception 'acceptance_candidate_registration_identity_sync_changed';
  end if;
  if to_regprocedure('public.provision_verified_candidate_registration(uuid,text,text)') is not null then
    raise exception 'acceptance_candidate_registration_already_installed';
  end if;
end $$;

alter table chat_auth_private.verified_identities
  add column normalized_email text;

create or replace function chat_auth_private.sync_verified_identity()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  insert into chat_auth_private.verified_identities
    (id, email_verified, normalized_email)
  values (
    new.id,
    new.email_confirmed_at is not null,
    nullif(lower(btrim(new.email)), '')
  )
  on conflict (id) do update set
    email_verified = excluded.email_verified,
    normalized_email = excluded.normalized_email;
  return new;
end $$;
revoke all on function chat_auth_private.sync_verified_identity()
  from public, anon, authenticated, service_role;
grant execute on function chat_auth_private.sync_verified_identity()
  to supabase_auth_admin;

-- Serialize the projection backfill against Auth identity changes.
lock table auth.users in share row exclusive mode;
drop trigger acceptance_chat_verified_identity_sync on auth.users;
create trigger acceptance_chat_verified_identity_sync
  after insert or update of email, email_confirmed_at on auth.users
  for each row execute function chat_auth_private.sync_verified_identity();
update chat_auth_private.verified_identities projection
set normalized_email = nullif(lower(btrim(auth_user.email)), '')
from auth.users auth_user where auth_user.id = projection.id;

create function public.provision_verified_candidate_registration(
  p_auth_user_id uuid,
  p_email text,
  p_full_name text
) returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_normalized_email text := lower(btrim(p_email));
  v_normalized_name text := btrim(p_full_name);
  existing_profile public.user_profiles%rowtype;
  existing_account public.candidate_accounts%rowtype;
  candidate_match_count integer;
  new_candidate_id uuid := gen_random_uuid();
  new_profile_id uuid := gen_random_uuid();
begin
  if current_user <> 'service_role' then
    raise exception 'candidate_registration_service_role_required';
  end if;
  if not exists (select 1 from public.acceptance_environment_markers
    where singleton and project_ref = 'iujucosewivndjpcjbuz'
      and classification = 'acceptance' and acceptance_enabled
      and harness_version = 'production-trust-authenticated-acceptance-v2') then
    raise exception 'candidate_registration_environment_blocked';
  end if;
  if p_auth_user_id is null
     or v_normalized_email is null or v_normalized_email = '' or length(v_normalized_email) > 254
     or v_normalized_email !~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$'
     or v_normalized_name is null or v_normalized_name = '' or length(v_normalized_name) > 120
     or v_normalized_name ~ '[[:cntrl:]]' then
    raise exception 'candidate_registration_input_invalid';
  end if;
  if not exists (
    select 1 from chat_auth_private.verified_identities identity_row
    where identity_row.id = p_auth_user_id
      and identity_row.email_verified
      and identity_row.normalized_email = v_normalized_email
  ) then
    raise exception 'candidate_registration_verified_identity_required';
  end if;

  select * into existing_profile from public.user_profiles
  where auth_user_id = p_auth_user_id for update;
  if found then
    select * into existing_account from public.candidate_accounts
    where user_profile_id = existing_profile.id for update;
    if existing_profile.role = 'candidate'
       and existing_profile.status = 'active'
       and lower(btrim(existing_profile.email)) = v_normalized_email
       and existing_profile.candidate_id is not null
       and found
       and existing_account.status = 'active'
       and existing_account.candidate_id = existing_profile.candidate_id
       and exists (select 1 from public.candidates candidate
         where candidate.id = existing_profile.candidate_id
           and coalesce(nullif(candidate.normalized_email, ''), lower(btrim(candidate.email))) = v_normalized_email) then
      return jsonb_build_object('status', 'already_owned');
    end if;
    return jsonb_build_object('status', 'identity_review_required');
  end if;

  if exists (select 1 from public.user_profiles profile
    where lower(btrim(profile.email)) = v_normalized_email) then
    return jsonb_build_object('status', 'identity_review_required');
  end if;

  select count(*) into candidate_match_count from public.candidates candidate
  where coalesce(nullif(candidate.normalized_email, ''), lower(btrim(candidate.email))) = v_normalized_email;
  if candidate_match_count > 0 then
    return jsonb_build_object('status', 'identity_review_required');
  end if;

  insert into public.candidates (
    id, name, email, normalized_email, status, profile_source_state,
    profile_confirmation_status
  ) values (
    new_candidate_id, v_normalized_name, v_normalized_email, v_normalized_email, 'New',
    jsonb_build_object('origin', 'candidate_signup', 'field_sources', jsonb_build_object()),
    'not_claimed'
  );
  insert into public.user_profiles (
    id, auth_user_id, email, full_name, role, status, candidate_id
  ) values (
    new_profile_id, p_auth_user_id, v_normalized_email, v_normalized_name,
    'candidate', 'active', new_candidate_id
  );
  insert into public.candidate_accounts (user_profile_id, candidate_id, status)
  values (new_profile_id, new_candidate_id, 'active');

  select count(*) into candidate_match_count from public.candidates candidate
  where coalesce(nullif(candidate.normalized_email, ''), lower(btrim(candidate.email))) = v_normalized_email;
  if candidate_match_count <> 1
     or not exists (select 1 from public.user_profiles profile
       join public.candidate_accounts account
         on account.user_profile_id = profile.id and account.candidate_id = profile.candidate_id
       where profile.id = new_profile_id and profile.auth_user_id = p_auth_user_id
         and profile.role = 'candidate' and profile.status = 'active'
         and account.status = 'active')
     or not exists (select 1 from chat_auth_private.verified_identities identity_row
       where identity_row.id = p_auth_user_id and identity_row.email_verified
         and identity_row.normalized_email = v_normalized_email) then
    raise exception 'candidate_registration_readback_failed';
  end if;
  return jsonb_build_object('status', 'created');
exception
  when unique_violation then
    -- The whole function statement rolls back. A retry performs exact readback.
    return jsonb_build_object('status', 'retry_required');
end $$;

revoke all on function public.provision_verified_candidate_registration(uuid,text,text)
  from public, anon, authenticated;
grant execute on function public.provision_verified_candidate_registration(uuid,text,text)
  to service_role;

commit;
