const { PGlite } = await import(
  process.env.PGLITE_MODULE_PATH || "@electric-sql/pglite"
);
import assert from "node:assert/strict";
import fs from "node:fs";

const db = new PGlite();
await db.exec(`
create role anon; create role authenticated; create role service_role; create role supabase_auth_admin;
create schema auth; create schema chat_auth_private;
create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz);
create table public.acceptance_environment_markers(singleton boolean,project_ref text,classification text,acceptance_enabled boolean,harness_version text);
insert into public.acceptance_environment_markers values(true,'iujucosewivndjpcjbuz','acceptance',true,'production-trust-authenticated-acceptance-v2');
grant select on public.acceptance_environment_markers to service_role;
create table chat_auth_private.verified_identities(id uuid primary key references auth.users(id) on delete cascade,email_verified boolean not null);
create function chat_auth_private.sync_verified_identity() returns trigger language plpgsql security invoker set search_path='' as $body$
begin insert into chat_auth_private.verified_identities(id,email_verified) values(new.id,new.email_confirmed_at is not null)
on conflict(id) do update set email_verified=excluded.email_verified; return new; end $body$;
create trigger acceptance_chat_verified_identity_sync after insert or update of email_confirmed_at on auth.users for each row execute function chat_auth_private.sync_verified_identity();
revoke all on schema auth from public,anon,authenticated,service_role; grant usage on schema auth to supabase_auth_admin;
grant select,insert,update,delete on auth.users to supabase_auth_admin;
revoke all on schema chat_auth_private from public,anon,authenticated,service_role; grant usage on schema chat_auth_private to service_role,supabase_auth_admin;
grant select on chat_auth_private.verified_identities to service_role; grant select,insert,update,delete on chat_auth_private.verified_identities to supabase_auth_admin;
create table public.candidates(id uuid primary key,name text,email text,normalized_email text,status text,profile_source_state jsonb not null default '{}'::jsonb check(jsonb_typeof(profile_source_state)='object'),profile_confirmation_status text not null default 'not_claimed' check(profile_confirmation_status in('not_claimed','claimed_incomplete','candidate_confirmed','recruiter_review_required')),profile_source_type text check(profile_source_type is null or profile_source_type in('admin_upload','candidate_upload','candidate_confirmed','recruiter_approved')));
create table public.user_profiles(id uuid primary key,auth_user_id uuid not null unique,email text not null,full_name text,role text not null check(role in('admin','recruiter_manager','recruiter','client','candidate','guest')),status text not null check(status in('invited','active','inactive','suspended','disabled')),candidate_id uuid unique,check((role='candidate' and candidate_id is not null) or (role='guest' and candidate_id is null and status<>'active')));
create unique index user_profiles_email_normalized_uidx on public.user_profiles(lower(btrim(email)));
create table public.candidate_accounts(id uuid primary key default gen_random_uuid(),user_profile_id uuid not null unique,candidate_id uuid not null unique,status text not null check(status in('active','inactive','suspended','disabled')));
grant select,insert,update,delete on public.candidates,public.user_profiles,public.candidate_accounts to service_role;
`);
const baseline = await db.query(
  "select md5(pg_get_functiondef('chat_auth_private.sync_verified_identity()'::regprocedure)) as hash",
);
const sql = fs
  .readFileSync(
    "supabase/acceptance/007_acceptance_candidate_registration_provision.sql",
    "utf8",
  )
  .replace("9cb97624874122a3e522e13cd4452cfc", baseline.rows[0].hash);
await db.exec(sql);
const verified = "00000000-0000-4000-8000-000000000001";
const collision = "00000000-0000-4000-8000-000000000002";
const profileCollision = "00000000-0000-4000-8000-000000000003";
const rollback = "00000000-0000-4000-8000-000000000004";
await db.exec(`set role supabase_auth_admin; insert into auth.users values('${verified}','New@Example.invalid',now()),('${collision}','existing@example.invalid',now()),('${profileCollision}','profile@example.invalid',now()),('${rollback}','rollback@example.invalid',now()); reset role;
insert into public.candidates(id,email,normalized_email) values('10000000-0000-4000-8000-000000000001','existing@example.invalid','existing@example.invalid');`);
await db.exec("set role service_role");
const call = async (id, email, name = "Synthetic Candidate") =>
  (
    await db.query(
      "select public.provision_verified_candidate_registration($1,$2,$3) as result",
      [id, email, name],
    )
  ).rows[0].result;
assert.deepEqual(await call(verified, "new@example.invalid"), {
  status: "created",
});
assert.deepEqual(await call(verified, "new@example.invalid"), {
  status: "already_owned",
});
assert.deepEqual(await call(collision, "existing@example.invalid"), {
  status: "identity_review_required",
});
await db.exec(
  `insert into public.user_profiles(id,auth_user_id,email,role,status) values('20000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000001','profile@example.invalid','guest','invited')`,
);
assert.deepEqual(await call(profileCollision, "profile@example.invalid"), {
  status: "identity_review_required",
});
assert.equal(
  (await db.query("select count(*)::int as n from public.candidates")).rows[0]
    .n,
  2,
);
await assert.rejects(
  call(collision, "other@example.invalid"),
  /verified_identity_required/,
);
await db.exec(`reset role; create function public.test_candidate_account_failure() returns trigger language plpgsql as $body$
begin if exists(select 1 from public.user_profiles where id=new.user_profile_id and email='rollback@example.invalid') then raise exception 'synthetic_account_failure'; end if; return new; end $body$;
create trigger test_candidate_account_failure before insert on public.candidate_accounts for each row execute function public.test_candidate_account_failure();`);
await db.exec("set role service_role");
await assert.rejects(
  call(rollback, "rollback@example.invalid"),
  /synthetic_account_failure/,
);
assert.equal(
  (
    await db.query(
      "select count(*)::int as n from public.candidates where normalized_email='rollback@example.invalid'",
    )
  ).rows[0].n,
  0,
);
assert.equal(
  (
    await db.query(
      "select count(*)::int as n from public.user_profiles where email='rollback@example.invalid'",
    )
  ).rows[0].n,
  0,
);
for (const role of ["anon", "authenticated"]) {
  await db.exec(`reset role; set role ${role}`);
  await assert.rejects(
    db.query(
      "select public.provision_verified_candidate_registration($1,$2,$3)",
      [verified, "new@example.invalid", "Synthetic"],
    ),
    /permission denied/,
  );
}
await db.exec("reset role");
const definition = (
  await db.query(
    "select prosecdef,pg_get_functiondef(oid) as body from pg_proc where oid='public.provision_verified_candidate_registration(uuid,text,text)'::regprocedure",
  )
).rows[0];
assert.equal(definition.prosecdef, false);
assert.ok(!definition.body.includes("raw_user_meta_data"));
await assert.rejects(db.exec(sql), /already_installed|identity_sync_changed/);
await db.close();
console.log(
  "PASS: exact acceptance guard, verified email projection, atomic new ownership, idempotent readback, candidate/profile collision holds, transaction rollback, role denial, invoker security, repeat guard.",
);
