import fs from "node:fs";
import path from "node:path";
import type { AiExtractionStagingRecord } from "./aiExtractionStagingPreview";

export type AiExtractionStagingStoreFile = {
  mode: string;
  updatedAt: string;
  items: AiExtractionStagingRecord[];
};

export function stagingStorePath(baseDir = process.cwd()) {
  return path.join(baseDir, "reports", "ai-extraction-staging.json");
}

function emptyStore(): AiExtractionStagingStoreFile {
  return {
    mode: "local AI extraction staging store only; no candidate DB writes; no apply; no delete",
    updatedAt: "",
    items: [],
  };
}

export function loadStagingStore(baseDir = process.cwd()): AiExtractionStagingStoreFile {
  const filePath = stagingStorePath(baseDir);
  if (!fs.existsSync(filePath)) return emptyStore();
  try {
    const parsed = JSON.parse(fs.readFileSync(filePath, "utf8"));
    return {
      ...emptyStore(),
      ...parsed,
      items: Array.isArray(parsed?.items) ? parsed.items : [],
    };
  } catch {
    return emptyStore();
  }
}

export function writeStagingStore(items: AiExtractionStagingRecord[], baseDir = process.cwd()) {
  const filePath = stagingStorePath(baseDir);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const store: AiExtractionStagingStoreFile = {
    ...emptyStore(),
    updatedAt: new Date().toISOString(),
    items: items.map((item) => ({ ...item, appliedToCandidate: false as const })),
  };
  fs.writeFileSync(filePath, `${JSON.stringify(store, null, 2)}\n`);
  return store;
}

export function stageApprovedChanges(items: AiExtractionStagingRecord[], options: { dryRun?: boolean; writeStaging?: boolean; baseDir?: string } = {}) {
  const dryRun = options.dryRun !== false || !options.writeStaging;
  if (dryRun) {
    return {
      mode: "dry-run staging only; no staging file write; no candidate DB writes",
      dryRun: true,
      stagedCount: items.length,
      rejectedCount: 0,
      outputPath: stagingStorePath(options.baseDir),
      store: null,
    };
  }
  const store = writeStagingStore(items, options.baseDir);
  return {
    mode: "local staging write only; no candidate DB writes; no apply; no delete",
    dryRun: false,
    stagedCount: store.items.length,
    rejectedCount: 0,
    outputPath: stagingStorePath(options.baseDir),
    store,
  };
}
