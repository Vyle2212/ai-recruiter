import { careerMonthIndex } from "./candidateCareerExperience";
import { projectDateIsCurrent, projectDateRange } from "./projectDateEvidence";

const PROJECT_CLIENT_LABEL = "(?:End\\s+)?(?:Client|Customer)(?:\\s+Name)?";
const PROJECT_FIELD_LABELS = `Project(?:\\s+(?:Name|Title))?|${PROJECT_CLIENT_LABEL}|Role|Position|Designation|Project\\s+Duration|Duration|Period|From\\s*\\/\\s*To|Roles?\\s*(?:&|and)\\s*Responsibilities|Responsibilities|Scope|Activities|Environment|System|Platform`;
const PROJECT_INLINE_SEPARATOR = "[|;•·]";
function cleanProjectCardValue(value: string) {
  return value
    .split(
      new RegExp(
        `${PROJECT_INLINE_SEPARATOR}\\s*(?=(?:${PROJECT_FIELD_LABELS})\\s*:)`,
        "i",
      ),
    )[0]
    .replace(new RegExp(`(?:\\s*${PROJECT_INLINE_SEPARATOR})+$`), "")
    .trim();
}

// Only explicit adjacent PDF labels form a card. A nearby employment date or
// an unrelated client line must not complete a partial assignment.
export function nativeProjectCards(source: string) {
  const heading = source.search(
    /^\s*(?:DETAILED WORK EXPERIENCES|PROJECT (?:PROFILE|HISTORY|EXPERIENCES?))\s*:?\s*$/im,
  );
  const output = [];
  const pattern = new RegExp(
    `^Project\\s*:[ \\t]*([^\\n]+)\\n[ \\t]*Environment\\s*:[ \\t]*([^\\n]+)\\n[ \\t]*${PROJECT_CLIENT_LABEL}\\s*:[ \\t]*([^\\n]+)\\n[ \\t]*(?:Project\\s+)?Duration\\s*:[ \\t]*([^\\n]+)\\n[ \\t]*Roles?\\s*&\\s*Responsibilities\\s*:[ \\t]*\\n[ \\t]*[•●▪-][ \\t]*([^\\n]+)`,
    "gim",
  );
  const bounded =
    heading < 0
      ? ""
      : source
          .slice(heading)
          .replace(/^\s*Page\s+\d+\s+of\s+\d+\s*$/gim, "")
          .split(
            /^\s*(?:EDUCATION|ACADEMIC QUALIFICATIONS|REFERENCES|PERSONAL DETAILS)\s*:?\s*$/im,
          )[0];
  for (const match of bounded.matchAll(pattern)) {
    const dates = projectDateRange(match[4].trim());
    if (!dates) continue;
    const start = careerMonthIndex(dates[1]);
    const end = careerMonthIndex(dates[2], projectDateIsCurrent(dates[2]));
    if (start === null || end === null || start > end) continue;
    const prefix = bounded.slice(0, match.index).trimEnd();
    const role =
      prefix.match(/(?:^|\n)Role\s*:[ \t]*([^\n]+)$/i)?.[1]?.trim() || "";
    const name = match[1].trim(),
      environment = match[2].trim(),
      client = match[3].trim();
    const responsibility = match[5].trim().replace(/\s+/g, " ");
    if (
      !/\b(?:support|implement|rollout|migration|upgrade|enhancement|integration)\b/i.test(
        name + " " + responsibility,
      )
    )
      continue;
    output.push({
      name,
      environment,
      client,
      role,
      start: dates[1],
      end: dates[2],
      responsibility,
      excerpt: match[0],
    });
  }
  const broadHeading = source.search(
    /^\s*(?:PROJECTS?|PROJECT\s+(?:PROFILE|HISTORY|EXPERIENCES?|DETAILS|PORTFOLIO))\s*:?\s*$/im,
  );
  if (broadHeading >= 0) {
    const broadSection = source
      .slice(broadHeading)
      .replace(/^\s*Page\s+\d+\s+of\s+\d+\s*$/gim, "")
      .split(
        /^\s*(?:EDUCATION|ACADEMIC QUALIFICATIONS|CERTIFICATIONS?|SKILLS|LANGUAGES|REFERENCES|PERSONAL DETAILS)\s*:?\s*$/im,
      )[0];
    const projectAnchors = [
      ...broadSection.matchAll(
        /^\s*(?:Project(?:\s+(?:Name|Title))?)\s*:\s*(?:\S.*)?$/gim,
      ),
    ];
    const anchors = projectAnchors.length
      ? projectAnchors
      : [
          ...broadSection.matchAll(
            new RegExp(
              `^\\s*(?:${PROJECT_CLIENT_LABEL})\\s*:\\s*(?:\\S.*)?$`,
              "gim",
            ),
          ),
        ];
    const value = (block: string, label: string) => {
      const matched = block
        .match(
          new RegExp(
            `^\\s*(?:${label})\\s*:\\s*(?:([^\\n]+)|\\n\\s*([^\\n]+))`,
            "im",
          ),
        )
        ?.slice(1)
        .find((item) => item?.trim())
        ?.trim();
      return matched ? cleanProjectCardValue(matched) : "";
    };
    const range = (block: string) => {
      const labelled = value(
        block,
        "Project\\s+Duration|Duration|Period|From\\s*\\/\\s*To",
      );
      const text = labelled || block;
      return projectDateRange(text);
    };
    anchors.forEach((anchor, index) => {
      const startOffset = anchor.index || 0;
      const block = broadSection.slice(
        startOffset,
        anchors[index + 1]?.index ?? broadSection.length,
      );
      if (block.length > 3000) return;
      const name = value(block, "Project(?:\\s+(?:Name|Title))?");
      const client = value(block, PROJECT_CLIENT_LABEL);
      const role = value(block, "Role|Position|Designation");
      const dates = range(block);
      const responsibility = value(
        block,
        "Roles?\\s*(?:&|and)\\s*Responsibilities|Responsibilities|Scope|Activities",
      );
      const deliveryText = `${name} ${role} ${responsibility} ${block}`;
      if (
        !client ||
        !role ||
        !dates ||
        !/\bSAP\b/i.test(deliveryText) ||
        !/\b(?:support|implement|rollout|migration|upgrade|enhancement|integration|configuration|testing|cutover|go-live|deployment)\b/i.test(
          deliveryText,
        )
      )
        return;
      const from = careerMonthIndex(dates[1]);
      const to = careerMonthIndex(dates[2], projectDateIsCurrent(dates[2]));
      if (from === null || to === null || from > to) return;
      output.push({
        name,
        environment: value(block, "Environment|System|Platform"),
        client,
        role,
        start: dates[1],
        end: dates[2],
        responsibility,
        excerpt: block,
      });
    });

    const inlineSection = broadSection.replace(/\s+/g, " ");
    const inlineProjectAnchors = [
      ...inlineSection.matchAll(/\bProject(?:\s+(?:Name|Title))?\s*:/gi),
    ];
    const inlineAnchors = inlineProjectAnchors.length
      ? inlineProjectAnchors
      : [
          ...inlineSection.matchAll(
            new RegExp(`\\b(?:${PROJECT_CLIENT_LABEL})\\s*:`, "gi"),
          ),
        ];
    const inlineValue = (block: string, label: string) =>
      block
        .match(
          new RegExp(
            `\\b(?:${label})\\s*:\\s*([\\s\\S]{1,300}?)(?=(?:\\s+|${PROJECT_INLINE_SEPARATOR}\\s*)\\b(?:${PROJECT_FIELD_LABELS})\\s*:|$)`,
            "i",
          ),
        )?.[1]
        ?.trim() || "";
    inlineAnchors.forEach((anchor, index) => {
      const block = inlineSection.slice(
        anchor.index || 0,
        inlineAnchors[index + 1]?.index ?? inlineSection.length,
      );
      if (block.length > 3000) return;
      const name = inlineValue(block, "Project(?:\\s+(?:Name|Title))?");
      const client = inlineValue(block, PROJECT_CLIENT_LABEL);
      const role = inlineValue(block, "Role|Position|Designation");
      const duration = inlineValue(
        block,
        "Project\\s+Duration|Duration|Period|From\\s*\\/\\s*To",
      );
      const dates = projectDateRange(duration || block);
      const responsibility = inlineValue(
        block,
        "Roles?\\s*(?:&|and)\\s*Responsibilities|Responsibilities|Scope|Activities",
      );
      const deliveryText = `${name} ${role} ${responsibility} ${block}`;
      if (
        !client ||
        !role ||
        !dates ||
        !/\bSAP\b/i.test(deliveryText) ||
        !/\b(?:support|implement|rollout|migration|upgrade|enhancement|integration|configuration|testing|cutover|go-live|deployment)\b/i.test(
          deliveryText,
        )
      )
        return;
      const from = careerMonthIndex(dates[1]);
      const to = careerMonthIndex(dates[2], projectDateIsCurrent(dates[2]));
      if (from === null || to === null || from > to) return;
      output.push({
        name,
        environment: inlineValue(block, "Environment|System|Platform"),
        client,
        role,
        start: dates[1],
        end: dates[2],
        responsibility,
        excerpt: block,
      });
    });
  }
  return [
    ...new Map(
      output.map((card) => [
        [card.name, card.client, card.role, card.start, card.end]
          .join("|")
          .toLowerCase(),
        card,
      ]),
    ).values(),
  ];
}
