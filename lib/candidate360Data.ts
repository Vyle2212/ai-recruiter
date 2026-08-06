import "server-only";

import fs from "node:fs";
import path from "node:path";

import {
  createCandidateSupabaseAdminClient,
} from "./candidateSupabase";

import {
  buildCandidate360Profile,
} from "./candidate360Profile";
import { normalizeActualCandidateSchema } from "./candidate360SchemaNormalize";

type UnknownRecord =
  Record<string, unknown>;

type CandidateValue =
  unknown;

function isRecord(
  value: unknown,
): value is UnknownRecord {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value)
  );
}

function readJson(
  fileName: string,
): unknown {
  const filePath =
    path.join(
      process.cwd(),
      "reports",
      fileName,
    );

  try {
    return JSON.parse(
      fs.readFileSync(
        filePath,
        "utf8",
      ),
    );
  } catch {
    return null;
  }
}

function normalizeKey(
  value: string,
): string {
  return value
    .replace(
      /[^a-zA-Z0-9]/g,
      "",
    )
    .toLowerCase();
}

function parseJsonValue(
  value: unknown,
): unknown {
  if (
    typeof value !== "string"
  ) {
    return value;
  }

  const trimmed =
    value.trim();

  if (
    !(
      trimmed.startsWith("{") ||
      trimmed.startsWith("[")
    )
  ) {
    return value;
  }

  try {
    return JSON.parse(
      trimmed,
    );
  } catch {
    return value;
  }
}

function deepFindValue(
  root: unknown,
  keys: string[],
): CandidateValue {
  const targetKeys =
    new Set(
      keys.map(
        normalizeKey,
      ),
    );

  const queue: Array<{
    value: unknown;
    depth: number;
  }> = [
    {
      value: root,
      depth: 0,
    },
  ];

  const visited =
    new WeakSet<object>();

  while (
    queue.length > 0
  ) {
    const item =
      queue.shift();

    if (!item) {
      break;
    }

    if (
      item.depth > 8
    ) {
      continue;
    }

    const parsedValue =
      parseJsonValue(
        item.value,
      );

    if (
      Array.isArray(
        parsedValue,
      )
    ) {
      for (
        const child
        of parsedValue
      ) {
        queue.push({
          value: child,
          depth:
            item.depth + 1,
        });
      }

      continue;
    }

    if (
      !isRecord(
        parsedValue,
      )
    ) {
      continue;
    }

    if (
      visited.has(
        parsedValue,
      )
    ) {
      continue;
    }

    visited.add(
      parsedValue,
    );

    for (
      const [
        key,
        rawValue,
      ]
      of Object.entries(
        parsedValue,
      )
    ) {
      const value =
        parseJsonValue(
          rawValue,
        );

      if (
        targetKeys.has(
          normalizeKey(
            key,
          ),
        ) &&
        value !== undefined &&
        value !== null &&
        value !== ""
      ) {
        return value;
      }
    }

    for (
      const value
      of Object.values(
        parsedValue,
      )
    ) {
      queue.push({
        value,
        depth:
          item.depth + 1,
      });
    }
  }

  return undefined;
}

function toText(
  value: unknown,
): string | null {
  const parsedValue =
    parseJsonValue(
      value,
    );

  if (
    typeof parsedValue ===
    "string"
  ) {
    const trimmed =
      parsedValue.trim();

    return trimmed || null;
  }

  if (
    typeof parsedValue ===
      "number" ||
    typeof parsedValue ===
      "boolean"
  ) {
    return String(
      parsedValue,
    );
  }

  if (
    isRecord(
      parsedValue,
    )
  ) {
    const nestedValue =
      deepFindValue(
        parsedValue,
        [
          "name",
          "label",
          "value",
          "text",
          "title",
          "description",
        ],
      );

    if (
      nestedValue !==
      parsedValue
    ) {
      return toText(
        nestedValue,
      );
    }
  }

  return null;
}

function splitTextList(
  value: string,
): string[] {
  return value
    .split(
      /[,;|\n]/,
    )
    .map(
      (item) =>
        item.trim(),
    )
    .filter(Boolean);
}

