import { extractFullCandidateProfile } from "./fullCandidateExtractionEngine";
import { normalizeActualCandidateSchema } from "./candidate360SchemaNormalize";
import { isValidProjectEntry } from "./candidateProfileIngestion";
import { careerMonthIndex } from "./candidateCareerExperience";
import {
  PROJECT_CURRENT_TOKEN_PATTERN,
  PROJECT_DATE_TOKEN_PATTERN,
  projectDateIsCurrent,
} from "./projectDateEvidence";

const clean = (value: unknown) =>
  String(value ?? "")
    .replace(/\s+/g, " ")
    .trim();

const unique = (values: unknown[]) =>
  Array.from(new Set(values.map(clean).filter(Boolean)));

function mergeGroundedProjects(
  canonical: Array<Record<string, unknown>>,
  explicit: Array<Record<string, unknown>>,
) {
  const validCanonical = canonical.filter(isValidProjectEntry);
  if (!validCanonical.length) return explicit;
  const projects = [...canonical];
  const key = (value: unknown) =>
    clean(value)
      .normalize("NFKC")
      .toLowerCase()
      .replace(/[^\p{L}\p{N}]+/gu, " ")
      .trim();
  const projectEndIsCurrent = (value: Record<string, unknown>) =>
    value.current === true || projectDateIsCurrent(value.end_date);
  for (const row of explicit.filter(isValidProjectEntry)) {
    const matching = projects.find((existing) => {
      if (!isValidProjectEntry(existing)) return false;
      const start = careerMonthIndex(existing.start_date);
      const end = careerMonthIndex(
        existing.end_date,
        projectEndIsCurrent(existing),
      );
      const samePeriod =
        (start !== null &&
          end !== null &&
          start === careerMonthIndex(row.start_date) &&
          end === careerMonthIndex(row.end_date, projectEndIsCurrent(row))) ||
        (!clean(existing.start_date) &&
          !clean(existing.end_date) &&
          !clean(row.start_date) &&
          !clean(row.end_date));
      const sameRole = Boolean(
        key(existing.role) && key(existing.role) === key(row.role),
      );
      const existingRole = clean(existing.role);
      const explicitRole = clean(row.role);
      const explicitRoleKey = key(explicitRole);
      const existingRoleKey = key(existingRole);
      const broadRoleTail = existingRole.slice(explicitRole.length);
      const explicitRefinesBroadRole = Boolean(
        explicitRoleKey &&
          existingRoleKey.startsWith(`${explicitRoleKey} `) &&
          existingRole.length > explicitRole.length &&
          (/\b(?:19|20)\d{2}\b/.test(broadRoleTail) ||
            /\b(?:responsibilit|deliver|implement|support|configur|test|cutover|migration|rollout|workshop|training|go[ -]?live)\w*\b/i.test(
              broadRoleTail,
            )),
      );
      const existingClient = key(existing.client);
      const explicitClient = key(row.client);
      const existingName = key(existing.name);
      const explicitName = key(row.name);
      if (
        (existingClient &&
          explicitClient &&
          existingClient !== explicitClient) ||
        (existingName && explicitName && existingName !== explicitName)
      )
        return false;
      const sameOwnership = Boolean(
        (existingClient && explicitClient) || (existingName && explicitName),
      );
      return (
        samePeriod && (sameRole || explicitRefinesBroadRole) && sameOwnership
      );
    });
    if (matching) {
      if (!clean(matching.name)) matching.name = row.name;
      if (!clean(matching.client)) matching.client = row.client;
      if (
        key(matching.role) !== key(row.role) &&
        key(matching.role).startsWith(`${key(row.role)} `)
      )
        matching.role = row.role;
      if (!clean(matching.project_type))
        matching.project_type = row.project_type;
      if (
        (!Array.isArray(matching.modules) || !matching.modules.length) &&
        Array.isArray(row.modules)
      )
        matching.modules = row.modules;
    } else projects.push(row);
  }
  return projects;
}

