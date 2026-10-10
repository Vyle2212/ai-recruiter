import { extractSapTaskSpecializations } from "./sapTaskSpecializations";
import {
  nestedResumeHistory,
  institutionFirstEducation,
  labelledResumeEducation,
  datedSelectedProjectTitles,
  labelledResumeEmployment,
  narrativeResumeEmployment,
  projectFieldLayoutText,
} from "./nestedResumeHistory";
import {
  contactHeaderPhone,
  sapProjectTypeEvidence,
} from "./candidatePortalEditEvidence";
import { extractFullCandidateProfile } from "./fullCandidateExtractionEngine";
import { normalizeActualCandidateSchema } from "./candidate360SchemaNormalize";
import { isValidProjectEntry } from "./candidateProfileIngestion";
import { careerMonthIndex } from "./candidateCareerExperience";
import {
  pipeEmploymentCards,
  embeddedSapEmploymentProjects,
  contactHeaderName,
  explicitContactLocation,
  positionedResumeSections,
  trackedHeaderName,
} from "./positionedResumeEvidence";
import {
  PROJECT_CURRENT_TOKEN_PATTERN,
  PROJECT_DATE_TOKEN_PATTERN,
  projectDateIsCurrent,
  projectDateRange,
  validProjectDateRange,
} from "./projectDateEvidence";

const clean = (value: unknown) =>
  String(value ?? "")
    .replace(/\s+/g, " ")
    .trim();

const unique = (values: unknown[]) =>
  Array.from(new Set(values.map(clean).filter(Boolean)));

const projectKey = (value: unknown) =>
  clean(value)
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();

/** A dated reader may refine an undated row only when the source has one
 * matching named card and that same bounded card owns the client, role and
 * dates. Repeated assignments with the same labels remain separate review
 * evidence instead of borrowing dates across cards. */
function uniqueBoundedProjectDateEvidence(
  rawText: string,
  row: Record<string, unknown>,
) {
  const name = projectKey(row.name);
  const client = projectKey(row.client);
  const role = projectKey(row.role);
  const start = careerMonthIndex(row.start_date);
  const end = careerMonthIndex(
    row.end_date,
    projectDateIsCurrent(row.end_date),
  );
  if (!name || !role || start === null || end === null) return false;
  const lines = rawText
    .normalize("NFKC")
    .replace(/\r/g, "")
    .split("\n")
    .map((line) => line.trim());
  const anchors = lines.flatMap((line, index) => {
    const match = line.match(/^Project(?:\s+(?:Name|Title))?\s*:\s*(\S.*)$/i);
    if (!match) return [];
    const inlineDates = projectDateRange(match[1]);
    const labelledName =
      inlineDates && (inlineDates.index ?? -1) >= 5
        ? match[1]
            .slice(0, inlineDates.index)
            .replace(/[,;\s-]+$/, "")
            .trim()
        : match[1];
    return projectKey(labelledName) === name ? [index] : [];
  });
  if (anchors.length !== 1) return false;
  const anchor = anchors[0];
  let endIndex = Math.min(lines.length, anchor + 40);
  let clientLabels = 0;
  let characters = 0;
  for (let index = anchor + 1; index < endIndex; index++) {
    characters += lines[index].length + 1;
    if (characters > 2400) {
      endIndex = index;
      break;
    }
    if (
      /^Project(?:\s+(?:Name|Title))?\s*:/i.test(lines[index]) ||
      /^(?:EMPLOYMENT|WORK EXPERIENCE|EDUCATION|CERTIFICATIONS?|REFERENCES)\s*$/i.test(
        lines[index],
      )
    ) {
      endIndex = index;
      break;
    }
    if (/^(?:Client|Customer)\s*:\s*\S/i.test(lines[index])) {
      clientLabels++;
      if (clientLabels > 1) {
        endIndex = index;
        break;
      }
    }
  }
  const block = lines.slice(anchor, endIndex);
  const ownsRole = block.some((line) => {
    const match = line.match(/^(?:Project\s+)?Role\s*:\s*(\S.*)$/i);
    return Boolean(match && projectKey(match[1]) === role);
  });
  const ownsClient =
    !client ||
    block.some((line) => {
      const match = line.match(/^(?:Client|Customer)\s*:\s*(\S.*)$/i);
      return Boolean(match && projectKey(match[1]) === client);
    });
  const ownsDates = block.some((line) => {
    const range = projectDateRange(line);
    return Boolean(
      range &&
        careerMonthIndex(range[1]) === start &&
        careerMonthIndex(range[2], projectDateIsCurrent(range[2])) === end,
    );
  });
  return ownsRole && ownsClient && ownsDates;
}

