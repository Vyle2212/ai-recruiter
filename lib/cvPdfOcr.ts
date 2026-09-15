import type { protos } from "@google-cloud/vision";

type Request = protos.google.cloud.vision.v1.IBatchAnnotateFilesRequest;
type Response = protos.google.cloud.vision.v1.IBatchAnnotateFilesResponse;
export type PdfOcrClient = {
  batchAnnotateFiles: (
    request: Request,
    options: { timeout: number; retry: null },
  ) => Promise<[Response, ...unknown[]]>;
};

export class CvSourceError extends Error {
  constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "CvSourceError";
  }
}

export async function ocrPdfPages(
  buffer: Buffer,
  pageCount: number,
  client: PdfOcrClient,
  timeoutMs = 45000,
): Promise<string> {
  if (!Number.isSafeInteger(pageCount) || pageCount < 1 || pageCount > 50)
    throw new CvSourceError(
      "OCR_PAGE_LIMIT",
      "PDF OCR supports 1–50 pages per CV. Split longer documents before uploading.",
    );
  if (buffer.length > 20 * 1024 * 1024)
    throw new CvSourceError(
      "OCR_FILE_LIMIT",
      "This PDF is too large for OCR. Upload a PDF smaller than 20 MB.",
    );
  const deadline = Date.now() + timeoutMs;
  const texts: string[] = [];
  for (let start = 1; start <= pageCount; start += 5) {
    const pages = Array.from(
      { length: Math.min(5, pageCount - start + 1) },
      (_, i) => start + i,
    );
    const remaining = deadline - Date.now();
    if (remaining <= 0)
      throw new CvSourceError(
        "OCR_TIMEOUT",
        "PDF OCR timed out. No partial CV was saved.",
      );
    let timer: ReturnType<typeof setTimeout> | undefined;
    let result: Response;
    try {
      [result] = await Promise.race([
        client.batchAnnotateFiles(
          {
            requests: [
              {
                inputConfig: { content: buffer, mimeType: "application/pdf" },
                features: [{ type: "DOCUMENT_TEXT_DETECTION" }],
                pages,
              },
            ],
          },
          { timeout: remaining, retry: null },
        ),
        new Promise<never>((_, reject) => {
          timer = setTimeout(
            () =>
              reject(
                new CvSourceError(
                  "OCR_TIMEOUT",
                  "PDF OCR timed out. No partial CV was saved.",
                ),
              ),
            remaining,
          );
        }),
      ]);
    } finally {
      if (timer) clearTimeout(timer);
    }
    if (result.responses?.length !== 1)
      throw new CvSourceError(
        "OCR_INCOMPLETE",
        "OCR did not return the complete PDF. No partial CV was saved.",
      );
    const file = result.responses[0];
    if (
      file.error?.code ||
      (file.totalPages != null && file.totalPages !== pageCount) ||
      file.responses?.length !== pages.length
    )
      throw new CvSourceError(
        "OCR_INCOMPLETE",
        "OCR returned a file error or missing pages. No partial CV was saved.",
      );
    const seen = new Set<number>();
    const batch = new Map<number, string>();
    for (const page of file.responses || []) {
      const number = page.context?.pageNumber;
      if (
        page.error?.code ||
        !number ||
        !pages.includes(number) ||
        seen.has(number)
      )
        throw new CvSourceError(
          "OCR_INCOMPLETE",
          "OCR returned an invalid page. No partial CV was saved.",
        );
      seen.add(number);
      batch.set(number, page.fullTextAnnotation?.text || "");
    }
    for (const page of pages) texts.push(batch.get(page)!);
  }
  return texts.join("\n\n");
}

export async function googlePdfOcr(
  buffer: Buffer,
  pageCount: number,
): Promise<string> {
  const raw = process.env.GOOGLE_CREDENTIALS;
  if (!raw)
    throw new CvSourceError(
      "OCR_NOT_CONFIGURED",
      "This PDF needs OCR, but document OCR is not configured. Upload a text-readable PDF or DOCX, or ask the administrator to configure OCR.",
    );
  let credentials: { client_email?: string; private_key?: string };
  try {
    credentials = JSON.parse(raw);
  } catch {
    throw new CvSourceError(
      "OCR_CONFIGURATION_INVALID",
      "Document OCR configuration is invalid. Contact the administrator.",
    );
  }
  if (!credentials?.client_email || !credentials.private_key)
    throw new CvSourceError(
      "OCR_CONFIGURATION_INVALID",
      "Document OCR configuration is incomplete. Contact the administrator.",
    );
  const { ImageAnnotatorClient } = await import("@google-cloud/vision");
  const client = new ImageAnnotatorClient({ credentials });
  try {
    return await ocrPdfPages(buffer, pageCount, client);
  } catch (error) {
    if (error instanceof CvSourceError) throw error;
    throw new CvSourceError(
      "OCR_SERVICE_FAILED",
      "Document OCR failed. No partial CV was saved. Try again or upload a text-readable PDF or DOCX.",
    );
  } finally {
    await client.close().catch(() => undefined);
  }
}
