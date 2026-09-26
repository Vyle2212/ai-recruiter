import {
  calculateTotalCareerYears,
  careerMonthIndex,
} from "./candidateCareerExperience";
import type {
  EnterpriseEmployment,
  EnterpriseProject,
} from "./candidate360SchemaNormalize";

export type ProjectTenureEstimate = {
  start: string;
  end: string;
  projectIds: string[];
  basis: "project_envelope";
};
const organization = (s: string) =>
  s
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
const validRange = (
  r: { start: string; end: string; current?: boolean },
  now: Date,
) => {
  const a = careerMonthIndex(r.start, false, now),
    b = careerMonthIndex(r.end, r.current, now);
  return a !== null && b !== null && b >= a;
};

/** Recruiter-authorized estimate only. Source employment dates are never overwritten.
 * Exact employer ownership is required; matching clients/titles alone is insufficient.
 * Multiple roles at the same employer are ambiguous without role-specific ownership. */
export function estimateEmploymentFromProjects(
  timeline: readonly EnterpriseEmployment[],
  projects: readonly EnterpriseProject[],
  now = new Date(),
): EnterpriseEmployment[] {
  return timeline.map((job) => {
    if ((job.start && (job.end || job.current)) || !job.company) return job;
    const key = organization(job.company);
    if (
      !key ||
      timeline.filter((j) => organization(j.company) === key).length !== 1
    )
      return job;
    const start = careerMonthIndex(job.start, false, now),
      end = careerMonthIndex(job.end, false, now);
    if (
      (job.start && start === null) ||
      (job.end && !job.current && end === null)
    )
      return job;
    const owned = projects
      .filter(
        (p) => organization(p.employer || "") === key && validRange(p, now),
      )
      .filter(
        (p) =>
          (start === null || careerMonthIndex(p.start, false, now)! >= start) &&
          (end === null || careerMonthIndex(p.end, false, now)! <= end),
      );
    if (!owned.length) return job;
    const first = [...owned].sort(
      (a, b) =>
        careerMonthIndex(a.start, false, now)! -
        careerMonthIndex(b.start, false, now)!,
    )[0];
    const last = [...owned].sort(
      (a, b) =>
        careerMonthIndex(b.end, false, now)! -
        careerMonthIndex(a.end, false, now)!,
    )[0];
    return {
      ...job,
      estimatedTenure: {
        start: first.start,
        end: last.end,
        projectIds: [...new Set(owned.map((p) => p.id))].sort(),
        basis: "project_envelope",
      },
    };
  });
}

const sap =
  /\bsap\b|\babap\b|\bhana\b|\b(?:s\/?4\s*hana|s4hana|successfactors|fico)\b/i;
const nonDelivery =
  /\b(?:accountant|bookkeeper|sales(?:person|man|woman|\s+(?:executive|representative|manager))?|(?:end|core|key|super)[ -]?user|data\s+entry)\b/i;
function operationalRole(role: string) {
  return (
    nonDelivery.test(role) &&
    !/\bsap\b.*\bsales\s*(?:(?:and|&|\/)\s*)?distribution\s+(?:functional\s+)?consultant\b/i.test(
      role,
    )
  );
}
function sapDelivery(role: string, modules: readonly string[], scope = "") {
  // Operational use of SAP and general sales/accounting work are not SAP delivery.
  if (operationalRole(role)) return false;
  return (
    (sap.test(role) &&
      /\b(?:consultant|developer|analyst|architect|engineer|lead|manager|specialist|administrator|associate|advisor)\b/i.test(
        role,
      )) ||
    /\b(?:FI(?:\/CO)?|CO|MM|SD|PP|PS|BW|HCM|BASIS|BTP)\s+(?:(?:functional|technical)\s+)?consultant\b/i.test(
      role,
    ) ||
    ((modules.some((m) =>
      /^(?:SAP\b|FI(?:CO)?$|CO$|MM$|SD$|PP$|PS$|BW$|ABAP$|HCM$|SuccessFactors$|Ariba$|TRM$|BASIS$|BTP$)/i.test(
        m.trim(),
      ),
    ) ||
      sap.test(scope)) &&
      /\b(?:consultant|developer|analyst|architect|engineer|lead|manager|specialist)\b/i.test(
        role,
      ))
  );
}

/** Recruiter policy: count a continuous SAP period between the first and last
 * assignment at the same employer, including internal work between projects.
 * Known separate employment spells and non-SAP roles are not bridged. */