function toStringArray(
  value: unknown,
): string[] {
  const parsedValue =
    parseJsonValue(
      value,
    );

  const result:
    string[] = [];

  function add(
    text: string | null,
  ) {
    if (!text) {
      return;
    }

    for (
      const item
      of splitTextList(
        text,
      )
    ) {
      if (
        !result.includes(
          item,
        )
      ) {
        result.push(
          item,
        );
      }
    }
  }

  if (
    typeof parsedValue ===
    "string"
  ) {
    add(
      parsedValue,
    );

    return result;
  }

  if (
    Array.isArray(
      parsedValue,
    )
  ) {
    for (
      const item
      of parsedValue
    ) {
      if (
        typeof item ===
        "string"
      ) {
        add(
          item,
        );

        continue;
      }

      if (
        isRecord(
          item,
        )
      ) {
        add(
          toText(
            deepFindValue(
              item,
              [
                "name",
                "label",
                "value",
                "title",
                "skill",
                "module",
                "industry",
                "language",
                "certification",
              ],
            ),
          ),
        );
      }
    }

    return result;
  }

  if (
    isRecord(
      parsedValue,
    )
  ) {
    for (
      const [
        key,
        itemValue,
      ]
      of Object.entries(
        parsedValue,
      )
    ) {
      if (
        itemValue === true ||
        itemValue === 1 ||
        itemValue === "true"
      ) {
        add(
          key,
        );
      }
    }
  }

  return result;
}

function toRecordArray(
  value: unknown,
): UnknownRecord[] {
  const parsedValue =
    parseJsonValue(
      value,
    );

  if (
    Array.isArray(
      parsedValue,
    )
  ) {
    return parsedValue
      .map(
        parseJsonValue,
      )
      .filter(
        isRecord,
      );
  }

  if (
    isRecord(
      parsedValue,
    )
  ) {
    const nestedArray =
      deepFindValue(
        parsedValue,
        [
          "items",
          "results",
          "data",
          "history",
          "experiences",
          "projects",
          "employment",
        ],
      );

    if (
      Array.isArray(
        nestedArray,
      )
    ) {
      return nestedArray
        .map(
          parseJsonValue,
        )
        .filter(
          isRecord,
        );
    }

    return [
      parsedValue,
    ];
  }

  return [];
}

function findText(
  candidate: UnknownRecord,
  keys: string[],
): string | null {
  return toText(
    deepFindValue(
      candidate,
      keys,
    ),
  );
}

function findArray(
  candidate: UnknownRecord,
  keys: string[],
): string[] {
  return toStringArray(
    deepFindValue(
      candidate,
      keys,
    ),
  );
}

function findRecords(
  candidate: UnknownRecord,
  keys: string[],
): UnknownRecord[] {
  return toRecordArray(
    deepFindValue(
      candidate,
      keys,
    ),
  );
}

function deriveTitleAndCompany(
  titleValue: string | null,
  companyValue: string | null,
) {
  let title =
    titleValue;

  let company =
    companyValue;

  if (
    title &&
    !company
  ) {
    const match =
      title.match(
        /^(.*?)\s+at\s+(.+)$/i,
      );

    if (match) {
      title =
        match[1]?.trim() ||
        title;

      company =
        match[2]?.trim() ||
        null;
    }
  }

  return {
    title,
    company,
  };
}

