import { CvSourceError } from "./cvPdfOcr";
import type { CvSourceExtraction } from "./cvPdfExtraction";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";

type TextEncoding = "utf8" | "utf16le" | "utf16be";

export type CvTextDocumentExtractionOptions = {
  extractDoc?: (buffer: Buffer) => Promise<string>;
  extractDocx?: (buffer: Buffer) => Promise<string>;
};

const OLE_COMPOUND_FILE_MAGIC = Buffer.from([
  0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1,
]);
const RTF_MAGIC = /^\{\\rtf\d(?:[\s\\{}]|$)/;
const MAX_RTF_TEXT_LENGTH = 1024 * 1024;

function sourceError(code: string, message: string): never {
  throw new CvSourceError(code, message);
}

function utf16WithoutBom(buffer: Buffer): TextEncoding | null {
  const sampleLength = Math.min(buffer.length - (buffer.length % 2), 4096);
  if (sampleLength < 8) return null;

  let evenNulls = 0;
  let oddNulls = 0;
  for (let index = 0; index < sampleLength; index += 2) {
    if (buffer[index] === 0) evenNulls++;
    if (buffer[index + 1] === 0) oddNulls++;
  }
  const pairs = sampleLength / 2;
  if (oddNulls / pairs >= 0.2 && evenNulls / pairs <= 0.05) return "utf16le";
  if (evenNulls / pairs >= 0.2 && oddNulls / pairs <= 0.05) return "utf16be";
  return null;
}

function decodeUtf16Be(buffer: Buffer): string {
  if (buffer.length % 2)
    sourceError(
      "CV_SOURCE_TEXT_ENCODING_INVALID",
      "The TXT encoding is incomplete. The original file needs review; no partial CV was saved.",
    );
  const littleEndian = Buffer.from(buffer);
  littleEndian.swap16();
  return littleEndian.toString("utf16le");
}

function validateReadableText(text: string, code: string): string {
  const withoutBom = text.replace(/^\uFEFF/, "");
  const replacements = (withoutBom.match(/\uFFFD/g) || []).length;
  const invalidControls = Array.from(withoutBom).filter((character) => {
    const value = character.charCodeAt(0);
    return value < 32 && ![9, 10, 12, 13].includes(value);
  }).length;

  if (
    !withoutBom.trim() ||
    replacements >= Math.max(3, Math.ceil(withoutBom.length * 0.005)) ||
    invalidControls >= Math.max(3, Math.ceil(withoutBom.length * 0.005))
  )
    sourceError(
      code,
      "The document did not contain reliably readable CV text. The original file needs review; no partial CV was saved.",
    );

  return withoutBom;
}

async function extractLegacyDocText(buffer: Buffer): Promise<string> {
  const { default: WordExtractor } = await import("word-extractor");
  const document = await new WordExtractor().extract(buffer);
  const sections = [
    document.getHeaders(),
    document.getBody(),
    document.getTextboxes({
      includeHeadersAndFooters: true,
      includeBody: true,
    }),
  ]
    .map((section) => section.trim())
    .filter((section, index, all) => section && all.indexOf(section) === index);
  return sections.join("\n");
}

async function extractRtfText(buffer: Buffer): Promise<string> {
  if (!RTF_MAGIC.test(buffer.subarray(0, 64).toString("latin1")))
    sourceError(
      "CV_SOURCE_RTF_INVALID",
      "The RTF document is invalid. The original file needs review; no partial CV was saved.",
    );
  try {
    const { initSync, parse_rtf } = await import("rtf-parser-wasm");
    initSync({
      module: readFileSync(
        join(
          dirname(require.resolve("rtf-parser-wasm/package.json")),
          "rtf_parser_bg.wasm",
        ),
      ),
    });
    const document = parse_rtf(buffer.toString("latin1"));
    try {
      const parts = document.body.map((block) => block.text);
      // Some RTF documents embed an image as one enormous hexadecimal text
      // block. It is neither readable CV text nor evidence for a profile.
      const text = parts
        .map((part) => part.replace(/[a-f0-9]{1024,}/gi, ""))
        .filter(Boolean)
        .join("\n");
      if (text.length > MAX_RTF_TEXT_LENGTH)
        sourceError(
          "CV_SOURCE_RTF_TEXT_INVALID",
          "The RTF text is too large to verify safely. The original file needs review; no partial CV was saved.",
        );
      return validateReadableText(text, "CV_SOURCE_RTF_TEXT_INVALID");
    } finally {
      document.free();
    }
  } catch (error) {
    if (error instanceof CvSourceError) throw error;
    sourceError(
      "CV_SOURCE_RTF_INVALID",
      "The RTF document could not be read safely. The original file needs review; no partial CV was saved.",
    );
  }
}

export function decodeCvTxt(buffer: Buffer): {
  text: string;
  encoding: TextEncoding;
} {
  if (!buffer.length)
    sourceError(
      "CV_SOURCE_TEXT_INVALID",
      "The TXT file is empty. The original file needs review; no partial CV was saved.",
    );

  let encoding: TextEncoding = "utf8";
  let bytes = buffer;
  if (buffer[0] === 0xff && buffer[1] === 0xfe) {
    encoding = "utf16le";
    bytes = buffer.subarray(2);
  } else if (buffer[0] === 0xfe && buffer[1] === 0xff) {
    encoding = "utf16be";
    bytes = buffer.subarray(2);
  } else if (buffer[0] === 0xef && buffer[1] === 0xbb && buffer[2] === 0xbf) {
    bytes = buffer.subarray(3);
  } else {
    encoding = utf16WithoutBom(buffer) || "utf8";
  }

  let text: string;
  try {
    if (encoding === "utf16be") text = decodeUtf16Be(bytes);
    else if (encoding === "utf16le") {
      if (bytes.length % 2) throw new Error("incomplete UTF-16LE code unit");
      text = bytes.toString("utf16le");
    } else {
      text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    }
  } catch {
    sourceError(
      "CV_SOURCE_TEXT_ENCODING_INVALID",
      "The TXT encoding could not be read safely. Save it as UTF-8 or UTF-16 and upload it again; no partial CV was saved.",
    );
  }

  return {
    text: validateReadableText(text!, "CV_SOURCE_TEXT_INVALID"),
    encoding,
  };
}

export async function extractCvTextDocument(
  buffer: Buffer,
  fileName: string,
  options: CvTextDocumentExtractionOptions = {},
): Promise<{ text: string; sourceExtraction: CvSourceExtraction }> {
  const extension = fileName.toLowerCase().split(".").pop();
  if (extension === "txt") {
    const decoded = decodeCvTxt(buffer);
    return {
      text: decoded.text,
      sourceExtraction: {
        method: "native",
        pageCount: 0,
        reason:
          decoded.encoding === "utf8"
            ? ""
            : `TXT_${decoded.encoding.toUpperCase()}`,
      },
    };
  }

  if (extension === "docx") {
    try {
      const extractDocx =
        options.extractDocx ||
        (await import("./docxTextLayout")).extractDocxText;
      return {
        text: validateReadableText(
          await extractDocx(buffer),
          "CV_SOURCE_DOCX_TEXT_INVALID",
        ),
        sourceExtraction: { method: "native", pageCount: 0, reason: "" },
      };
    } catch (error) {
      if (error instanceof CvSourceError) throw error;
      sourceError(
        "CV_SOURCE_DOCX_INVALID",
        "The DOCX file could not be read safely. The original file needs review; no partial CV was saved.",
      );
    }
  }

  if (extension === "doc") {
    if (RTF_MAGIC.test(buffer.subarray(0, 64).toString("latin1")))
      return {
        text: await extractRtfText(buffer),
        sourceExtraction: {
          method: "native",
          pageCount: 0,
          reason: "LEGACY_DOC_RTF_NATIVE",
        },
      };
    if (
      buffer.length < OLE_COMPOUND_FILE_MAGIC.length ||
      !buffer
        .subarray(0, OLE_COMPOUND_FILE_MAGIC.length)
        .equals(OLE_COMPOUND_FILE_MAGIC)
    )
      sourceError(
        "CV_SOURCE_DOC_INVALID",
        "The DOC file is not a valid Word binary document. The original file needs review; no partial CV was saved.",
      );
    try {
      const extractDoc = options.extractDoc || extractLegacyDocText;
      return {
        text: validateReadableText(
          await extractDoc(buffer),
          "CV_SOURCE_DOC_TEXT_INVALID",
        ),
        sourceExtraction: {
          method: "native",
          pageCount: 0,
          reason: "LEGACY_DOC_NATIVE",
        },
      };
    } catch (error) {
      if (error instanceof CvSourceError) throw error;
      sourceError(
        "CV_SOURCE_DOC_INVALID",
        "The DOC file could not be read safely. The original file needs review; no partial CV was saved.",
      );
    }
  }

  if (extension === "rtf")
    return {
      text: await extractRtfText(buffer),
      sourceExtraction: {
        method: "native",
        pageCount: 0,
        reason: "RTF_NATIVE",
      },
    };

  return sourceError(
    "CV_SOURCE_UNSUPPORTED",
    "Only PDF, DOCX, DOC, RTF, and TXT CV files are supported. No candidate data was saved.",
  );
}
