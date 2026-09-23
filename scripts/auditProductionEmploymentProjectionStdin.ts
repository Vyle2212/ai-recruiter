import { auditProductionEmploymentProjection } from "../lib/productionEmploymentProjectionAudit";
import { createInterface } from "node:readline";

async function readRows() {
  const rows: Array<Record<string, unknown>> = [];
  const input = createInterface({ input: process.stdin, crlfDelay: Infinity });
  for await (const line of input) {
    if (line === "__AUDIT_END__") break;
    if (line)
      try {
        rows.push(JSON.parse(line) as Record<string, unknown>);
      } catch {
        throw new Error(
          `Invalid projection-audit input at row ${rows.length + 1}; source content withheld`,
        );
      }
  }
  input.close();
  return rows;
}

async function main() {
  const rows = await readRows();
  process.stdout.write(
    `${JSON.stringify(auditProductionEmploymentProjection(rows), null, 2)}\n`,
  );
}

void main();
