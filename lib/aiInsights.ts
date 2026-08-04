export function buildAiInsights(candidate: any, allCandidates: any[]) {
  const ranking =
    allCandidates
      .sort((a, b) => b.matchScore - a.matchScore)
      .findIndex((c) => c.id === candidate.id) + 1;

  const reasons: string[] = [];

  if (candidate.yearsExperience >= 10)
    reasons.push(`${candidate.yearsExperience} years SAP experience`);

  if (candidate.primaryAuthority >= 90)
    reasons.push(
      `Primary SAP ${candidate.primaryModule} specialist`
    );

  if (candidate.implementationAuthority >= 90)
    reasons.push(
      `${candidate.implementationProjects} implementation projects`
    );

  if (candidate.s4hanaProjects >= 3)
    reasons.push(
      `${candidate.s4hanaProjects} S/4HANA projects`
    );

  if (candidate.location)
    reasons.push(
      `${candidate.location} market exposure`
    );

  const risks: string[] = [];

  if (candidate.primaryAuthority < 75)
    risks.push(
      `Primary module authority below target`
    );

  if (candidate.implementationAuthority < 75)
    risks.push(
      `Limited implementation leadership`
    );

  if (!candidate.email || !candidate.phone)
    risks.push(
      `Contact information incomplete`
    );

  if (candidate.technicalDepth < 75)
    risks.push(
      `Technical depth below senior threshold`
    );

  const confidence =
    Math.round(
      (
        candidate.primaryAuthority +
        candidate.roleFit +
        candidate.implementationAuthority +
        candidate.technicalDepth
      ) / 4
    );

  return {
    ranking,
    confidence,
    reasons,
    risks,
  };
}