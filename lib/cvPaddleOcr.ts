import { createHash } from "node:crypto";
import { CvSourceError, type PdfOcrClient } from "./cvPdfOcr";

/** Private worker transport. The shared PDF validator checks every returned page. */
export function createPaddlePdfOcrClient(): PdfOcrClient {
  const endpoint = process.env.PADDLE_OCR_URL;
  const token = process.env.PADDLE_OCR_TOKEN;
  if (!endpoint || !token)
    throw new CvSourceError(
      "OCR_NOT_CONFIGURED",
      "Private document OCR is not configured.",
    );
  let url: URL;
  try {
    url = new URL(endpoint);
  } catch {
    throw new CvSourceError(
      "OCR_CONFIGURATION_INVALID",
      "Invalid document OCR configuration.",
    );
  }
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    url.search ||
    url.hash
  )
    throw new CvSourceError(
      "OCR_CONFIGURATION_INVALID",
      "Document OCR requires a private HTTPS endpoint.",
    );
  return {
    async batchAnnotateFiles(request, options) {
      const input = request.requests?.[0];
      const bytes = input?.inputConfig?.content;
      if (!(bytes instanceof Uint8Array))
        throw new CvSourceError(
          "OCR_CONFIGURATION_INVALID",
          "Invalid OCR request.",
        );
      const buffer = Buffer.from(bytes);
      const digest = createHash("sha256").update(buffer).digest("hex");
      try {
        const response = await fetch(url, {
          method: "POST",
          redirect: "error",
          cache: "no-store",
          signal: AbortSignal.timeout(options.timeout),
          headers: {
            "content-type": "application/pdf",
            authorization: `Bearer ${token}`,
            "x-document-sha256": digest,
            "x-ocr-pages": (input?.pages || []).join(","),
          },
          body: new Uint8Array(buffer),
        });
        if (
          !response.ok ||
          !response.headers.get("content-type")?.includes("application/json")
        )
          throw new Error("worker unavailable");
        const reader = response.body?.getReader();
        if (!reader) throw new Error("empty response");
        const chunks: Uint8Array[] = [];
        let size = 0;
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            size += value.byteLength;
            if (size > 2 * 1024 * 1024) {
              await reader.cancel();
              throw new Error("response limit");
            }
            chunks.push(value);
          }
        } finally {
          reader.releaseLock();
        }
        const result = JSON.parse(Buffer.concat(chunks).toString("utf8"));
        if (
          result.sha256 !== digest ||
          result.engine !== "paddleocr" ||
          !Number.isSafeInteger(result.totalPages) ||
          !Array.isArray(result.pages) ||
          result.pages.some(
            (p: { page?: unknown; text?: unknown }) =>
              !Number.isSafeInteger(p.page) || typeof p.text !== "string",
          )
        )
          throw new CvSourceError(
            "OCR_INCOMPLETE",
            "OCR response identity or pages are invalid.",
          );
        return [
          {
            responses: [
              {
                totalPages: result.totalPages,
                responses: result.pages.map(
                  (p: { page: number; text: string }) => ({
                    context: { pageNumber: p.page },
                    fullTextAnnotation: { text: p.text },
                  }),
                ),
              },
            ],
          },
        ];
      } catch (error) {
        if (error instanceof CvSourceError) throw error;
        if (
          error instanceof Error &&
          (error.name === "TimeoutError" || error.name === "AbortError")
        )
          throw new CvSourceError(
            "OCR_TIMEOUT",
            "Document OCR timed out. No partial CV was saved.",
          );
        throw new CvSourceError(
          "OCR_SERVICE_FAILED",
          "Private document OCR failed. No partial CV was saved.",
        );
      }
    },
  };
}
