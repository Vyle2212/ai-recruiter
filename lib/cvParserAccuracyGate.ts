/** Offline release evidence only. Coverage heuristics and parser self-checks
 * are not independently adjudicated source truth. Never infer a pass from them. */
export type CvAccuracyReview = {
  sourceId: string;
  revision: string;
  sourceCompared: boolean;
  independentlyReviewed: boolean;
  expectedFacts: number;
  wrongFacts: number;
  missingFacts: number;
  inventedFacts: number;
  unresolvedFacts: number;
};

export function cvParserAccuracyGate(
  revision: string,
  population: readonly string[],
  reviews: readonly CvAccuracyReview[],
) {
  const blockers: string[] = [];
  const wanted = new Set(population);
  const seen = new Set<string>();
  let facts = 0, errors = 0, erroneousProfiles = 0;
  if (!revision || !wanted.size || wanted.size !== population.length)
    blockers.push("invalid_population_or_revision");
  for (const r of reviews) {
    if (!wanted.has(r.sourceId) || seen.has(r.sourceId)) {
      blockers.push("unknown_or_duplicate_review");
      continue;
    }
    seen.add(r.sourceId);
    const counts = [r.expectedFacts, r.wrongFacts, r.missingFacts, r.inventedFacts, r.unresolvedFacts];
    if (counts.some(n => !Number.isSafeInteger(n) || n < 0) ||
        r.expectedFacts === 0 || r.wrongFacts + r.missingFacts > r.expectedFacts) {
      blockers.push("invalid_review_counts");
      continue;
    }
    if (r.revision !== revision) blockers.push("stale_parser_review");
    if (!r.sourceCompared || !r.independentlyReviewed)
      blockers.push("source_truth_not_verified");
    if (r.unresolvedFacts) blockers.push("unresolved_source_facts");
    facts += r.expectedFacts;
    const mistakes = r.wrongFacts + r.missingFacts + r.inventedFacts;
    errors += mistakes;
    if (mistakes) erroneousProfiles++;
  }
  if (seen.size !== wanted.size) blockers.push("unreviewed_sources");
  const factErrorRate = facts ? errors / facts : null;
  const profileErrorRate = seen.size ? erroneousProfiles / seen.size : null;
  if (factErrorRate === null || factErrorRate >= 0.01) blockers.push("fact_error_rate_not_below_one_percent");
  if (profileErrorRate === null || profileErrorRate >= 0.01) blockers.push("profile_error_rate_not_below_one_percent");
  // One-sided 95% Wilson bound: a small clean sample is not enough to claim
  // <1% profile errors on future CVs. This is statistical evidence, not a guarantee.
  const n = seen.size, p = profileErrorRate ?? 1, z = 1.6448536269514722;
  const profileErrorUpper95 = n ?
    (p + z*z/(2*n) + z*Math.sqrt(p*(1-p)/n + z*z/(4*n*n))) / (1 + z*z/n) : null;
  if (profileErrorUpper95 === null || profileErrorUpper95 >= 0.01)
    blockers.push("future_profile_error_bound_not_below_one_percent");
  return {
    revision, populationSize: wanted.size, reviewedSources: seen.size,
    expectedFacts: facts, errorFacts: errors, erroneousProfiles,
    factErrorRate, profileErrorRate, profileErrorUpper95,
    blockers: [...new Set(blockers)],
    parserAccuracyEvidencePassed: blockers.length === 0,
    // Infrastructure, consent, security and launch approval remain separate.
    launchApproved: false as const,
  };
}
