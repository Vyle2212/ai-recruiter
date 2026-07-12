import fs from "node:fs";
import path from "node:path";
import type { QuickFixRepairSuggestionFile } from "./quickFixRepairTypes";
import { summarizeQuickFixRepair } from "./quickFixRepairSummary";
import { writeWorkflowJson } from "./recruiterWorkflowStore";

function readJson(filePath: string) {
  const fullPath = path.resolve(filePath);
  if (!fs.existsSync(fullPath)) return null;
  try { return JSON.parse(fs.readFileSync(fullPath, "utf8")); } catch { return null; }
}

export function buildQuickFixRepairReview(suggestionsFile: QuickFixRepairSuggestionFile) {
  return {
    generatedAt: new Date().toISOString(),
    mode: "quick fix repair review file; no candidate DB writes; no approvals write; no staging; no apply; no OpenAI calls",
    summary: suggestionsFile.summary,
    suggestions: suggestionsFile.suggestions,
  };
}

export function loadQuickFixRepairSuggestions(suggestionsPath = path.join("reports", "quick-fix-repair-suggestions.json")): QuickFixRepairSuggestionFile {
  const parsed = readJson(suggestionsPath);
  const suggestions = Array.isArray(parsed?.suggestions) ? parsed.suggestions : [];
  return {
    generatedAt: parsed?.generatedAt || "",
    mode: parsed?.mode || "quick fix suggestions not found; no candidate DB writes",
    candidatesProcessed: Number(parsed?.candidatesProcessed || 0),
    suggestions,
    summary: parsed?.summary || summarizeQuickFixRepair(suggestions, Number(parsed?.candidatesProcessed || 0)),
  };
}

export function writeQuickFixRepairReview(suggestionsFile: QuickFixRepairSuggestionFile, outputPath = path.join("reports", "quick-fix-repair-review.json")) {
  return writeWorkflowJson(outputPath, buildQuickFixRepairReview(suggestionsFile));
}