function mergeGroundedProjects(
  canonical: Array<Record<string, unknown>>,
  explicit: Array<Record<string, unknown>>,
  rawText: string,
) {
  // A section heading after an empty Project label is not a project identity.
  // Discard these reader artefacts rather than borrowing a later assignment.
  const isHeading = (row: Record<string, unknown>) =>
    /^(?:Responsibilities|Roles?\s*(?:and|&)\s*Responsibilities|Job\s+Scope|Deliverables)[ \t]*:?[ \t]*$/i.test(
      clean(row.name),
    );
  canonical = canonical.filter((row) => !isHeading(row));
  explicit = explicit.filter((row) => !isHeading(row));
  const exactUnique = (rows: Array<Record<string, unknown>>) => {
    const seen = new Set<string>();
    return rows.filter((row) => {
      const signature = JSON.stringify(row);
      if (seen.has(signature)) return false;
      seen.add(signature);
      return true;
    });
  };
  const validCanonical = canonical.filter(isValidProjectEntry);
  if (!validCanonical.length) return exactUnique(explicit);
  const projects = [...canonical];
  const key = projectKey;
  const projectEndIsCurrent = (value: Record<string, unknown>) =>
    value.current === true || projectDateIsCurrent(value.end_date);
  const identity = (value: Record<string, unknown>) =>
    [key(value.name), key(value.client), key(value.role)].join("|");
  const isDated = (value: Record<string, unknown>) =>
    careerMonthIndex(value.start_date) !== null &&
    careerMonthIndex(value.end_date, projectEndIsCurrent(value)) !== null;
  for (const row of explicit.filter(isValidProjectEntry)) {
    const sameIdentity = identity(row);
    const matchingUndated = projects.filter(
      (existing) =>
        isValidProjectEntry(existing) &&
        !clean(existing.start_date) &&
        !clean(existing.end_date) &&
        key(existing.name) &&
        key(existing.client) &&
        key(existing.role) &&
        identity(existing) === sameIdentity,
    );
    const competingDated = projects.some(
      (existing) =>
        isValidProjectEntry(existing) &&
        isDated(existing) &&
        identity(existing) === sameIdentity,
    );
    const competingExplicit =
      explicit.filter(
        (other) =>
          isValidProjectEntry(other) &&
          isDated(other) &&
          identity(other) === sameIdentity,
      ).length > 1;
    if (
      isDated(row) &&
      matchingUndated.length === 1 &&
      !competingDated &&
      !competingExplicit &&
      uniqueBoundedProjectDateEvidence(rawText, row)
    ) {
      matchingUndated[0].start_date = row.start_date;
      matchingUndated[0].end_date = row.end_date;
      continue;
    }
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
  return exactUnique(projects);
}

const SECTION_HEADINGS =
  /^(?:(?:work|professional|career|employment)\s+(?:experience|history)|experience|additional information|projects?|client experience|education|academic background|academic qualifications?|qualifications?|certifications?|credentials?|skills?|technical skills?|core competencies|languages?|language proficiency|personal details|summary|profile|references?)\s*:?[\s]*$/i;
const PROJECT_SECTION_END_HEADINGS =
  /^(?:experience|additional information|(?:work(?:ing)?|professional|career|employment)\s+(?:experience|history)|education|academic\s+(?:background|qualifications?)|qualifications?|certifications?|credentials?|skills?|technical\s+skills?|core\s+competencies|languages?|language\s+proficiency|personal\s+details|summary|profile|references?)\s*:?\s*$/i;

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
    "Arabic",
    "Mandarin",
    "Chinese",
    "Japanese",
    "Korean",
    "Malay",
    "Bahasa Malaysia",
    "Bahasa Indonesia",
    "Bahasa",
    "Indonesian",
    "Vietnamese",
    "Thai",
    "Tamil",
    "Hindi",
    "German",
    "French",
    "Spanish",
  ];
  const anchors = known
    .flatMap((language) => {
      const match = new RegExp(
        `\\b${language.replace(/\s+/g, "\\s+")}\\b${language === "Bahasa" ? "(?!\\s+(?:Malaysia|Indonesia)\\b)" : ""}`,
        "i",
      ).exec(section);
      return match
        ? [{ language, index: match.index, end: match.index + match[0].length }]
        : [];
    })
    .sort((a, b) => a.index - b.index);
  return anchors.map((anchor, index) => {
    const bounded = section.slice(
      anchor.end,
      anchors[index + 1]?.index ?? section.length,
    );
    const proficiency =
      bounded.match(
        /\b(?:JLPT\s*N[1-5]|N[1-5]|HSK\s*[1-9]|TOPIK\s*[1-6]|(?:CEFR\s*)?[ABC][12]|IELTS\s*\d(?:\.\d)?|Native|Fluent|Advanced|Intermediate|Basic|Professional|Fair|Simple)\b/i,
      )?.[0] || "";
    return { language: anchor.language, proficiency };
  });
}

