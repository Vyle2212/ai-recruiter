import assert from "node:assert/strict";
import fs from "node:fs";

for (const route of [
  "candidate/profile/cv/route.js.nft.json",
  "upload-cv/route.js.nft.json",
]) {
  const trace = JSON.parse(
    fs.readFileSync(`.next/server/app/api/${route}`, "utf8"),
  ) as { files: string[] };
  assert.ok(
    trace.files.some((file) => file.endsWith("pdfjs-dist/package.json")),
    `${route} must include the PDF.js package root`,
  );
  assert.ok(
    trace.files.some((file) =>
      file.endsWith("pdfjs-dist/legacy/build/pdf.mjs"),
    ),
    `${route} must include the PDF.js reader`,
  );
  assert.ok(
    trace.files.some((file) =>
      file.endsWith("pdfjs-dist/standard_fonts/LiberationSans-Regular.ttf"),
    ),
    `${route} must include PDF standard fonts`,
  );
}

console.log("PDF font deployment traces passed");