export function supportedSapYears(
  timeline: readonly EnterpriseEmployment[],
  projects: readonly EnterpriseProject[],
  now = new Date(),
) {
  const jobs = timeline.filter(
    (j) => sapDelivery(j.title, j.modules) && validRange(j, now),
  );
  const assignments = projects.filter(
    (p) => sapDelivery(p.role, p.modules, p.name) && validRange(p, now),
  );
  const groups = new Map<string, EnterpriseProject[]>();
  for (const project of assignments) {
    const employer = organization(project.employer || "");
    const employerJobs = employer
      ? timeline.filter((j) => organization(j.company) === employer)
      : [];
    let group: string | null = null;
    if (employer && !employerJobs.length) group = `employer:${employer}`;
    else if (
      employerJobs.length === 1 &&
      !operationalRole(employerJobs[0].title)
    ) {
      const job = employerJobs[0];
      const start = careerMonthIndex(job.start, false, now);
      const end = careerMonthIndex(job.end, job.current, now);
      if (
        (!job.start || start !== null) &&
        (!job.end || end !== null) &&
        (start === null ||
          careerMonthIndex(project.start, false, now)! >= start) &&
        (end === null || careerMonthIndex(project.end, false, now)! <= end)
      )
        group = `employment:${job.id}`;
    } else if (employerJobs.length > 1) {
      const owners = employerJobs.filter(
        (job) =>
          !operationalRole(job.title) &&
          validRange(job, now) &&
          careerMonthIndex(project.start, false, now)! >=
            careerMonthIndex(job.start, false, now)! &&
          careerMonthIndex(project.end, false, now)! <=
            careerMonthIndex(job.end, job.current, now)!,
      );
      if (owners.length === 1) group = `employment:${owners[0].id}`;
    }
    // An unknown employer, ambiguous role or out-of-tenure project keeps only
    // its own range. Never bridge companies by client name or title similarity.
    const key = group ?? `assignment:${groups.size}:${project.id}`;
    groups.set(key, [...(groups.get(key) || []), project]);
  }
  const continuousPeriods = [...groups.values()].map((group) => {
    const first = group.reduce((a, b) =>
      careerMonthIndex(a.start, false, now)! <=
      careerMonthIndex(b.start, false, now)!
        ? a
        : b,
    );
    const last = group.reduce((a, b) =>
      careerMonthIndex(a.end, false, now)! >=
      careerMonthIndex(b.end, false, now)!
        ? a
        : b,
    );
    return { start: first.start, end: last.end };
  });
  return calculateTotalCareerYears([...jobs, ...continuousPeriods], now);
}

export function formatProjectTenureEstimate(
  estimate?: ProjectTenureEstimate,
): string {
  if (!estimate) return "";
  return `${estimate.start} – ${estimate.end} (estimated from first to last project, including time between projects)`;
}

/** Recover dated assignment groups only under an already-established employer/role
 * heading. The first range must precede duty prose; later dates cannot leak across
 * another employer. Multiple named projects sharing that range stay one group. */
export function ownedProjectRangesFromResume(
  timeline: readonly EnterpriseEmployment[],
  raw: string,
): EnterpriseProject[] {
  const text = raw.normalize("NFKC").replace(/\s+/g, " ");
  const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const output: EnterpriseProject[] = [];
  for (const job of timeline) {
    if (!job.company || !job.title || job.start || job.end) continue;
    const header = new RegExp(
      `${escape(job.company)}\\s+${escape(job.title)}\\s+Projects? Involvement\\s*:`,
      "gi",
    );
    const matches = [...text.matchAll(header)];
    if (matches.length !== 1) continue;
    const match = matches[0];
    const after = text.slice(
      match.index! + match[0].length,
      match.index! + match[0].length + 700,
    );
    const range =
      /\b(0?[1-9]|1[0-2])\/(\d{2}|(?:19|20)\d{2})\s*[-–—]\s*(0?[1-9]|1[0-2])\/(\d{2}|(?:19|20)\d{2})\b/.exec(
        after,
      );
    if (!range) continue;
    const prefix = after.slice(0, range.index);
    if (
      /\b(?:Sdn\.?\s*Bhd|Pte\.?\s*Ltd|Pvt\.?\s*Ltd|Limited|Ltd\.?|Responsibilities|Duties|Education|Requirements gathering|Responsible to|Perform system)\b/i.test(
        prefix,
      )
    )
      continue;
    const start = `${range[1]}/${range[2]}`,
      end = `${range[3]}/${range[4]}`;
    if (!validRange({ start, end }, new Date())) continue;
    const id = `owned-assignment-${job.id}`;
    const provenance = [
      {
        sourceType: "parsed_resume" as const,
        sourceRef: id,
        label: "Project range under explicit employer and role",
        excerpt: match[0] + after.slice(0, range.index + range[0].length),
      },
    ];
    const field = (value: string) => ({
      value,
      provenance,
      evidenceState: "source_extracted" as const,
    });
    output.push({
      id,
      name: prefix.trim(),
      employer: job.company,
      client: "",
      role: job.title,
      start,
      end,
      modules: [],
      industry: "",
      country: "",
      projectType: "",
      implementationType: "",
      duration: null,
      responsibilities: [],
      teamSize: null,
      environment: "",
      evidenceState: "source_extracted",
      fieldEvidence: {
        employer: field(job.company),
        role: field(job.title),
        dates: field(`${start} – ${end}`),
        name: field(prefix.trim()),
      },
    });
  }
  return output;
}
