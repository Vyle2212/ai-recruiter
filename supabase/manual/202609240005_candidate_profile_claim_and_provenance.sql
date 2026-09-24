-- MANUAL, REVIEWED-RUN ONLY. DO NOT APPLY FROM CI.
-- Prepares provenance and an INTERNAL claim primitive. This does not implement
-- candidate signup or expose a callable claim endpoint. Production auth must
-- first support an active, verified candidate user with no candidate_id;
-- the staging-only ownership constraint/trigger does NOT support that state.
-- Do not execute this artifact until that production contract is reviewed.
begin;

do $preflight$
begin
  if to_regclass('public.candidates') is null
     or to_regclass('public.user_profiles') is null
     or to_regclass('public.candidate_accounts') is null then
    raise exception 'candidate profile claim preflight failed: required tables are missing';
  end if;
end
$preflight$;

alter table public.candidates
  add column if not exists profile_source_state jsonb not null default
    '{"origin":"admin_upload","field_sources":{}}'::jsonb,
  add column if not exists profile_confirmation_status text not null default 'not_claimed',
  add column if not exists candidate_confirmed_at timestamptz,
  add column if not exists claimed_by_candidate_at timestamptz;

do $constraints$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.candidates'::regclass
      and conname = 'candidates_profile_confirmation_status_check'
  ) then
    alter table public.candidates add constraint candidates_profile_confirmation_status_check
      check (profile_confirmation_status in (
        'not_claimed','claimed_incomplete','candidate_confirmed','recruiter_review_required'
      ));
  end if;
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.candidates'::regclass
      and conname = 'candidates_profile_source_state_object_check'
  ) then
    alter table public.candidates add constraint candidates_profile_source_state_object_check
      check (jsonb_typeof(profile_source_state) = 'object');
  end if;
end
$constraints$;

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table if not exists private.candidate_ingestion_events (
  id uuid primary key default gen_random_uuid(),
  candidate_id uuid,
  source_kind text not null check (source_kind in ('admin_upload','candidate_upload')),
  disposition text not null check (disposition in ('create_new','update_existing','hold_for_identity_review','reject_non_sap')),
  source_object_reference text not null,
  source_fingerprint text not null,
  reasons text[] not null default '{}',
  created_at timestamptz not null default now(),
  constraint candidate_ingestion_events_source_fingerprint_key unique (source_fingerprint)
);
revoke all on private.candidate_ingestion_events from public, anon, authenticated;

create or replace function private.claim_candidate_profile()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_auth_user_id uuid := (select auth.uid());
  v_profile_id uuid;
  v_email text;
  v_verified_auth_email text;
  v_candidate_ids uuid[];
  v_candidate_id uuid;
  v_profile_candidate_id uuid;
  v_owner_profile_id uuid;
  v_link_candidate_id uuid;
  v_link_status text;
begin
  if v_auth_user_id is null then raise exception 'authentication required'; end if;
  select lower(btrim(u.email)) into v_verified_auth_email
  from auth.users u
  where u.id = v_auth_user_id and u.email_confirmed_at is not null;
  if v_verified_auth_email is null or v_verified_auth_email = '' then
    raise exception 'verified email required';
  end if;

  select p.id, lower(btrim(p.email)), p.candidate_id
    into v_profile_id, v_email, v_profile_candidate_id
  from public.user_profiles p
  where p.auth_user_id = v_auth_user_id and p.role = 'candidate' and p.status = 'active'
  for update;
  if v_profile_id is null then raise exception 'active candidate profile required'; end if;
  if v_email is distinct from v_verified_auth_email then
    raise exception 'verified profile email mismatch';
  end if;

  select array_agg(matched.id order by matched.id) into v_candidate_ids
  from (
    select c.id from public.candidates c
    where lower(btrim(c.email)) = v_email
    order by c.id for update
  ) matched;
  if coalesce(cardinality(v_candidate_ids), 0) = 0 then
    return jsonb_build_object('status','no_exact_identity_match');
  end if;
  if cardinality(v_candidate_ids) <> 1 then
    return jsonb_build_object('status','identity_review_required','match_count',cardinality(v_candidate_ids));
  end if;
  v_candidate_id := v_candidate_ids[1];
  select a.user_profile_id into v_owner_profile_id
  from public.candidate_accounts a
  where a.candidate_id = v_candidate_id for update;
  select a.candidate_id, a.status into v_link_candidate_id, v_link_status
  from public.candidate_accounts a
  where a.user_profile_id = v_profile_id for update;
  if v_profile_candidate_id is not null
     or v_owner_profile_id is not null
     or v_link_candidate_id is not null then
    if v_profile_candidate_id = v_candidate_id
       and v_owner_profile_id = v_profile_id
       and v_link_candidate_id = v_candidate_id
       and v_link_status = 'active' then
      return jsonb_build_object('status','already_claimed','candidate_id',v_candidate_id);
    end if;
    -- Partially linked, inactive, or owned by someone else: never repair an
    -- existing mapping automatically through a self-service claim.
    return jsonb_build_object('status','identity_review_required');
  end if;

  insert into public.candidate_accounts(user_profile_id,candidate_id,status)
  values (v_profile_id,v_candidate_id,'active')
  on conflict do nothing;
  -- Unique user/candidate constraints arbitrate races without ever reassigning
  -- either side. An inactive ownership mapping must be reviewed, not revived.
  if not exists (
    select 1 from public.candidate_accounts a
    where a.user_profile_id = v_profile_id
      and a.candidate_id = v_candidate_id and a.status = 'active'
  ) then
    raise exception 'candidate claim conflict';
  end if;
  update public.user_profiles set candidate_id = v_candidate_id, updated_at = now()
  where id = v_profile_id;
  update public.candidates
  set profile_confirmation_status = 'claimed_incomplete',
      claimed_by_candidate_at = coalesce(claimed_by_candidate_at, now()),
      updated_at = now()
  where id = v_candidate_id;
  return jsonb_build_object('status','claimed_existing_profile','candidate_id',v_candidate_id);
end
$function$;

revoke all on function private.claim_candidate_profile() from public, anon, authenticated;
-- No EXECUTE grant until a reviewed, verified-email production signup and
-- server-only claim adapter have passed ownership/RLS/runtime acceptance.

commit;
