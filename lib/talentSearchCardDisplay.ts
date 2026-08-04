type AnyRecord = Record<string, any>;

export type TalentSearchEmployerDisplay = {
  company: string;
  start?: string;
  end?: string;
  duration?: string;
  label: string;
};

function clean(value: any) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function list(value: any): AnyRecord[] {
  if (Array.isArray(value)) return value.filter((item) => item && typeof item === "object");
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) return parsed.filter((item) => item && typeof item === "object");
    } catch {}
  }
  return [];
}

function monthYear(value: any) {
  const raw = clean(value);
  if (!raw) return "";
  if (/present|current|now/i.test(raw)) return "Present";
  const date = new Date(raw);
  if (!Number.isNaN(date.getTime())) return date.toLocaleString("en-US", { month: "short", year: "numeric" });
  const match = raw.match(/\b(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\s+\d{4}\b|\b\d{4}\b/i);
  return match ? clean(match[0]).replace(/^sept/i, "Sep") : "";
}

function dateForDuration(value: any) {
  const raw = clean(value);
  if (!raw || /present|current|now/i.test(raw)) return new Date();
  const date = new Date(raw);
  if (!Number.isNaN(date.getTime())) return date;
  const year = raw.match(/\b(19|20)\d{2}\b/)?.[0];
  return year ? new Date(`${year}-01-01T00:00:00.000Z`) : null;
}

function durationLabel(start: any, end: any) {
  const startDate = dateForDuration(start);
  const endDate = dateForDuration(end) || new Date();
  if (!startDate || Number.isNaN(startDate.getTime()) || endDate < startDate) return "";
  let months = (endDate.getFullYear() - startDate.getFullYear()) * 12 + (endDate.getMonth() - startDate.getMonth());
  if (months < 1) months = 1;
  const years = Math.floor(months / 12);
  const remMonths = months % 12;
  const parts: string[] = [];
  if (years) parts.push(`${years} yr${years > 1 ? "s" : ""}`);
  if (remMonths) parts.push(`${remMonths} mo${remMonths > 1 ? "s" : ""}`);
  return parts.join(" ");
}

function safeCompany(value: any) {
  const company = clean(value);
  if (!company) return "";
  if (/^(not disclosed|unknown|n\/?a|na|none|null)$/i.test(company)) return "";
  if (/\b(where as my goal|in the world|managed\s*&|roles and|date of birth|professional objective|personal particular|responsibilities)\b/i.test(company)) return "";
  if (company.length > 80 || company.split(/\s+/).length > 10) return "";
  return company;
}

function employerFromRecord(record: AnyRecord): TalentSearchEmployerDisplay | null {
  const company = safeCompany(record.company || record.employer || record.organization || record.current_company || record.previous_company || record.name);
  if (!company) return null;
  const start = monthYear(record.start_date || record.startDate || record.from || record.from_date);
  const end = monthYear(record.end_date || record.endDate || record.to || record.to_date || (record.is_current || record.current ? "Present" : ""));
  const duration = start ? durationLabel(record.start_date || record.startDate || record.from || record.from_date, record.end_date || record.endDate || record.to || record.to_date || (record.is_current || record.current ? "Present" : "")) : "";
  const range = start && end ? `${start} - ${end}` : "";
  return { company, start, end, duration, label: range ? `${company} — ${range}${duration ? ` (${duration})` : ""}` : company };
}

function experienceRecords(candidate: AnyRecord) {
  return [
    ...list(candidate.experience),
    ...list(candidate.experiences),
    ...list(candidate.work_experience),
    ...list(candidate.employment_history),
    ...list(candidate.parsed_experience),
  ];
}

export function talentSearchEmployerDisplay(candidate: AnyRecord) {
  const records = experienceRecords(candidate);
  const current = records.find((record) => record.current || record.is_current || /present|current/i.test(clean(record.end_date || record.endDate || record.to || record.to_date))) || null;
  const currentEmployer = employerFromRecord(current || {}) || employerFromRecord({ company: candidate.display_company || candidate.currentCompany || candidate.current_company || candidate.current_employer || candidate.company });
  const previous = records.find((record) => record !== current && employerFromRecord(record)) || null;
  const previousEmployer = employerFromRecord(previous || { company: candidate.previous_company || candidate.previousCompany || candidate.last_company || candidate.prior_company });
  return {
    currentEmployer: currentEmployer || { company: "Not disclosed", label: "Not disclosed" },
    previousEmployer: previousEmployer || { company: "Not disclosed", label: "Not disclosed" },
  };
}

function formatMoney(amount: string) {
  const numeric = amount.replace(/[^0-9.]/g, "");
  const parsed = Number(numeric);
  if (!Number.isFinite(parsed) || parsed <= 0) return clean(amount);
  return Math.round(parsed).toLocaleString("en-US");
}

export function talentSearchExpectedSalaryDisplay(candidate: AnyRecord) {
  const rawAmount = clean(candidate.expected_salary || candidate.salary_expectation || candidate.expectedSalary || candidate.expected_monthly_salary);
  if (!rawAmount) return "";
  const currency = clean(candidate.expected_salary_currency || candidate.salary_currency || candidate.currency || "");
  const period = /annual|year/i.test(clean(candidate.expected_salary_period || candidate.salary_period)) ? "annual" : "monthly";
  const plus = /\+$/.test(rawAmount) ? "+" : "";
  const amount = formatMoney(rawAmount);
  return clean(`${currency} ${amount}${plus} ${period}`);
}