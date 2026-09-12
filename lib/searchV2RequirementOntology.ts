import { conceptsInText, searchConcept } from "./candidateSearchConcepts";

export const SEARCH_V2_REQUIREMENT_ONTOLOGY_VERSION =
  "search-v2-requirement-ontology-v3";

const normalize = (value: unknown) =>
  String(value || "").normalize("NFKC").replace(/[\u2013\u2014]/g, "-").replace(/\s+/g, " ").trim().toLowerCase();

export type UnifiedProfessionalRole = { id: string; label: string; aliases: readonly string[] };
export const PROFESSIONAL_ROLE_REGISTRY: readonly UnifiedProfessionalRole[] = [
  { id: "functional_consultant", label: "Functional Consultant", aliases: ["functional consultant"] },
  { id: "technical_consultant", label: "Technical Consultant", aliases: ["technical consultant"] },
  { id: "consultant", label: "Consultant", aliases: ["consultant", "consulting advisor"] },
  { id: "solution_architect", label: "Solution Architect", aliases: ["solution architect"] },
  { id: "architect", label: "Architect", aliases: ["architect", "technical architect"] },
  { id: "program_manager", label: "Program Manager", aliases: ["program manager", "programme manager"] },
  { id: "project_manager", label: "Project Manager", aliases: ["project manager"] },
  { id: "manager", label: "Manager", aliases: ["manager"] },
  { id: "developer", label: "Developer", aliases: ["developer", "programmer", "software engineer"] },
  { id: "analyst", label: "Analyst", aliases: ["analyst", "business analyst", "systems analyst"] },
  { id: "lead", label: "Lead", aliases: ["lead", "leader", "team lead"] },
  { id: "administrator", label: "Administrator", aliases: ["administrator", "admin"] },
  { id: "specialist", label: "Specialist", aliases: ["specialist", "subject matter expert"] },
  { id: "engineer", label: "Engineer", aliases: ["engineer"] },
  { id: "designer", label: "Designer", aliases: ["designer", "ux designer", "ui designer", "product designer"] },
  { id: "scientist", label: "Scientist", aliases: ["scientist", "data scientist", "research scientist"] },
  { id: "researcher", label: "Researcher", aliases: ["researcher"] },
  { id: "accountant", label: "Accountant", aliases: ["accountant", "auditor"] },
  { id: "recruiter", label: "Recruiter", aliases: ["recruiter", "talent acquisition specialist"] },
  { id: "sales", label: "Sales Professional", aliases: ["sales executive", "account executive", "sales representative"] },
  { id: "marketing", label: "Marketing Professional", aliases: ["marketer", "marketing executive", "marketing specialist"] },
  { id: "product_manager", label: "Product Manager", aliases: ["product manager", "product owner"] },
  { id: "scrum_master", label: "Scrum Master", aliases: ["scrum master"] },
  { id: "technician", label: "Technician", aliases: ["technician"] },
  { id: "coordinator", label: "Coordinator", aliases: ["coordinator"] },
  { id: "director", label: "Director", aliases: ["director"] },
  { id: "executive", label: "Executive", aliases: ["executive"] },
];

export const LANGUAGE_REGISTRY = [
  { id: "mandarin", label: "Mandarin", aliases: ["mandarin", "mandarin chinese", "chinese mandarin"] },
  { id: "japanese", label: "Japanese", aliases: ["japanese", "nihongo"] },
  { id: "english", label: "English", aliases: ["english"] },
  { id: "malay", label: "Malay", aliases: ["malay", "bahasa malaysia"] },
  { id: "thai", label: "Thai", aliases: ["thai"] },
  { id: "vietnamese", label: "Vietnamese", aliases: ["vietnamese"] },
  { id: "korean", label: "Korean", aliases: ["korean"] },
  { id: "german", label: "German", aliases: ["german"] },
  { id: "french", label: "French", aliases: ["french"] },
  { id: "spanish", label: "Spanish", aliases: ["spanish"] },
  { id: "arabic", label: "Arabic", aliases: ["arabic"] },
  { id: "cantonese", label: "Cantonese", aliases: ["cantonese", "yue chinese"] },
  { id: "hindi", label: "Hindi", aliases: ["hindi"] },
  { id: "bengali", label: "Bengali", aliases: ["bengali", "bangla"] },
  { id: "urdu", label: "Urdu", aliases: ["urdu"] },
  { id: "tamil", label: "Tamil", aliases: ["tamil"] },
  { id: "telugu", label: "Telugu", aliases: ["telugu"] },
  { id: "indonesian", label: "Indonesian", aliases: ["indonesian", "bahasa indonesia"] },
  { id: "tagalog", label: "Filipino", aliases: ["filipino", "tagalog"] },
  { id: "burmese", label: "Burmese", aliases: ["burmese", "myanmar language"] },
  { id: "khmer", label: "Khmer", aliases: ["khmer", "cambodian"] },
  { id: "lao", label: "Lao", aliases: ["lao", "laotian"] },
  { id: "italian", label: "Italian", aliases: ["italian"] },
  { id: "portuguese", label: "Portuguese", aliases: ["portuguese"] },
  { id: "dutch", label: "Dutch", aliases: ["dutch", "nederlands"] },
  { id: "polish", label: "Polish", aliases: ["polish"] },
  { id: "russian", label: "Russian", aliases: ["russian"] },
  { id: "ukrainian", label: "Ukrainian", aliases: ["ukrainian"] },
  { id: "turkish", label: "Turkish", aliases: ["turkish"] },
  { id: "hebrew", label: "Hebrew", aliases: ["hebrew"] },
  { id: "swedish", label: "Swedish", aliases: ["swedish"] },
  { id: "norwegian", label: "Norwegian", aliases: ["norwegian"] },
  { id: "danish", label: "Danish", aliases: ["danish"] },
  { id: "finnish", label: "Finnish", aliases: ["finnish"] },
  { id: "greek", label: "Greek", aliases: ["greek"] },
  { id: "romanian", label: "Romanian", aliases: ["romanian"] },
  { id: "czech", label: "Czech", aliases: ["czech"] },
  { id: "hungarian", label: "Hungarian", aliases: ["hungarian"] },
  { id: "swahili", label: "Swahili", aliases: ["swahili", "kiswahili"] },
] as const;

