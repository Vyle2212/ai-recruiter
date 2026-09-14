export const SPREADSHEET_EXPORT_LIMITS = {
  sheets: 12,
  rowsPerSheet: 5_000,
  columnsPerSheet: 100,
  charactersPerCell: 32_000,
  charactersPerWorkbook: 5_000_000,
} as const;

export type SpreadsheetCell =
  | string
  | number
  | boolean
  | Date
  | null
  | undefined;

export type SpreadsheetSheet = {
  name: string;
  rows: SpreadsheetCell[][];
  headerRow?: number;
  widths?: number[];
};

const FORMULA_PREFIX = /^[\p{Z}\s]*[=+\-@]/u;
const UNSAFE_CONTROL = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g;

export function sanitizeSpreadsheetCell(
  value: SpreadsheetCell,
): SpreadsheetCell {
  if (value instanceof Date && Number.isNaN(value.getTime())) return null;
  if (typeof value !== "string") return value;
  const cleaned = value
    .normalize("NFKC")
    .replace(UNSAFE_CONTROL, "")
    .slice(0, SPREADSHEET_EXPORT_LIMITS.charactersPerCell);
  return FORMULA_PREFIX.test(cleaned) ? `'${cleaned}` : cleaned;
}

function sanitizeSheetName(name: string, index: number) {
  const cleaned = name
    .normalize("NFKC")
    .replace(/[\\/?*\[\]:]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return (cleaned || `Sheet ${index + 1}`).slice(0, 31);
}

export function prepareSpreadsheetSheets<T extends SpreadsheetSheet>(
  sheets: T[],
): T[] {
  if (sheets.length > SPREADSHEET_EXPORT_LIMITS.sheets)
    throw new Error("Spreadsheet export exceeds the supported sheet limit.");
  let workbookCharacters = 0;
  const names = new Set<string>();

  return sheets.map((sheet, sheetIndex) => {
    if (sheet.rows.length > SPREADSHEET_EXPORT_LIMITS.rowsPerSheet)
      throw new Error("Spreadsheet export exceeds the supported row limit.");
    const name = sanitizeSheetName(sheet.name, sheetIndex);
    const foldedName = name.toLocaleLowerCase("en");
    if (names.has(foldedName))
      throw new Error("Spreadsheet export contains duplicate sheet names.");
    names.add(foldedName);

    const rows = sheet.rows.map((row) => {
      if (row.length > SPREADSHEET_EXPORT_LIMITS.columnsPerSheet)
        throw new Error(
          "Spreadsheet export exceeds the supported column limit.",
        );
      return row.map((value) => {
        const safeValue = sanitizeSpreadsheetCell(value);
        if (typeof safeValue === "string")
          workbookCharacters += safeValue.length;
        if (
          workbookCharacters > SPREADSHEET_EXPORT_LIMITS.charactersPerWorkbook
        ) {
          throw new Error(
            "Spreadsheet export exceeds the supported content limit.",
          );
        }
        return safeValue;
      });
    });
    return { ...sheet, name, rows };
  });
}

function styledCell(
  value: SpreadsheetCell,
  rowIndex: number,
  headerRow: number,
): Cell {
  const isTitle = rowIndex === 0;
  const isHeader = rowIndex === headerRow;
  const text = String(value ?? "");
  const percentage = /%$/.test(text) ? Number(text.slice(0, -1)) : Number.NaN;
  const backgroundColor =
    isTitle || isHeader
      ? "#0F172A"
      : /shortlisted/i.test(text)
        ? "#DCFCE7"
        : /high/i.test(text)
          ? "#FEE2E2"
          : /medium/i.test(text)
            ? "#FEF3C7"
            : /low/i.test(text)
              ? "#DCFCE7"
              : Number.isFinite(percentage)
                ? percentage >= 90
                  ? "#DCFCE7"
                  : percentage >= 80
                    ? "#FEF3C7"
                    : "#FCE7F3"
                : undefined;
  return {
    value: value ?? "",
    fontFamily: "Aptos",
    fontSize: isTitle ? 14 : 10,
    fontWeight: isTitle || isHeader ? "bold" : undefined,
    textColor: isTitle || isHeader ? "#FFFFFF" : "#0F172A",
    backgroundColor,
    borderColor: "#CBD5E1",
    borderStyle: "thin",
    wrap: true,
    alignVertical: "top",
  };
}

export async function writeSafeSpreadsheetFile(
  sheets: SpreadsheetSheet[],
  fileName: string,
) {
  const prepared = prepareSpreadsheetSheets(sheets);
  const output: Sheet<Blob>[] = prepared.map((sheet) => ({
    sheet: sheet.name,
    data: sheet.rows.map((row, rowIndex) =>
      row.map((value) => styledCell(value, rowIndex, sheet.headerRow ?? 0)),
    ),
    columns: (sheet.widths || []).map((width) => ({ width })),
    stickyRowsCount: (sheet.headerRow ?? 0) + 1,
  }));
  await writeXlsxFile(output).toFile(fileName);
}
import writeXlsxFile, { type Cell, type Sheet } from "write-excel-file/browser";
