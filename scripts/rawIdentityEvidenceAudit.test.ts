import assert from "node:assert/strict";
import fs from "node:fs";
import { loadRealTalentPoolCandidates } from "../lib/candidateAudit";
import { candidateRawCvText } from "../lib/candidateReExtractionEngine";
import { auditRawIdentityEvidence, auditRawIdentityEvidenceForCandidate, filterRawIdentityEvidenceCandidates, parseRawIdentityEvidenceArgs } from "../lib/rawIdentityEvidenceAudit";
import { extractRawIdentityCandidate, extractRawIdentityCandidates } from "../lib/rawIdentityEvidenceRecovery";

function candidate(id: string, raw_text: string, name = "Candidate profile pending validation") {
  return { id, name, raw_text };
}

const parserMissedRaw = "Name: Priya Raman\nEmail: priya@example.com\nPhone: +60 12 345 6789\nMalaysia\nSAP FICO Consultant\nWork Experience Jan 2022 - Present Deloitte SAP FICO Consultant\nS/4HANA implementation support data migration UAT SIT repeated SAP project evidence";
const placeholderRaw = "Candidate profile pending validation\nEmail: pending@example.com\nPhone: +60 12 345 6789\nMalaysia\nSAP FICO Consultant\nS/4HANA implementation support data migration UAT SIT repeated SAP project evidence";

const parserMissed = auditRawIdentityEvidenceForCandidate(candidate("missed", parserMissedRaw));
assert.equal(parserMissed.diagnosticClassification, "name_evidence_present_parser_missed", "labelled name evidence is detected");
assert.equal(parserMissed.clearNameEvidenceExists, true, "clear name evidence exists");

const placeholder = auditRawIdentityEvidenceForCandidate(candidate("placeholder", placeholderRaw));
assert.equal(placeholder.diagnosticClassification, "only_placeholder_identity_present", "placeholder-only identity is detected");
assert.equal(placeholder.reuploadOriginalCvRecommended, true, "placeholder-only identity recommends reupload/source check");

const experienceOnly = auditRawIdentityEvidenceForCandidate(candidate("experience", "Work Experience\nJan 2022 - Present Deloitte SAP FICO Consultant\nResponsibilities implementation support configuration migration rollout UAT SIT hypercare production support stakeholder workshops documentation training finance controlling SAP project delivery repeated evidence across modules"));
assert.equal(experienceOnly.diagnosticClassification, "raw_text_experience_only", "experience-only text is detected");

const short = auditRawIdentityEvidenceForCandidate(candidate("short", "x SAP"));
assert.equal(short.diagnosticClassification, "not_enough_raw_text", "short raw text is detected");

const possible = auditRawIdentityEvidenceForCandidate(candidate("possible", "Priya Raman\nMalaysia\nSAP FICO Consultant\nWork Experience Jan 2022 - Present Deloitte SAP FICO Consultant\nS/4HANA implementation support data migration UAT SIT repeated SAP project evidence"));
assert.equal(possible.diagnosticClassification, "name_evidence_present_parser_missed", "unlabelled top-line name is clear parser-missed evidence in v4");

const report = auditRawIdentityEvidence([
  candidate("missed-report", parserMissedRaw),
  candidate("placeholder-report", placeholderRaw),
  candidate("short-report", "x SAP"),
]);
assert.equal(report.mode, "read-only", "report is read-only");
assert.equal(report.summary.totalChecked, 3, "report counts candidates");
assert.equal(report.summary.clearNameEvidencePresent, 1, "report counts clear evidence");

const parsed = parseRawIdentityEvidenceArgs(["--onlyBlockedIdentity", "--limit=30", "--candidateIds=a,b", "--showSnippets"]);
assert.equal(parsed.onlyBlockedIdentity, true, "blocked identity arg parses");
assert.equal(parsed.limit, 30, "limit arg parses");
assert.deepEqual(parsed.candidateIds, ["a", "b"], "candidate ids parse");
assert.equal(parsed.showSnippets, true, "show snippets arg parses");

const filtered = filterRawIdentityEvidenceCandidates([{ id: "a", raw_text: "x" }, { id: "b", raw_text: "x" }], { candidateIds: ["b"] });
assert.equal(filtered.length, 1, "candidateIds filter works");
assert.equal(filtered[0].id, "b", "candidateIds filter returns requested candidate");


function exactIdentity(raw: string) {
  return extractRawIdentityCandidate(raw);
}