const bounded = (text: string, phrase: string) => {
  const escaped = normalize(phrase).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(?:^|[^a-z0-9])${escaped}(?:$|[^a-z0-9])`, "i").test(normalize(text));
};

export function professionalRolesInText(value: unknown) {
  const text = normalize(value);
  const matches = PROFESSIONAL_ROLE_REGISTRY.filter((role) => role.aliases.some((alias) => bounded(text, alias)));
  return matches.filter((role) => !matches.some((other) => other.id !== role.id && other.aliases.some((alias) => alias.includes(role.label.toLowerCase()))));
}

export function languagesInText(value: unknown) {
  const text = normalize(value);
  return LANGUAGE_REGISTRY.filter((language) => language.aliases.some((alias) => bounded(text, alias)));
}

export function canonicalLanguage(value: unknown) {
  const text = normalize(value);
  return LANGUAGE_REGISTRY.find((language) => language.aliases.some((alias) => normalize(alias) === text)) || null;
}

export function experienceRangeInText(value: unknown) {
  const text = normalize(value);
  const range = text.match(/\b(\d{1,2})\s*(?:-|to)\s*(\d{1,2})\s*years?\b/i);
  if (range) return { minimum: Number(range[1]), maximum: Number(range[2]) };
  const minimum = text.match(/(?:minimum|min\.?|at least)?\s*(\d{1,2})\s*\+?\s*years?\b/i);
  return minimum ? { minimum: Number(minimum[1]), maximum: null } : null;
}

export function seniorityInText(value: unknown) {
  const text = normalize(value);
  if (/\b(?:principal|director|head of)\b/.test(text)) return "Principal";
  if (/\b(?:senior|sr\.?|lead)\b/.test(text)) return "Senior";
  if (/\b(?:junior|jr\.?|entry level|graduate)\b/.test(text)) return "Junior";
  return null;
}

export type SearchClarificationQuestion = Readonly<{ id: string; label: string; type: "single" | "multiple" | "free_text"; options: readonly string[]; affects: "location" | "experience" | "language" | "delivery" | "title_scope" }>;
export function clarificationQuestionsFor(input: { wording: string; hasLocation: boolean; hasExperience: boolean; hasLanguage: boolean; hasDelivery: boolean }): SearchClarificationQuestion[] {
  const concepts = conceptsInText(input.wording).map((id) => searchConcept(id)?.label).filter(Boolean);
  const questions: SearchClarificationQuestion[] = [];
  if (!input.hasLocation) questions.push({ id: "location", label: "Where should candidates be located?", type: "multiple", options: ["No preference"], affects: "location" });
  if (!input.hasExperience) questions.push({ id: "experience", label: "What experience level should we target?", type: "single", options: ["3+ years", "5+ years", "8+ years", "10+ years", "No preference"], affects: "experience" });
  if (!input.hasDelivery && concepts.length) questions.push({ id: "delivery", label: `Which delivery experience is required for ${concepts[0]}?`, type: "multiple", options: ["Implementation", "Rollout", "Migration", "Support", "No preference"], affects: "delivery" });
  if (!input.hasLanguage) questions.push({ id: "language", label: "Is a specific language required?", type: "multiple", options: [...LANGUAGE_REGISTRY.slice(0, 6).map((item) => item.label), "No preference"], affects: "language" });
  return questions;
}
