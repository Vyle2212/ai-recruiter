-- Supervised production preparation. This records successful original-CV reads
-- without storing a filename, object key, CV content, contact detail or token.
begin;

create table public.recruiter_original_cv_access_events (
  id uuid primary key default gen_random_uuid(),
  candidate_id uuid not null,
  actor_profile_id uuid not null references public.user_profiles(id) on delete restrict,
  actor_role text not null check (actor_role in ('admin', 'recruiter_manager', 'recruiter')),
  grant_id uuid references public.recruiter_original_cv_grants(id) on delete restrict,
  purpose text not null check (purpose in ('administration', 'headhunting', 'client_support')),
  client_id uuid,
  accessed_at timestamptz not null default now(),
  check (
    (actor_role = 'admin' and grant_id is null and purpose = 'administration' and client_id is null)
    or
    (actor_role in ('recruiter_manager', 'recruiter') and grant_id is not null and (
      (purpose = 'headhunting' and client_id is null)
      or (purpose = 'client_support' and client_id is not null)
    ))
  )
);
create index recruiter_original_cv_access_events_actor_idx
  on public.recruiter_original_cv_access_events (actor_profile_id, accessed_at desc);
create index recruiter_original_cv_access_events_candidate_idx
  on public.recruiter_original_cv_access_events (candidate_id, accessed_at desc);
create index recruiter_original_cv_access_events_grant_idx
  on public.recruiter_original_cv_access_events (grant_id, accessed_at desc)
  where grant_id is not null;

-- Recheck the live actor, grant and client-support scope at the same moment the
-- event is appended. This closes the gap between the route's initial check and
-- delivery without copying source-file information into the audit table.
create function public.validate_recruiter_original_cv_access_event()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  if new.actor_role = 'admin' then
    if not exists (
      select 1 from public.user_profiles p
      where p.id = new.actor_profile_id and p.role = 'admin' and p.status = 'active'
    ) then
      raise exception 'Active admin required for original CV access';
    end if;
    return new;
  end if;

  if not exists (
    select 1
    from public.recruiter_original_cv_grants g
    join public.user_profiles p on p.id = g.recruiter_profile_id
    where g.id = new.grant_id
      and g.candidate_id = new.candidate_id
      and g.recruiter_profile_id = new.actor_profile_id
      and p.role = new.actor_role and p.status = 'active'
      and g.status = 'active' and g.revoked_at is null
      and g.approved_at <= clock_timestamp()
      and g.expires_at > clock_timestamp()
      and g.purpose = new.purpose
      and g.client_id is not distinct from new.client_id
      and (
        g.purpose = 'headhunting'
        or (
          g.purpose = 'client_support'
          and exists (
            select 1 from public.client_recruiter_assignments a
            where a.client_id = g.client_id
              and a.recruiter_profile_id = g.recruiter_profile_id
              and a.status = 'active'
          )
          and exists (
            select 1 from public.client_candidate_shares s
            where s.client_id = g.client_id
              and s.recruiter_profile_id = g.recruiter_profile_id
              and s.candidate_id = g.candidate_id
              and s.status = 'active'
          )
          and exists (
            select 1 from public.client_candidate_access a
            where a.client_id = g.client_id
              and a.candidate_id = g.candidate_id
              and a.status = 'active'
          )
          and exists (
            select 1 from public.client_feature_entitlements e
            where e.client_id = g.client_id
              and e.feature = 'recruiter_support'
              and e.status = 'active'
              and e.valid_from <= clock_timestamp()
              and (e.valid_until is null or e.valid_until > clock_timestamp())
          )
        )
      )
  ) then
    raise exception 'Current original CV entitlement required';
  end if;
  return new;
end;
$$;
revoke all on function public.validate_recruiter_original_cv_access_event()
  from public, anon, authenticated;
create trigger recruiter_original_cv_access_event_validate
before insert on public.recruiter_original_cv_access_events
for each row execute function public.validate_recruiter_original_cv_access_event();

create function public.reject_recruiter_original_cv_access_event_change()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  raise exception 'Original CV access audit is append-only';
end;
$$;
revoke all on function public.reject_recruiter_original_cv_access_event_change()
  from public, anon, authenticated;
create trigger recruiter_original_cv_access_event_immutable
before update or delete on public.recruiter_original_cv_access_events
for each row execute function public.reject_recruiter_original_cv_access_event_change();

alter table public.recruiter_original_cv_access_events enable row level security;
alter table public.recruiter_original_cv_access_events force row level security;
revoke all on public.recruiter_original_cv_access_events
  from public, anon, authenticated;
grant select, insert on public.recruiter_original_cv_access_events to service_role;

commit;
