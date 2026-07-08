import { classifyCandidateSearchVisibility } from "./candidateSearchVisibility";

export type ExtractionQaScore = {
  score: number;
  searchReady: boolean;
  reasons: string[];
  missingFields: string[];
  riskFlags: string[];
};

function clean(value: any) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function hasValue(value: any) {
  if (Array.isArray(value)) return value.length > 0;
  return Boolean(clean(value));
}

function invalidNameReason(name: string) {
  const value = clean(name);
  if (!value) return "missing_name";
  if (/candidate profile pending validation|profile under review|personal particulars?|personal details|curriculum vitae|professional summary|work experience|monitoring compliance|external stakeholders/i.test(value)) return "placeholder_or_section_name";
  if (/\b(?:Work|Current|Status|Public|Father'?s Name|Mother'?s Name|Staff Reimbursement|Industry)\b/i.test(value)) return "metadata_name";
  if (/\b(?:service\s*now|hp\s*alm|\balm\b|jira|oracle|excel|sap)\b/i.test(value) && ((value.match(/,/g)||[]).length > 0 || /\b(?:service\s*now|hp\s*alm|\balm\b)\b/i.test(value))) return "tool_or_skill_name";
  if (value.split(/\s+/).length > 6) return "long_or_sentence_name";
  return "";
}

function invalidTitleReason(title: string) {
  const value = clean(title);
  if (!value) return "missing_title";
  if (/^\d{1,2}(?:\.\d)?\+?\s+years?\s+as\b/i.test(value)) return "summary_sentence_title";
  if (/\b(?:implementation projects?|roll-?out projects?|support projects?|years as|experience in)\b/i.test(value)) return "summary_sentence_title";
  if ((value.match(/,/g) || []).length >= 2 || value.length > 90) return "long_or_comma_heavy_title";
  if (/^(?:summary|profile|career objective|professional objective|work experience|education)$/i.test(value)) return "section_title";
  return "";
}

function invalidCompanyReason(company: string) {
  const value = clean(company);
  if (!value || /^not disclosed$/i.test(value)) return "";
  if (/^(?:L\d\s+Specialist|Maker|Application Development Team Lead|Project Manager|Consultant|Functional Consultant|Senior Manager|Manager|Specialist|Analyst|Developer|Architect|Led IT systems)$/i.test(value)) return "role_as_company";
  if (/^(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec|January|February|March|April|June|July|August|September|October|November|December)?\s*(?:19|20)\d{2}\s*(?:-|to)\s*(?:present|current|till date|to date|(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec|January|February|March|April|June|July|August|September|October|November|December)?\s*(?:19|20)\d{2})\)?$/i.test(value)) return "date_as_company";
  if (/@|\b(?:yahoo|gmail|hotmail|outlook)\.com\b|EMPLOYMENT HISTORY|PROFESSIONAL EXPERIENCES|Date Company Name Role|technology enablement solutions/i.test(value)) return "dirty_employer_text";
  if (/nguagesBahasa|Current statusCurrent|every phase|cultures both|Research issues|creating Functional Designs|responsible for|led IT systems|proactively monitored|request via|change management/i.test(value)) return "responsibility_fragment_company";
  if (/Business\s*&\s*Industrial\s+Imaging\s+Products|Flavor\s*&\s*Fragrance\s+Solutions|\bfrom$|\b(?:enhancement|consultation|responsibilities|implementation|project|duration|role|present)\b/i.test(value)) return "project_or_dangling_company";
  return "";
}

function candidateName(candidate: Record<string, any>) {
  return clean(candidate.display_name || candidate.full_name || candidate.candidate_name || candidate.name);
}

function candidateTitle(candidate: Record<string, any>) {
  return clean(candidate.current_title || candidate.title || candidate.headline);
}

function candidateCompany(candidate: Record<string, any>) {
  return clean(candidate.current_company || candidate.company || candidate.display_company);
}

