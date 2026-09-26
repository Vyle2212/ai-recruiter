/** Only Storage's explicit missing-key response proves the original is absent. */
export function originalCvStorageReadStatus(error: unknown): 404 | 503 {
  if (
    error &&
    typeof error === "object" &&
    "status" in error &&
    "statusCode" in error &&
    error.status === 404 &&
    error.statusCode === "NoSuchKey"
  )
    return 404;
  return 503;
}
