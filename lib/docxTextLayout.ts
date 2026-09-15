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
