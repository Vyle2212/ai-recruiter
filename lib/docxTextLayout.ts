import * as mammoth from "mammoth";
type DocumentNode = {
  type?: string;
  value?: string;
  children?: DocumentNode[];
};

export function renderDocxText(node: DocumentNode): string {
  if (node.type === "text") return node.value || "";
  if (node.type === "tab") return "\t";
  if (node.type === "break") return "\n";
  if (node.type === "table") {
    let datedTable = false;
    return (node.children || [])
      .map((row) => {
        const cells = (row.children || []).map((cell) =>
          (cell.children || [])
            .map(renderDocxText)
            .map((x) => x.trim())
            .filter(Boolean),
        );
        if (
          cells.length === 3 &&
          cells.map((c) => c.join(" ")).join("|") === "Date|Company Name|Role"
        ) {
          datedTable = true;
          return "Date\tCompany Name\tRole\n";
        }
        if (
          datedTable &&
          cells.length === 3 &&
          cells[0].length &&
          cells.every((c) => c.length === cells[0].length) &&
          cells[0].every((s) =>
            /^(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+(?:19|20)\d{2}$/i.test(
              s,
            ),
          )
        ) {
          return (
            cells[0]
              .map((_, i) => cells.map((c) => c[i]).join("\t"))
              .join("\n") + "\n"
          );
        }
        datedTable = false;
        return renderDocxText(row);
      })
      .join("");
  }
  const text = (node.children || []).map(renderDocxText).join("");
  if (node.type === "paragraph") return text + "\n\n";
  return text;
}

export async function extractDocxText(buffer: Buffer): Promise<string> {
  let text = "";
  // extractRawText ignores Word line breaks. Read the document tree through
  // Mammoth's public transform hook, without converting images or emitting HTML.
  await mammoth.convertToHtml(
    { buffer },
    {
      transformDocument(document) {
        text = renderDocxText(document);
        return { ...document, children: [] };
      },
    },
  );
  return text;
}