for (const [raw, reason] of [
  ["Product Manager - VNG Games VNG Games is seeking a Product Manager...", "generic_title_or_job_description"],
  ["Career Objective Seeking a challenging and rewarding position in SAP FI...", "generic_title_or_job_description"],
  ["Territory Manager JOB EXPERIENCE ISS Data – Enterprise Sales Manager...", "generic_title_or_job_description"],
  ["SAP Functional Integration Lead (Senior/Manager) People Profilers is hiring on behalf of...", "generic_title_or_job_description"],
  ["B\u1EA3n m\u00F4 t\u1EA3 c\u00F4ng vi\u1EC7c n\u00E0y \u0111\u00E3 \u0111\u01B0\u1EE3c x\u00E1c nh\u1EADn...", "unrelated_job_description"],
] as Array<[string, string]>) {
  const result = exactIdentity(raw);
  assert.equal(result.value, null, `${raw} is rejected`);
  assert.match(result.rejectReason || "", new RegExp(reason), `${raw} reject reason is specific`);
}

for (const [raw, expected] of [
  ["Tan Hoi Leong (Mr.) BIODATA DOB 6th October 1994 Nationality Malaysian", "Tan Hoi Leong"],
  ["biancadominiquejeangomez @gmail.com +63 995 214 1 745 Orani, Bataan, Philippines Bianca Dominique Jean Q. Gomez SAP FICO Consultant", "Bianca Dominique Jean Q. Gomez"],
  ["Bangsue, Bangkok 10800 JIRAPHAN YUSAENG (GIVE) SAP MDM Consultant Age: 30 I Nationality: Thai", "JIRAPHAN YUSAENG (GIVE)"],
  ["EEMIR SYAZWAN HASYHIM B ROSLAN NO 12, Jalan Satu, Kampung Pandan, 55100, Kuala Lumpur Education", "EEMIR SYAZWAN HASYHIM B ROSLAN"],
  ["NAME: Loreto Virgilio J. Baylon Position: Sr. SAP BW/BI Consultant Profile Results-oriented professional", "Loreto Virgilio J. Baylon"],
  ["Internal use only 1 NUR FATIN BINTI ABD RAZAK Career Objectives: Seeking a position", "NUR FATIN BINTI ABD RAZAK"],
  ["C A N D R A P R A B H A P R A D I P T A A-1-4 S R I B U K I T T U N K U", "CANDRA PRABHA PRADIPTA"],
  ["PERSONAL INFORMATION Full name LUU DUC TUNG (Mr.) Nationality Vietnam Position SAP FICO Functional Consultant", "LUU DUC TUNG"],
  ["P a g e | 1 B\u00D9I TH\u1ECA NH\u00CDP (MINH) SAP Consultant/Team Leader/Project Manager", "B\u00D9I TH\u1ECA NH\u00CDP (MINH)"],
  ["\\ Singapore Malaysia Indonesia Thailand Vietnam Natasha binti Hamri Kepong, Kuala Lumpur WORK EXPERIENCE", "Natasha binti Hamri"],
  ["1 | 12 RESUME: TAJUL ARIFIN SALLEH Summary Tajul is an accomplished leader", "TAJUL ARIFIN SALLEH"],
  ["ABOUT ME Hanzala Ali Home : Flat#801, Al Kamran Center", "Hanzala Ali"],
  ["Chen Ai, Ng (Angielyn) +6012 4216208 25th Aug 1972 Angielyn_ng@hotmail.com", "Chen Ai, Ng (Angielyn)"],
  ["JahangirS/OJiavudeen Mobile:+6592714577 e-mail:jahankeer@gmail.com", "Jahangir S/O Jiavudeen"],
  ["Chowdhury, Rudranil SAP Retail/ MM Consultant 7 Eleven Sdn Bhd", "Chowdhury, Rudranil"],
] as Array<[string, string]>) {
  const result = exactIdentity(raw);
  assert.equal(result.value, expected, `${expected} is extracted by the pure raw identity function`);
  assert.equal(result.rejectReason, undefined, `${expected} has no reject reason`);
}

function bestName(raw: string) {
  return extractRawIdentityCandidates(raw).find((item) => !item.rejectReason)?.possibleName || "";
}

