import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

export type WorkflowActionPinViolation = {
  workflowPath: string;
  action: string;
  violationType:
    | "expression_ref"
    | "missing_ref"
    | "short_sha"
    | "mutable_ref"
    | "invalid_remote_action"
    | "docker_not_digest_pinned"
    | "unsupported_uses_syntax";
};

type UsesEntry = {
  workflowPath: string;
  line: number;
  value: string;
};

const fullSha = /^[a-f0-9]{40}$/i;
const dockerDigest = /^docker:\/\/[a-z0-9][a-z0-9._/-]*@sha256:[a-f0-9]{64}$/i;

function withoutYamlComment(line: string) {
  let quote = "";
  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    if (quote) {
      if (character === quote && line[index - 1] !== "\\") quote = "";
      continue;
    }
    if (character === '"' || character === "'") {
      quote = character;
      continue;
    }
    if (character === "#") return line.slice(0, index);
  }
  return line;
}

function scalarAfterUses(line: string) {
  const key = /(?:^|[\s{,\-])(?:"uses"|'uses'|uses)\s*:\s*/g;
  const match = key.exec(line);
  if (!match) return null;
  let scalar = line.slice(match.index + match[0].length).trim();
  if (!scalar) return "";
  if (scalar[0] === '"' || scalar[0] === "'") {
    const quote = scalar[0];
    let end = 1;
    while (end < scalar.length) {
      if (scalar[end] === quote && scalar[end - 1] !== "\\") break;
      end += 1;
    }
    if (end === scalar.length) return "__unsupported_yaml_scalar__";
    return scalar.slice(1, end);
  }
  scalar = scalar.split(/[},\s]/, 1)[0];
  return scalar;
}

export function workflowUsesEntries(source: string, workflowPath: string) {
  const entries: UsesEntry[] = [];
  source.split(/\r?\n/).forEach((rawLine, index) => {
    const line = withoutYamlComment(rawLine);
    if (!/(?:^|[\s{,\-])(?:"uses"|'uses'|uses)\s*:/.test(line)) return;
    const value = scalarAfterUses(line);
    entries.push({
      workflowPath,
      line: index + 1,
      value: value ?? "__unsupported_yaml_scalar__",
    });
  });
  return entries;
}

function sanitizedAction(value: string) {
  if (/\$\{\{/.test(value)) return "[expression]";
  if (value.startsWith("docker://"))
    return value.split("@", 1)[0].split(":", 2).join(":");
  const action = value.split("@", 1)[0] || "[missing]";
  return action.replace(/[^a-z0-9._/-]/gi, "?").slice(0, 160);
}

export function actionPinViolation(
  entry: UsesEntry,
): WorkflowActionPinViolation | null {
  const value = entry.value.trim();
  const base = {
    workflowPath: entry.workflowPath.replaceAll("\\", "/"),
    action: sanitizedAction(value),
  };
  if (value === "__unsupported_yaml_scalar__")
    return { ...base, violationType: "unsupported_uses_syntax" };
  if (/\$\{\{/.test(value)) return { ...base, violationType: "expression_ref" };
  if (value.startsWith("./")) return null;
  if (value.startsWith("docker://"))
    return dockerDigest.test(value)
      ? null
      : { ...base, violationType: "docker_not_digest_pinned" };
  const separator = value.lastIndexOf("@");
  if (separator < 1) return { ...base, violationType: "missing_ref" };
  const action = value.slice(0, separator);
  const reference = value.slice(separator + 1);
  if (!/^[a-z0-9_.-]+\/[a-z0-9_.-]+(?:\/[a-z0-9_.\/-]+)*$/i.test(action))
    return { ...base, violationType: "invalid_remote_action" };
  if (fullSha.test(reference)) return null;
  if (/^[a-f0-9]{1,39}$/i.test(reference))
    return { ...base, violationType: "short_sha" };
  return { ...base, violationType: "mutable_ref" };
}

export function validateWorkflowActionPins(
  source: string,
  workflowPath = "fixture.yml",
) {
  return workflowUsesEntries(source, workflowPath)
    .map(actionPinViolation)
    .filter((violation): violation is WorkflowActionPinViolation =>
      Boolean(violation),
    );
}

export async function workflowFiles(root = process.cwd()) {
  const directory = path.join(root, ".github", "workflows");
  const entries = await readdir(directory, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile() && /\.(?:ya?ml)$/i.test(entry.name))
    .map((entry) => path.join(directory, entry.name))
    .sort();
}

export async function validateRepositoryWorkflowActionPins(
  root = process.cwd(),
) {
  const files = await workflowFiles(root);
  const violations: WorkflowActionPinViolation[] = [];
  for (const file of files) {
    const workflowPath = path.relative(root, file).replaceAll("\\", "/");
    violations.push(
      ...validateWorkflowActionPins(await readFile(file, "utf8"), workflowPath),
    );
  }
  return { files, violations };
}
