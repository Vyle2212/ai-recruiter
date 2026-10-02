-- Reviewed-run candidate chat consent foundation. Acceptance first.
-- Does not enable chat, create users, or modify existing profile sharing consent.
begin;

do $preflight$
begin
  if to_regclass('public.candidates') is null
     or to_regclass('public.user_profiles') is null
     or to_regclass('public.candidate_accounts') is null then
    raise exception 'candidate_chat_consent_dependencies_missing';
  end if;
  if to_regclass('public.candidate_chat_contact_consents') is not null
     or to_regclass('public.candidate_chat_contact_consent_events') is not null then
    raise exception 'candidate_chat_consent_already_installed';
  end if;
end
$preflight$;

alter table public.candidate_accounts
  add constraint candidate_chat_contact_account_pair_key
  unique (user_profile_id, candidate_id);

create table public.candidate_chat_contact_consents (
  candidate_id uuid primary key references public.candidates(id) on delete restrict,
  user_profile_id uuid not null unique references public.user_profiles(id) on delete restrict,
  consent boolean not null default false,
  updated_at timestamptz not null default now(),
  constraint candidate_chat_contact_consent_ownership
    foreign key (user_profile_id, candidate_id)
    references public.candidate_accounts(user_profile_id, candidate_id)
);

create table public.candidate_chat_contact_consent_events (
  id uuid primary key default gen_random_uuid(),
  candidate_id uuid not null references public.candidates(id) on delete restrict,
  user_profile_id uuid not null references public.user_profiles(id) on delete restrict,
  consent boolean not null,
  changed_at timestamptz not null default now()
);
create index candidate_chat_contact_consent_events_candidate_idx
  on public.candidate_chat_contact_consent_events(candidate_id, changed_at desc);

create function public.record_candidate_chat_contact_consent()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  if tg_op = 'INSERT' or old.consent is distinct from new.consent then
    insert into public.candidate_chat_contact_consent_events
      (candidate_id, user_profile_id, consent)
    values (new.candidate_id, new.user_profile_id, new.consent);
  end if;
  return new;
end
$$;
revoke all on function public.record_candidate_chat_contact_consent()
  from public, anon, authenticated;
create trigger candidate_chat_contact_consent_audit
after insert or update on public.candidate_chat_contact_consents
for each row execute function public.record_candidate_chat_contact_consent();

create function public.reject_candidate_chat_contact_consent_event_change()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  raise exception 'Candidate chat contact consent audit is append-only';
end
$$;
revoke all on function public.reject_candidate_chat_contact_consent_event_change()
  from public, anon, authenticated;
create trigger candidate_chat_contact_consent_events_immutable
before update or delete on public.candidate_chat_contact_consent_events
for each row execute function public.reject_candidate_chat_contact_consent_event_change();

alter table public.candidate_chat_contact_consents enable row level security;
alter table public.candidate_chat_contact_consents force row level security;
alter table public.candidate_chat_contact_consent_events enable row level security;
alter table public.candidate_chat_contact_consent_events force row level security;
revoke all on public.candidate_chat_contact_consents,
  public.candidate_chat_contact_consent_events
  from public, anon, authenticated;
grant select, insert, update on public.candidate_chat_contact_consents
  to service_role;
grant select, insert on public.candidate_chat_contact_consent_events
  to service_role;

commit;
