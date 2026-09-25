import { randomUUID } from "node:crypto";

export const ORIGINAL_CV_BUCKET = "candidate-original-cvs";
export const MAX_ORIGINAL_BYTES = 10 * 1024 * 1024;
const TYPES: Record<string, string> = {
  pdf: "application/pdf",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  txt: "text/plain",
};

export function originalCvObjectKey(fileName: string, bytes: Buffer) {
  const extension = /\.([a-z0-9]+)$/i.exec(fileName)?.[1]?.toLowerCase();
  if (
    !extension ||
    !TYPES[extension] ||
    !bytes.length ||
    bytes.length > MAX_ORIGINAL_BYTES
  ) {
    throw new Error("CV_ORIGINAL_INVALID");
  }
  return {
    objectKey: `${randomUUID()}.${extension}`,
    contentType: TYPES[extension],
  };
}

export function originalCvReference(value: unknown): string | undefined {
  const ref = typeof value === "string" ? value : "";
  return /^candidate-original-cvs\/(?:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\/)?[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(?:pdf|docx|doc|txt)$/i.test(
    ref,
  )
    ? ref
    : undefined;
}

export function ownedOriginalCvObjectKey(
  ownerId: string,
  objectKey: string,
): boolean {
  if (!/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(ownerId))
    return false;
  return (
    originalCvReference(`${ORIGINAL_CV_BUCKET}/${objectKey}`) !== undefined &&
    objectKey.startsWith(`${ownerId}/`)
  );
}
