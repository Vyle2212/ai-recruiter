import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import JSZip from "jszip";
import * as mammoth from "mammoth";
import { extractDocxText } from "../lib/docxTextLayout";

// Exercise the public API and the CLI that owns argparse, with disposable data.
async function main() {
  const zip = new JSZip();
  zip.file(
    "[Content_Types].xml",
    '<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>',
  );
  zip.file(
    "_rels/.rels",
    '<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>',
  );
  zip.file(
    "word/document.xml",
    '<?xml version="1.0"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>Synthetic SAP Consultant</w:t><w:br/><w:t>Employer: Example Consulting</w:t><w:tab/><w:t>Client: Example Manufacturing</w:t></w:r></w:p></w:body></w:document>',
  );
  const bytes = await zip.generateAsync({ type: "nodebuffer" });
  assert.match(
    await extractDocxText(bytes),
    /Synthetic SAP Consultant\nEmployer: Example Consulting\tClient: Example Manufacturing/,
  );
  const expected = (await mammoth.convertToHtml({ buffer: bytes })).value;
  const dir = await mkdtemp(path.join(tmpdir(), "synthetic-mammoth-"));
  const require = createRequire(import.meta.url);
  const cli = path.join(
    path.dirname(require.resolve("mammoth/package.json")),
    "bin/mammoth",
  );
  const run = (...args: string[]) =>
    spawnSync(process.execPath, [cli, ...args], { encoding: "utf8" });
  try {
    const source = path.join(dir, "synthetic.docx");
    const output = path.join(dir, "output.html");
    await writeFile(source, bytes);
    const help = run("--help");
    assert.equal(help.status, 0, help.stderr);
    assert.match(help.stdout, /--output-format/);
    const stdout = run(source, "--output-format", "html");
    assert.equal(stdout.status, 0, stdout.stderr);
    assert.equal(stdout.stdout.trim(), expected);
    const file = run(source, output);
    assert.equal(file.status, 0, file.stderr);
    assert.equal((await readFile(output, "utf8")).trim(), expected);
    assert.notEqual(run(source, output, "--output-dir", dir).status, 0);
    assert.notEqual(run(source, "--output-format", "invalid").status, 0);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
  console.log(
    "Synthetic DOCX API, layout, CLI output and argument rejection passed.",
  );
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
