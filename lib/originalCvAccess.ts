import {
  ORIGINAL_CV_BUCKET,
  originalCvReference,
} from "./originalCvArchiveKey";

const CONTENT_TYPES: Record<string, string> = {
  pdf: "application/pdf",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  doc: "application/msword",
  rtf: "application/rtf",
  txt: "text/plain; charset=utf-8",
};

/** The caller must verify a persisted recruiter approval and, for client
 * support, the active assignment/share/subscription before passing approved.
 * Client and URL-supplied flags are never access evidence.
 */
export function originalCvReadGrant(
  role: string,
  sourceFile: unknown,
  recruiterApproved = false,
) {
  if (
    role !== "admin" &&
    !(
      (role === "recruiter" || role === "recruiter_manager") &&
      recruiterApproved
    )
  )
    return null;
  const reference = originalCvReference(sourceFile);
  if (!reference) return null;
  const objectKey = reference.slice(`${ORIGINAL_CV_BUCKET}/`.length);
  const extension = objectKey.split(".").at(-1)?.toLowerCase() || "";
  const contentType = CONTENT_TYPES[extension];
  if (!contentType) return null;
  return {
    objectKey,
    contentType,
    disposition:
      extension === "pdf" || extension === "txt"
        ? `inline; filename="candidate-cv.${extension}"`
        : `attachment; filename="candidate-cv.${extension}"`,
  };
}
