import assert from "node:assert/strict";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  installAcceptanceComparisonPack,
  removeAcceptanceComparisonPack,
  verifyAcceptanceComparisonPackAbsent,
} from "../lib/acceptanceComparisonPackRuntime";

const expected = {
  runId: "ptf1c2-gh-123456-1",
  syntheticNamespace: "ptf1c2/test",
  environmentId: "acceptance",
  projectRef: "acceptance-test",
  expectedCommitSha: "a".repeat(40),
  expiresAt: "2026-10-07T00:00:00Z",
};
function database() {
  const tables = new Map<string, Record<string, any>[]>();
  const deletes: string[] = [];
  let failure = "";
  const client = {
    from(table: string) {
      let action = "select",
        key = "",
        ids: string[] = [],
        values: any[] = [],
        head = false;
      const query = {
        select(_columns: string, options?: { head?: boolean }) {
          head = !!options?.head;
          return query;
        },
        in(column: string, selected: string[]) {
          key = column;
          ids = selected;
          return query;
        },
        insert(rows: any[]) {
          action = "insert";
          values = rows;
          return query;
        },
        delete() {
          action = "delete";
          return query;
        },
        then(resolve: (value: any) => any, reject: (error: any) => any) {
          if (failure === `${action}:${table}`)
            return Promise.resolve({ error: { code: "42501" } }).then(
              resolve,
              reject,
            );
          const rows = tables.get(table) || [];
          const selected = key
            ? rows.filter((row) => ids.includes(row[key]))
            : rows;
          if (action === "insert")
            tables.set(table, [...rows, ...structuredClone(values)]);
          if (action === "delete") {
            deletes.push(table);
            tables.set(
              table,
              rows.filter((row) => !ids.includes(row[key])),
            );
          }
          return Promise.resolve({
            error: null,
            data: head ? null : structuredClone(selected),
            count: selected.length,
          }).then(resolve, reject);
        },
      };
      return query;
    },
  } as unknown as SupabaseClient;
  return {
    client,
    tables,
    deletes,
    fail(value: string) {
      failure = value;
    },
  };
}
async function main() {
  const clean = database();
  await installAcceptanceComparisonPack(clean.client, expected);
  assert.equal(clean.tables.get("candidates")?.length, 25);
  await assert.rejects(
    installAcceptanceComparisonPack(clean.client, expected),
    /namespace_unavailable/,
  );
  await removeAcceptanceComparisonPack(clean.client, expected);
  await verifyAcceptanceComparisonPackAbsent(clean.client, expected);
  await removeAcceptanceComparisonPack(clean.client, expected);
  for (const scenario of [
    "foreign",
    "orphan",
    "dependency",
    "permission",
    "real-contact",
  ] as const) {
    const db = database();
    await installAcceptanceComparisonPack(db.client, expected);
    if (scenario === "foreign")
      db.tables.get("acceptance_synthetic_candidates")![0].owner_run_id =
        "another-run";
    if (scenario === "orphan")
      db.tables.set("acceptance_synthetic_candidates", []);
    if (scenario === "dependency")
      db.tables.set("candidate_chat_contact_consents", [
        { candidate_id: db.tables.get("candidates")![0].id },
      ]);
    if (scenario === "permission")
      db.fail("select:candidate_chat_contact_consents");
    if (scenario === "real-contact")
      db.tables.get("candidates")![0].phone = "real-contact";
    await assert.rejects(removeAcceptanceComparisonPack(db.client, expected));
    assert.deepEqual(
      db.deletes,
      [],
      `${scenario} must fail before any deletion`,
    );
  }
  const partial = database();
  partial.fail("insert:candidate_search_index");
  await assert.rejects(
    installAcceptanceComparisonPack(partial.client, expected),
  );
  partial.fail("");
  await removeAcceptanceComparisonPack(partial.client, expected);
  await verifyAcceptanceComparisonPackAbsent(partial.client, expected);
  console.log("Acceptance comparison pack install/cleanup safety passed.");
}
void main();
