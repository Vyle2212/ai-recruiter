export async function parseJDWithAI(text: string) {
  const lower = text.toLowerCase()

  const skills: string[] = []

  const skillKeywords = [
    'SAP FICO',
    'SAP FI',
    'SAP CO',
    'SAP MM',
    'SAP SD',
    'SAP ABAP',
    'SAP EWM',
    'SAP TM',
    'Implementation',
    'Rollout',
    'Support',
    'AMS',
    'S/4HANA',
  ]

  for (const skill of skillKeywords) {
    if (lower.includes(skill.toLowerCase())) {
      skills.push(skill)
    }
  }

  let years = 0

  const yearMatch = text.match(/(\d+)\+?\s*years/i)

  if (yearMatch) {
    years = parseInt(yearMatch[1])
  }

  let title = 'SAP Consultant'

  if (lower.includes('senior')) {
    title = 'Senior SAP Consultant'
  }

  return {
    title,
    skills,
    years,
    raw_text: text,
  }
}