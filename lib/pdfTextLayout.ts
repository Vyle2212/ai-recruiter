type TextItem = {
  str: string;
  transform: number[];
  width: number;
  height?: number;
};

/** PDF content-stream order is not reading order. Keep visible rows and cell gaps. */
export function renderPdfTextItems(items: TextItem[]): string {
  const sorted = items
    .filter(
      (item) =>
        typeof item.str === "string" &&
        item.str.trim() &&
        Number.isFinite(item.transform?.[4]) &&
        Number.isFinite(item.transform?.[5]),
    )
    .sort(
      (a, b) =>
        b.transform[5] - a.transform[5] || a.transform[4] - b.transform[4],
    );
  const rows: { y: number; items: TextItem[] }[] = [];
  for (const item of sorted) {
    const row = rows.at(-1);
    if (row && Math.abs(row.y - item.transform[5]) <= 2) row.items.push(item);
    else rows.push({ y: item.transform[5], items: [item] });
  }
  return rows
    .map((row) => {
      row.items.sort((a, b) => a.transform[4] - b.transform[4]);
      let text = "",
        end = 0;
      for (const item of row.items) {
        const gap = item.transform[4] - end;
        const fontSize =
          Math.hypot(item.transform[2], item.transform[3]) || item.height || 10;
        if (text && gap > fontSize * 1.5) text += "\t";
        else if (
          text &&
          gap > fontSize * 0.15 &&
          !/\s$/.test(text) &&
          !/^\s/.test(item.str)
        )
          text += " ";
        text += item.str;
        end = item.transform[4] + item.width;
      }
      return text.trim();
    })
    .join("\n");
}

type PdfPage = {
  getTextContent: (options: {
    includeMarkedContent: false;
    disableNormalization: false;
  }) => Promise<{ items: Array<TextItem | { type: string }> }>;
  cleanup?: () => void;
};
const compact = (items: TextItem[]) =>
  renderPdfTextItems(items).replace(/\s+/g, " ").trim();

/** Split a sidebar only at a positioned, explicit employment heading. */
function renderEmploymentColumns(items: TextItem[]): string | undefined {
  const ys = [...new Set(items.map((x) => x.transform[5]))].sort(
    (a, b) => b - a,
  );
  const minX = Math.min(
    ...items.filter((x) => x.str.trim()).map((x) => x.transform[4]),
  );
  for (const y of ys) {
    const row = items
      .filter((x) => Math.abs(x.transform[5] - y) <= 2)
      .sort((a, b) => a.transform[4] - b.transform[4]);
    for (let first = 0; first < row.length; first++) {
      if (!/[a-z]/i.test(row[first].str)) continue;
      let label = "";
      for (let last = first; last < row.length && label.length <= 24; last++) {
        label += row[last].str.replace(/[^a-z]/gi, "").toUpperCase();
        if (label !== "WORKEXPERIENCE" && label !== "PROFESSIONALEXPERIENCE")
          continue;
        const x = row[first].transform[4];
        if (x < minX + 100) continue;
        const below = items.filter((item) => item.transform[5] <= y + 2);
        const left = below.filter((item) => item.transform[4] < x - 3);
        const right = below.filter((item) => item.transform[4] >= x - 3);
        // Require independent sidebar sections, not an indented employment heading.
        if (
          !renderPdfTextItems(left)
            .split("\n")
            .some((s) =>
              /^(?:EDUCATION|SKILLS|LANGUAGES|SUMMARYOFQUALIFICATIONS)$/i.test(
                s.replace(/[^a-z]/gi, ""),
              ),
            )
        )
          continue;
        return [
          renderPdfTextItems(items.filter((item) => item.transform[5] > y + 2)),
          renderPdfTextItems(left),
          renderPdfTextItems(right),
        ].join("\n");
      }
    }
  }
}

