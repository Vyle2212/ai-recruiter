import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const root = path.resolve(__dirname, "..");
const runner = path.join(
  root,
  "scripts/prepareProductionEmploymentReviewPack.ts",
);
const temp = fs.mkdtempSync(path.join(os.tmpdir(), "review-permissions-"));

try {
  const input = path.join(temp, "input.json");
  fs.writeFileSync(input, "invalid-json", { mode: 0o644 });
  fs.chmodSync(input, 0o644);

  for (const [action, flag] of [
    ["prepare", "source"],
    ["finalize", "review"],
  ]) {
    const output = path.join(
      temp,
      `${action}.employment-promotion-private.json`,
    );
    const result = spawnSync(
      process.execPath,
      [
        "--import",
        "tsx",
        runner,
        action,
        `--${flag}=${input}`,
        `--output=${output}`,
      ],
      { cwd: root, encoding: "utf8" },
    );
    assert.equal(result.status, 1);
    assert.match(
      result.stderr,
      /private input must use owner-only permissions/,
    );
    assert.equal(result.stdout, "");
    assert.equal(fs.existsSync(output), false);
  }
} finally {
  fs.rmSync(temp, { recursive: true, force: true });
}

console.log("Private review file permission checks passed.");
