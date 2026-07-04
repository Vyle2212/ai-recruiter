import { rebuildSearchIndex } from "../lib/search/rebuildSearchIndex";

async function main() {
  const result = await rebuildSearchIndex();
  console.log(JSON.stringify({ success: true, ...result }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