function candidateModules(candidate: Record<string, any>) {
  const raw = candidate.sapModules || candidate.sap_modules || candidate.modules || candidate.primary_sap_module || candidate.primarySapModule || [];
  if (Array.isArray(raw)) return raw.map(clean).filter(Boolean);
  return clean(raw).split(/[,;/|]+/).map(clean).filter(Boolean);
}

export function scoreExistingCandidateProfile(candidate: Record<string, any>): ExtractionQaScore {
  const reasons: string[] = [];
  const missingFields: string[] = [];
  const riskFlags: string[] = [];
  let score = 0;
  const visibility = classifyCandidateSearchVisibility(candidate);
  const name = candidateName(candidate);
  const title = candidateTitle(candidate);
  const company = candidateCompany(candidate);
  const modules = candidateModules(candidate);
  const hasContact = hasValue(candidate.email || candidate.contact_email) || hasValue(candidate.phone || candidate.mobile || candidate.contact_phone);
  const hasLocation = hasValue(candidate.city || candidate.country || candidate.location || candidate.current_location || candidate.current_city || candidate.current_country);

  const nameRisk = invalidNameReason(name);
  if (nameRisk) { missingFields.push("displayName"); riskFlags.push(nameRisk); } else score += 25;
  const titleRisk = invalidTitleReason(title);
  if (titleRisk) { missingFields.push("title"); riskFlags.push(titleRisk); } else score += 20;
  const companyRisk = invalidCompanyReason(company);
  if (companyRisk) riskFlags.push(companyRisk); else if (company) score += 10;
  if (modules.length && !modules.some(m => /^unknown$/i.test(m))) score += 20; else missingFields.push("sapModules");
  if (hasContact) score += 10; else missingFields.push("contact");
  if (hasLocation) score += 10; else missingFields.push("location");
  if (!visibility.blocked_from_recruiter_search) score += 5; else riskFlags.push("blocked_from_recruiter_search");

  if (riskFlags.length) reasons.push(...riskFlags);
  const searchReady = score >= 75 && !nameRisk && !titleRisk && modules.length > 0 && !visibility.blocked_from_recruiter_search;
  return { score, searchReady, reasons, missingFields, riskFlags };
}

export function scoreExtractedCandidateProfile(item: Record<string, any>): ExtractionQaScore {
  const reasons: string[] = [];
  const missingFields: string[] = [];
  const riskFlags: string[] = [];
  let score = 0;
  if (item.extractedFullName && !item.isNameSuspicious) score += 25; else { missingFields.push("displayName"); riskFlags.push(item.nameRejectReason || "invalid_name"); }
  if (item.extractedCurrentTitle && !item.isTitleSuspicious) score += 20; else { missingFields.push("title"); riskFlags.push(item.titleRejectReason || "invalid_title"); }
  if (item.extractedCurrentCompany && item.extractedCurrentCompany !== "Not disclosed" && !item.isCompanySuspicious) score += 10; else if (item.isCompanySuspicious) riskFlags.push(item.companyRejectReason || "invalid_company");
  if (Array.isArray(item.sapModules) && item.sapModules.length && item.primarySapModule && item.primarySapModule !== "UNKNOWN") score += 20; else missingFields.push("sapModules");
  if (item.hasContact) score += 10; else missingFields.push("contact");
  if (!item.isLocationMissing) score += 10; else missingFields.push("location");
  if (item.reviewClassification === "search_ready_after_extraction") score += 5;
  if (item.primaryModuleAlignmentStatus === "evidence_conflict") riskFlags.push("title_module_mismatch");
  if (item.rawTextQualityReason) riskFlags.push(item.rawTextQualityReason);
  if (riskFlags.length) reasons.push(...riskFlags.filter(Boolean));
  return { score, searchReady: item.reviewClassification === "search_ready_after_extraction", reasons, missingFields, riskFlags: riskFlags.filter(Boolean) };
}
