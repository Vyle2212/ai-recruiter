import assert from "node:assert/strict";
import { readdirSync,readFileSync } from "node:fs";
const files=readdirSync("scripts").filter(name=>/candidate360/i.test(name)&&/\.(?:test|spec)\.(?:ts|tsx|js|mjs)$/.test(name)).sort();
const prefix=files.filter(name=>/^candidate360.*\.test\.ts$/i.test(name));
const broader=files.filter(name=>!prefix.includes(name));
assert.equal(files.length,39);assert.equal(prefix.length,35);
assert.deepEqual(broader,["quickFixApplyCandidate360.test.ts","quickFixRepairCandidate360.test.ts","recruiterWorkflowCandidate360.test.ts","repairQueueCandidate360.test.ts"]);
for(const file of files){const source=readFileSync(`scripts/${file}`,"utf8");assert.doesNotMatch(source,/\.skip\s*\(|\bxit\s*\(|\bxdescribe\s*\(/,`${file} contains a skipped test`)}
console.log(JSON.stringify({candidate360RelatedFiles:files.length,prefixMatchedFiles:prefix.length,broaderRelatedFiles:broader}));
