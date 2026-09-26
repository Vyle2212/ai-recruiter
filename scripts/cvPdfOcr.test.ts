import assert from "node:assert/strict";
import {
  ocrPdfPages,
  googlePdfOcr,
  CvSourceError,
  type PdfOcrClient,
} from "../lib/cvPdfOcr";
import { pdfOcrReason } from "../lib/cvPdfExtraction";
async function main() {
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
