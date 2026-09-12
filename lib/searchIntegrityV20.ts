import type {
  CandidateSearchV2Document,
  CandidateSearchV2Result,
} from "./candidateSearchV2Types";
import type { GuidedSearchHandoff } from "./guidedSourcingTypes";
export const SEARCH_INTEGRITY_VERSION = "search-integrity-v20" as const;
export type RequirementState =
  | "verified"
  | "supported"
  | "not_verified"
  | "manual_review"
  | "conflicting"
  | "not_available";
export type RequirementEvaluation = {
  id: string;
  criterionId: string;
  label: string;
  kind: GuidedSearchHandoff["integrityPlan"]["requirements"][number]["kind"];
  required: boolean;
  state: RequirementState;
  reason: string;
};
const norm = (v: unknown) =>
  String(v ?? "")
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[^a-z0-9+#/.-]+/g, " ")
    .trim();
const list = (v: unknown) => (Array.isArray(v) ? v.map(norm) : []);
function currentCountry(doc: CandidateSearchV2Document) {
  return (
    norm(doc.country) ||
    (/\bjapan\b|\btokyo\b/.test(norm(doc.location)) ? "japan" : "")
  );
}
function textEvidence(doc: CandidateSearchV2Document) {
  return norm(
    [
      doc.currentTitle,
      ...(doc.skills || []),
      ...(doc.sapModules || []),
      ...(doc.languages || []),
      ...(doc.evidence || []).map((e) => e.value),
    ].join(" "),
  );
}
export function evaluateIntegrityCandidate(
  result: CandidateSearchV2Result,
  doc: CandidateSearchV2Document,
  plan: GuidedSearchHandoff["integrityPlan"],
) {
  const evidence = textEvidence(doc),
    country = currentCountry(doc),
    languages = list(doc.languages);
  const requirements: RequirementEvaluation[] = plan.requirements.map((req) => {
    let state: RequirementState = "not_verified",
      reason = "Candidate-bound evidence was not found.";
    if (req.kind === "location") {
      if (!country) {
        state = "not_available";
        reason = "Current candidate location is not available.";
      } else if (country === norm(req.country)) {
        state =
          doc.locationEvidenceState === "VERIFIED" ? "verified" : "supported";
        reason = "Current location supports " + req.country + ".";
      } else {
        state = "conflicting";
        reason = "Verified current location is outside " + req.country + ".";
      }
    } else if (req.kind === "experience") {
      const years = doc.totalYearsExperience;
      if (years == null) {
        state = "not_available";
        reason = "Total experience is not established from dated employment.";
      } else if (years >= (req.minimum || 0)) {
        state = "verified";
        reason =
          "Verified · " +
          years +
          " years meets the " +
          req.minimum +
          "+ year requirement.";
      } else {
        state = "conflicting";
        reason =
          years + " years is below the " + req.minimum + "+ year requirement.";
      }
    } else if (req.kind === "language") {
      const missing = req.values.filter(
        (v) => !languages.some((x) => x.includes(norm(v))),
      );
      if (!doc.languages?.length) {
        state = "not_available";
        reason = "Required language evidence is not available.";
      } else if (!missing.length) {
        state = "supported";
        reason = "Languages recorded: " + req.values.join(", ") + ".";
      } else {
        state = "not_verified";
        reason = "Not verified: " + missing.join(", ") + ".";
      }
    } else if (req.kind === "implementation") {
      const count = doc.groundedImplementationProjectCount || 0;
      if (!count) {
        state = "not_verified";
        reason =
          "Candidate evidence not found in grounded project records.";
      } else if (count >= (req.minimum || 1)) {
        state = "verified";
        reason =
          count + " grounded implementation projects meet the " + req.minimum + "+ requirement.";
      } else {
        state = "conflicting";
        reason =
          count +
          " grounded implementation projects are below the " + req.minimum + "+ requirement.";
      }
    } else {
      const tokens = req.values
        .flatMap((v) => norm(v).split(/\s+/))
        .filter(
          (v) =>
            v.length > 2 &&
            ![
              "experience",
              "knowledge",
              "including",
              "with",
              "and",
              "the",
            ].includes(v),
        );
      const hits = tokens.filter((t) => evidence.includes(t));
      if (hits.length >= Math.min(2, tokens.length)) {
        state = "supported";
        reason = "Candidate-bound profile evidence supports this requirement.";
      } else if (
        req.kind === "manual" ||
        req.kind === "local_regulation" ||
        req.kind === "presales"
      ) {
        state = "manual_review";
        reason =
          "Manual review required; an automated candidate assessment is not supported for this criterion.";
      }
    }
    return { ...req, state, reason };
  });
  const hardFailures = requirements.filter(
    (r) =>
      r.required &&
      !["verified", "supported"].includes(r.state),
  );
  const outsideLocation = requirements.some(
    (r) => r.kind === "location" && r.state === "conflicting",
  );
  const eligible =
    !hardFailures.length ||
    (plan.includeRelocationRemote &&
      outsideLocation &&
      hardFailures.every((r) => r.kind === "location"));
  return {
    version: SEARCH_INTEGRITY_VERSION,
    eligible,
    broadeningApplied: plan.includeRelocationRemote && outsideLocation,
    requirements,
    verified: requirements.filter((r) => r.state === "verified").length,
    supported: requirements.filter((r) => r.state === "supported").length,
    attention: requirements.filter(
      (r) => !["verified", "supported"].includes(r.state),
    ).length,
    currentEmployment: doc.canonicalCurrentEmployment || null,
  };
}
export function applySearchIntegrity(
  results: CandidateSearchV2Result[],
  documents: CandidateSearchV2Document[],
  plan: GuidedSearchHandoff["integrityPlan"],
) {
  const docs = new Map(documents.map((d) => [d.candidateId, d]));
  const evaluated = results.map((result) => {
    const guided = evaluateIntegrityCandidate(
      result,
      docs.get(result.candidateId) || { candidateId: result.candidateId },
      plan,
    );
    const prior = (result as CandidateSearchV2Result & {
      integrity?: typeof guided;
    }).integrity;
    const priorIds = new Set((prior?.requirements || []).map((item) => item.id));
    const requirements = [
      ...(prior?.requirements || []),
      ...guided.requirements.filter((item) => !priorIds.has(item.id)),
    ];
    const integrity = {
      ...guided,
      eligible: prior?.eligible !== false && guided.eligible,
      requirements,
      verified: requirements.filter((item) => item.state === "verified").length,
      supported: requirements.filter((item) => item.state === "supported").length,
      attention: requirements.filter(
        (item) => !["verified", "supported"].includes(item.state),
      ).length,
    };
    return { result, integrity };
  });
  return evaluated
    .filter((x) => x.integrity.eligible)
    .map((x) => Object.assign(x.result, { integrity: x.integrity }));
}
