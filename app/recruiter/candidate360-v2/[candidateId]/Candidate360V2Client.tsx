"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";

import type { Candidate360Field, Candidate360Profile } from "@/lib/candidate360Types";
import Candidate360Skeleton from "./Candidate360Skeleton";

type EnterpriseProject = Candidate360Profile["enterpriseProfile"]["projects"][number];
type EnterpriseEmployment = Candidate360Profile["enterpriseProfile"]["employmentTimeline"][number];
type EnterpriseEducation = Candidate360Profile["enterpriseProfile"]["education"][number];
type Candidate360V2Profile = Candidate360Profile & {
  availability?: unknown;
  availabilityTimeline?: unknown;
  expectedSalary?: unknown;
  expected_salary?: unknown;
  noticePeriod?: unknown;
  notice_period?: unknown;
  linkedinUrl?: unknown;
  linkedin_url?: unknown;
  recruiterNotes?: unknown[] | string;
  notes?: unknown[] | string;
  duplicateRisk?: unknown;
  duplicate_count?: unknown;
};

type SkillGroup = "SAP" | "Programming" | "Database" | "Cloud" | "Integration" | "Tools";

type SearchContext = {
  candidateIds: string[];
  returnUrl: string;
  filters?: { countries?: string[]; skills?: string[]; sapModules?: string[]; industries?: string[] };
  matchedByCandidate?: Record<string, { matchedSkills?: string[]; matchedSapModules?: string[]; matchedIndustries?: string[]; matchedTerms?: string[] }>;
};

type OpenSections = { projects: boolean; timeline: boolean; education: boolean; credentials: boolean; risks: boolean; notes: boolean };
type WorkspaceTab = "overview" | "decision" | "experience" | "projects" | "skills" | "evidence" | "notes";
const WORKSPACE_TABS: Array<{ id: WorkspaceTab; label: string }> = [{ id: "overview", label: "Overview" }, { id: "decision", label: "Decision" }, { id: "experience", label: "Experience" }, { id: "projects", label: "Projects" }, { id: "skills", label: "Skills" }, { id: "evidence", label: "Evidence" }, { id: "notes", label: "Notes" }];
const SEARCH_CONTEXT_KEY = "candidate360.searchContext.v1";
const ACCORDION_KEY = "candidate360.openSections.v2";

const shell = "rounded-2xl border border-slate-800/90 bg-[#0B0F16]";
const subtle = "rounded-xl border border-slate-800 bg-[#070A0F]";
const button = "inline-flex min-h-10 items-center justify-center rounded-lg border border-slate-700 px-4 py-2 text-sm font-medium text-slate-200 transition hover:border-slate-500 hover:bg-slate-800/70 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300";

function unwrap(value: unknown): unknown {
  let current = value;
  for (let depth = 0; depth < 4 && current && typeof current === "object" && !Array.isArray(current) && "value" in current; depth += 1) {
    current = (current as { value: unknown }).value;
  }
  return current;
}

function display(value: unknown, fallback = "—") {
  const current = unwrap(value);
  if (typeof current === "string" && current.trim()) return current.trim();
  if (typeof current === "number" || typeof current === "boolean") return String(current);
  return fallback;
}

