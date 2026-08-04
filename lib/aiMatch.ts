export function calculateMatch(
  candidateSkills: string[],
  jdSkills: string[]
) {
  const matchedSkills = candidateSkills.filter(
    (skill) =>
      jdSkills.includes(skill)
  )

  const missingSkills = jdSkills.filter(
    (skill) =>
      !candidateSkills.includes(skill)
  )

  const score = Math.min(
    100,
    Math.round(
      (matchedSkills.length /
        Math.max(jdSkills.length, 1)) *
        100
    )
  )

  return {
    score,

    matchedSkills,

    missingSkills,

    recommendation:
      score >= 80
        ? 'Strong Match'
        : score >= 60
        ? 'Good Match'
        : 'Weak Match',
  }
}