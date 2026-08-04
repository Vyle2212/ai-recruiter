import { extractSAPSkills } from '@/src/utils/extractSAPSkills'

export async function parseCV(
  fileName: string,
) {
  const mockText = `
    Senior SAP FICO Consultant
    SAP S/4HANA implementation
    SAP FI integration
    SAP CO reporting
    SAP BTP exposure
  `

  const skills =
    extractSAPSkills(mockText)

  return {
    candidateName:
      fileName.replace('.pdf', ''),
    skills,
    experience: '8 years',
    location: 'Malaysia',
  }
}