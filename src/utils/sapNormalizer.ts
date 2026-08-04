export function normalizeSAPSkill(
  skill: string,
) {
  const normalized = skill
    .trim()
    .toLowerCase()

  const mappings: Record<string, string> =
    {
      fico: 'SAP FI/CO',
      fi: 'SAP FI',
      co: 'SAP CO',
      mm: 'SAP MM',
      sd: 'SAP SD',
      ewm: 'SAP EWM',
      tm: 'SAP TM',
      pp: 'SAP PP',
      qm: 'SAP QM',
      hana: 'SAP HANA',
      's/4': 'SAP S/4HANA',
      s4hana: 'SAP S/4HANA',
      successfactors:
        'SAP SuccessFactors',
      sf: 'SAP SuccessFactors',
      abap: 'SAP ABAP',
      basis: 'SAP Basis',
      btp: 'SAP BTP',
      sac: 'SAP Analytics Cloud',
    }

  return (
    mappings[normalized] || skill
  )
}