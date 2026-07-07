import fs from "node:fs";
import path from "node:path";
import { auditAiCandidateExtraction } from "./aiCandidateExtractionEngine";
import type { AnyRecord } from "./cvExtractionSchema";

export type CvExtractionGoldCase = {
  id: string;
  candidate: AnyRecord;
  expected: {
    fullName?: string;
    email?: string;
    phone?: string;
    title?: string;
    employer?: string;
    primarySapModule?: string;
    searchReady?: boolean;
  };
};

export const GOLDSET_SAMPLE_PATH = path.join("reports", "cv-extraction-goldset.sample.json");

function clean(value: any) {
  return String(value || "").replace(/\s+/g, " ").trim().toLowerCase();
}

function score(cases: CvExtractionGoldCase[], predicate: (item: any, expected: CvExtractionGoldCase["expected"]) => boolean, applicable: (expected: CvExtractionGoldCase["expected"]) => boolean) {
  const relevant = cases.filter((item) => applicable(item.expected));
  if (!relevant.length) return 100;
  return Math.round(relevant.filter((item: any) => predicate(item.result, item.expected)).length / relevant.length * 100);
}

export async function runCvExtractionBenchmark(goldCases: CvExtractionGoldCase[]) {
  const candidates = goldCases.map((item) => item.candidate);
  const report = await auditAiCandidateExtraction(candidates);
  const joined = goldCases.map((item, index) => ({ ...item, result: report.items[index] }));
  const hallucinations = joined.filter((item) => {
    const raw = JSON.stringify(item.candidate).toLowerCase();
    return [item.result.identity.fullName.value, item.result.currentTitle, item.result.currentEmployer].filter((value) => Boolean(value) && !/^not disclosed$/i.test(String(value))).some((value) => clean(value).length > 3 && !raw.includes(clean(value).split(" ")[0]));
  });
  return {
    totalBenchmarkCases: goldCases.length,
    identityPrecision: score(joined as any, (item, expected) => clean(item.identity.fullName.value) === clean(expected.fullName), (expected) => Boolean(expected.fullName)),
    contactPrecision: score(joined as any, (item, expected) => clean(item.email) === clean(expected.email), (expected) => Boolean(expected.email)),
    titlePrecision: score(joined as any, (item, expected) => clean(item.currentTitle) === clean(expected.title), (expected) => Boolean(expected.title)),
    employerPrecision: score(joined as any, (item, expected) => clean(item.currentEmployer) === clean(expected.employer), (expected) => Boolean(expected.employer)),
    sapModulePrecision: score(joined as any, (item, expected) => clean(item.primarySapModule) === clean(expected.primarySapModule), (expected) => Boolean(expected.primarySapModule)),
    fieldCompleteness: Math.round(report.items.reduce((sum, item) => sum + item.fieldCompletenessScore, 0) / Math.max(report.items.length, 1)),
    hallucinationRate: Math.round(hallucinations.length / Math.max(joined.length, 1) * 100),
    validationRejectionRate: Math.round(report.rejectedItems.length / Math.max(report.items.length, 1) * 100),
    cases: joined.map((item) => ({ id: item.id, expected: item.expected, actual: { fullName: item.result.identity.fullName.value, email: item.result.email, title: item.result.currentTitle, employer: item.result.currentEmployer, primarySapModule: item.result.primarySapModule, searchReady: item.result.searchReadiness }, reasons: item.result.reviewReasons })),
  };
}

export function loadGoldset(filePath = path.join(process.cwd(), GOLDSET_SAMPLE_PATH)): CvExtractionGoldCase[] {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

export function ensureSampleGoldset(filePath = path.join(process.cwd(), GOLDSET_SAMPLE_PATH)) {
  if (fs.existsSync(filePath)) return;
  const sample: CvExtractionGoldCase[] = [
    {
      id: "labelled-name",
      candidate: { id: "labelled-name", name: "Candidate profile pending validation", raw_text: "Full Name: Priya Raman\nEmail: priya.raman@example.com\nKuala Lumpur Malaysia\nSAP FICO Consultant\nDeloitte employer\nS/4HANA implementation UAT SIT data migration rollout support configuration workshops cutover hypercare finance controlling testing documentation stakeholder management repeated SAP evidence" },
      expected: { fullName: "Priya Raman", email: "priya.raman@example.com", title: "SAP FICO Consultant", primarySapModule: "FICO", searchReady: true },
    },
    {
      id: "compressed-fullname",
      candidate: { id: "compressed-fullname", raw_text: "FullName:TranQuocTrieuDateofbirth:18/11/1992\nEmail: tran.quoc.trieu@example.com\nVietnam\nSAP ABAP Consultant\nABAP OData BAPI S/4HANA implementation support data migration UAT SIT WRICEF IDoc CDS technical design development testing documentation repeated SAP evidence" },
      expected: { fullName: "Tran Quoc Trieu", email: "tran.quoc.trieu@example.com", title: "SAP ABAP Consultant", primarySapModule: "ABAP", searchReady: true },
    },
    {
      id: "client-not-employer",
      candidate: { id: "client-not-employer", name: "Jane Fruelda", raw_text: "Jane Fruelda\nEmail: jane@example.com\nSingapore\nSAP MM Consultant\nClient Name Yash Technologies\nS/4HANA MM rollout support procurement inventory configuration data migration UAT SIT cutover hypercare stakeholder workshops documentation repeated SAP evidence" },
      expected: { fullName: "Jane Fruelda", email: "jane@example.com", title: "SAP MM Consultant", employer: "Not disclosed", primarySapModule: "MM", searchReady: true },
    },
    {
      id: "summary-title",
      candidate: { id: "summary-title", name: "Fakhrin bin Mohd Ramli", current_title: "11 years as SAP Consultant: 5 implementation projects", raw_text: "Fakhrin bin Mohd Ramli\nEmail: fakhrin@example.com\nMalaysia\n11 years as SAP Consultant: 5 implementation projects\nSAP MM implementation rollout support procurement inventory configuration data migration UAT SIT cutover hypercare stakeholder workshops documentation repeated SAP evidence" },
      expected: { fullName: "Fakhrin bin Mohd Ramli", email: "fakhrin@example.com", primarySapModule: "MM", searchReady: false },
    },
    {
      id: "poor-ocr",
      candidate: { id: "poor-ocr", name: "Profile Under Review", raw_text: "x SAP" },
      expected: { searchReady: false },
    },
  ];
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(sample, null, 2));
}