const SECTION_HEADINGS =
  /^(?:work|professional|career|employment)\s+(?:experience|history)|projects?|client experience|education|academic background|academic qualifications?|qualifications?|certifications?|credentials?|skills?|technical skills?|core competencies|languages?|language proficiency|personal details|summary|profile|references?\s*:?[\s]*$/i;
const PROJECT_SECTION_END_HEADINGS =
  /^(?:(?:work(?:ing)?|professional|career|employment)\s+(?:experience|history)|education|academic\s+(?:background|qualifications?)|qualifications?|certifications?|credentials?|skills?|technical\s+skills?|core\s+competencies|languages?|language\s+proficiency|personal\s+details|summary|profile|references?)\s*:?\s*$/i;

function explicitSectionLines(rawText: string, heading: RegExp) {
  const lines = rawText.split(/\r?\n/).map((line) => line.trim());
  const start = lines.findIndex((line) => heading.test(line));
  if (start < 0) return [];
  const output: string[] = [];
  for (const line of lines.slice(start + 1)) {
    if (SECTION_HEADINGS.test(line)) break;
    if (line && line.length <= 240)
      output.push(line.replace(/^[•·▪\-*]+\s*/, ""));
    if (output.length >= 20) break;
  }
  return unique(output);
}

function explicitLanguages(rawText: string) {
  const section = explicitSectionLines(
    rawText,
    /^(?:languages?|language proficiency|spoken languages?)\s*:?[\s]*$/i,
  ).join(" ");
  if (!section) return [];
  const known = [
    "English",
    "Mandarin",
    "Chinese",
    "Japanese",
    "Korean",
    "Malay",
    "Bahasa Malaysia",
    "Bahasa Indonesia",
    "Indonesian",
    "Vietnamese",
    "Thai",
    "Tamil",
    "Hindi",
    "German",
    "French",
    "Spanish",
  ];
  return known.filter((language) =>
    new RegExp(`\\b${language.replace(/\s+/g, "\\s+")}\\b`, "i").test(section),
  );
}

