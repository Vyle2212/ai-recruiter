import assert from "node:assert/strict";
import {
  ocrPdfPages,
  googlePdfOcr,
  configuredPdfOcr,
  CvSourceError,
  type PdfOcrClient,
} from "../lib/cvPdfOcr";
import { pdfOcrReason } from "../lib/cvPdfExtraction";
async function main() {
  const envKeys = [
    "CV_OCR_PROVIDER",
    "PADDLE_OCR_URL",
    "PADDLE_OCR_TOKEN",
  ] as const;
  const saved = envKeys.map((key) => process.env[key]);
  const originalFetch = globalThis.fetch;
  try {
    process.env.CV_OCR_PROVIDER = "paddle";
    delete process.env.PADDLE_OCR_URL;
    delete process.env.PADDLE_OCR_TOKEN;
    await assert.rejects(
      configuredPdfOcr(Buffer.from("%PDF-test"), 2),
      (e) => e instanceof CvSourceError && e.code === "OCR_NOT_CONFIGURED",
    );
    process.env.PADDLE_OCR_URL = "https://owned-worker.example/ocr/pdf";
    process.env.PADDLE_OCR_TOKEN = "synthetic-test-token-not-a-secret";
    let mode = "valid";
    globalThis.fetch = async (_url, init) => {
      assert.equal(init?.redirect, "error");
      assert.equal(init?.cache, "no-store");
      const headers = new Headers(init?.headers);
      assert.equal(
        headers.get("authorization"),
        "Bearer synthetic-test-token-not-a-secret",
      );
      assert.equal(headers.get("x-ocr-pages"), "1,2");
      assert.equal(
        Buffer.from(init?.body as Uint8Array).toString(),
        "%PDF-test",
      );
      if (mode === "timeout")
        throw new DOMException("synthetic", "TimeoutError");
      if (mode === "unavailable")
        return new Response("private error", { status: 503 });
      const pages = [
        { page: 2, text: "SAP project implementation second page" },
        { page: 1, text: "SAP consultant employment first page" },
      ];
      if (mode === "duplicate") pages[0].page = 1;
      if (mode === "missing") pages.pop();
      if (mode === "short") pages[0].text = "SAP";
      return Response.json({
        engine: "paddleocr",
        totalPages: 2,
        sha256: mode === "digest" ? "wrong" : headers.get("x-document-sha256"),
        pages,
      });
    };
    assert.equal(
      await configuredPdfOcr(Buffer.from("%PDF-test"), 2, [1, 2]),
      "SAP consultant employment first page\n\nSAP project implementation second page",
    );
    for (const [scenario, code] of [
      ["digest", "OCR_INCOMPLETE"],
      ["duplicate", "OCR_INCOMPLETE"],
      ["missing", "OCR_INCOMPLETE"],
      ["short", "OCR_REVIEW_REQUIRED"],
      ["unavailable", "OCR_SERVICE_FAILED"],
      ["timeout", "OCR_TIMEOUT"],
    ]) {
      mode = scenario;
      await assert.rejects(
        configuredPdfOcr(Buffer.from("%PDF-test"), 2, [1, 2]),
        (e) => e instanceof CvSourceError && e.code === code,
      );
    }
    process.env.PADDLE_OCR_URL = "http://owned-worker.example/ocr/pdf";
    await assert.rejects(
      configuredPdfOcr(Buffer.from("%PDF-test"), 2),
      (e) =>
        e instanceof CvSourceError && e.code === "OCR_CONFIGURATION_INVALID",
    );
    process.env.CV_OCR_PROVIDER = "unknown";
    await assert.rejects(
      configuredPdfOcr(Buffer.from("%PDF-test"), 2),
      (e) =>
        e instanceof CvSourceError && e.code === "OCR_CONFIGURATION_INVALID",
    );
  } finally {
    globalThis.fetch = originalFetch;
    envKeys.forEach((key, i) => {
      if (saved[i] === undefined) delete process.env[key];
      else process.env[key] = saved[i];
    });
  }
  const calls: number[][] = [];
  const client: PdfOcrClient = {
    async batchAnnotateFiles(req, options) {
      assert.equal(req.requests?.length, 1);
      assert.equal(req.requests![0].inputConfig?.mimeType, "application/pdf");
      assert.equal(
        req.requests![0].features![0].type,
        "DOCUMENT_TEXT_DETECTION",
      );
      assert.equal(options.retry, null);
      assert.ok(options.timeout > 0 && options.timeout <= 45000);
      const pages = req.requests![0].pages!;
      calls.push(pages);
      return [
        {
          responses: [
            {
              totalPages: 7,
              responses: [...pages].reverse().map((pageNumber) => ({
                context: { pageNumber },
                fullTextAnnotation: {
                  text: pageNumber === 3 ? "" : `Page ${pageNumber}`,
                },
              })),
            },
          ],
        },
      ];
    },
  };
  assert.equal(
    await ocrPdfPages(Buffer.from("%PDF"), 7, client),
    "Page 1\n\nPage 2\n\n\n\nPage 4\n\nPage 5\n\nPage 6\n\nPage 7",
  );
  assert.deepEqual(calls, [
    [1, 2, 3, 4, 5],
    [6, 7],
  ]);
  await assert.rejects(
    ocrPdfPages(Buffer.from("%PDF"), 7, client, 45000, [3]),
    (error) =>
      error instanceof CvSourceError && error.code === "OCR_REVIEW_REQUIRED",
  );
  await assert.rejects(
    ocrPdfPages(
      Buffer.from("%PDF"),
      2,
      {
        async batchAnnotateFiles() {
          return [
            {
              responses: [
                {
                  totalPages: 2,
                  responses: [
                    {
                      context: { pageNumber: 1 },
                      fullTextAnnotation: { text: "First page has full text" },
                    },
                    {
                      context: { pageNumber: 2 },
                      fullTextAnnotation: { text: "Page 2" },
                    },
                  ],
                },
              ],
            },
          ];
        },
      },
      45000,
      [2],
    ),
    (error) =>
      error instanceof CvSourceError && error.code === "OCR_REVIEW_REQUIRED",
  );
  assert.equal(
    await ocrPdfPages(
      Buffer.from("%PDF"),
      2,
      {
        async batchAnnotateFiles() {
          return [
            {
              responses: [
                {
                  totalPages: 2,
                  responses: [
                    {
                      context: { pageNumber: 1 },
                      fullTextAnnotation: {
                        text: "SAP consultant employment and project experience",
                      },
                    },
                    {
                      context: { pageNumber: 2 },
                      fullTextAnnotation: {
                        text: "SAP implementation and migration project details",
                      },
                    },
                  ],
                },
              ],
            },
          ];
        },
      },
      45000,
      [1, 2],
    ),
    "SAP consultant employment and project experience\n\nSAP implementation and migration project details",
  );
  const fails = async (responses: any) =>
    assert.rejects(
      ocrPdfPages(Buffer.from("%PDF"), 2, {
        async batchAnnotateFiles() {
          return [{ responses }];
        },
      }),
      (e) => e instanceof CvSourceError && e.code === "OCR_INCOMPLETE",
    );
  await fails([]);
  await fails([
    {
      totalPages: 2,
      responses: [
        {
          context: { pageNumber: 1 },
          fullTextAnnotation: { text: "Only page one" },
        },
      ],
    },
  ]);
  await fails([
    {
      totalPages: 2,
      responses: [
        { context: { pageNumber: 1 } },
        { context: { pageNumber: 1 } },
      ],
    },
  ]);
  await fails([
    {
      totalPages: 2,
      responses: [
        { context: { pageNumber: 1 } },
        { context: { pageNumber: 3 } },
      ],
    },
  ]);
  await fails([
    {
      totalPages: 3,
      responses: [
        { context: { pageNumber: 1 } },
        { context: { pageNumber: 2 } },
      ],
    },
  ]);
  await fails([{ error: { code: 3 }, responses: [] }]);
  await fails([
    {
      responses: [
        { context: { pageNumber: 1 } },
        { context: { pageNumber: 2 }, error: { code: 3 } },
      ],
    },
  ]);
  await assert.rejects(ocrPdfPages(Buffer.from("%PDF"), 51, client), /1–50/);
  await assert.rejects(
    ocrPdfPages(Buffer.alloc(21 * 1024 * 1024), 1, client),
    /too large/,
  );
  await assert.rejects(
    ocrPdfPages(Buffer.from("%PDF"), 1, client, 0),
    /timed out/,
  );
  await assert.rejects(
    ocrPdfPages(
      Buffer.from("%PDF"),
      1,
      { batchAnnotateFiles: () => new Promise(() => {}) },
      10,
    ),
    (e) => e instanceof CvSourceError && e.code === "OCR_TIMEOUT",
  );
  const original = process.env.GOOGLE_CREDENTIALS;
  try {
    delete process.env.GOOGLE_CREDENTIALS;
    await assert.rejects(
      googlePdfOcr(Buffer.from("%PDF"), 1),
      (e) => e instanceof CvSourceError && e.code === "OCR_NOT_CONFIGURED",
    );
    process.env.GOOGLE_CREDENTIALS = "invalid";
    await assert.rejects(
      googlePdfOcr(Buffer.from("%PDF"), 1),
      (e) =>
        e instanceof CvSourceError && e.code === "OCR_CONFIGURATION_INVALID",
    );
  } finally {
    if (original === undefined) delete process.env.GOOGLE_CREDENTIALS;
    else process.env.GOOGLE_CREDENTIALS = original;
  }
  assert.equal(pdfOcrReason(""), "PDF_TEXT_EMPTY_OR_TOO_SHORT");
  assert.equal(
    pdfOcrReason("Employment History " + "unreadable text ".repeat(10)),
    "PDF_EMPLOYMENT_UNRESOLVED",
  );
  assert.equal(
    pdfOcrReason(
      "Employment History\nExample Services\tJanuary 2020 - June 2025\nSAP Consultant\nEducation\nDegree",
    ),
    "",
  );
  console.log(
    "PDF OCR batching, complete page coverage, page ordering, limits and configuration failures passed",
  );
}
main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
