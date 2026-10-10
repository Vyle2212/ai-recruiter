import assert from "node:assert/strict";
import fs from "node:fs";

function sourceFiles(directory: string): string[] {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = `${directory}/${entry.name}`;

    if (entry.isDirectory()) {
      return sourceFiles(path);
    }

    return /\.(?:ts|tsx)$/.test(entry.name) ? [path] : [];
  });
}

const targets = [
  ...sourceFiles("app"),
  "lib/candidate360Engine.ts",
  "lib/recruiterCopilotAnswerEngine.ts",
  "scripts/validateWorkflowAutomationPlatform.cjs",
];

const mojibakeMarker = /[ÃÂÆÄ]|ï¿½|áº|á»|�/;

for (const path of targets) {
  assert.ok(
    fs.existsSync(path),
    `Expected UI file to exist: ${path}`,
  );

  const source =
    fs.readFileSync(path, "utf8");

  assert.doesNotMatch(
    source,
    mojibakeMarker,
    `${path} must not contain mojibake text`,
  );
}

const automationSource = fs.readFileSync(
  "app/recruiter/workflow/automation/page.tsx",
  "utf8",
);
assert.match(
  automationSource,
  /Enabled · Preview only/,
  "automation rules should retain a readable status separator",
);

const copilotSource = fs.readFileSync(
  "lib/recruiterCopilotAnswerEngine.ts",
  "utf8",
);
assert.match(
  copilotSource,
  /cần làm gì hôm nay/,
  "Copilot should recognize the Vietnamese today-plan intent",
);
assert.match(
  copilotSource,
  /ưu tiên ứng viên/,
  "Copilot should recognize the Vietnamese candidate-priority intent",
);
assert.match(
  copilotSource,
  /follow up trễ/,
  "Copilot should recognize the Vietnamese overdue-follow-up intent",
);

console.log(
  "recruiterUiEncoding.test.ts passed",
);