/** Keep cells in explicit employment tables together instead of interleaving prose. */
export function createCvPdfRenderer() {
  let scopeTable = false;
  return async (page: PdfPage) => {
    const content = await page.getTextContent({
      includeMarkedContent: false,
      disableNormalization: false,
    });
    const items = content.items.filter(
      (item): item is TextItem =>
        "str" in item && "transform" in item && "width" in item,
    );
    const plain = renderPdfTextItems(items);
    const columns = renderEmploymentColumns(items);
    if (columns) return columns;
    const scopeHeader = items.find((x) => /^Scope of\s*$/.test(x.str));
    if (
      /Name of Company/.test(plain) &&
      /Scope of\s+Work/.test(plain) &&
      /Year/.test(plain)
    )
      scopeTable = true;
    const starts = items
      .filter((x) => /^Roles & Responsibilities\s*$/.test(x.str))
      .sort((a, b) => b.transform[5] - a.transform[5]);
    if (scopeTable && starts.length) {
      const output = [
        renderPdfTextItems(
          items.filter(
            (x) =>
              x.transform[5] >
              (scopeHeader?.transform[5] ?? starts[0].transform[5]) + 2,
          ),
        ),
        "Name of Company\tScope of Work\tYear",
      ];
      for (let i = 0; i < starts.length; i++) {
        const block = items.filter(
          (x) =>
            x.transform[5] <= starts[i].transform[5] + 2 &&
            x.transform[5] > (starts[i + 1]?.transform[5] ?? -Infinity) + 2,
        );
        const scopeX = starts[i].transform[4];
        const dated = block.find(
          (x) =>
            x.transform[4] > scopeX + 80 &&
            /(?:19|20)\d{2}\s*[–—-]/.test(x.str),
        );
        if (!dated) {
          output.push(renderPdfTextItems(block));
          continue;
        }
        const dateX = dated.transform[4];
        output.push(
          [
            compact(block.filter((x) => x.transform[4] < scopeX - 2)),
            compact(
              block.filter(
                (x) =>
                  x.transform[4] >= scopeX - 2 && x.transform[4] < dateX - 2,
              ),
            ),
            compact(block.filter((x) => x.transform[4] >= dateX - 2)),
          ].join("\t"),
        );
      }
      return output.join("\n");
    }
    // Five-column Year / Employer / Role / Responsibilities / Years-in-company.
    if (
      /EMPLOYMENT HISTORY/.test(plain) &&
      /Employer\s*\//.test(plain) &&
      /Years in/.test(plain)
    ) {
      const roleHeader = items.find((x) => /^Role\s*$/.test(x.str));
      const first = items
        .filter(
          (x) =>
            roleHeader &&
            x.transform[5] < roleHeader.transform[5] - 20 &&
            /^(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s*$/.test(
              x.str,
            ),
        )
        .sort((a, b) => b.transform[5] - a.transform[5])[0];
      const anchors =
        first &&
        items
          .filter(
            (x) =>
              Math.abs(x.transform[5] - first.transform[5]) < 2 && x.str.trim(),
          )
          .sort((a, b) => a.transform[4] - b.transform[4]);
      if (first && anchors?.length === 5) {
        const rows = items
          .filter(
            (x) =>
              Math.abs(x.transform[4] - first.transform[4]) < 2 &&
              x.transform[5] <= first.transform[5] &&
              /^(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s*$/.test(
                x.str,
              ),
          )
          .sort((a, b) => b.transform[5] - a.transform[5]);
        const footers = items.filter((x) =>
          /^Page\s+\d+\s+of\s+\d+/i.test(x.str.trim()),
        );
        return [
          renderPdfTextItems(
            items.filter((x) => x.transform[5] > first.transform[5] + 2),
          ),
          "Year\tEmployer / Company\tRole\tResponsibilities\tYears in Company",
          ...rows.map((row, i) =>
            anchors
              .map((anchor, c) =>
                compact(
                  items.filter(
                    (x) =>
                      !footers.includes(x) &&
                      x.transform[5] <= row.transform[5] + 2 &&
                      x.transform[5] >
                        (rows[i + 1]?.transform[5] ?? -Infinity) + 2 &&
                      x.transform[4] >= anchor.transform[4] - 2 &&
                      x.transform[4] <
                        (anchors[c + 1]?.transform[4] ?? Infinity) - 2,
                  ),
                ),
              )
              .join("\t"),
          ),
          renderPdfTextItems(footers),
        ].join("\n");
      }
    }
    return plain;
  };
}
