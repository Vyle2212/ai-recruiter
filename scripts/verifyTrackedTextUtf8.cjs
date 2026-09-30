const { execFileSync } = require("node:child_process");
const { readFileSync } = require("node:fs");
const { extname } = require("node:path");

const textExtensions = new Set([
  ".ts", ".tsx", ".js", ".jsx", ".json", ".mjs", ".cjs",
  ".css", ".md", ".sql", ".yml", ".yaml",
]);
const decoder = new TextDecoder("utf-8", { fatal: true });
const tracked = execFileSync("git", ["ls-files", "-z"]).toString("utf8").split("\0").filter(Boolean);
const invalid = [];

for (const path of tracked) {
  if (!textExtensions.has(extname(path).toLowerCase())) continue;
  try {
    decoder.decode(readFileSync(path));
  } catch {
    invalid.push(path);
  }
}

if (invalid.length) {
  console.error(`Invalid UTF-8 in tracked text files:\n${invalid.join("\n")}`);
  process.exitCode = 1;
} else {
  console.log("Tracked text files are valid UTF-8.");
}
