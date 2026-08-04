import { normalizeSAPSkill } from './sapNormalizer'

const SAP_KEYWORDS = [
  'FICO',
  'FI',
  'CO',
  'MM',
  'SD',
  'EWM',
  'TM',
  'PP',
  'QM',
  'HANA',
  'S/4',
  'S4HANA',
  'SuccessFactors',
  'SF',
  'ABAP',
  'Basis',
  'BTP',
  'SAC',
]

export function extractSAPSkills(
  text: string,
) {
  const foundSkills = new Set<string>()

  const upperText = text.toUpperCase()

  SAP_KEYWORDS.forEach((keyword) => {
    if (upperText.includes(keyword)) {
      foundSkills.add(
        normalizeSAPSkill(keyword),
      )
    }
  })

  return Array.from(foundSkills)
}