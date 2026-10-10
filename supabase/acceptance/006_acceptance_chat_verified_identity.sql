-- MANUAL REVIEW ONLY. Acceptance-only verified identity projection.
-- No Auth SELECT grant; existing chat functions remain SECURITY INVOKER.
-- Auth writes synchronously maintain only ID + email-verification boolean.
begin;
do $$
begin
  if not exists (select 1 from public.acceptance_environment_markers
    where singleton and project_ref = 'iujucosewivndjpcjbuz'
      and classification = 'acceptance' and acceptance_enabled
      and harness_version = 'production-trust-authenticated-acceptance-v2') then
    raise exception 'acceptance_chat_verified_identity_environment_blocked';
  end if;
  if has_table_privilege('service_role', 'auth.users', 'SELECT') then
    raise exception 'acceptance_chat_verified_identity_auth_grant_unexpected';
  end if;
  if md5(pg_get_functiondef('public.enforce_chat_message_active_scope()'::regprocedure))
       <> '40e9a584cc38c073396026da435effcf'
     or md5(pg_get_functiondef('public.create_client_candidate_chat_conversation(uuid,uuid,uuid)'::regprocedure))
       <> '695da1a689cfa8340e8f93e54d8e014a'
     or md5(pg_get_functiondef('public.create_recruiter_candidate_chat_conversation(uuid,uuid,uuid)'::regprocedure))
       <> '3d1427ce8d073efdca9ff60b6b77470a' then
    raise exception 'acceptance_chat_verified_identity_definition_changed';
  end if;
end $$;

create schema chat_auth_private;
revoke all on schema chat_auth_private from public, anon, authenticated, service_role;
grant usage on schema chat_auth_private to service_role, supabase_auth_admin;
create table chat_auth_private.verified_identities (
  id uuid primary key references auth.users(id) on delete cascade,
  email_verified boolean not null
);
alter table chat_auth_private.verified_identities enable row level security;
alter table chat_auth_private.verified_identities force row level security;
revoke all on chat_auth_private.verified_identities from public, anon, authenticated, service_role;
grant select on chat_auth_private.verified_identities to service_role;
grant select, insert, update, delete on chat_auth_private.verified_identities to supabase_auth_admin;
create policy auth_sync on chat_auth_private.verified_identities
  for all to supabase_auth_admin using (true) with check (true);
create policy server_read on chat_auth_private.verified_identities
  for select to service_role using (true);

create function chat_auth_private.sync_verified_identity()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  insert into chat_auth_private.verified_identities (id, email_verified)
    values (new.id, new.email_confirmed_at is not null)
    on conflict (id) do update set email_verified = excluded.email_verified;
  return new;
end $$;
revoke all on function chat_auth_private.sync_verified_identity() from public, anon, authenticated, service_role;
grant execute on function chat_auth_private.sync_verified_identity() to supabase_auth_admin;

-- Prevent a backfill/write race. Scope is this isolated acceptance database only.
lock table auth.users in share row exclusive mode;
create trigger acceptance_chat_verified_identity_sync
  after insert or update of email_confirmed_at on auth.users
  for each row execute function chat_auth_private.sync_verified_identity();
insert into chat_auth_private.verified_identities (id, email_verified)
  select id, email_confirmed_at is not null from auth.users;

do $$
declare
  function_id regprocedure;
  definition text;
  rewritten text;
begin
  foreach function_id in array array[
    'public.enforce_chat_message_active_scope()'::regprocedure,
    'public.create_client_candidate_chat_conversation(uuid,uuid,uuid)'::regprocedure,
    'public.create_recruiter_candidate_chat_conversation(uuid,uuid,uuid)'::regprocedure
  ] loop
    definition := pg_get_functiondef(function_id);
    rewritten := replace(definition, 'join auth.users candidate_auth',
      'join chat_auth_private.verified_identities candidate_auth');
    rewritten := replace(rewritten, 'candidate_auth.email_confirmed_at is not null',
      'candidate_auth.email_verified = true');
    rewritten := replace(rewritten, 'join auth.users auth_user',
      'join chat_auth_private.verified_identities auth_user');
    rewritten := replace(rewritten, 'auth_user.email_confirmed_at is not null',
      'auth_user.email_verified = true');
    -- The approved policy permits any active nonempty subscription plan.
    -- This live RPC still contains an obsolete recruiter_support-only predicate.
    if function_id = 'public.create_recruiter_candidate_chat_conversation(uuid,uuid,uuid)'::regprocedure then
      if position('and entitlement.feature = ''recruiter_support''' in rewritten) = 0 then
        raise exception 'acceptance_chat_verified_identity_subscription_definition_changed';
      end if;
      rewritten := replace(rewritten, 'and entitlement.feature = ''recruiter_support''', '');
    end if;
    if rewritten = definition or position('auth.users' in rewritten) > 0
       or position('email_confirmed_at' in rewritten) > 0 then
      raise exception 'acceptance_chat_verified_identity_rewrite_failed';
    end if;
    execute rewritten;
    if (select prosecdef from pg_proc where oid = function_id) then
      raise exception 'acceptance_chat_verified_identity_security_changed';
    end if;
  end loop;
end $$;
commit;