function normalizeCandidate(
  rawCandidate: UnknownRecord,
): UnknownRecord {
  const candidateId =
    findText(
      rawCandidate,
      [
        "id",
        "candidateId",
        "candidate_id",
        "candidateID",
        "uuid",
      ],
    );

  const candidateName =
    findText(
      rawCandidate,
      [
        "candidateName",
        "candidate_name",
        "fullName",
        "full_name",
        "displayName",
        "display_name",
        "personName",
        "person_name",
        "name",
      ],
    );

  const rawTitle =
    findText(
      rawCandidate,
      [
        "currentTitle",
        "current_title",
        "jobTitle",
        "job_title",
        "currentPosition",
        "current_position",
        "headline",
        "position",
        "role",
        "title",
      ],
    );

  const rawCompany =
    findText(
      rawCandidate,
      [
        "currentCompany",
        "current_company",
        "currentEmployer",
        "current_employer",
        "employerName",
        "employer_name",
        "companyName",
        "company_name",
        "employer",
        "company",
      ],
    );

  const {
    title:
      currentTitle,
    company:
      currentCompany,
  } =
    deriveTitleAndCompany(
      rawTitle,
      rawCompany,
    );

  const country =
    findText(
      rawCandidate,
      [
        "country",
        "locationCountry",
        "location_country",
        "candidateCountry",
        "candidate_country",
        "nationality",
      ],
    );

  const location =
    findText(
      rawCandidate,
      [
        "location",
        "currentLocation",
        "current_location",
        "city",
        "address",
      ],
    );

  const email =
    findText(
      rawCandidate,
      [
        "email",
        "emailAddress",
        "email_address",
        "candidateEmail",
        "candidate_email",
      ],
    );

  const phone =
    findText(
      rawCandidate,
      [
        "phone",
        "phoneNumber",
        "phone_number",
        "mobile",
        "mobileNumber",
        "mobile_number",
      ],
    );

  const executiveSummary =
    findText(
      rawCandidate,
      [
        "executiveSummary",
        "executive_summary",
        "professionalSummary",
        "professional_summary",
        "profileSummary",
        "profile_summary",
        "careerSummary",
        "career_summary",
        "summary",
        "about",
      ],
    );

  const skills =
    findArray(
      rawCandidate,
      [
        "normalizedSkills",
        "normalized_skills",
        "technicalSkills",
        "technical_skills",
        "coreSkills",
        "core_skills",
        "skillSet",
        "skill_set",
        "skills",
      ],
    );

  const sapModules =
    findArray(
      rawCandidate,
      [
        "sapModules",
        "sap_modules",
        "primarySapModules",
        "primary_sap_modules",
        "sapModule",
        "sap_module",
        "moduleExperience",
        "module_experience",
        "modules",
      ],
    );

  const employmentHistory =
    findRecords(
      rawCandidate,
      [
        "employmentHistory",
        "employment_history",
        "workExperience",
        "work_experience",
        "careerHistory",
        "career_history",
        "employment",
        "experiences",
        "experience",
      ],
    );

  const projectExperience =
    findRecords(
      rawCandidate,
      [
        "projectExperience",
        "project_experience",
        "projectHistory",
        "project_history",
        "projectDetails",
        "project_details",
        "projects",
      ],
    );

  const industries =
    findArray(
      rawCandidate,
      [
        "industryExperience",
        "industry_experience",
        "industries",
        "industry",
      ],
    );

  const languages =
    findArray(
      rawCandidate,
      [
        "languageSkills",
        "language_skills",
        "languages",
        "language",
      ],
    );

  const certifications =
    findArray(
      rawCandidate,
      [
        "professionalCertifications",
        "professional_certifications",
        "certifications",
        "certificates",
        "certification",
      ],
    );

  const availability =
    findText(
      rawCandidate,
      [
        "availability",
        "availableFrom",
        "available_from",
      ],
    );

  const noticePeriod =
    findText(
      rawCandidate,
      [
        "noticePeriod",
        "notice_period",
      ],
    );

  const expectedSalary =
    deepFindValue(
      rawCandidate,
      [
        "expectedSalary",
        "expected_salary",
        "salaryExpectation",
        "salary_expectation",
      ],
    );

  return {
    ...rawCandidate,

    id:
      candidateId,

    candidateId:
      candidateId,

    candidate_id:
      candidateId,

    name:
      candidateName,

    candidateName:
      candidateName,

    candidate_name:
      candidateName,

    fullName:
      candidateName,

    full_name:
      candidateName,

    displayName:
      candidateName,

    currentTitle:
      currentTitle,

    current_title:
      currentTitle,

    jobTitle:
      currentTitle,

    job_title:
      currentTitle,

    title:
      currentTitle,

    currentCompany:
      currentCompany,

    current_company:
      currentCompany,

    currentEmployer:
      currentCompany,

    current_employer:
      currentCompany,

    employer:
      currentCompany,

    company:
      currentCompany,

    country,
    location,
    email,
    phone,

    executiveSummary,
    executive_summary:
      executiveSummary,

    professionalSummary:
      executiveSummary,

    professional_summary:
      executiveSummary,

    summary:
      executiveSummary,

    skills,

    normalizedSkills:
      skills,

    normalized_skills:
      skills,

    coreSkills:
      skills,

    core_skills:
      skills,

    sapModules,
    sap_modules:
      sapModules,

    primarySapModules:
      sapModules,

    primary_sap_modules:
      sapModules,

    employmentHistory,
    employment_history:
      employmentHistory,

    workExperience:
      employmentHistory,

    work_experience:
      employmentHistory,

    experiences:
      employmentHistory,

    projectExperience,
    project_experience:
      projectExperience,

    projects:
      projectExperience,

    industries,
    languages,
    certifications,

    availability,

    noticePeriod,
    notice_period:
      noticePeriod,

    expectedSalary,
    expected_salary:
      expectedSalary,
  };
}

