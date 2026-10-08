// Isolated test dependency; no application/runtime dependency.
const { PGlite } = await import(
  process.env.PGLITE_MODULE_PATH || "@electric-sql/pglite"
);
import assert from "node:assert/strict";
import fs from "node:fs";
const db = new PGlite();
await db.exec(`create role anon; create role authenticated; create role service_role; create role supabase_auth_admin;
create schema auth; create table auth.users(id uuid primary key,email_confirmed_at timestamptz);
grant usage on schema auth to supabase_auth_admin; grant select,insert,update,delete on auth.users to supabase_auth_admin;
create table public.acceptance_environment_markers(singleton boolean,project_ref text,classification text,acceptance_enabled boolean,harness_version text);
insert into public.acceptance_environment_markers values(true,'iujucosewivndjpcjbuz','acceptance',true,'production-trust-authenticated-acceptance-v2');
insert into auth.users values('00000000-0000-0000-0000-000000000001',null),('00000000-0000-0000-0000-000000000002',now());`);
// Public function definitions only, captured read-only; no user rows/secrets.
await db.exec(
  fs.readFileSync(
    "scripts/fixtures/acceptanceChatVerifiedIdentityBaseline.sql",
    "utf8",
  ),
);
const sql = fs.readFileSync(
  "supabase/acceptance/006_acceptance_chat_verified_identity.sql",
  "utf8",
);
await db.exec(sql);
await db.exec("set role service_role");
const rows = (
  await db.query(
    "select * from chat_auth_private.verified_identities order by id",
  )
).rows;
assert.deepEqual(
  rows.map((x) => x.email_verified),
  [false, true],
);
await db.exec(
  `reset role; set role supabase_auth_admin; update auth.users set email_confirmed_at=now() where id='00000000-0000-0000-0000-000000000001'; update auth.users set email_confirmed_at=null where id='00000000-0000-0000-0000-000000000002'; insert into auth.users values('00000000-0000-0000-0000-000000000003',now()); reset role; set role service_role;`,
);
assert.deepEqual(
  (
    await db.query(
      "select email_verified from chat_auth_private.verified_identities order by id",
    )
  ).rows.map((x) => x.email_verified),
  [true, false, true],
);
for (const query of [
  "select id from auth.users",
  "update chat_auth_private.verified_identities set email_verified=true",
  "delete from chat_auth_private.verified_identities",
  "insert into chat_auth_private.verified_identities values(gen_random_uuid(),true)",
])
  await assert.rejects(db.query(query), /permission denied/);
await db.exec(
  `reset role; set role supabase_auth_admin; delete from auth.users where id='00000000-0000-0000-0000-000000000003'; reset role; set role service_role;`,
);
assert.equal(
  (
    await db.query(
      "select count(*)::int as n from chat_auth_private.verified_identities",
    )
  ).rows[0].n,
  2,
);
for (const role of ["anon", "authenticated"]) {
  await db.exec(`reset role; set role ${role};`);
  await assert.rejects(
    db.query("select * from chat_auth_private.verified_identities"),
    /permission denied/,
  );
}
await db.exec("reset role");
const rewritten = (
  await db.query(
    `select proname,prosecdef,pg_get_functiondef(oid) as body from pg_proc where proname in ('create_client_candidate_chat_conversation','create_recruiter_candidate_chat_conversation','enforce_chat_message_active_scope')`,
  )
).rows;
for (const f of rewritten) {
  assert.equal(f.prosecdef, false);
  assert.ok(!f.body.includes("auth.users"));
  assert.ok(f.body.includes("chat_auth_private.verified_identities"));
  if (f.proname === "create_recruiter_candidate_chat_conversation") {
    assert.ok(!f.body.includes("entitlement.feature = 'recruiter_support'"));
    assert.ok(f.body.includes("entitlement.status = 'active'"));
    assert.ok(f.body.includes("entitlement.valid_from <= now()"));
  }
}
await assert.rejects(db.exec(sql), /definition_changed/);
await db.exec("rollback");
console.log(
  "PASS: exact live definition hashes, SQL compilation, backfill, Auth-role insert/update/revocation/delete, service read-only, private roles denied, invoker preserved, repeat guard. Live application flow not tested.",
);
await db.close();
