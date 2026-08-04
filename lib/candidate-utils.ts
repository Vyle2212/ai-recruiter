export function normalizeText(text: string) {
  return String(text || "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "")
    .trim();
}

export function normalizeEmail(email: string) {
  return String(email || "")
    .toLowerCase()
    .trim();
}

export function extractNameFromCV(text: string) {
  const lines = String(text || "")
    .split("\n")
    .map((x) => x.trim())
    .filter(Boolean)
    .slice(0, 20);

  for (const line of lines) {
    if (
      /^[A-Z][A-Za-z.' -]{3,40}$/.test(line) &&
      !line.toUpperCase().includes("CURRICULUM") &&
      !line.toUpperCase().includes("RESUME") &&
      !line.toUpperCase().includes("PROFILE") &&
      !line.toUpperCase().includes("CAREER OBJECTIVE") &&
      !line.toUpperCase().includes("MARITAL STATUS")
    ) {
      return line;
    }
  }

  return "Candidate Name Not Detected";
}

export function parseSkills(skills: any): string[] {
  if (!skills) return [];

  if (Array.isArray(skills)) {
    return skills
      .flatMap((s) => String(s).split(","))
      .map((s) => normalizeText(s))
      .filter(Boolean);
  }

  if (typeof skills === "string") {
    try {
      const parsed = JSON.parse(skills);

      if (Array.isArray(parsed)) {
        return parseSkills(parsed);
      }
    } catch {}

    return skills
      .replace(/[{}[\]"]/g, "")
      .split(",")
      .map((s) => normalizeText(s))
      .filter(Boolean);
  }

  return [];
}