function getItems(
  value: unknown,
): UnknownRecord[] {
  const parsedValue =
    parseJsonValue(
      value,
    );

  if (
    Array.isArray(
      parsedValue,
    )
  ) {
    return parsedValue.filter(
      isRecord,
    );
  }

  if (
    !isRecord(
      parsedValue,
    )
  ) {
    return [];
  }

  for (
    const key
    of [
      "items",
      "states",
      "data",
      "results",
      "candidates",
    ]
  ) {
    const possibleArray =
      parseJsonValue(
        parsedValue[key],
      );

    if (
      Array.isArray(
        possibleArray,
      )
    ) {
      return possibleArray.filter(
        isRecord,
      );
    }
  }

  return [];
}

function matchesCandidateId(
  item: UnknownRecord,
  candidateId: string,
): boolean {
  const itemId =
    findText(
      item,
      [
        "candidateId",
        "candidate_id",
        "id",
      ],
    );

  return (
    itemId ===
    candidateId
  );
}

export async function loadCandidate360Profile(
  candidateId: string,
) {
  const supabase =
    createCandidateSupabaseAdminClient();

  const {
    data,
    error,
  } =
    await supabase
      .from(
        "candidates",
      )
      .select(
        "*",
      )
      .eq(
        "id",
        candidateId,
      )
      .maybeSingle();

  if (error) {
    throw new Error(
      `Candidate360 query failed: ${error.message}`,
    );
  }

  if (
    !data ||
    !isRecord(
      data,
    )
  ) {
    return null;
  }

  const candidate = normalizeCandidate({
    ...data,
    ...normalizeActualCandidateSchema(data),
  });


  const workflowFile =
    readJson(
      "recruiter-workflow-state.json",
    );

  const repairFile =
    readJson(
      "repair-queue-audit.json",
    );

  const approvals =
    readJson(
      "ai-extraction-approvals.json",
    );

  const decisions =
    readJson(
      "quick-fix-apply-decisions.json",
    );

  const applyHistory =
    readJson(
      "candidate-apply-history.json",
    ) ??
    readJson(
      "quick-fix-post-apply-verification.json",
    );

  const workflowState =
    getItems(
      workflowFile,
    ).find(
      (item) =>
        matchesCandidateId(
          item,
          candidateId,
        ),
    ) ?? {};

  const repair =
    getItems(
      repairFile,
    ).find(
      (item) =>
        matchesCandidateId(
          item,
          candidateId,
        ),
    );

  const repairQueueStatus =
    repair
      ? (
          findText(
            repair,
            [
              "repairCategory",
              "repair_category",
              "status",
            ],
          ) ??
          "needs_repair"
        )
      : "not_in_repair_queue";

  return buildCandidate360Profile(
    candidate,
    {
      ...workflowState,
      repairQueueStatus,
    },
    approvals,
    decisions,
    applyHistory,
  );
}
