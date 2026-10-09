const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { execFileSync } = require("node:child_process");
const ts = require("typescript");
const { webpack } = require("next/dist/compiled/webpack/webpack");

async function main() {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "pdf-runtime-"));
  try {
    const source = fs.readFileSync("lib/cvPdfRuntime.ts", "utf8");
    const entry = path.join(directory, "entry.mjs");
    fs.writeFileSync(
      entry,
      ts.transpileModule(source, {
        compilerOptions: {
          target: ts.ScriptTarget.ES2022,
          module: ts.ModuleKind.ESNext,
        },
      }).outputText,
    );
    await new Promise((resolve, reject) => {
      const compiler = webpack({
        mode: "production",
        target: "node",
        module: { rules: [{ test: /entry\.mjs$/, type: "javascript/auto" }] },
        optimization: { minimize: false },
        context: process.cwd(),
        entry,
        output: {
          path: directory,
          filename: "bundle.cjs",
          library: { type: "commonjs2" },
        },
        resolve: {
          modules: [path.join(process.cwd(), "node_modules"), "node_modules"],
        },
      });
      compiler.run((error, stats) => {
        compiler.close(() => {
          if (error) return reject(error);
          if (stats.hasErrors())
            return reject(
              new Error(stats.toString({ all: false, errors: true })),
            );
          resolve();
        });
      });
    });
    const check = `
      const assert = require('node:assert/strict');
      const fs = require('node:fs');
      const path = require('node:path');
      const { pdfStandardFontDataUrl } = require(process.argv[1]);
      const url = pdfStandardFontDataUrl();
      assert.equal(typeof url, 'string');
      assert.ok(path.isAbsolute(url));
      assert.ok(url.endsWith(path.sep));
      assert.ok(fs.statSync(path.join(url, 'LiberationSans-Regular.ttf')).isFile());
    `;
    execFileSync(
      process.execPath,
      ["-e", check, path.join(directory, "bundle.cjs")],
      { stdio: "pipe" },
    );
    console.log("Webpack PDF runtime font resolution passed.");
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