function explicitProjectRecords(rawText: string) {
  const normalized = rawText
    .normalize("NFKC")
    .replace(/\r/g, "")
    .replace(/[ \t]+/g, " ");
  const projectMarkers = [
    ...normalized.matchAll(
      /(?:^|\n)\s*(?:project\s+(?:name|title)|project)\s*:/gim,
    ),
  ];
  const clientMarkers = [
    ...normalized.matchAll(/(?:^|\n)\s*(?:client|customer)\s*:/gim),
  ];
  const markers = projectMarkers.length ? projectMarkers : clientMarkers;
  const rangePattern = new RegExp(
    `\\b(${PROJECT_DATE_TOKEN_PATTERN})\\s*(?:-|–|—|to|~)\\s*(${PROJECT_DATE_TOKEN_PATTERN}|${PROJECT_CURRENT_TOKEN_PATTERN})\\b`,
    "i",
  );
  const dateValue = (value: string) => clean(value.replace(/[’']/g, " "));
  // An invalid or partial date claim is not an undated assignment. Preserve
  // that claim only in the source text until it can be reviewed.
  const unresolvedDateClaim = (block: string, start: string, end: string) =>
    !start &&
    !end &&
    (/(?:^|\n)\s*(?:duration|period|project\s+dates?|(?:project\s+)?(?:start|end)(?:ing)?\s+date|date\s+(?:from|to)|from|to)\s*:/im.test(
      block,
    ) ||
      rangePattern.test(block));
  const projectFieldValue = (value: unknown) => {
    const normalized = clean(value);
    return /^(?:project(?:[ \t]+(?:name|title|role|dates?|duration|type))?|end[ \t]+client|client|customer|role|position|designation|duration|period|(?:project[ \t]+)?start(?:ing)?[ \t]+date|(?:project[ \t]+)?end(?:ing)?[ \t]+date|date[ \t]+(?:from|to)|from|to|sap[ \t]+modules?|modules?|type|education|skills?)[ \t]*(?::|$)/i.test(
      normalized,
    )
      ? ""
      : normalized;
  };
  const nextLabelLine = (block: string, labels: string) =>
    projectFieldValue(
      block.match(
        new RegExp(
          `(?:^|\\n)[ \\t]*(?:${labels})[ \\t]*\\n(?:[ \\t]*\\n){0,2}[ \\t]*([^\\n]{2,160})`,
          "im",
        ),
      )?.[1],
    );
  const labelledLineValue = (block: string, labels: string) =>
    projectFieldValue(
      block.match(
        new RegExp(
          `(?:^|\\n)[ \\t]*(?:${labels})[ \\t]*:[ \\t]*([^\\n]{2,120})`,
          "im",
        ),
      )?.[1] || nextLabelLine(block, labels),
    );
  const splitDateRange = (block: string) => {
    const start = dateValue(
      labelledLineValue(
        block,
        "(?:project[ \\t]+)?start(?:ing)?[ \\t]+date|date[ \\t]+from|from",
      ),
    );
    const end = dateValue(
      labelledLineValue(
        block,
        "(?:project[ \\t]+)?end(?:ing)?[ \\t]+date|date[ \\t]+to|to",
      ),
    );
    const startIsDate = new RegExp(
      `^(?:${PROJECT_DATE_TOKEN_PATTERN})$`,
      "i",
    ).test(start);
    const endIsDate = new RegExp(
      `^(?:${PROJECT_DATE_TOKEN_PATTERN}|${PROJECT_CURRENT_TOKEN_PATTERN})$`,
      "i",
    ).test(end);
    return startIsDate && endIsDate ? ([start, end] as const) : null;
  };
  const boundedProjectBlock = (block: string) => {
    const boundary = block.match(
      /\n\s*(?:(?:work(?:ing)?|professional|career|employment)\s+(?:experience|history)|education|academic\s+(?:background|qualifications?)|qualifications?|certifications?|credentials?|skills?|technical\s+skills?|core\s+competencies|languages?|language\s+proficiency|personal\s+details|summary|profile|references?)\s*:?\s*(?:\n|$)/i,
    );
    return boundary?.index === undefined
      ? block
      : block.slice(0, boundary.index);
  };
  const records: Array<Record<string, unknown>> = [];
  for (const [index, marker] of markers.entries()) {
    const start = marker.index || 0;
    const nextProject =
      markers[index + 1]?.index ?? Math.min(normalized.length, start + 2400);
    // The first Client label can belong to this named project. A second one
    // starts a separate card and must not lend its role or dates backward.
    const clientsWithinCard = clientMarkers
      .map((clientMarker) => clientMarker.index || 0)
      .filter(
        (clientIndex) => clientIndex > start && clientIndex < nextProject,
      );
    const end = clientsWithinCard[1] ?? nextProject;
    const block = boundedProjectBlock(normalized.slice(start, end));
    const name = projectFieldValue(
      block.match(
        /(?:^|\n)\s*(?:project\s+(?:name|title)|project)\s*:\s*([^\n]{2,160})/im,
      )?.[1],
    );
    const client = projectFieldValue(
      block.match(
        /(?:^|\n)\s*(?:client|customer)\s*:\s*([^\n]{2,160})/im,
      )?.[1] || nextLabelLine(block, "client|customer"),
    );
    const multilineRole = nextLabelLine(
      block,
      "project[ \\t]+role|role|position|designation",
    );
    const colonRole = projectFieldValue(
      block.match(
        /(?:^|\n)\s*(?:project\s+role|role|position|designation)\s*:\s*([^\n]{2,160})/im,
      )?.[1],
    );
    const role = colonRole || multilineRole;
    const duration = labelledLineValue(
      block,
      "duration|period|project[ \\t]+dates?",
    );
    const range =
      duration.match(rangePattern) ||
      (colonRole ? block.match(rangePattern) : null);
    const splitRange = splitDateRange(block);
    const startDate = range?.[1] || splitRange?.[0] || "";
    const endDate = range?.[2] || splitRange?.[1] || "";
    if (
      !(name || client) ||
      !role ||
      unresolvedDateClaim(block, startDate, endDate)
    )
      continue;
    const moduleLine = clean(
      block.match(
        /(?:^|\n)\s*(?:sap\s+modules?|modules?)\s*:\s*([^\n]{1,160})/im,
      )?.[1],
    );
    const projectType = clean(
      block.match(
        /(?:^|\n)\s*(?:project\s+type|type)\s*:\s*([^\n]{1,100})/im,
      )?.[1] ||
        block.match(
          /\b(implementation|rollout|migration|upgrade|support|ams|greenfield|brownfield|conversion)\b/i,
        )?.[1],
    );
    records.push({
      name,
      client,
      role,
      start_date: dateValue(startDate),
      end_date: dateValue(endDate),
      modules: unique(moduleLine.split(/[,;|/]+/)),
      project_type: projectType,
    });
  }
  // A document can mix named Project cards with Client-only cards. The
  // primary pass above uses Project markers, so Client-only assignments
  // before or between them would otherwise disappear. A leading Client card
  // must be inside an explicit project section; later cards need a nearby
  // Project marker. Each card owns its own Role and Duration labels.
  if (projectMarkers.length) {
    const boundaries = [...projectMarkers, ...clientMarkers]
      .map((marker) => marker.index || 0)
      .sort((left, right) => left - right);
    for (const clientMarker of clientMarkers) {
      const start = clientMarker.index || 0;
      const priorProject = projectMarkers
        .map((marker) => marker.index || 0)
        .filter((index) => index < start)
        .at(-1);
      const priorProjectHeading = [
        ...normalized
          .slice(0, start)
          .matchAll(
            /(?:^|\n)[ \t]*(?:projects?|project[ \t]+(?:experience|history|profile|details|portfolio|assignments?))[ \t]*:?[ \t]*(?:\n|$)/gim,
          ),
      ].at(-1);
      const anchor =
        priorProject ??
        (priorProjectHeading?.index === undefined
          ? undefined
          : priorProjectHeading.index + priorProjectHeading[0].length);
      if (anchor === undefined || start - anchor > 2400) continue;
      if (
        /(?:^|\n)\s*(?:(?:work(?:ing)?|professional|employment)\s+(?:experience|history)|education|academic\s+(?:background|qualifications?)|skills?|languages?|references?)\s*:?\s*(?:\n|$)/i.test(
          normalized.slice(anchor, start),
        )
      )
        continue;
      const end =
        boundaries.find((index) => index > start) ??
        Math.min(normalized.length, start + 1200);
      const block = boundedProjectBlock(normalized.slice(start, end));
      const client = projectFieldValue(
        block.match(
          /(?:^|\n)[ \t]*(?:client|customer)[ \t]*:[ \t]*([^\n]{2,160})/im,
        )?.[1] || nextLabelLine(block, "client|customer"),
      );
      const role = projectFieldValue(
        block.match(
          /(?:^|\n)[ \t]*(?:project[ \t]+role|role|position|designation)[ \t]*:[ \t]*([^\n]{2,160})/im,
        )?.[1] ||
          nextLabelLine(block, "project[ \\t]+role|role|position|designation"),
      );
      const dated =
        block.match(
          /(?:^|\n)[ \t]*(?:duration|period|project[ \t]+dates?)[ \t]*:[ \t]*([^\n]{3,120})/im,
        )?.[1] || nextLabelLine(block, "duration|period|project[ \\t]+dates?");
      const range = dated?.match(rangePattern);
      const splitRange = splitDateRange(block);
      const startDate = range?.[1] || splitRange?.[0] || "";
      const endDate = range?.[2] || splitRange?.[1] || "";
      if (
        !client ||
        !role ||
        unresolvedDateClaim(block, startDate, endDate) ||
        /^(?:role|duration|project|client|customer|education)\s*:/i.test(
          client,
        ) ||
        /^(?:role|duration|project|client|customer|education)\s*:/i.test(role)
      )
        continue;
      const row = {
        name: "",
        client,
        role,
        start_date: dateValue(startDate),
        end_date: dateValue(endDate),
        modules: [],
        project_type: "",
      };
      if (
        isValidProjectEntry(row) &&
        !records.some(
          (known) =>
            clean(known.client).toLowerCase() === client.toLowerCase() &&
            clean(known.role).toLowerCase() === role.toLowerCase() &&
            careerMonthIndex(known.start_date) ===
              careerMonthIndex(row.start_date) &&
            careerMonthIndex(known.end_date) === careerMonthIndex(row.end_date),
        )
      )
        records.push(row);
    }
  }
  // Some DOCX layouts put the label and its value on separate lines. Keep
  // each Client/Project/Role group bounded by the next Client so dates and
  // roles from a neighbouring assignment cannot complete a partial entry.
  const lines = normalized
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  const clientHeadings = lines.flatMap((line, index) =>
    /^(?:client|customer)$/i.test(line) ? [index] : [],
  );
  const labelValue = (block: string[], label: RegExp) => {
    const index = block.findIndex((line) => label.test(line));
    const value = index < 0 ? "" : clean(block[index + 1]);
    return value &&
      value.length <= 160 &&
      !/^(?:client|customer|project|role|position|designation)$/i.test(value)
      ? value
      : "";
  };
  for (const [index, start] of clientHeadings.entries()) {
    const end = clientHeadings[index + 1] ?? lines.length;
    const unboundedBlock = lines.slice(start, end);
    const sectionBoundary = unboundedBlock.findIndex(
      (line, offset) => offset > 0 && PROJECT_SECTION_END_HEADINGS.test(line),
    );
    const block =
      sectionBoundary < 0
        ? unboundedBlock
        : unboundedBlock.slice(0, sectionBoundary);
    const clientLine = labelValue(block, /^(?:client|customer)$/i);
    const name = labelValue(block, /^project$/i);
    const role = labelValue(block, /^(?:role|position|designation)$/i);
    // Some project cards put a date-only line immediately before Client.
    // Never borrow a date embedded in preceding prose or in a later task.
    const precedingLine = lines[start - 1] || "";
    const precedingRange = precedingLine.match(rangePattern);
    const dateOnlyBeforeClient =
      precedingRange && !precedingLine.replace(precedingRange[0], "").trim()
        ? precedingRange
        : null;
    const range = (block[1] || "").match(rangePattern) || dateOnlyBeforeClient;
    const splitRange = splitDateRange(block.join("\n"));
    const startDate = range?.[1] || splitRange?.[0] || "";
    const endDate = range?.[2] || splitRange?.[1] || "";
    const client = clean(
      clientLine
        .replace((block[1] || "").match(rangePattern)?.[0] || /$^/, "")
        .replace(/[\s,;|–—-]+$/, ""),
    );
    if (
      !client ||
      !name ||
      !role ||
      unresolvedDateClaim(block.join("\n"), startDate, endDate)
    )
      continue;
    records.push({
      name,
      client,
      role,
      start_date: dateValue(startDate),
      end_date: dateValue(endDate),
      modules: [],
      project_type: "",
    });
  }
  // A source can show a reversed or unparseable date range. Leave that
  // assignment in the original CV for review instead of structuring it.
  return records.filter(isValidProjectEntry);
}

/** Enriches the lightweight upload parser with the repository's deterministic
 * full-profile reader. Only evidence-backed values are added; missing dates,
 * employers and project ownership remain missing for review.
 */
export function enrichCandidateUpload(
  candidate: Record<string, any>,
  rawText: string,
) {
  const full = extractFullCandidateProfile({
    ...candidate,
    raw_text: rawText,
    resume_text: rawText,
  });
  const canonical = normalizeActualCandidateSchema({
    ...candidate,
    raw_text: rawText,
    resume_text: rawText,
  });
  const explicitEducation = explicitSectionLines(
    rawText,
    /^(?:education|academic background|academic qualifications?|qualifications?)\s*:?[\s]*$/i,
  );
  const explicitCertifications = explicitSectionLines(
    rawText,
    /^(?:certifications?|licenses?\s*(?:&|and)\s*certifications?|credentials?)\s*:?[\s]*$/i,
  );
  const explicitLanguageValues = explicitLanguages(rawText);
  const explicitSkills = explicitSectionLines(
    rawText,
    /^(?:skills?|technical skills?|core competencies|sap skills?|expertise)\s*:?[\s]*$/i,
  ).flatMap((line) => line.split(/[,;|•·▪]+/));
  const experience = canonical.workExperience?.length
    ? canonical.workExperience.map((item: any) => ({
        employer: clean(item.company),
        company: clean(item.company),
        title: clean(item.title),
        start_date: clean(item.startDate),
        end_date: clean(item.endDate),
        current: item.current === true,
      }))
    : (full.employerHistory || [])
        .filter(
          (item: any) => item.isEmployer !== false && clean(item.employer),
        )
        .map((item: any) => ({
          employer: clean(item.employer),
          company: clean(item.employer),
          title: clean(item.title),
          start_date: clean(item.startDate),
          end_date: clean(item.endDate),
          current: item.isCurrent === true,
          evidence_confidence: Number(item.confidence || 0),
        }));
  const currentExperience = experience.find(
    (item: any) => item.current === true && clean(item.employer),
  );
  const canonicalProjects = (canonical.projectExperience || []).map(
    (item: any) => ({
      name: clean(item.name),
      client: clean(item.client),
      employer: clean(item.employer),
      role: clean(item.role),
      modules: Array.isArray(item.modules) ? item.modules : [],
      location: clean(item.location),
      description: clean(item.description),
      start_date: clean(item.startDate),
      end_date: clean(item.endDate),
      project_type: clean(item.projectType),
    }),
  );
  const explicitProjects = explicitProjectRecords(rawText);
  // The two source-backed readers may recover different assignments. Count
  // alone must not discard a distinct explicit project or a canonical one.
  // Match role, project/client and either the same period or both undated
  // records before deduplicating. Never copy employment dates to a project.
  const projects = mergeGroundedProjects(canonicalProjects, explicitProjects);
  const education = explicitEducation.length
    ? explicitEducation
    : canonical.education || [];
  const certifications = explicitCertifications.length
    ? explicitCertifications
    : canonical.certifications || [];
  const languages = explicitLanguageValues.length
    ? explicitLanguageValues
    : canonical.languages || [];
  const skills = unique([
    ...(candidate.skills || []),
    ...(canonical.skills || []),
    ...(full.sapSkills || []),
    ...(full.technicalKeywords || []),
    ...(full.functionalKeywords || []),
    ...(full.integrationKeywords || []),
    ...(full.businessProcesses || []),
    ...explicitSkills,
  ]);
  const location = clean(
    [full.locationCity, full.locationCountry].filter(Boolean).join(", ") ||
      candidate.location,
  );

  return {
    ...candidate,
    name:
      full.extractedFullName && !full.isNameSuspicious
        ? full.extractedFullName
        : candidate.name,
    email: full.extractedEmail || candidate.email,
    phone: full.extractedPhone || candidate.phone,
    linkedin_url: full.linkedInUrl || candidate.linkedin_url,
    location,
    country: full.locationCountry || candidate.country,
    current_title:
      full.extractedCurrentTitle && !full.isTitleSuspicious
        ? full.extractedCurrentTitle
        : candidate.current_title || candidate.currentTitle,
    // Current employer is a temporal claim. Only an explicitly open-ended
    // canonical employment row may populate it; stale upstream fields and
    // undated labels remain review evidence instead of current facts.
    current_company: clean(currentExperience?.employer) || null,
    primary_module:
      full.primarySapModule && full.primarySapModule !== "UNKNOWN"
        ? full.primarySapModule
        : candidate.primary_module || candidate.primaryModule,
    sap_modules: unique([
      ...(candidate.sap_modules || candidate.sapModules || []),
      ...(full.sapModules || []),
    ]),
    secondary_modules: unique([
      ...(candidate.secondary_modules || candidate.secondaryModules || []),
      ...(full.secondarySapModules || []),
    ]),
    skills,
    experience,
    employment_history: experience,
    projects,
    project_history: projects,
    project_types: unique([
      ...(candidate.project_types || []),
      ...(full.projectTypes || []),
    ]),
    education,
    certifications,
    languages,
    extraction_review_classification: full.reviewClassification,
    extraction_review_reasons: full.reviewReasons,
  };
}
