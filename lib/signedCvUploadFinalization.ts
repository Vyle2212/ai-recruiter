type SignedCvUploadFinalizationInput<T> = {
  uploadError: unknown;
  requestProcessing: () => Promise<Response>;
  parseResponse: (response: Response) => Promise<T>;
  transferFailureMessage: string;
};

/**
 * A signed Storage upload can commit successfully while the browser loses the
 * response. Always let the server verify the private object and its digest
 * before deciding that the transfer failed. The processing endpoints are
 * replay-safe and return 404 only when the owned object is genuinely absent.
 */
export async function finalizePossiblyCompletedSignedCvUpload<T>({
  uploadError,
  requestProcessing,
  parseResponse,
  transferFailureMessage,
}: SignedCvUploadFinalizationInput<T>): Promise<T> {
  const response = await requestProcessing();
  if (uploadError && response.status === 404) {
    throw new Error(transferFailureMessage);
  }
  return parseResponse(response);
}
