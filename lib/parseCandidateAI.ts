import { parseCvFromText } from "./cv-parser";
import {
  classifyCandidateText,
  normalizeCandidatePayloadForSapUpload,
} from "./candidateFileGuards";

export async function parseCandidateAI(text: string, fileName?: string) {
  const classification = classifyCandidateText(text, fileName);
  const parsed = parseCvFromText(text, fileName);

  const normalized = classification.shouldSave
    ? normalizeCandidatePayloadForSapUpload(parsed, text)
    : parsed;

  return {
    ...normalized,

    name: normalized.name,
    email: normalized.email,
    phone: normalized.phone,
    location: normalized.location,

    title: normalized.currentTitle,
    current_title: normalized.currentTitle,
    current_company: normalized.currentCompany,
    headline: normalized.headline,

    years: normalized.years,
    yearsOfExperience: normalized.yearsOfExperience,
    experience: normalized.years ? `${normalized.years} years` : "",

    primary_module: normalized.primaryModule,
    primaryModule: normalized.primaryModule,
    secondary_modules: normalized.secondaryModules,
    secondaryModules: normalized.secondaryModules,

    role_type: normalized.roleType,
    roleType: normalized.roleType,
    consulting_level: normalized.consultingLevel,
    confidence: normalized.confidence,

    implementation_projects: normalized.implementationProjectCount,
    rollout_projects: normalized.rolloutProjectCount,
    ams_projects: normalized.amsProjectCount,
    migration_projects: normalized.migrationProjectCount,
    transformation_projects: normalized.transformationProjectCount,
    s4hana_projects: normalized.s4hanaProjectCount,
    ecc_projects: normalized.eccProjectCount,
    fico_projects: normalized.ficoProjectCount,

    implementation_authority_score: normalized.implementationAuthorityScore,
    domain_authority_score: normalized.domainAuthorityScore,
    finance_depth_score: normalized.financeDepthScore,
    consulting_dna_score: normalized.consultingDNAScore,
    module_authority_score: normalized.moduleAuthorityScore,

    skills: [...(normalized.sapModules || []), ...(normalized.sapSubmodules || [])],
    record_type: classification.recordType,
    is_sap_profile: classification.isSapProfile,
    file_classification: classification,
    parsed: normalized,
  };
}

export default parseCandidateAI;
