export function extractJobInfo(text: string) {
  const upper = text.toUpperCase()

  const skills: string[] = []

  const skillMap = [
    'SAP FICO',
    'SAP FI',
    'SAP CO',
    'S/4HANA',
    'ABAP',
    'Implementation',
    'Rollout',
    'AMS',
    'Support',
    'Testing',
    'Migration',
    'Integration',
    'Workshops',
    'Pre-sales',
    'Cutover',
    'Hypercare',
    'Banking',
    'Treasury',
    'AP',
    'AR',
    'GL',
    'AA',
  ]

  skillMap.forEach((skill) => {
    if (upper.includes(skill.toUpperCase())) {
      skills.push(skill)
    }
  })

  let title = 'SAP Consultant'

  if (upper.includes('MANAGER')) {
    title = 'SAP Manager'
  } else if (upper.includes('SENIOR CONSULTANT')) {
    title = 'Senior SAP Consultant'
  }

  let experience = '3+ years'

  const expMatch = text.match(/(\d+)\s*years/gi)

  if (expMatch?.length) {
    const nums = expMatch.map((e) =>
      parseInt(e.match(/\d+/)?.[0] || '0')
    )

    const max = Math.max(...nums)

    experience = `${max}+ years`
  }

  let location = 'Unknown'

  if (upper.includes('PHILIPPINES')) {
    location = 'Philippines'
  }

  return {
    title,
    experience,
    location,
    skills,
  }
}