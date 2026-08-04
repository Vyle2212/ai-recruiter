import assert from "node:assert/strict";
import fs from "node:fs";

const boardPath =
  "app/recruiter/workflow/WorkflowKanbanBoard.tsx";

const pagePath =
  "app/recruiter/workflow/page.tsx";

assert.ok(fs.existsSync(boardPath));

const board = fs.readFileSync(
  boardPath,
  "utf8",
);

const page = fs.readFileSync(
  pagePath,
  "utf8",
);

assert.match(
  board,
  /CANDIDATE_PIPELINE_STAGES/,
);

assert.match(
  board,
  /PIPELINE_STAGE_LABELS/,
);

assert.match(
  board,
  /item\.lifecycle\?\.stage/,
);

assert.match(
  board,
  /ownerName/,
);

assert.match(
  board,
  /nextAction/,
);

assert.match(
  board,
  /nextActionDueAt/,
);

assert.match(
  board,
  /missingData/,
);

assert.match(
  board,
  /Open Candidate360/,
);

assert.match(
  board,
  /No candidates/,
);

assert.match(
  board,
  /fetch\(\s*["']\/api\/recruiter\/workflow\/move-stage/,
);

assert.match(
  board,
  /method:\s*["']POST["']/,
);

assert.match(
  board,
  /async function postMove\(execute: boolean\)/,
);

assert.match(
  board,
  /execute,/,
);

assert.match(
  board,
  /result\.executed/,
);

assert.match(
  board,
  /Preview approved/,
);

assert.match(
  board,
  /window\.location\.reload\(\)/,
);

assert.doesNotMatch(
  board,
  /\/api\/recruiter\/workflow\/rollback-stage/,
);

assert.match(
  page,
  /WorkflowKanbanBoard/,
);

assert.match(
  page,
  /viewMode.*board/,
);

assert.match(
  page,
  /setViewMode\("board"\)/,
);

assert.match(
  page,
  /setViewMode\("table"\)/,
);

assert.match(
  page,
  /<WorkflowKanbanBoard items=\{queue\}/,
);

console.log(
  "recruiterWorkflowBoard.test.ts passed",
);