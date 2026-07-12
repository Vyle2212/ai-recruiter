import fs from "node:fs";
import path from "node:path";
import type { RecruiterWorkflowState } from "./recruiterWorkflowTypes";

export type RecruiterWorkflowStoreFile = {
  mode: string;
  updatedAt: string;
  states: RecruiterWorkflowState[];
};

export function recruiterWorkflowStatePath(baseDir = process.cwd()) {
  return path.join(baseDir, "reports", "recruiter-workflow-state.json");
}

export function emptyWorkflowStore(): RecruiterWorkflowStoreFile {
  return { mode: "local workflow state only; no candidate DB writes; no delete; no OpenAI calls", updatedAt: "", states: [] };
}

export function loadRecruiterWorkflowStore(baseDir = process.cwd()): RecruiterWorkflowStoreFile {
  const filePath = recruiterWorkflowStatePath(baseDir);
  if (!fs.existsSync(filePath)) return emptyWorkflowStore();
  try {
    const parsed = JSON.parse(fs.readFileSync(filePath, "utf8"));
    return { ...emptyWorkflowStore(), ...parsed, states: Array.isArray(parsed?.states) ? parsed.states : [] };
  } catch {
    return emptyWorkflowStore();
  }
}

export function writeRecruiterWorkflowStore(states: RecruiterWorkflowState[], baseDir = process.cwd()) {
  const filePath = recruiterWorkflowStatePath(baseDir);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const store = { ...emptyWorkflowStore(), updatedAt: new Date().toISOString(), states };
  fs.writeFileSync(filePath, `${JSON.stringify(store, null, 2)}\n`);
  return { store, path: filePath };
}

export function writeWorkflowJson(filePath: string, data: unknown) {
  const fullPath = path.resolve(filePath);
  fs.mkdirSync(path.dirname(fullPath), { recursive: true });
  fs.writeFileSync(fullPath, `${JSON.stringify(data, null, 2)}\n`);
  return fullPath;
}
