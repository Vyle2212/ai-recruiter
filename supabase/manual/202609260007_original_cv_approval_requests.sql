-- Recruiter requests and atomic admin decisions. No candidate/CV data is copied.
begin;

create table public.recruiter_original_cv_requests (
  id uuid primary key default gen_random_uuid(),
  candidate_id uuid not null,
  recruiter_profile_id uuid not null references public.user_profiles(id) on delete restrict,
  purpose text not null check (purpose in ('headhunting', 'client_support')),
  client_id uuid,
  status text not null default 'pending' check (status in ('pending', 'approved', 'denied')),
  requested_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by_profile_id uuid references public.user_profiles(id) on delete restrict,
  check ((purpose = 'headhunting' and client_id is null)
     or (purpose = 'client_support' and client_id is not null)),
  check ((status = 'pending' and resolved_at is null and resolved_by_profile_id is null)
     or (status <> 'pending' and resolved_at is not null and resolved_by_profile_id is not null))
);
create unique index recruiter_original_cv_requests_one_pending_uidx
  on public.recruiter_original_cv_requests (candidate_id, recruiter_profile_id)
  where status = 'pending';
create index recruiter_original_cv_requests_admin_queue_idx
  on public.recruiter_original_cv_requests (requested_at, id)
  where status = 'pending';
create index recruiter_original_cv_requests_recruiter_idx
  on public.recruiter_original_cv_requests (recruiter_profile_id, requested_at desc);

alter table public.recruiter_original_cv_requests enable row level security;
alter table public.recruiter_original_cv_requests force row level security;
revoke all on public.recruiter_original_cv_requests from public, anon, authenticated;
grant select, insert, update on public.recruiter_original_cv_requests to service_role;

-- The pending request is locked, the grant and immutable event are written,
-- and the request is resolved in one database transaction.
create function public.approve_recruiter_original_cv_request(
  p_request_id uuid,
  p_admin_profile_id uuid,
  p_expires_at timestamptz
) returns uuid language plpgsql security invoker set search_path = '' as $$
declare
  v_request public.recruiter_original_cv_requests%rowtype;
  v_grant_id uuid;
  v_now timestamptz := clock_timestamp();
begin
  if not exists (
    select 1 from public.user_profiles
    where id = p_admin_profile_id and role = 'admin' and status = 'active'
  ) then
    raise exception 'Active admin required';
  end if;
  if p_expires_at <= v_now or p_expires_at > v_now + interval '90 days' then
    raise exception 'Invalid CV approval expiry';
  end if;
  select * into v_request from public.recruiter_original_cv_requests
    where id = p_request_id and status = 'pending' for update;
  if not found then
    raise exception 'Pending CV request required';
  end if;
  if not exists (
    select 1 from public.user_profiles
    where id = v_request.recruiter_profile_id
      and role in ('recruiter', 'recruiter_manager') and status = 'active'
  ) then
    raise exception 'Active recruiter required';
  end if;

  insert into public.recruiter_original_cv_grants (
    candidate_id, recruiter_profile_id, approved_by_profile_id,
    updated_by_profile_id, purpose, client_id, status,
    approved_at, expires_at, revoked_at, updated_at
  ) values (
    v_request.candidate_id, v_request.recruiter_profile_id, p_admin_profile_id,
    p_admin_profile_id, v_request.purpose, v_request.client_id, 'active',
    v_now, p_expires_at, null, v_now
  ) on conflict (candidate_id, recruiter_profile_id) do update set
    approved_by_profile_id = excluded.approved_by_profile_id,
    updated_by_profile_id = excluded.updated_by_profile_id,
    purpose = excluded.purpose,
    client_id = excluded.client_id,
    status = 'active',
    approved_at = excluded.approved_at,
    expires_at = excluded.expires_at,
    revoked_at = null,
    updated_at = excluded.updated_at
  returning id into v_grant_id;

  update public.recruiter_original_cv_requests
    set status = 'approved', resolved_at = v_now,
        resolved_by_profile_id = p_admin_profile_id
    where id = p_request_id;
  return v_grant_id;
end;
$$;
revoke all on function public.approve_recruiter_original_cv_request(uuid, uuid, timestamptz)
  from public, anon, authenticated;
grant execute on function public.approve_recruiter_original_cv_request(uuid, uuid, timestamptz)
  to service_role;

commit;
