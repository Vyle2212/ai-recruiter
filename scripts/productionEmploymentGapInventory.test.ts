import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(__dirname, "..");
const inventory = fs.readFileSync(
  path.join(
    root,
    "supabase/manual/202609240001_production_employment_gap_inventory.sql",
  ),
  "utf8",
);

assert.match(inventory, /production_employment_gap_inventory_v1/);
assert.match(
  inventory,
  /begin transaction isolation level repeatable read read only/i,
);
assert.match(inventory, /contains_candidate_identifiers', false/i);
assert.match(inventory, /database_writes', 0/i);
assert.match(inventory, /jsonb_array_length\(employment\)/i);
assert.match(inventory, /parser_versions/i);
assert.match(inventory, /source_text_available/i);
assert.match(inventory, /gap_groups/i);

for (const category of [
  "short-or-missing-source",
  "headed-table-needs-layout-review",
  "explicit-employer-label-needs-field-review",
  "near-heading-date-needs-boundary-review",
  "project-or-client-heavy-needs-employment-evidence",
  "other-narrative-or-layout-review",
]) {
  assert.match(inventory, new RegExp(`'${category}'`));
}

assert.doesNotMatch(
  inventory,
  /^\s*(?:alter|create|delete|drop|grant|insert|revoke|truncate|update)\b/im,
);
assert.doesNotMatch(
  inventory,
  /jsonb_build_object\([\s\S]*?'(?:candidate_id|name|email|phone|source_file|source|raw_text)'\s*,/i,
);

console.log("Production employment gap inventory regression passed.");
