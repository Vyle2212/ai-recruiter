/** Registration input is identity data only; ownership and roles are server-owned. */
export type CandidateRegistrationInput = {
  email: string;
  password: string;
  fullName: string;
  captchaToken: string;
};

export function parseCandidateRegistrationInput(
  value: unknown,
): CandidateRegistrationInput | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const input = value as Record<string, unknown>;
  const keys = ["email", "password", "fullName", "captchaToken"];
  if (
    Object.keys(input).length !== keys.length ||
    Object.keys(input).some((key) => !keys.includes(key)) ||
    keys.some((key) => typeof input[key] !== "string")
  )
    return null;
  const email = (input.email as string).trim();
  const password = input.password as string;
  const fullName = (input.fullName as string).trim();
  const captchaToken = (input.captchaToken as string).trim();
  if (
    email.length > 254 ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
    password.length < 12 ||
    password.length > 128 ||
    fullName.length < 1 ||
    fullName.length > 120 ||
    /[\u0000-\u001f\u007f]/.test(fullName) ||
    captchaToken.length < 1 ||
    captchaToken.length > 4096
  )
    return null;
  return { email, password, fullName, captchaToken };
}

/** The origin comes from reviewed configuration, never from registration input. */
export function candidateRegistrationCallback(origin: string): string | null {
  try {
    const url = new URL(origin);
    if (
      url.protocol !== "https:" ||
      url.username ||
      url.password ||
      url.port ||
      url.pathname !== "/" ||
      url.search ||
      url.hash
    )
      return null;
    return new URL("/auth/candidate/callback", url.origin).href;
  } catch {
    return null;
  }
}
