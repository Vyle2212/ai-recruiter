/** Reject numeric dates before treating a source fragment as a phone number.
 * This is source extraction only; it does not rewrite candidate-confirmed data. */
export function sourcePhoneIsNumericDate(value: string) {
  const text = value.trim();
  if (text.startsWith("+")) return false;
  return /^(?:\d{1,2}([.\/-])\d{1,2}\1(?:19|20)\d{2}|(?:19|20)\d{2}([.\/-])\d{1,2}\2\d{1,2})$/.test(text) ||
    /^(?:19|20)\d{2}\s*[-–—]\s*(?:19|20)\d{2}$/.test(text);
}
