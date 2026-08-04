import assert from "node:assert/strict";
import fs from "node:fs";

const path =
  "app/recruiter/workflow/WorkflowKanbanBoard.tsx";

const source = fs.readFileSync(path, "utf8");

assert.match(source, /@hello-pangea\/dnd/);
assert.match(source, /DragDropContext/);
assert.match(source, /Droppable/);
assert.match(source, /Draggable/);
assert.match(source, /onDragEnd/);
assert.match(source, /findCandidateLifecycleTransition/);
assert.match(
  source,
  /async function postMove\(execute: boolean\)/,
);
assert.match(source, /execute,/);
assert.match(source, /postMove\(false\)/);
assert.match(source, /postMove\(true\)/);
assert.match(source, /Preview move/);
assert.match(source, /Confirm move/);
assert.match(source, /expectedStage/);
assert.match(source, /window\.location\.reload/);
assert.match(source, /Candidate database writes remain disabled/);

const previewIndex = source.indexOf("postMove(false)");
const executeIndex = source.indexOf("postMove(true)");

assert.ok(previewIndex >= 0);
assert.ok(executeIndex > previewIndex);

console.log(
  "recruiterWorkflowDragPreview.test.ts passed",
);