function unique(values: Array<string | null | undefined>) {
  const seen = new Set<string>();
  return values.filter((value): value is string => {
    const key = value?.trim().toLowerCase();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function formatSalary(value: unknown) {
  const current = unwrap(value);
  if (typeof current === "string" || typeof current === "number") return display(current);
  if (!current || typeof current !== "object") return "—";
  const item = current as Record<string, unknown>;
  const amount = display(item.amount ?? item.value ?? item.expected, "");
  const currency = display(item.currency, "");
  const period = display(item.period ?? item.frequency, "");
  return [currency, amount, period].filter(Boolean).join(" ") || "—";
}

function Section({ id, title, description, children, className = "", open = true, onToggle }: { id?: string; title: string; description?: string; children: React.ReactNode; className?: string; collapsible?: boolean; open?: boolean; onToggle?: () => void }) {
  const [internalOpen, setInternalOpen] = useState(open);
  const [copiedSection, setCopiedSection] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);
  const sectionKey = title.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  const headingId = `candidate-section-${sectionKey}`;
  const contentId = `${headingId}-content`;
  const expanded = onToggle ? open : internalOpen;
  const toggle = () => onToggle ? onToggle() : setInternalOpen((value) => !value);
  const sectionText = () => `${title}\n${contentRef.current?.textContent?.replace(/\s+/g, " ").trim() || "Not evidenced in source profile."}`;
  const copySection = async () => { await navigator.clipboard.writeText(sectionText()); setCopiedSection(true); window.setTimeout(() => setCopiedSection(false), 1500); };
  const exportSection = () => { const blob = new Blob([sectionText()], { type: "text/plain;charset=utf-8" }); const href = URL.createObjectURL(blob); const link = document.createElement("a"); link.href = href; link.download = `${sectionKey}.txt`; link.click(); URL.revokeObjectURL(href); };
  return <section id={id} aria-labelledby={headingId} className={`${shell} p-5 md:p-6 ${className}`}>
    <div className={expanded ? "mb-5 flex flex-wrap items-start justify-between gap-3" : "flex flex-wrap items-start justify-between gap-3"}><div><h2 id={headingId} className="text-lg font-semibold tracking-tight text-white">{title}</h2>{description ? <p className="mt-1 text-sm text-slate-400">{description}</p> : null}</div><div className="flex flex-wrap items-center gap-1.5"><button type="button" onClick={copySection} className="min-h-9 rounded-lg border border-slate-800 px-2.5 text-xs font-medium text-slate-400 hover:border-slate-600 hover:text-white">{copiedSection ? "Copied" : "Copy"}</button><button type="button" onClick={exportSection} className="min-h-9 rounded-lg border border-slate-800 px-2.5 text-xs font-medium text-slate-400 hover:border-slate-600 hover:text-white">Export</button><button type="button" onClick={toggle} aria-expanded={expanded} aria-controls={contentId} className="min-h-9 rounded-lg border border-slate-800 px-2.5 text-xs font-medium text-slate-400 hover:border-slate-600 hover:text-white">{expanded ? "Collapse" : "Expand"}</button></div></div>
    <div ref={contentRef} id={contentId} className={expanded ? "" : "hidden"}>{children}</div>
  </section>;
}

function Empty({ children }: { children: React.ReactNode }) {
  return <div className="rounded-xl border border-dashed border-slate-700 px-5 py-8 text-center text-sm text-slate-400">{children}</div>;
}

function Info({ label, value, href }: { label: string; value: string; href?: string }) {
  const content = href && value !== "—" ? <a href={href} className="break-all text-slate-100 underline decoration-slate-700 underline-offset-4 hover:decoration-cyan-400">{value}</a> : <span className="break-words text-slate-100">{value}</span>;
  return <div className="border-b border-slate-800/80 py-3 last:border-0"><dt className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">{label}</dt><dd className="mt-1 text-sm">{content}</dd></div>;
}

function highlightPills(profile: Candidate360V2Profile) {
  const enterprise = profile.enterpriseProfile;
  const h = enterprise.careerHighlights;
  const background = h.consultingBackground && h.endUserBackground ? "Consulting + End User" : h.consultingBackground ? "Consulting" : h.endUserBackground ? "End User" : null;
  const primaryModule = h.primarySapModule ? (/^SAP\b/i.test(h.primarySapModule) ? h.primarySapModule : `SAP ${h.primarySapModule}`) : null;
  return unique([
    h.yearsExperience ? `${h.yearsExperience} Years SAP` : null,
    h.implementationProjects ? `${h.implementationProjects} Full-cycle Implementation${h.implementationProjects === 1 ? "" : "s"}` : null,
    h.amsProjects ? `${h.amsProjects} AMS` : null,
    h.rolloutProjects ? `${h.rolloutProjects} Rollout${h.rolloutProjects === 1 ? "" : "s"}` : null,
    h.greenfieldProjects ? `${h.greenfieldProjects} Greenfield` : null,
    h.brownfieldProjects ? `${h.brownfieldProjects} Brownfield` : null,
    primaryModule,
    h.countries[0] || null,
    background ? `${background}${h.yearsConsulting ? ` · ${h.yearsConsulting} years` : ""}` : null,
    h.yearsLeadership ? `${h.yearsLeadership} Years Leadership` : null,
    h.industries[0] || null,
    enterprise.languages[0]?.language || null,
    h.publicCloud ? "Public Cloud" : h.privateCloud ? "Private Cloud" : h.s4hana ? "S/4HANA" : h.ecc ? "ECC" : null,
  ]).slice(0, 10);
}

function companyInitials(company: string) {
  return company.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("") || "CO";
}

function employmentBadge(role: EnterpriseEmployment) {
  const evidence = `${role.companyType} ${role.company}`;
  if (/consulting|consultancy|professional services/i.test(evidence)) return "Consulting";
  if (/end[ -]?user|in[ -]?house|corporate/i.test(role.companyType)) return "End User";
  return "";
}

function seniorityRank(title: string) {
  if (/director|head|principal/i.test(title)) return 5;
  if (/manager|lead/i.test(title)) return 4;
  if (/senior|sr\.?/i.test(title)) return 3;
  if (/consultant|specialist/i.test(title)) return 2;
  if (/analyst|associate|junior|jr\.?/i.test(title)) return 1;
  return 0;
}

function isPromotion(role: EnterpriseEmployment, previous?: EnterpriseEmployment) {
  return Boolean(previous && role.company.trim().toLowerCase() === previous.company.trim().toLowerCase() && seniorityRank(role.title) > seniorityRank(previous.title));
}

function preciseMonth(value: string) {
  if (!value || /present|current|now/i.test(value) || /^\d{4}$/.test(value.trim())) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.getUTCFullYear() * 12 + parsed.getUTCMonth();
}

function employmentGap(newer: EnterpriseEmployment, older?: EnterpriseEmployment) {
  if (!older) return null;
  const nextStart = preciseMonth(newer.start);
  const previousEnd = preciseMonth(older.end);
  if (nextStart === null || previousEnd === null) return null;
  const months = nextStart - previousEnd;
  return months > 1 ? months : null;
}
function frequency(values: string[]) {
  const counts = new Map<string, number>();
  for (const value of values.map((item) => item.trim()).filter(Boolean)) counts.set(value, (counts.get(value) || 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1]);
}
function projectCopyText(project: EnterpriseProject) {
  return [project.name, project.client && project.client !== project.name ? `Client: ${project.client}` : "", project.role ? `Role: ${project.role}` : "", project.country ? `Country: ${project.country}` : "", project.industry ? `Industry: ${project.industry}` : "", project.modules.length ? `Modules: ${project.modules.join(", ")}` : "", project.environment ? `Environment: ${project.environment}` : "", [project.start, project.end].filter(Boolean).join("–"), ...project.responsibilities.map((item) => `- ${item}`)].filter(Boolean).join("\n");
}
function projectGroup(project: EnterpriseProject) {
  const evidence = `${project.name} ${project.projectType} ${project.implementationType} ${project.environment}`;
  if (/rollout/i.test(evidence)) return "Rollout";
  if (/migration|conversion/i.test(evidence)) return "Migration";
  if (/\bams\b|application management/i.test(evidence)) return "AMS";
  if (/\bsupport\b|hypercare|maintenance/i.test(evidence)) return "Support";
  if (/implementation|greenfield|brownfield/i.test(evidence)) return "Implementation";
  if (/transformation|upgrade|s\/4|s4hana|public cloud|private cloud/i.test(evidence)) return "Transformation";
  return "Transformation";
}
function projectComplexityLabel(project: EnterpriseProject) {
  const scope = `${project.projectType} ${project.implementationType} ${project.environment}`;
  const signals = [project.teamSize !== null, project.modules.length > 1, project.responsibilities.length > 2, /greenfield|migration|conversion|s\/4|s4hana|cloud/i.test(scope)].filter(Boolean).length;
  if (!signals) return "";
  return signals >= 3 || (project.teamSize || 0) >= 10 ? "High" : signals >= 2 ? "Medium" : "Established";
}
function projectOutcome(project: EnterpriseProject) {
  return project.responsibilities.find((item) => /go-live|delivered|implemented|completed|achieved|launched|deployed|successful/i.test(item)) || "";
}
function projectImpact(project: EnterpriseProject) {
  return project.responsibilities.find((item) => /\d+%|saving|reduc|improv|efficien|users|countries|sites|business impact|revenue/i.test(item)) || "";
}
function projectBadges(project: EnterpriseProject) {
  const evidence = `${project.name} ${project.projectType} ${project.implementationType} ${project.environment} ${project.responsibilities.join(" ")}`;
  const options: Array<[string, RegExp]> = [
    ["Greenfield", /greenfield/i], ["Brownfield", /brownfield/i], ["AMS", /\bams\b/i],
    ["Rollout", /rollout/i], ["Support", /\bsupport\b/i], ["Upgrade", /\bupgrade\b/i], ["Migration", /migration|conversion/i], ["Public Cloud", /public cloud/i],
    ["Private Cloud", /private cloud/i], ["ECC", /\becc\b/i], ["S/4HANA", /s\/?4\s*hana|s4hana/i],
  ];
  return options.filter(([, pattern]) => pattern.test(evidence)).map(([label]) => label);
}

function groupSkills(profile: Candidate360V2Profile): Record<SkillGroup, string[]> {
  const groups: Record<SkillGroup, string[]> = { SAP: [], Programming: [], Database: [], Cloud: [], Integration: [], Tools: [] };
  const sap = unique([...profile.enterpriseProfile.sapModules, ...profile.sapModules.map((item) => display(item.name.value, ""))]);
  groups.SAP = sap;
  const skills = unique([...profile.enterpriseProfile.technicalSkills, ...profile.techSkills.map((item) => display(item.name.value, ""))]).filter((item) => !sap.some((module) => module.toLowerCase() === item.toLowerCase()));
  for (const skill of skills) {
    if (/abap|java|javascript|typescript|python|\.net|sql|coding|development/i.test(skill)) groups.Programming.push(skill);
    else if (/hana|oracle|sql server|database|db2|mysql|postgres/i.test(skill)) groups.Database.push(skill);
    else if (/aws|azure|gcp|cloud|btp|hyperscaler/i.test(skill)) groups.Cloud.push(skill);
    else if (/cpi|pi\/?po|integration|idoc|odata|api|edi|middleware/i.test(skill)) groups.Integration.push(skill);
    else groups.Tools.push(skill);
  }
  return groups;
}

function riskItems(profile: Candidate360V2Profile) {
  const enterprise = profile.enterpriseProfile;
  const risks = [...enterprise.quality.reviewRisks];
  if (enterprise.quality.dataConfidence < 70) risks.push(`Data confidence is ${enterprise.quality.dataConfidence}%`);
  if (profile.readiness.needsCandidateConfirmation) risks.push("Candidate confirmation is required");
  if (profile.readiness.needsRecruiterReview) risks.push("Recruiter verification is required");
  const duplicate = Number(unwrap(profile.duplicateRisk ?? profile.duplicate_count));
  if (Number.isFinite(duplicate) && duplicate > 0) risks.push("Potential duplicate candidate record");
  return unique(risks.filter((item) => !/repair|needs_repair|parser extracted/i.test(item)));
}

const CandidateIntelligencePanel = dynamic(() => import("./CandidateIntelligencePanel"), { loading: () => <IntelligenceSkeleton /> });
const CandidateDecisionPanel = dynamic(() => import("./CandidateDecisionPanel"), { loading: () => <IntelligenceSkeleton /> });
const RecruiterAICopilot = dynamic(() => import("./RecruiterAICopilot"));
const ExecutiveHiringDecision = dynamic(() => import("./ExecutiveHiringDecision"), { loading: () => <IntelligenceSkeleton /> });
const HiringDashboard = dynamic(() => import("./HiringDashboard"));

function IntelligenceSkeleton() { return <div aria-busy="true" aria-label="Loading candidate intelligence" className={`${shell} h-[560px] animate-pulse motion-reduce:animate-none`}><span className="sr-only" role="status">Loading candidate intelligence</span></div>; }

export default function Candidate360V2Client({ candidateId }: { candidateId: string }) {
  const [profile, setProfile] = useState<Candidate360V2Profile | null>(null);
  const [error, setError] = useState("");
  const [showAllRoles, setShowAllRoles] = useState(false);
  const [showAllHighlights, setShowAllHighlights] = useState(false);
  const [showAllProjects, setShowAllProjects] = useState(false);
  const [projectSort, setProjectSort] = useState<"newest" | "relevant" | "complexity">("newest");
  const [searchContext, setSearchContext] = useState<SearchContext | null>(null);
  const [detailsReady, setDetailsReady] = useState(false);
  const [selectedJob, setSelectedJob] = useState<Record<string, unknown> | null>(null);
  const [activeTab, setActiveTab] = useState<WorkspaceTab>("overview");
  const [copied, setCopied] = useState("");
  const [openSections, setOpenSections] = useState<OpenSections>({ projects: false, timeline: false, education: false, credentials: false, risks: false, notes: false });

  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/candidate360/${encodeURIComponent(candidateId)}`, { signal: controller.signal })
      .then(async (response) => {
        const payload = await response.json() as Candidate360V2Profile | { error?: string };
        if (!response.ok) throw new Error("error" in payload && payload.error ? payload.error : "Unable to load Candidate360 profile");
        setProfile(payload as Candidate360V2Profile);
      })
      .catch((reason: unknown) => {
        if (!(reason instanceof DOMException && reason.name === "AbortError")) setError(reason instanceof Error ? reason.message : "Unable to load Candidate360 profile");
      });
    return () => controller.abort();
  }, [candidateId]);
  useEffect(() => {
    if (!profile) return;
    const idleWindow = window as Window & { requestIdleCallback?: (callback: () => void, options?: { timeout: number }) => number };
    const restore = () => {
      setDetailsReady(true);
      requestAnimationFrame(() => window.scrollTo({ top: Number(window.sessionStorage.getItem(`candidate360.scroll.${candidateId}`)) || 0 }));
    };
    if (idleWindow.requestIdleCallback) idleWindow.requestIdleCallback(restore, { timeout: 250 });
    else window.setTimeout(restore, 0);
  }, [profile, candidateId]);

  useEffect(() => {
    try {
      const context = window.sessionStorage.getItem(SEARCH_CONTEXT_KEY);
      if (context) setSearchContext(JSON.parse(context) as SearchContext);
      const savedTab = window.localStorage.getItem("candidate360.activeTab.v1") as WorkspaceTab | null;
      if (savedTab && WORKSPACE_TABS.some((tab) => tab.id === savedTab)) setActiveTab(savedTab);
      const sections = window.localStorage.getItem(ACCORDION_KEY);
      if (sections) setOpenSections((current) => ({ ...current, ...(JSON.parse(sections) as Partial<OpenSections>) }));
      const jobId = new URLSearchParams(window.location.search).get("jobId");
      if (jobId) fetch(`/api/jobs/${encodeURIComponent(jobId)}`).then(async (response) => response.ok ? response.json() as Promise<Record<string, unknown>> : null).then((job) => { if (job) setSelectedJob(job); }).catch(() => undefined);
    } catch {
      window.sessionStorage.removeItem(SEARCH_CONTEXT_KEY);
      window.localStorage.removeItem(ACCORDION_KEY);
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem("candidate360.activeTab.v1", activeTab);
  }, [activeTab]);

  useEffect(() => {
    window.localStorage.setItem(ACCORDION_KEY, JSON.stringify(openSections));
  }, [openSections]);

  useEffect(() => {
    const persistScroll = () => window.sessionStorage.setItem(`candidate360.scroll.${candidateId}`, String(window.scrollY));
    window.addEventListener("scroll", persistScroll, { passive: true });
    return () => { persistScroll(); window.removeEventListener("scroll", persistScroll); };
  }, [candidateId]);

  useEffect(() => {
    const ids = searchContext?.candidateIds || [];
    const index = ids.indexOf(candidateId);
    const previousId = index > 0 ? ids[index - 1] : "";
    const nextId = index >= 0 && index < ids.length - 1 ? ids[index + 1] : "";
    const go = (href: string) => { window.sessionStorage.setItem(`candidate360.scroll.${candidateId}`, String(window.scrollY)); window.location.assign(href); };
    const handler = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (event.metaKey || event.ctrlKey || event.altKey || target?.matches("input, textarea, select, [contenteditable='true']")) return;
      const key = event.key.toLowerCase();
      if (key === "j" && nextId) go(`/recruiter/candidate360-v2/${encodeURIComponent(nextId)}?from=search-v2`);
      else if (key === "k" && previousId) go(`/recruiter/candidate360-v2/${encodeURIComponent(previousId)}?from=search-v2`);
      else if (key === "s") go("/recruiter/smart-shortlist");
      else if (key === "c") go(`/recruiter/candidate-compare?candidateIds=${encodeURIComponent(candidateId)}`);
      else if (key === "g") go(`/recruiter/submission-generator?candidateId=${encodeURIComponent(candidateId)}`);
      else return;
      event.preventDefault();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [candidateId, searchContext]);

  const skills = useMemo(() => profile ? groupSkills(profile) : null, [profile]);
  const risks = useMemo(() => profile ? riskItems(profile) : [], [profile]);

  if (error) return <main className="min-h-screen bg-[#05070A] px-5 py-16 text-slate-100"><div role="alert" className="mx-auto max-w-2xl rounded-2xl border border-rose-400/40 bg-rose-950/30 p-6"><h1 className="text-xl font-semibold">Candidate profile unavailable</h1><p className="mt-2 text-sm text-rose-100">The candidate profile could not be loaded.</p><div className="mt-5 flex flex-wrap gap-3"><button type="button" onClick={() => window.location.reload()} className={button}>Try again</button><Link href="/recruiter/talent-search/v2" className={button}>Back to Candidate Search V2</Link></div></div></main>;
  if (!profile || !skills) return <Candidate360Skeleton />;

  const visibleSkillGroups = (Object.entries(skills) as Array<[SkillGroup, string[]]>).filter(([, items]) => items.length);
  const enterprise = profile.enterpriseProfile;
  const recruiterSignals = enterprise.recruiterSignals;
  const availability = display(recruiterSignals.availability || profile.availability || profile.availabilityTimeline);
  const salary = formatSalary(recruiterSignals.salary || profile.expectedSalary || profile.expected_salary);
  const notice = display(recruiterSignals.notice || profile.noticePeriod || profile.notice_period);
  const travel = display(recruiterSignals.travel);
  const remote = display(recruiterSignals.remote);
  const visa = display(recruiterSignals.visa);
  const linkedin = display(profile.linkedinUrl ?? profile.linkedin_url);
  const email = display(profile.contactInfo.email.value);
  const phone = display(profile.contactInfo.phone.value);
  const highlights = highlightPills(profile);
  const roles = enterprise.employmentTimeline;
  const currentEmployment = roles.find((role) => role.current) || roles[0];
  const employerDates = currentEmployment ? [currentEmployment.start, currentEmployment.end || (currentEmployment.current ? "Present" : "")].filter(Boolean).join("–") : "";
  const visibleRoles = showAllRoles ? roles : roles.slice(0, 6);
  const projects = enterprise.projects;
  const relevantProjectTerms = unique([...(searchContext?.filters?.skills || []), ...(searchContext?.filters?.sapModules || []), ...(searchContext?.filters?.industries || []), ...(searchContext?.filters?.countries || [])]).map((item) => item.toLowerCase());
  const projectRelevance = (project: EnterpriseProject) => relevantProjectTerms.filter((term) => [project.name, project.client, project.role, project.industry, project.country, project.environment, ...project.modules].join(" ").toLowerCase().includes(term)).length;
  const projectComplexity = (project: EnterpriseProject) => (project.teamSize || 0) + project.responsibilities.length * 2 + project.modules.length * 3 + (/greenfield|migration|s\/4|public cloud/i.test(`${project.projectType} ${project.implementationType} ${project.environment}`) ? 10 : 0);
  const orderedProjects = projectSort === "newest" ? projects : [...projects].sort((a, b) => projectSort === "relevant" ? projectRelevance(b) - projectRelevance(a) : projectComplexity(b) - projectComplexity(a));
  const visibleProjects = showAllProjects ? orderedProjects : orderedProjects.slice(0, 5);
  const projectGroups = ["Implementation", "Rollout", "AMS", "Support", "Migration", "Transformation", "Unclassified"].map((label) => ({ label, projects: visibleProjects.filter((project) => projectGroup(project) === label) })).filter((group) => group.projects.length);
  const education = enterprise.education;
  const languages = enterprise.languages;
  const certifications = enterprise.certifications;
  const notesValue = profile.recruiterNotes ?? profile.notes;
  const notes = (Array.isArray(notesValue) ? notesValue : [notesValue]).map((item) => display(item, "")).filter(Boolean);
  const candidateIds = searchContext?.candidateIds || [];
  const candidateIndex = candidateIds.indexOf(candidateId);
  const previousId = candidateIndex > 0 ? candidateIds[candidateIndex - 1] : "";
  const nextId = candidateIndex >= 0 && candidateIndex < candidateIds.length - 1 ? candidateIds[candidateIndex + 1] : "";
  const backHref = searchContext?.returnUrl || "/recruiter/talent-search/v2";
  const match = searchContext?.matchedByCandidate?.[candidateId];
  const matchedSignals = new Set(unique([...(match?.matchedSkills || []), ...(match?.matchedSapModules || []), ...(match?.matchedIndustries || []), ...(match?.matchedTerms || []), ...(searchContext?.filters?.countries || [])]).map((item) => item.toLowerCase()));
  const isMatched = (value: string) => [...matchedSignals].some((signal) => value.toLowerCase().includes(signal) || signal.includes(value.toLowerCase()));
  const toggleSection = (section: keyof OpenSections) => setOpenSections((current) => ({ ...current, [section]: !current[section] }));
  const candidateHref = (id: string) => `/recruiter/candidate360-v2/${encodeURIComponent(id)}?from=search-v2`;
  const copyText = async (label: string, value: string) => {
    if (!value.trim()) return;
    await navigator.clipboard.writeText(value);
    setCopied(label);
    window.setTimeout(() => setCopied((current) => current === label ? "" : current), 1800);
  };
  const timelineText = roles.map((role) => [[role.start, role.end || (role.current ? "Present" : "")].filter(Boolean).join("–"), role.company, role.title, role.location].filter(Boolean).join(" | ")).join("\n");
  const skillsText = (Object.entries(skills) as Array<[SkillGroup, string[]]>).filter(([, items]) => items.length).map(([group, items]) => `${group}: ${items.join(", ")}`).join("\n");
  const summaryLines = (enterprise.summary || profile.executiveSummary || "").split(/\n|(?<=\.)\s+/).map((line) => line.trim()).filter(Boolean).slice(0, 4);
  const countryHeatmap = frequency(projects.map((project) => project.country));
  const industryHeatmap = frequency(projects.map((project) => project.industry));
  const landscapes = unique([enterprise.careerHighlights.ecc ? "ECC" : null, enterprise.careerHighlights.s4hana ? "S/4HANA" : null, enterprise.careerHighlights.publicCloud ? "Public Cloud" : null, enterprise.careerHighlights.privateCloud ? "Private Cloud" : null]);

  return (
    <main id="candidate-profile" className="min-h-screen bg-[#05070A] pb-16 text-slate-100">
      <header className="sticky top-0 z-40 border-b border-slate-800/90 bg-[#070A0F]/95 px-4 py-4 shadow-2xl shadow-black/30 backdrop-blur-xl md:px-6">
        <div className="mx-auto max-w-[1440px]">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div className="min-w-0">
              <div className="flex items-center gap-3 text-xs text-slate-400"><Link href={backHref} className="hover:text-slate-200">Back to Search</Link><span>/</span><span>Candidate360</span></div>
              <div className="mt-2 flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <h1 className="truncate text-2xl font-semibold tracking-tight text-white">{display(profile.displayName.value, "Candidate profile")}</h1>
                <span className="text-sm text-slate-400">{display(profile.currentTitle.value)}</span>
              </div>
              <p className="mt-1 text-sm text-slate-400">{unique([display(profile.currentCompany.value, ""), currentEmployment?.location || display(profile.location.value, ""), employerDates]).join(" · ") || "Profile context requires review"}</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <dl aria-label="Candidate availability" className="mr-2 grid grid-cols-2 gap-x-4 gap-y-2 border-slate-800 text-xs sm:grid-cols-3 lg:border-r lg:pr-4"><div><dt className="text-slate-400">Availability</dt><dd className="font-medium text-slate-200">{availability}</dd></div><div><dt className="text-slate-400">Notice</dt><dd className="font-medium text-slate-200">{notice}</dd></div><div><dt className="text-slate-400">Salary</dt><dd className="font-medium text-slate-200">{salary}</dd></div><div><dt className="text-slate-400">Travel</dt><dd className="font-medium text-slate-200">{travel}</dd></div><div><dt className="text-slate-400">Remote</dt><dd className="font-medium text-slate-200">{remote}</dd></div><div><dt className="text-slate-400">Visa</dt><dd className="font-medium text-slate-200">{visa}</dd></div></dl>
              {previousId ? <Link href={candidateHref(previousId)} aria-keyshortcuts="K" className={button}>Previous</Link> : null}
              {nextId ? <Link href={candidateHref(nextId)} aria-keyshortcuts="J" className={button}>Next</Link> : null}
              <Link href={`/recruiter/candidate-compare?candidateIds=${encodeURIComponent(profile.candidateId)}`} aria-keyshortcuts="C" className={button}>Compare</Link>
              <Link href="/recruiter/smart-shortlist" aria-keyshortcuts="S" className={button}>Shortlist</Link>
              <Link href={`/recruiter/submission-generator?candidateId=${encodeURIComponent(profile.candidateId)}`} aria-keyshortcuts="G" className="inline-flex min-h-10 items-center justify-center rounded-lg bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-white">Generate Submission</Link>
              <a href={`/api/candidate360/${encodeURIComponent(profile.candidateId)}/resume`} className={button}>Download CV</a>
              <a href={`/api/candidate360/${encodeURIComponent(profile.candidateId)}/resume?mode=inline`} target="_blank" rel="noreferrer" className={button}>Open Original Resume</a>
            </div>
          </div>
          <nav aria-label="Quick recruiter actions" className="mt-3 flex flex-wrap items-center gap-2 border-t border-slate-800 pt-3">
            <span className="mr-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">Quick actions</span>
            <Link href={`/recruiter/submission-generator?candidateId=${encodeURIComponent(profile.candidateId)}`} className={button}>Generate Submission</Link>
            <Link href={`/recruiter/workflow/copilot?candidateId=${encodeURIComponent(profile.candidateId)}&intent=interview-questions`} className={button}>Generate Interview Questions</Link>
            <button type="button" onClick={() => copyText("summary", enterprise.summary)} className={button}>Generate Candidate Summary</button>
            <span aria-live="polite" className="text-xs text-emerald-300">{copied ? `${copied} copied` : ""}</span>
          </nav>
        </div>
      </header>

      <nav aria-label="Candidate workspace sections" className="sticky top-[1px] z-30 border-b border-slate-800 bg-[#05070A]/95 px-4 backdrop-blur-xl md:px-6"><div className="mx-auto flex max-w-[1440px] gap-1 overflow-x-auto py-2" role="tablist">{WORKSPACE_TABS.map((tab) => <button key={tab.id} type="button" role="tab" aria-selected={activeTab === tab.id} aria-controls="candidate-workspace-panel" onClick={() => setActiveTab(tab.id)} className={`min-h-10 shrink-0 rounded-lg px-4 text-sm font-medium transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-300 ${activeTab === tab.id ? "bg-slate-100 text-slate-950" : "text-slate-400 hover:bg-slate-900 hover:text-white"}`}>{tab.label}</button>)}</div></nav>

      <div id="candidate-workspace-panel" role="tabpanel" aria-label={`${activeTab} workspace`} className="mx-auto max-w-[1440px] space-y-6 px-4 py-7 md:px-6 md:py-10">
        <div className={activeTab === "overview" ? "space-y-4" : "hidden"}><HiringDashboard profile={profile} job={selectedJob}/><ExecutiveHiringDecision profile={profile} job={selectedJob}/></div>
        <Section title="Career highlights" description="System-derived signals from resume evidence; expand source details before treating a claim as verified." className={activeTab === "overview" ? "" : "hidden"}>
          {highlights.length ? <div className="flex flex-wrap gap-2">{(showAllHighlights ? highlights : highlights.slice(0, 6)).map((item) => <span key={item} className={`rounded-full border px-3 py-1.5 text-sm font-medium transition duration-200 hover:-translate-y-0.5 hover:border-slate-500 motion-reduce:transform-none ${isMatched(item) ? "border-emerald-600/60 bg-emerald-950/35 text-emerald-200" : "border-slate-700 bg-slate-900/80 text-slate-200"}`}><span className="mr-1.5 text-[9px] uppercase tracking-wide text-slate-500">Derived</span>{item}{isMatched(item) ? <span className="ml-1.5 text-[10px] uppercase tracking-wide text-emerald-400">match</span> : null}</span>)}{highlights.length > 6 ? <button type="button" onClick={() => setShowAllHighlights((value) => !value)} aria-expanded={showAllHighlights} className="rounded-full border border-slate-700 px-3 py-1.5 text-sm font-medium text-cyan-300 hover:border-cyan-600">{showAllHighlights ? "Show fewer" : `+${highlights.length - 6} More`}</button> : null}</div> : <Empty>Career highlights not evidenced in source profile.</Empty>}
        </Section>
        <section aria-labelledby="executive-snapshot-title" className={`${activeTab === "overview" ? shell : "hidden"} p-5 md:p-6`}>
          <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 id="executive-snapshot-title" className="text-lg font-semibold text-white">Executive snapshot</h2><p className="mt-1 text-sm text-slate-400">System-derived summary from structured resume evidence; confirmation status is shown separately.</p></div><button type="button" onClick={() => copyText("summary", enterprise.summary || profile.executiveSummary || "")} className={button}>Copy Summary</button></div>
          <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,3fr)_minmax(300px,1fr)]">
            <div><dl className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-slate-800 bg-slate-800 sm:grid-cols-4"><div className="bg-[#070A0F] p-3"><dt className="text-[10px] uppercase tracking-wide text-slate-400">Experience</dt><dd className="mt-1 text-lg font-semibold text-white">{enterprise.careerHighlights.yearsExperience ? `${enterprise.careerHighlights.yearsExperience} Years` : "Insufficient evidence"}</dd></div><div className="bg-[#070A0F] p-3"><dt className="text-[10px] uppercase tracking-wide text-slate-400">Projects</dt><dd className="mt-1 text-lg font-semibold text-white">{projects.length || "Insufficient evidence"}</dd></div><div className="bg-[#070A0F] p-3"><dt className="text-[10px] uppercase tracking-wide text-slate-400">Implementation</dt><dd className="mt-1 text-lg font-semibold text-white">{enterprise.careerHighlights.implementationProjects || "Insufficient evidence"}</dd></div><div className="bg-[#070A0F] p-3"><dt className="text-[10px] uppercase tracking-wide text-slate-400">AMS / Rollout</dt><dd className="mt-1 text-lg font-semibold text-white">{enterprise.careerHighlights.amsProjects || "Not evidenced"} / {enterprise.careerHighlights.rolloutProjects || "Not evidenced"}</dd></div><div className="bg-[#070A0F] p-3"><dt className="text-[10px] uppercase tracking-wide text-slate-400">Primary module</dt><dd className="mt-1 font-semibold text-white">{enterprise.careerHighlights.primarySapModule || "Insufficient evidence"}</dd></div><div className="bg-[#070A0F] p-3"><dt className="text-[10px] uppercase tracking-wide text-slate-400">Consulting</dt><dd className="mt-1 font-semibold text-white">{enterprise.careerHighlights.yearsConsulting ? `${enterprise.careerHighlights.yearsConsulting} Years` : enterprise.careerHighlights.consultingBackground ? "Established" : "Insufficient evidence"}</dd></div><div className="bg-[#070A0F] p-3"><dt className="text-[10px] uppercase tracking-wide text-slate-400">Current employer</dt><dd className="mt-1 truncate font-semibold text-white">{enterprise.identity.currentCompany || "Insufficient evidence"}</dd></div><div className="bg-[#070A0F] p-3"><dt className="text-[10px] uppercase tracking-wide text-slate-400">Best-fit role</dt><dd className="mt-1 truncate font-semibold text-white">{enterprise.intelligence.insights.idealRoles[0] || enterprise.identity.currentTitle || "Insufficient evidence"}</dd></div></dl>{summaryLines.length ? <ul className="mt-4 grid gap-2 sm:grid-cols-2">{summaryLines.map((line)=><li key={line} className="flex gap-2 text-sm leading-6 text-slate-300"><span aria-hidden="true" className="text-cyan-300">•</span><span>{line}</span></li>)}</ul> : null}</div>
            <div className="grid gap-3"><div className={subtle+" p-3"}><h3 className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Countries</h3><div className="mt-2 flex flex-wrap gap-2">{(countryHeatmap.length ? countryHeatmap : enterprise.careerHighlights.countries.map((item)=>[item,0] as [string,number])).slice(0,6).map(([item,count])=><span key={item} className="text-xs text-slate-200">{item}{count ? ` (${count})` : ""}</span>)}</div></div><div className={subtle+" p-3"}><h3 className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Industries</h3><div className="mt-2 flex flex-wrap gap-2">{(industryHeatmap.length ? industryHeatmap : enterprise.careerHighlights.industries.map((item)=>[item,0] as [string,number])).slice(0,6).map(([item,count])=><span key={item} className="text-xs text-slate-200">{item}{count ? ` (${count})` : ""}</span>)}</div></div>{landscapes.length ? <div className={subtle+" p-3"}><h3 className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">SAP landscape</h3><div className="mt-2 flex flex-wrap gap-2">{landscapes.map((item)=><span key={item} className="rounded border border-slate-700 px-2 py-1 text-xs text-slate-200">{item}</span>)}</div></div> : null}</div>
          </div>
        </section>
        <div className={activeTab === "overview" ? "grid items-start gap-6" : activeTab === "experience" ? "grid items-start gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(300px,1fr)]" : "hidden"}>
          <div className={activeTab === "experience" ? "space-y-6" : "hidden"}>

            <Section title="Employment timeline" description="Most recent positions first." className="xl:sticky xl:top-40" collapsible open={openSections.timeline} onToggle={() => toggleSection("timeline")}>
              {roles.length ? <div className="mb-4 flex justify-end"><button type="button" onClick={() => copyText("timeline", timelineText)} className={button}>Copy Timeline</button></div> : null}
              {visibleRoles.length ? <div className="space-y-4">{visibleRoles.map((role, index) => {
                const olderRole = roles[index + 1];
                const promoted = isPromotion(role, olderRole);
                const gap = employmentGap(role, olderRole);
                const badge = employmentBadge(role);
                return <div key={role.id}>
                  <article className={`relative rounded-xl border bg-[#070A0F] p-4 [content-visibility:auto] [contain-intrinsic-size:180px] transition duration-200 hover:border-slate-700 hover:shadow-lg hover:shadow-black/20 ${role.current ? "border-cyan-400/70 shadow-[0_0_0_1px_rgba(34,211,238,0.12)]" : "border-slate-800"}`}>
                    <div className="flex items-start gap-4">
                      <div aria-hidden="true" className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg border border-slate-700 bg-slate-900 text-sm font-semibold text-slate-200">{companyInitials(role.company)}</div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div><h3 className="text-base font-semibold text-white">{role.company}</h3>{role.location ? <p className="mt-1 text-sm text-slate-400">{role.location}</p> : null}</div>
                          <div className="text-right text-xs text-slate-400"><p>{[role.start, role.end || (role.current ? "Present" : "")].filter(Boolean).join("–")}</p>{role.duration ? <p className="mt-1">{role.duration}</p> : null}</div>
                        </div>
                        <div className="mt-4 flex flex-wrap items-center gap-2">{role.title ? <p className="font-medium text-slate-100">{role.title}</p> : null}<span className="rounded-full border border-slate-700 px-2 py-0.5 text-[10px] text-slate-400" title="Structured resume evidence; not independently confirmed.">Structured employment · strong</span>{role.current ? <span className="rounded-full border border-cyan-500/50 bg-cyan-950/40 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-cyan-200">Current role</span> : null}{badge ? <span className="rounded-full border border-slate-700 px-2 py-0.5 text-[11px] font-medium text-slate-300">{badge}</span> : null}{promoted ? <span className="rounded-full border border-emerald-600/50 bg-emerald-950/30 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-emerald-200">Promotion</span> : null}</div>
                        {role.modules.length ? <div className="mt-3 flex flex-wrap gap-1.5" aria-label="Key modules">{role.modules.map((module) => <span key={module} className="rounded-md bg-slate-900 px-2 py-1 text-xs text-slate-300 ring-1 ring-inset ring-slate-800">{module}</span>)}</div> : null}
                        {role.achievements.length ? <details className="mt-3 text-sm text-slate-300"><summary className="cursor-pointer text-xs font-medium text-slate-400 hover:text-slate-200">View achievements</summary><ul className="mt-2 space-y-1.5">{role.achievements.slice(0, 3).map((achievement) => <li key={achievement} className="flex gap-2 leading-6"><span aria-hidden="true" className="text-cyan-300">•</span><span>{achievement}</span></li>)}</ul></details> : null}
                      </div>
                    </div>
                  </article>
                  {gap ? <div className="mx-6 flex items-center gap-3 py-3 text-xs text-amber-200" aria-label={`${gap} month employment gap`}><span className="h-px flex-1 bg-amber-800/50"/><span>{gap} month{gap === 1 ? "" : "s"} employment gap</span><span className="h-px flex-1 bg-amber-800/50"/></div> : null}
                </div>;
              })}</div> : <Empty>Employment history not evidenced in source profile.</Empty>}
              {roles.length > 6 ? <button type="button" onClick={() => setShowAllRoles((value) => !value)} className="mt-5 min-h-11 rounded-md px-2 text-sm font-medium text-slate-300 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300">{showAllRoles ? "Show fewer positions" : `Show ${roles.length - 6} older positions`}</button> : null}
            </Section>
          </div>

          <aside className={activeTab === "overview" ? "space-y-6 xl:sticky xl:top-40" : "hidden"}>
            <Section title="Recruiter snapshot">
              <dl>{display(profile.location.value) !== "—" ? <Info label="Location" value={display(profile.location.value)}/> : null}{display(profile.currentCompany.value) !== "—" ? <Info label="Current employer" value={unique([display(profile.currentCompany.value, ""), currentEmployment?.location || display(profile.location.value, ""), employerDates]).join(" · ")}/> : null}{email !== "—" ? <Info label="Email" value={email} href={`mailto:${email}`}/> : null}{phone !== "—" ? <Info label="Phone" value={phone} href={`tel:${phone}`}/> : null}{visa !== "—" ? <Info label="Visa / work authorization" value={visa}/> : null}</dl><details className="mt-3 border-t border-slate-800 pt-3"><summary className="cursor-pointer text-xs font-medium text-cyan-300">Additional fields</summary><dl className="mt-2">{availability !== "—" ? <Info label="Availability" value={availability}/> : null}{notice !== "—" ? <Info label="Notice" value={notice}/> : null}{salary !== "—" ? <Info label="Expected salary" value={salary}/> : null}{travel !== "—" ? <Info label="Travel" value={travel}/> : null}{remote !== "—" ? <Info label="Remote" value={remote}/> : null}{linkedin !== "—" ? <Info label="LinkedIn" value={linkedin} href={linkedin}/> : null}</dl><p className="mt-2 text-xs text-slate-500">Fields absent from the source profile are hidden.</p></details>
            </Section>
          </aside>
        </div>

        <div className={activeTab === "decision" ? "space-y-6" : "hidden"}><CandidateDecisionPanel profile={profile} job={selectedJob}/><CandidateIntelligencePanel intelligence={enterprise.intelligence} /></div>

        <Section title="Project portfolio" description="Top five evidence-backed projects, grouped by delivery type. Collapsed by default." className={activeTab === "projects" ? "" : "hidden"} collapsible open={openSections.projects} onToggle={() => toggleSection("projects")}>
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3"><div className="flex flex-wrap gap-2" role="group" aria-label="Project ordering">{([['newest','Newest'],['relevant','Most Relevant'],['complexity','Highest Complexity']] as const).map(([value,label]) => <button key={value} type="button" onClick={() => setProjectSort(value)} aria-pressed={projectSort === value} className={`rounded-lg border px-3 py-2 text-xs font-medium ${projectSort === value ? "border-cyan-500/60 bg-cyan-950/30 text-cyan-100" : "border-slate-700 text-slate-400 hover:text-white"}`}>{label}</button>)}</div><span className="text-xs text-slate-500">Showing {visibleProjects.length} of {projects.length}</span></div>
          {!detailsReady ? <div aria-busy="true" className="grid min-h-[280px] gap-4 lg:grid-cols-2 2xl:grid-cols-3">{[0,1,2].map((item) => <div key={item} className={`${subtle} h-[280px] animate-pulse motion-reduce:animate-none`}/>)}</div> : projectGroups.length ? <div className="space-y-8">{projectGroups.map((group) => <section key={group.label} aria-labelledby={`project-group-${group.label.toLowerCase().replace(/\s+/g, "-")}`}><h3 id={`project-group-${group.label.toLowerCase().replace(/\s+/g, "-")}`} className="mb-3 text-sm font-semibold uppercase tracking-[0.14em] text-slate-300">{group.label}</h3><div className="grid gap-4 lg:grid-cols-2 2xl:grid-cols-3">{group.projects.map((project) => {
            const badges = projectBadges(project);
            const projectDates = [project.start, project.end].filter(Boolean).join("–");
            const complexity = projectComplexityLabel(project);
            const outcome = projectOutcome(project);
            const impact = projectImpact(project);
            return <article key={project.id} className={`${subtle} flex min-h-[210px] flex-col p-4 [content-visibility:auto] [contain-intrinsic-size:210px] transition duration-200 hover:-translate-y-0.5 hover:border-slate-700 hover:shadow-lg hover:shadow-black/20 motion-reduce:transform-none`}><div className="mb-3 flex items-center justify-between gap-2"><span className="rounded border border-slate-700 px-2 py-1 text-[10px] text-slate-400" title="Structured resume evidence; not independently confirmed.">Structured project · strong</span><button type="button" onClick={() => copyText("project", projectCopyText(project))} className="text-xs font-medium text-slate-400 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300">Copy Project</button></div>
              <div className="flex items-start justify-between gap-3"><div className="min-w-0">{project.client ? <><p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">Business</p><p className="mt-1 text-xs font-semibold text-slate-200">{project.client}</p></> : null}{project.name && project.name.toLowerCase() !== project.client.toLowerCase() ? <h4 className="mt-2 font-semibold text-white">{project.name}</h4> : null}</div>{project.duration ? <span className="shrink-0 text-xs text-slate-400">{project.duration}</span> : null}</div>
              {badges.length ? <div className="mt-4 flex flex-wrap gap-1.5">{badges.map((badge) => <span key={badge} className="rounded-md border border-slate-700 px-2 py-1 text-[11px] font-medium text-slate-200">{badge}</span>)}</div> : null}
              {(project.industry || project.modules.length || complexity || project.role || project.duration || projectDates) ? <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 text-xs">{project.industry ? <div><dt className="text-slate-500">Industry</dt><dd className="mt-1 text-slate-200">{project.industry}</dd></div> : null}{complexity ? <div><dt className="text-slate-500">Complexity</dt><dd className="mt-1 text-slate-200">{complexity}</dd></div> : null}{project.role ? <div><dt className="text-slate-500">Role</dt><dd className="mt-1 text-slate-200">{project.role}</dd></div> : null}{project.modules.length ? <div><dt className="text-slate-500">Modules</dt><dd className="mt-1 text-slate-200">{project.modules.join(", ")}</dd></div> : null}{(project.duration || projectDates) ? <div className="col-span-2"><dt className="text-slate-500">Duration</dt><dd className="mt-1 text-slate-200">{project.duration || projectDates}</dd></div> : null}</dl> : null}{outcome ? <div className="mt-3"><div className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Outcome</div><p className="mt-1 line-clamp-2 text-xs leading-5 text-slate-300">{outcome}</p></div> : null}{impact && impact !== outcome ? <div className="mt-3"><div className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Impact</div><p className="mt-1 line-clamp-2 text-xs leading-5 text-slate-300">{impact}</p></div> : null}
              {project.responsibilities.length ? <details className="mt-auto pt-4 text-sm text-slate-300"><summary className="cursor-pointer text-xs font-medium text-slate-400 hover:text-slate-200">View responsibilities</summary><ul className="mt-2 space-y-1.5">{project.responsibilities.slice(0, 4).map((item) => <li key={item} className="flex gap-2 leading-6"><span aria-hidden="true" className="text-cyan-300">•</span><span>{item}</span></li>)}</ul></details> : null}
            </article>;
          })}</div></section>)}</div> : <Empty>Project experience not evidenced in source profile.</Empty>}
          {projects.length > 5 ? <button type="button" onClick={() => setShowAllProjects((value) => !value)} className="mt-6 min-h-11 rounded-md px-2 text-sm font-medium text-slate-300 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300">{showAllProjects ? "Show first 5 projects" : `Show all ${projects.length} projects`}</button> : null}
        </Section>

        <Section title="Technical skills" description="Grouped for recruiter scanning, not keyword density." className={activeTab === "skills" && visibleSkillGroups.length ? "" : "hidden"}>
          <div className="mb-4 flex justify-end"><button type="button" onClick={() => copyText("skills", skillsText)} className={button}>Copy Skills</button></div>
          <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">{visibleSkillGroups.map(([group, items]) => <div key={group}><h3 className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">{group}</h3><div className="mt-3 flex flex-wrap gap-2">{items.map((item) => <span key={item} className="rounded-lg bg-slate-900 px-2.5 py-1.5 text-sm text-slate-300 ring-1 ring-inset ring-slate-800">{item}</span>)}</div></div>)}</div>
        </Section>

        <div className={activeTab === "skills" ? "grid gap-6 xl:grid-cols-3" : "hidden"}>
          <Section title="Education" collapsible open={openSections.education} onToggle={() => toggleSection("education")}>{education.length ? <div className="space-y-0">{education.map((item: EnterpriseEducation) => <article key={item.id} className="relative border-l border-slate-700 pb-6 pl-5 last:pb-0"><span className="absolute -left-1 top-1.5 h-2 w-2 rounded-full bg-slate-500"/><p className="font-medium text-slate-200">{item.qualification || item.fieldOfStudy || "Qualification"}</p><p className="mt-1 text-sm text-slate-400">{item.institution || "Institution requires review"}</p><p className="mt-2 text-xs text-slate-400">{[item.startYear, item.endYear].filter(Boolean).join("—")}</p></article>)}</div> : <Empty>Education not found in source resume.</Empty>}</Section>
          <Section title="Languages" className={languages.length ? "" : "hidden"} collapsible open={openSections.credentials} onToggle={() => toggleSection("credentials")}>{languages.length ? <div className="flex flex-wrap gap-2">{languages.map((item) => <span key={`${item.language}-${item.proficiency}`} className="rounded-full border border-slate-700 px-3 py-1.5 text-sm text-slate-300">{[item.language, item.proficiency].filter(Boolean).join(" — ")}</span>)}</div> : <Empty>Languages not evidenced in source profile.</Empty>}</Section>
          <Section title="Certifications" className={certifications.length ? "" : "hidden"} collapsible open={openSections.credentials} onToggle={() => toggleSection("credentials")}>{certifications.length ? <div className="space-y-3">{certifications.map((item) => <article key={item} className={`${subtle} p-4`}><p className="text-sm font-medium text-slate-200">{item}</p><p className="mt-1 text-xs text-slate-400">Professional certification</p></article>)}</div> : <Empty>Certifications not evidenced in source profile.</Empty>}</Section>
        </div>

        <div className={activeTab === "evidence" ? "grid gap-6 lg:grid-cols-2" : "hidden"}><Section title="AI evidence" description="Source quality and confidence behind generated insights."><dl className="grid gap-3 sm:grid-cols-2"><Info label="Profile completeness" value={`${enterprise.quality.profileCompleteness}%`}/><Info label="Data confidence" value={`${enterprise.quality.dataConfidence}%`}/><Info label="Workflow status" value={profile.workflowStatus}/><Info label="Quality status" value={profile.repairQueueStatus}/></dl><div className="mt-5"><h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400">Missing evidence</h3>{enterprise.quality.missingSections.length ? <ul className="mt-2 space-y-2 text-sm text-slate-300">{enterprise.quality.missingSections.map((item) => <li key={item}>• {item}</li>)}</ul> : <p className="mt-2 text-sm text-emerald-300">No normalized sections are marked missing.</p>}</div></Section><Section title="Source and parser notes" description="Audit context without internal repair instructions."><p className="text-sm leading-6 text-slate-300">Field-level source, verification status, confidence and evidence remain available in the Candidate360 response. Generic parser labels and internal repair commands are suppressed from recruiter display.</p><div className="mt-4 grid gap-3"><Info label="Name source" value={profile.displayName.source}/><Info label="Employer source" value={profile.currentCompany.source}/><Info label="Location source" value={profile.location.source}/></div></Section></div>
        <div className={activeTab === "decision" ? "grid items-start gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(300px,1fr)]" : activeTab === "notes" ? "grid gap-6" : "hidden"}>
          <Section title="Review risks" className={activeTab === "decision" ? "" : "hidden"} collapsible open={openSections.risks} onToggle={() => toggleSection("risks")} description={`${enterprise.quality.profileCompleteness}% complete · ${enterprise.quality.dataConfidence}% confidence`}>
            {risks.length ? <div className="grid gap-3 md:grid-cols-2">{risks.map((risk) => <div key={risk} className="rounded-xl border border-amber-900/40 bg-amber-950/10 px-4 py-3 text-sm text-amber-100/80">{risk}</div>)}</div> : <p className="text-sm text-emerald-300">No immediate review risks identified.</p>}
          </Section>
          <Section title="Recruiter notes" className={activeTab === "notes" ? "" : "hidden"} collapsible open={openSections.notes} onToggle={() => toggleSection("notes")}>{notes.length ? <ul className="space-y-3">{notes.map((note, index) => <li key={`${note}-${index}`} className="rounded-lg bg-amber-100/90 p-4 text-sm leading-6 text-amber-950 shadow-lg shadow-black/20">{note}</li>)}</ul> : <div className="min-h-32 rounded-lg bg-amber-100/90 p-4 text-sm leading-6 text-amber-950/60 shadow-lg shadow-black/20">Recruiter notes not evidenced in source profile.</div>}<p className="mt-3 text-xs text-slate-400">Read-only candidate view</p></Section>
        </div>
        <div className={activeTab === "notes" ? "grid gap-6 lg:grid-cols-2" : "hidden"}><Section title="AI Copilot"><p className="text-sm leading-6 text-slate-300">Ask evidence-only questions about implementation ownership, industries, modules and Job requirements.</p><Link href={`/recruiter/workflow/copilot?candidateId=${encodeURIComponent(profile.candidateId)}`} className={`${button} mt-4`}>Open AI Copilot</Link></Section><Section title="Activity log"><dl className="space-y-1"><Info label="Workflow status" value={profile.workflowStatus}/><Info label="Self-confirm status" value={profile.selfConfirmStatus}/><Info label="Quality review" value={profile.repairQueueStatus}/></dl><p className="mt-3 text-xs text-slate-500">Only recorded Candidate360 lifecycle states are shown.</p></Section></div>
      </div>
      <RecruiterAICopilot profile={profile} job={selectedJob}/>
    </main>
  );
}






