function explicitProjectRecords(rawText: string) {
  const normalized = projectFieldLayoutText(rawText)
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
    `(?<![\\w.])(${PROJECT_DATE_TOKEN_PATTERN})\\s*(?:-|–|—|to|until|till|~)\\s*(${PROJECT_DATE_TOKEN_PATTERN}|${PROJECT_CURRENT_TOKEN_PATTERN})\\b`,
    "i",
  );
  const dateValue = (value: string) => clean(value.replace(/[’‘']/g, " "));
  // An invalid or partial date claim is not an undated assignment. Preserve
  // that claim only in the source text until it can be reviewed.
  const elapsedDuration = (value: string) =>
    /^(?:\d+(?:\.\d+)?|one|two|three|four|five|six|seven|eight|nine|ten)[ \t]*(?:man[ \t]+)?(?:days?|weeks?|months?|years?)(?:[ \t]*\/[ \t]*project)?(?:[ \t]*\((?:19|20)\d{2}\))?[.]?$/i.test(
      value,
    );
  const unresolvedDateClaim = (block: string, start: string, end: string) => {
    const duration = labelledLineValue(
      block,
      "duration|period|project[ \\t]+(?:dates?|duration)",
    );
    if (
      elapsedDuration(duration) ||
      /^from joining date with the company\b/i.test(duration)
    )
      return false;
    return (
      !start &&
      !end &&
      (/(?:^|\n)\s*(?:duration|period|project\s+(?:dates?|duration)|(?:project\s+)?(?:start|end)(?:ing)?\s+date|date\s+(?:from|to)|from|to)\s*(?::|\n|$)/im.test(
        block,
      ) ||
        rangePattern.test(block))
    );
  };
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
    // A standalone company followed by its employment title ends this card.
    // Its role, dates and client must never be borrowed by the prior project.
    const employerBoundary = [
      ...block.matchAll(/\n([^\n]+)\n[ \t]*Position Title[ \t]*:/gi),
    ].find(
      (match) =>
        !/^[ \t]*(?:client|customer|project|duration|period|environment)[ \t]*:/i.test(
          match[1],
        ),
    );
    if (employerBoundary?.index !== undefined)
      block = block.slice(0, employerBoundary.index);
    // A dated employer narrative belongs to the next employment, not to
    // the preceding client card's project role.
    const employerNarrative = block.match(
      new RegExp(
        `\\n[ \\t]*(?:Worked|Working|Served)[ \\t]+(?:with|for|as[^\\n]+?[ \\t]+at)[ \\t]+[^\\n]+?[ \\t]+from[ \\t]+${PROJECT_DATE_TOKEN_PATTERN}`,
        "i",
      ),
    );
    if (employerNarrative?.index !== undefined)
      block = block.slice(0, employerNarrative.index);
    const companyOrNonSapBoundary = block.match(
      /\n[ \t]*(?:Employer|Company|Non[- \t]*SAP[ \t]+Project[ \t]+Work[ \t]+Experience)[ \t]*:?[ \t]*\n/i,
    );
    if (companyOrNonSapBoundary?.index !== undefined)
      block = block.slice(0, companyOrNonSapBoundary.index);
    const boundary = block.match(
      /\n\s*(?:(?:previous\s+)?(?:work(?:ing)?|professional|career|employment)\s+(?:experience|history)|education|academic\s+(?:background|qualifications?)|qualifications?|certifications?|credentials?|skills?|technical\s+skills?|core\s+competencies|languages?|language\s+proficiency|personal\s+details|summary|profile|references?)\s*:?\s*(?:\n|$)/i,
    );
    return boundary?.index === undefined
      ? block
      : block.slice(0, boundary.index);
  };
  const calendarDurationValue = (duration: string) =>
    duration
      .replace(/\((\d{1,2}\/\d{2,4})\)/g, "$1")
      .replace(
        /\b([A-Za-z]+)[ \t]*(\d{1,2}),[ \t]*((?:19|20)\d{2})\b/g,
        "$1 $2 $3",
      )
      .replace(
        /\b(Mac|Ogos|Mei|Disember)(?=\s|(?:19|20)\d{2})/gi,
        (token) =>
          ({ mac: "March", ogos: "August", mei: "May", disember: "December" })[
            token.toLowerCase()
          ] || token,
      );
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
      "project[ \\t]+role|job[ \\t]+role|role|position(?:[ \\t]+title)?|designation",
    );
    const combinedModuleRole = labelledLineValue(
      block,
      "(?:sap[ \\t]+)?modules?[ \\t]*/[ \\t]*role",
    );
    const combinedSeparator = combinedModuleRole.lastIndexOf("/");
    const combinedRole =
      combinedSeparator > 0
        ? clean(combinedModuleRole.slice(combinedSeparator + 1))
        : combinedModuleRole;
    const supportedCombinedRole =
      /\b(?:consultant|developer|analyst|architect|specialist|engineer|lead|manager|team member|PMO)\b/i.test(
        combinedRole,
      )
        ? combinedRole
        : "";
    const colonRole = projectFieldValue(
      block.match(
        /(?:^|\n)\s*(?:project\s+role|job\s+role|role|position(?:\s+title)?|designation)\s*:\s*([^\n]{2,160})/im,
      )?.[1] || supportedCombinedRole,
    );
    const narrativeRole = projectFieldValue(
      block.match(
        /(?:^|\n)[ \t]*(?:[-•*][ \t]*)?(?:Involved|Worked|Working|Served) as[ \t]+([^\n]{2,160})/im,
      )?.[1],
    );
    const role = colonRole || multilineRole || narrativeRole;
    const duration = labelledLineValue(
      block,
      "duration|period|project[ \\t]+(?:dates?|duration)",
    );
    const calendarDuration = calendarDurationValue(duration);
    const adjacentDates = calendarDuration.match(
      new RegExp(
        `^(${PROJECT_DATE_TOKEN_PATTERN})[ \\t]+(${PROJECT_DATE_TOKEN_PATTERN}|${PROJECT_CURRENT_TOKEN_PATTERN})$`,
        "i",
      ),
    );
    const range = duration
      ? calendarDuration.match(rangePattern) || adjacentDates
      : colonRole
        ? block.match(rangePattern)
        : null;
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
      )?.[1] ||
        (supportedCombinedRole && combinedSeparator > 0
          ? combinedModuleRole.slice(0, combinedSeparator)
          : ""),
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
      current: projectDateIsCurrent(endDate),
      ...(!startDate && !endDate && duration
        ? { duration_text: duration }
        : {}),
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
      if (
        anchor !== undefined &&
        start - anchor <= 2400 &&
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
          /(?:^|\n)[ \t]*(?:duration|period|project[ \t]+(?:dates?|duration))[ \t]*:[ \t]*([^\n]{3,120})/im,
        )?.[1] ||
        nextLabelLine(
          block,
          "duration|period|project[ \\t]+(?:dates?|duration)",
        );
      const range = calendarDurationValue(dated || "").match(rangePattern);
      const splitRange = splitDateRange(block);
      const startDate = range?.[1] || splitRange?.[0] || "";
      const endDate = range?.[2] || splitRange?.[1] || "";
      const scopeText = block.replace(
        /(?:^|\n)[ \t]*(?:role|position|designation)[ \t]*(?::[ \t]*[^\n]+|\n(?:[ \t]*\n)*[^\n]+)/gim,
        "\n",
      );
      // A self-contained literal Client/Role/Duration card is sufficient
      // evidence even when a distant Project marker exists elsewhere in the CV.
      // Without a nearby project section, require this card's complete period.
      if (
        (anchor === undefined || start - anchor > 2400) &&
        (!validProjectDateRange(startDate, endDate) ||
          !(
            /(?:^|\n)[ \t]*project[ \t]+duration[ \t]*(?::|\n)/i.test(block) ||
            (/\b(?:SAP|S\/4HANA)\b/i.test(scopeText) &&
              /\b(?:project|implementation|rollout|upgrade|configuration|interfaces?|cutover|testing|support)\b/i.test(
                scopeText,
              ))
          ))
      )
        continue;
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
  const projectHeadings = lines.flatMap((line, index) =>
    /^project(?:[ \t]+(?:name|title))?$/i.test(line) ? [index] : [],
  );
  const roleHeadings = lines.flatMap((line, index) =>
    /^(?:project[ \t]+role|role|position|designation)$/i.test(line)
      ? [index]
      : [],
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
    const priorProject = projectHeadings
      .filter((value) => value < start)
      .at(-1);
    const priorRole = roleHeadings.filter((value) => value < start).at(-1);
    // Project -> Client -> Role belongs to a Project-bounded card. Starting a
    // second Client-bounded read here would attach the next Project name to
    // the current client. Client -> Project -> Role remains handled below.
    if (priorProject !== undefined && priorProject > (priorRole ?? -1))
      continue;
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
  // Some source-owned project cards put every label and value on separate
  // lines and begin with Project rather than Client. The Client-bounded pass
  // above cannot look backwards for that Project value without crossing its
  // own card boundary. Read the whole Project-bounded card instead, retaining
  // its own client, role and date evidence. A partial date claim still blocks
  // the row; employment dates are never used here.
  for (const [index, start] of projectHeadings.entries()) {
    const priorProject = projectHeadings[index - 1] ?? -1;
    const priorClient = clientHeadings.filter((value) => value < start).at(-1);
    const priorRole = roleHeadings.filter((value) => value < start).at(-1);
    // Client -> Project -> Role is already a Client-bounded card. Starting a
    // second card at its nested Project label would borrow the next client's
    // fields and duplicate or cross-wire both assignments.
    if (
      priorClient !== undefined &&
      priorClient > priorProject &&
      priorClient > (priorRole ?? -1)
    )
      continue;
    const end = projectHeadings[index + 1] ?? lines.length;
    const unboundedBlock = lines.slice(start, end);
    const sectionBoundary = unboundedBlock.findIndex(
      (line, offset) => offset > 0 && PROJECT_SECTION_END_HEADINGS.test(line),
    );
    const block =
      sectionBoundary < 0
        ? unboundedBlock
        : unboundedBlock.slice(0, sectionBoundary);
    const blockText = block.join("\n");
    const name = labelValue(block, /^project(?:[ \t]+(?:name|title))?$/i);
    const client =
      labelledLineValue(blockText, "client|customer") ||
      labelValue(block, /^(?:client|customer)$/i);
    const role =
      labelledLineValue(
        blockText,
        "project[ \\t]+role|role|position|designation",
      ) ||
      labelValue(block, /^(?:project[ \t]+role|role|position|designation)$/i);
    const duration = labelledLineValue(
      blockText,
      "duration|period|project[ \\t]+dates?",
    );
    const range = duration.match(rangePattern);
    const splitRange = splitDateRange(blockText);
    const startDate = range?.[1] || splitRange?.[0] || "";
    const endDate = range?.[2] || splitRange?.[1] || "";
    if (
      !(name || client) ||
      !role ||
      unresolvedDateClaim(blockText, startDate, endDate)
    )
      continue;
    const row = {
      name,
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
          clean(known.name).toLowerCase() === name.toLowerCase() &&
          clean(known.client).toLowerCase() === client.toLowerCase() &&
          clean(known.role).toLowerCase() === role.toLowerCase() &&
          careerMonthIndex(known.start_date) ===
            careerMonthIndex(row.start_date) &&
          careerMonthIndex(known.end_date) === careerMonthIndex(row.end_date),
      )
    )
      records.push(row);
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
  const nested = nestedResumeHistory(rawText);
  const labelledEmployment = labelledResumeEmployment(rawText);
  const narrativeEmployment = narrativeResumeEmployment(rawText);
  const institutionEducation = institutionFirstEducation(rawText);
  const structuredEducation = institutionEducation.length
    ? institutionEducation
    : labelledResumeEducation(rawText);
  const positioned = positionedResumeSections(rawText);
  const trackedName = trackedHeaderName(
    rawText,
    String(candidate.file_name || candidate.source_file || ""),
  );
  const pipeCards = pipeEmploymentCards(rawText);
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
  const experience =
    nested?.experience ||
    (labelledEmployment.length ? labelledEmployment : null) ||
    (narrativeEmployment.length ? narrativeEmployment : null) ||
    (pipeCards.length
      ? pipeCards
      : canonical.workExperience?.length
        ? canonical.workExperience.map((item: any) => ({
            employer: clean(item.company),
            company: clean(item.company),
            title: clean(item.title),
            ...(clean(item.location) ? { location: clean(item.location) } : {}),
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
            })));
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
      current: item.current === true || projectDateIsCurrent(item.endDate),
      project_type: clean(item.projectType),
    }),
  );
  const explicitProjects = explicitProjectRecords(rawText);
  // The two source-backed readers may recover different assignments. Count
  // alone must not discard a distinct explicit project or a canonical one.
  // Match role, project/client and either the same period or both undated
  // records before deduplicating. Never copy employment dates to a project.
  const projects = mergeGroundedProjects(
    nested ? nested.projects : canonicalProjects,
    [
      ...explicitProjects,
      ...positioned.projects,
      ...embeddedSapEmploymentProjects(rawText),
    ],
    rawText,
  );
  for (const draft of datedSelectedProjectTitles(rawText)) {
    if (
      !projects.some(
        (row) =>
          projectKey(row.name) === projectKey(draft.name) &&
          careerMonthIndex(row.start_date) ===
            careerMonthIndex(draft.start_date) &&
          careerMonthIndex(row.end_date, projectDateIsCurrent(row.end_date)) ===
            careerMonthIndex(draft.end_date, draft.current),
      )
    )
      projects.push(draft);
  }
  const education = structuredEducation.length
    ? structuredEducation
    : positioned.education.length
      ? positioned.education
      : explicitEducation.length
        ? explicitEducation
        : canonical.education || [];
  const certifications = positioned.certifications.length
    ? positioned.certifications
    : explicitCertifications.length
      ? explicitCertifications
      : canonical.certifications || [];
  const languages = positioned.languages.length
    ? positioned.languages
    : explicitLanguageValues.length
      ? explicitLanguageValues
      : canonical.languages || [];
  const skills = unique([
    ...extractSapTaskSpecializations(rawText)
      .filter(
        (item) =>
          item.involvement === "delivery" ||
          item.involvement === "technical_delivery",
      )
      .map(
        (item) =>
          `SAP ${item.module === "CASH_MANAGEMENT" ? "Cash Management" : item.module}: ${item.specialization}${item.involvement === "technical_delivery" ? " (technical)" : ""}`,
      ),
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
    ...(nested
      ? {
          currentCompany: clean(currentExperience?.employer) || null,
          currentTitle: clean(currentExperience?.title) || null,
        }
      : {}),
    name:
      contactHeaderName(rawText) ||
      trackedName ||
      (full.extractedFullName && !full.isNameSuspicious
        ? full.extractedFullName
        : candidate.name),
    email: full.extractedEmail || candidate.email,
    phone:
      contactHeaderPhone(rawText) || full.extractedPhone || candidate.phone,
    linkedin_url: full.linkedInUrl || candidate.linkedin_url,
    location:
      explicitContactLocation(rawText) ||
      positioned.location ||
      (pipeCards.length ? "" : location),
    country:
      positioned.country ||
      (pipeCards.length ? "" : full.locationCountry || candidate.country),
    current_title:
      (nested ||
        labelledEmployment.length ||
        narrativeEmployment.length ||
        pipeCards.length) &&
      currentExperience
        ? currentExperience.title
        : full.extractedCurrentTitle && !full.isTitleSuspicious
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
    projects: projects.map(
      (row): Record<string, any> => ({
        ...row,
        project_type:
          clean(row.project_type) ||
          sapProjectTypeEvidence(
            `${clean(row.name)} ${clean(row.description)}`,
          ),
      }),
    ),
    project_history: projects.map(
      (row): Record<string, any> => ({
        ...row,
        project_type:
          clean(row.project_type) ||
          sapProjectTypeEvidence(
            `${clean(row.name)} ${clean(row.description)}`,
          ),
      }),
    ),
    project_types: unique([
      ...(candidate.project_types || []),
      ...(full.projectTypes || []),
    ]),
    education,
    certifications,
    languages,
    sap_task_evidence: extractSapTaskSpecializations(rawText),
    extraction_review_classification: full.reviewClassification,
    extraction_review_reasons: full.reviewReasons,
  };
}
