const sourceFields = new Set(['raw_text', 'resume_text', 'raw_cv', 'rawText', 'resumeText', 'cv_text', 'profile_text']);

// Preserve layout-bearing whitespace in extracted source. PostgreSQL text cannot
// store NUL; other non-layout controls are cleaned without flattening the CV.
export function sanitizeCandidateSourceText(input: unknown): string {
  return String(input ?? '').replace(/\u0000/g, '').replace(/\r\n?/g, '\n')
    .replace(/\f/g, '\n').replace(/[\u0001-\u0008\u000B\u000E-\u001F\u007F]/g, ' ').trim();
}

export function sanitizeCandidateForPersistence<T>(value: T, field = ''): T {
  if (value === null || value === undefined) return value;
  if (typeof value === 'string') {
    return (sourceFields.has(field) ? sanitizeCandidateSourceText(value) : value
      .replace(/\u0000/g, '').replace(/[\u0001-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, ' ')
      .replace(/\s+/g, ' ').trim()) as T;
  }
  if (Array.isArray(value)) return value.map(item => sanitizeCandidateForPersistence(item, field)) as T;
  if (typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key,item]) => [key, sanitizeCandidateForPersistence(item,key)])) as T;
  return value;
}