const rawIdentityExamples: Array<[string, string]> = [
  ["PERSONAL DETAIL Name Dr James Paul Asirvatham PhD Economics (University Malaya) Skill EWM/WMS", "Dr James Paul Asirvatham"],
  ["Muhammad Wasim Qureshi Sr. SAP MM/EWM, Business Processes Consultant/Analyst Phone: +60175005529 E-mail: wasimq@gmail.com", "Muhammad Wasim Qureshi"],
  ["JOANA LEA NAVAREZ PROFESSIONAL SUMMARY Senior SAP SD Consultant Email joananavarez@gmail.com", "JOANA LEA NAVAREZ"],
  ["Malakondaiah K As SAP Analytics Architect/Lead Contact Details Core SAP BW", "Malakondaiah K As"],
  ["Maria Teresa Briñas Senior SAP Consultant with 15+ years of experience", "Maria Teresa Briñas"],
  ["CURRICULUM VITAE ROA R. MARODA SAP WM/EWM CONSULTANT Mobile No: +639179506448", "ROA R. MARODA"],
  ["TONG THI LINH SAP FI Functional Consultant +84866059702 | linhtongbp.ueh@gmail.com", "TONG THI LINH"],
  ["Smitha Sasidharan smithagopu1212@gmail.com +60 192814361 Career history SAP Consultant", "Smitha Sasidharan"],
  ["Simon Cheng simonsny@gmail.com +60 167370726 Career history Enterprise Resource Planning Specialist", "Simon Cheng"],
  ["RESUME PERSONAL DETAILS Name: Abdul Hadie Bin Noorudin EDUCATION BACKGROUND", "Abdul Hadie Bin Noorudin"],
  ["PERSONAL PARTICULARS Name Date of Birth Status Nationality Current Address Notice Period : Mr. Surachai Siripreechavidh : 27 Dec 1973", "Surachai Siripreechavidh"],
  ["Phuah, Yew Hock - Benjamin Contact Info Address : No. 26 Jalan Setia", "Phuah Yew Hock Benjamin"],
  ["PERIASAMY MANI maniperiasamy13@gmail.com +60 103601480 Career history SAP Consultant", "PERIASAMY MANI"],
  ["NICHLOS NG Jalan Abdullah Ariff, Kampung Baharu, Penang (016) 4899506 Nichlos294@gmail.com", "NICHLOS NG"],
  ["Leonard Tan leonardtly@gmail.com +60 122861443 Career history Senior SAP BI Consultant", "Leonard Tan"],
  ["Lechimy Kajirasa kajirasalaxmi@yahoo.com.my +60 102591867 Career history SAP FICO Consultant", "Lechimy Kajirasa"],
  ["Giri Moturi giribabum@gmail.com +60 173597161 Career history Senior System Administrator", "Giri Moturi"],
  ["ajay kumar ajaysapgts9@gmail.com +60 1135863554 Career history SAP GTS Consultant", "ajay kumar"],
  ["KhatcharinKurana Jobintention SAP Consultant Email khatcharin@example.com", "Khatcharin Kurana"],
  ["The better the world works. Digital Transformation Manager Shayne Huang", "Shayne Huang"],
  ["Bianca Dominique Jean Q. Gomez SAP FICO Consultant", "Bianca Dominique Jean Q. Gomez"],
  ["E X P E R I E N C E J U L I U S V E L C H E Z S E N I O R S A P F I C O", "JULIUS VELCHEZ"],
  ["PERSONAL INFORMATION Full name LUU DUC TUNG (Mr.)", "LUU DUC TUNG"],
  ["P a g e | 1 B\u00D9I TH\u1ECA NH\u00CDP (MINH) SAP Consultant", "B\u00D9I TH\u1ECA NH\u00CDP (MINH)"],
  ["C A N D R A P R A B H A P R A D I P T A SAP Consultant", "CANDRA PRABHA PRADIPTA"],
  ["OungSiew Khoon Project Manager", "Oung Siew Khoon"],
  ["Chen Ai, Ng (Angielyn) +6012 4216208", "Chen Ai, Ng (Angielyn)"],
  ["ABOUT ME Hanzala Ali Home : Flat#801", "Hanzala Ali"],
  ["B.SOWJANYA S/4 HANA Certified SAP SD Techno-Functional Consultant", "B.SOWJANYA"],
  ["NUTHAN SAP BI / B4HANA / SAC Consultant", "NUTHAN"],
  ["SITHARTH THEVADASON(SAP)(PMP) IT Project Manager", "SITHARTH THEVADASON"],
  ["Tran Duc Hien (Mr) SAP PP Senior Consultant", "Tran Duc Hien"],
  ["Chowdhury, Rudranil SAP Retail/ MM Consultant", "Chowdhury, Rudranil"],
  ["JahangirS/OJiavudeen Mobile:+6592714577", "Jahangir S/O Jiavudeen"],
  ["Zuhelmiza Zullkefli Selangor Darul Ehsan Malaysia +6013", "Zuhelmiza Zullkefli"],
  ["CURRICULUM VITAE 1 of 4 PERSONAL DETAILS OBJECTIVE EDUCATION LAU WEI HAN G-34-03", "LAU WEI HAN"],
];
for (const [raw, expected] of rawIdentityExamples) {
  assert.equal(bestName(raw), expected, `${expected} is recovered from raw identity evidence`);
}

for (const rejected of [
  "B?n mô t? công vi?c này dã du?c xác nh?n",
  "The better the question. The better the answer.",
  "E X P E R I E N C E",
  "CORE EXPERTISE SAP FICA IS-U",
]) {
  assert.equal(bestName(rejected), "", `${rejected} is rejected as identity evidence`);
}

