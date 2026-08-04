export function normalizeSkills(
  skills: string[]
) {
  const map: Record<
    string,
    string
  > = {
    "sap fi": "fico",

    "sap fico": "fico",

    "fi/co": "fico",

    fico: "fico",

    fi: "fi",

    co: "co",

    "sap mm": "mm",

    mm: "mm",

    "sap sd": "sd",

    sd: "sd",

    abap: "abap",

    hana: "hana",

    "sap hana": "hana",

    fiori: "fiori",

    crm: "crm",

    ps: "ps",

    "is-u": "is-u",

    isu: "is-u",

    successfactors:
      "successfactors",
  };

  return [
    ...new Set(
      skills.map((skill) => {
        const normalized =
          skill
            .toLowerCase()
            .trim();

        return (
          map[normalized] ||
          normalized
        );
      })
    ),
  ];
}