import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import postcss from "postcss";
import tailwind from "@tailwindcss/postcss";

async function main() {
  const from = path.resolve("app/globals.css");
  const source = await fs.readFile(from, "utf8");
  const result = await postcss([tailwind()]).process(
    `${source}\n@source inline("rounded-sm shadow-xs outline-hidden wrap-break-word ring-1 bg-linear-to-br grid-cols-[minmax(0,1fr)_minmax(19rem,.82fr)_auto] bg-slate-900 text-cyan-300");`,
    { from },
  );
  assert.equal(result.warnings().length, 0);
  const declarations = (selector: string) => {
    const values: Record<string, string> = {};
    result.root.walkRules((rule) => {
      if (rule.selector === selector)
        rule.walkDecls((d) => {
          values[d.prop] = d.value;
        });
    });
    return values;
  };
  assert.equal(
    declarations(".rounded-sm")["border-radius"],
    "var(--radius-sm)",
  );
  assert.equal(declarations(".wrap-break-word")["overflow-wrap"], "break-word");
  assert.equal(declarations(".outline-hidden")["outline-style"], "none");
  assert.equal(
    declarations(".outline-hidden")["outline"],
    "2px solid transparent",
  );
  assert.ok(declarations(".shadow-xs")["box-shadow"]);
  assert.ok(declarations(".ring-1")["box-shadow"]);
  assert.ok(declarations(".bg-linear-to-br")["background-image"]);
  assert.ok(
    result.css.includes("minmax(19rem"),
    "Search V2 comparison grid must compile",
  );
  assert.ok(
    result.css.includes(".focus-visible\\:outline-solid"),
    "Keyboard focus styles must compile",
  );
  assert.ok(
    result.css.includes(".disabled\\:opacity-50"),
    "Disabled controls must compile",
  );
  const variables = new Map<string, string>();
  result.root.walkDecls((d) => {
    if (d.prop.startsWith("--")) variables.set(d.prop, d.value);
  });
  assert.equal(variables.get("--color-slate-900"), "#0f172a");
  assert.equal(variables.get("--color-cyan-300"), "#67e8f9");
  assert.equal(variables.get("--color-gray-200"), "#e5e7eb");
  assert.equal(variables.get("--radius-sm"), "0.25rem");
  assert.ok(declarations(".ring-1")["--tw-ring-shadow"].includes("#3b82f6"));
  console.log(
    "Tailwind CSS compilation, reviewed palette, card geometry and control states passed.",
  );
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