const noReuploadWhenEvidence = auditRawIdentityEvidenceForCandidate(candidate("joana", "Personal Address Laguna Phone number +639989684013 Email joananavarez@gmail.com JOANA LEA NAVAREZ PROFESSIONAL SUMMARY Senior SAP SD Consultant with SAP implementation support rollout migration UAT SIT"));
assert.equal(noReuploadWhenEvidence.clearNameEvidenceExists, true, "clear raw identity evidence is detected even in compact text");
assert.equal(noReuploadWhenEvidence.reuploadOriginalCvRecommended, false, "reupload is not recommended when clear name/contact evidence exists");

const realCandidateIdentityRegressions: Array<[string, string]> = [
  ["81cf7b71-d4e9-4b7b-8c31-8184d82b0696", "Bianca Dominique Jean Q. Gomez"],
  ["0277bf8b-2260-442e-b804-edbc3d80b3dc", "JULIUS VELCHEZ"],
  ["ee1d9df6-9b5c-40a3-b95e-cf6d77bd4db7", "JIRAPHAN YUSAENG (GIVE)"],
  ["810dc8c2-8edd-4909-a75d-ca0e1605cb45", "EEMIR SYAZWAN HASYHIM B ROSLAN"],
  ["efb4800e-6668-4bc3-8966-05cee21802cb", "Loreto Virgilio J. Baylon"],
  ["8910c029-a0d4-47dd-9cd1-f85d8fa00625", "NUR FATIN BINTI ABD RAZAK"],
  ["b671b951-18e0-43c9-b85d-3c55bf1244bb", "CANDRA PRABHA PRADIPTA"],
  ["6ecb2196-033b-4f37-98e0-69dd43a8904b", "LUU DUC TUNG"],
  ["91e23a99-3676-4413-98ee-7d332f431e29", "B\u00D9I TH\u1ECA NH\u00CDP (MINH)"],
  ["fd3b3389-a857-4a04-9112-2d1bce6e8c1c", "Natasha binti Hamri"],
  ["ce8d78e1-1a09-4587-a3af-0b616280c967", "TAJUL ARIFIN SALLEH"],
  ["c24a6722-1a5f-4a30-8b87-afe9947af014", "ajay kumar"],
  ["9bcdc601-4722-4083-9c3f-adfe82203fd1", "vimal james"],
  ["7b618d0a-0788-43f3-b5a8-bb73e0e21211", "tatineni sravanthi"],
  ["4e65b038-2201-4443-aac2-b40e9bb48735", "shaik saleem"],
  ["27276045-1852-4ec6-9e50-5f6fb94f5db8", "santosh trimukhe"],
  ["19d67ad3-9afd-4d17-8fc9-0b77dd5ae140", "santhosh kumar"],
  ["f03417d6-90e8-40f9-9ddd-4b2dbe28d1a4", "Nadarajah (Rajah) Suppiah"],
  ["778421cd-c5ef-440d-9680-52defbfdc0db", "kaven phong"],
  ["181d5a6d-7d53-4048-aa70-cef08c7c1e84", "Yen Choy Hoon"],
];

async function runRealCandidateIdentityRegressionTests() {
  const { candidates } = await loadRealTalentPoolCandidates();
  const byId = new Map(candidates.map((item: any) => [String(item.id || item.candidate_id), item]));
  for (const [candidateId, expected] of realCandidateIdentityRegressions) {
    const item = byId.get(candidateId);
    assert.ok(item, `real candidate fixture ${candidateId} must exist`);
    const raw = candidateRawCvText(item);
    assert.ok(raw.length > 0, `real candidate fixture ${candidateId} must have raw CV text`);
    const result = extractRawIdentityCandidate(raw);
    assert.equal(
      result.value,
      expected,
      `${candidateId} expected ${expected}; got ${result.value || "null"}; reject=${result.rejectReason || "none"}; source=${result.source}; evidence=${result.evidence}`,
    );
  }
}
const sources = [
  fs.readFileSync(new URL("../lib/rawIdentityEvidenceAudit.ts", import.meta.url), "utf8"),
  fs.readFileSync(new URL("./auditRawIdentityEvidence.ts", import.meta.url), "utf8"),
  fs.readFileSync(new URL("./exportRawIdentityEvidence.ts", import.meta.url), "utf8"),
].join("\n");
assert.equal(sources.includes("OPENAI_API_KEY"), false, "raw identity diagnostic does not call OpenAI");
assert.equal(/from\([^)]*\)\.update\(/.test(sources), false, "no DB update behavior");
assert.equal(/from\([^)]*\)\.insert\(/.test(sources), false, "no DB insert behavior");
assert.equal(/from\([^)]*\)\.delete\(/.test(sources), false, "no DB delete behavior");

runRealCandidateIdentityRegressionTests().then(() => {
  console.log("Raw identity evidence diagnostic tests passed");
}).catch((error) => {
  console.error(error);
  process.exitCode = 1;
});











