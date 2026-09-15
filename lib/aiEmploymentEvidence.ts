import { careerMonthIndex } from './candidateCareerExperience';

type Row = Record<string, any>;
const text = (v: unknown): string => typeof v === 'string' ? v.normalize('NFKC').replace(/\s+/g, ' ').trim() : '';
const value = (v: any) => text(v && typeof v === 'object' ? v.value : v);
const literal = (v: string) => v.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// This is a conservative evidence gate, not a general CV parser. Unproven
// proposals remain available in the raw extraction for review, never safe apply.
export function validateAiEmploymentEvidence(rows: unknown[], rawText: string) {
  const source = text(rawText);
  const accepted: Row[] = [];
  const reasons: string[] = [];
  rows.forEach((item, index) => {
    const reject = (reason: string) => reasons.push(`employment_review:${index}:${reason}`);
    if (!item || typeof item !== 'object' || Array.isArray(item)) return reject('invalid_record');
    const row = item as Row;
    const company = value(row.company || row.employer || row.companyName);
    const title = value(row.title || row.role || row.position);
    const start = value(row.start || row.startDate);
    const end = value(row.end || row.endDate);
    const evidence = text(row.evidence || row.excerpt);
    if (!company || !title || !start || !end) return reject('incomplete_fields');
    if (!evidence || !source.includes(evidence)) return reject('evidence_not_in_source');
    if (![company,title,start,end].every(v => evidence.includes(v))) return reject('fields_not_in_same_evidence');
    const employerLabel = new RegExp(`\\b(?:Employer|Company(?: Name)?|Organi[sz]ation)\\s*:\\s*${literal(company)}(?=\\s|[,;.]|$)`, 'i');
    if (!employerLabel.test(evidence) || /\b(?:Client|Customer)\s*:/i.test(evidence)) return reject('employer_association_requires_review');
    const employerLabels = [...evidence.matchAll(/\b(?:Employer|Company(?: Name)?|Organi[sz]ation)\s*:/gi)];
    const titleLabel = new RegExp(`\\b(?:Position(?: Title)?|Job Title|Role|Designation)\\s*:\\s*${literal(title)}(?=\\s|[,;.]|$)`, 'i');
    const datePair = new RegExp(`${literal(start)}\\s*(?:[-–—]|to|until)\\s*${literal(end)}(?=\\s|[.;]|$)`, 'i');
    if (employerLabels.length !== 1 || !titleLabel.test(evidence) || !datePair.test(evidence)) return reject('row_association_requires_review');
    const current = /^(present|current|now)$/i.test(end);
    if (row.current === true && !current) return reject('current_flag_conflict');
    const from = careerMonthIndex(start), to = careerMonthIndex(end, current);
    if (from === null || to === null || from > to) return reject('invalid_date_range');
    accepted.push({...row, company, title, start, end, current});
  });
  return {accepted, reasons};
}
