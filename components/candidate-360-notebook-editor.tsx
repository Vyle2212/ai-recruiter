"use client";

import { useEffect, useRef, useState } from "react";
import type { ClipboardEvent, KeyboardEvent, MouseEvent } from "react";

type Candidate360NotebookEditorProps = {
  editorKey: string;
  value: string;
  placeholder: string;
  suggestions?: Array<{ id: string; label: string }>;
  blockLabel?: string;
  sectionLabel?: string;
  sectionDescription?: string;
  onChange: (value: string) => void;
  onSave: () => void;
};

type EditorSelection = {
  start: number;
  end: number;
};

const BULLET_PREFIX = "\u2022 ";
const CHECK_OPEN_PREFIX = "\u2610 ";
const CHECK_DONE_PREFIX = "\u2611 ";
const NUMBER_PREFIX = "1. ";
const TOGGLE_PREFIX = "\u25B6 Decision note: ";
const BULLET_ICON = "\u2022";
const CHECK_ICON = "\u2610";
const TOGGLE_ICON = "\u25B6";
const TABLE_ICON = "\u25A6";
const SPARK_ICON = "\u2728";

const MENTION_ENTITIES = ["Candidate", "Client", "Hiring Manager", "Salary", "Risk", "Project"];

function readPlainText(element: HTMLDivElement) {
  return element.innerText;
}

function readStoredValue(element: HTMLDivElement) {
  return element.innerHTML;
}

function isHtmlValue(value: string) {
  return /<[^>]+>/.test(value);
}

function currentSelection(element: HTMLDivElement): EditorSelection | null {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) return null;
  const range = selection.getRangeAt(0);
  const anchorNode = selection.anchorNode;
  if (!anchorNode || !element.contains(anchorNode)) return null;

  const beforeStart = range.cloneRange();
  beforeStart.selectNodeContents(element);
  beforeStart.setEnd(range.startContainer, range.startOffset);

  const beforeEnd = range.cloneRange();
  beforeEnd.selectNodeContents(element);
  beforeEnd.setEnd(range.endContainer, range.endOffset);

  return {
    start: beforeStart.toString().length,
    end: beforeEnd.toString().length,
  };
}

function setCaretOffset(element: HTMLDivElement, offset: number) {
  const selection = window.getSelection();
  if (!selection) return;

  const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
  let remaining = Math.max(0, offset);
  let current = walker.nextNode();

  while (current) {
    const length = current.textContent?.length || 0;
    if (remaining <= length) {
      const range = document.createRange();
      range.setStart(current, remaining);
      range.collapse(true);
      selection.removeAllRanges();
      selection.addRange(range);
      return;
    }
    remaining -= length;
    current = walker.nextNode();
  }

  const range = document.createRange();
  range.selectNodeContents(element);
  range.collapse(false);
  selection.removeAllRanges();
  selection.addRange(range);
}

function setEditorText(element: HTMLDivElement, text: string, caretOffset: number) {
  element.innerText = text;
  element.focus();
  setCaretOffset(element, caretOffset);
}

function ensureSelection(element: HTMLDivElement): EditorSelection {
  const selection = currentSelection(element);
  if (selection) return selection;

  element.focus();
  const text = readPlainText(element);
  setCaretOffset(element, text.length);
  return { start: text.length, end: text.length };
}

function normalizeLinesForPrefix(text: string, prefix: string) {
  return text
    .split("\n")
    .map((line) => {
      const cleanLine = line
        .replace(/^\s*[\u2022\-]\s?/, "")
        .replace(/^\s*[\u2610\u2611]\s?/, "");
      return prefix + cleanLine;
    })
    .join("\n");
}

function tableCells(row: HTMLTableRowElement) {
  return Array.from(row.querySelectorAll<HTMLTableCellElement>("th,td"));
}

function createCell(tagName: "td" | "th", text = "") {
  const cell = document.createElement(tagName) as HTMLTableCellElement;
  cell.className = "border border-slate-700/70 px-2 py-1 align-top text-slate-100 outline-none focus:bg-cyan-500/10";
  cell.contentEditable = "true";
  cell.tabIndex = 0;
  cell.textContent = text;
  return cell;
}

function tableFromCell(cell: HTMLTableCellElement) {
  return cell.closest("table") as HTMLTableElement | null;
}

function rowFromCell(cell: HTMLTableCellElement) {
  return cell.closest("tr") as HTMLTableRowElement | null;
}

function focusCell(cell: HTMLTableCellElement | null | undefined) {
  if (!cell) return;
  const selection = window.getSelection();
  if (!selection) return;
  cell.focus();
  const range = document.createRange();
  range.selectNodeContents(cell);
  range.collapse(false);
  selection.removeAllRanges();
  selection.addRange(range);
}

export function Candidate360NotebookEditor({
  editorKey,
  value,
  placeholder,
  suggestions = [],
  sectionLabel = "Recruiter Notes",
  sectionDescription = "Recruiter workspace section",
  blockLabel = "Notes",
  onChange,
  onSave,
}: Candidate360NotebookEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const hydratedKeyRef = useRef<string | null>(null);
  const [activeMode, setActiveMode] = useState<"bullet" | "check" | null>(null);
  const [aiOpen, setAiOpen] = useState(false);
  const [mentionOpen, setMentionOpen] = useState(false);
  const [highlightedAi, setHighlightedAi] = useState(0);
  const [activeCell, setActiveCell] = useState<HTMLTableCellElement | null>(null);
  const [aiStatus, setAiStatus] = useState<"idle" | "thinking" | "inserted">("idle");
  const aiTimersRef = useRef<number[]>([]);

  const aiOptions = suggestions;

  useEffect(() => {
    return () => {
      aiTimersRef.current.forEach((timer) => window.clearTimeout(timer));
      aiTimersRef.current = [];
    };
  }, []);

  useEffect(() => {
    const editor = editorRef.current;
    if (!editor || hydratedKeyRef.current === editorKey) return;

    if (value && isHtmlValue(value)) editor.innerHTML = value;
    else editor.innerText = value || "";
    hydratedKeyRef.current = editorKey;
  }, [editorKey, value]);

  function syncValue() {
    const editor = editorRef.current;
    if (!editor) return;
    onChange(readStoredValue(editor));
  }

  function replaceTextSelection(nextText: string, caretOffsetFromInsertEnd = 0) {
    const editor = editorRef.current;
    if (!editor) return;

    const selection = ensureSelection(editor);
    const current = readPlainText(editor);
    const next = current.slice(0, selection.start) + nextText + current.slice(selection.end);
    const caret = selection.start + nextText.length + caretOffsetFromInsertEnd;
    setEditorText(editor, next, caret);
    syncValue();
  }

  function insertNodeAtSelection(node: Node, focusTarget?: HTMLTableCellElement) {
    const editor = editorRef.current;
    if (!editor) return;

    editor.focus();
    const selection = window.getSelection();
    let range: Range;

    if (selection && selection.rangeCount > 0 && selection.anchorNode && editor.contains(selection.anchorNode)) {
      range = selection.getRangeAt(0);
      range.deleteContents();
    } else {
      range = document.createRange();
      range.selectNodeContents(editor);
      range.collapse(false);
    }

    range.insertNode(node);
    range.setStartAfter(node);
    range.setEndAfter(node);

    if (selection) {
      selection.removeAllRanges();
      selection.addRange(range);
    }

    if (focusTarget) {
      setActiveCell(focusTarget);
      focusCell(focusTarget);
    }
    syncValue();
  }

  function applyLinePrefix(prefix: string) {
    const editor = editorRef.current;
    if (!editor) return;

    const selection = ensureSelection(editor);
    const current = readPlainText(editor);
    const selected = current.slice(selection.start, selection.end);

    if (selected) {
      const replacement = normalizeLinesForPrefix(selected, prefix);
      const next = current.slice(0, selection.start) + replacement + current.slice(selection.end);
      setEditorText(editor, next, selection.start + replacement.length);
      syncValue();
      setActiveMode(prefix === BULLET_PREFIX ? "bullet" : "check");
      return;
    }

    replaceTextSelection(prefix);
    setActiveMode(prefix === BULLET_PREFIX ? "bullet" : "check");
  }

  function insertNumberedList() {
    replaceTextSelection(NUMBER_PREFIX);
    setActiveMode(null);
  }

  function insertToggle() {
    replaceTextSelection(TOGGLE_PREFIX);
    setActiveMode(null);
  }

  function insertTable() {
    const wrapper = document.createElement("div");
    wrapper.className = "my-2 overflow-hidden rounded-xl border border-slate-700/70 bg-slate-950/30";
    const table = document.createElement("table");
    table.className = "w-full border-collapse text-sm";
    const tbody = document.createElement("tbody");
    const header = document.createElement("tr");
    ["Item", "Status", "Notes"].forEach((text) => header.appendChild(createCell("th", text)));
    const row = document.createElement("tr");
    ["", "", ""].forEach(() => row.appendChild(createCell("td")));
    tbody.appendChild(header);
    tbody.appendChild(row);
    table.appendChild(tbody);
    wrapper.appendChild(table);
    wrapper.appendChild(document.createElement("br"));
    insertNodeAtSelection(wrapper, tableCells(row)[0]);
    setActiveMode(null);
  }

  function textContext() {
    const editor = editorRef.current;
    const current = editor ? readPlainText(editor).trim() : "";
    return current ? current.slice(0, 320) : "No recruiter note captured yet.";
  }

  function buildAiContent(option: { id: string; label: string }) {
    const context = textContext();
    const block = blockLabel.toLowerCase();
    const section = sectionLabel.toLowerCase();
    const id = option.id;
    const hasNote = context !== "No recruiter note captured yet.";

    const bullets = (title: string, items: string[]) => title + ":\n" + items.map((item) => BULLET_PREFIX + item).join("\n");
    const checks = (title: string, items: string[]) => title + ":\n" + items.map((item) => CHECK_OPEN_PREFIX + item).join("\n");
    const basedOnNote = hasNote ? "Current note considered: " + context : "Use this as a starting point and adjust after recruiter screening.";

    if (id.includes("shorten")) return bullets("Short recruiter note", ["Keep this profile under recruiter validation before submission.", "Lead with SAP BTP and architecture relevance.", "Confirm ownership, salary, availability, and notice before client release."]);
    if (id.includes("client-ready") || id.includes("client-introduction") || id.includes("client-pitch") || id.includes("position-against-jd")) return bullets("Client positioning", ["Position the candidate for SAP BTP Lead / Manager discussion.", "Lead with enterprise architecture relevance and delivery background.", "Mention implementation ownership as the main screening point before submission.", basedOnNote]);
    if (id.includes("improve-summary")) return bullets("Executive summary", ["Candidate is best treated as a SAP BTP leadership profile pending recruiter validation.", "Submission case is strongest around BTP depth, architecture relevance, and enterprise delivery context.", "Main decision point is whether implementation ownership is strong enough for client submission.", basedOnNote]);
    if (id.includes("confirm-submission") || id.includes("salary-decision")) return bullets("Decision note", ["Decision: continue recruiter validation before client submission.", "Reason: profile appears relevant, but ownership and commercial details still need confirmation.", "Next action: complete the highest-priority validation before preparing the client summary."]);
    if (id.includes("hold-reason")) return bullets("Hold reason", ["Hold only if implementation ownership, availability, or package cannot be confirmed.", "Evidence required: project accountability, notice period, and expected package.", "Next recruiter action: document the blocker and confirm whether the profile remains submission viable."]);
    if (id.includes("risk") || id.includes("blocker") || id.includes("concern") || id.includes("weakness") || id.includes("pushback")) return checks("Key risks", ["Validate full-cycle implementation ownership before submission.", "Confirm availability, notice period, and salary expectations.", "Clarify client-facing accountability and stakeholder scope.", "Prepare a client response for any missing S/4HANA or delivery ownership evidence."]);
    if (id.includes("question") || id.includes("interview")) return bullets("Interview questions", ["What did you personally own in the most recent SAP BTP project?", "Which phases did you own from solution design through go-live or hypercare?", "Which client stakeholders or architects did you work with directly?", "What outcome would a client reference confirm about your delivery role?"]);
    if (id.includes("salary") || id.includes("package") || id.includes("bonus") || id.includes("budget") || id.includes("compensation")) return bullets("Salary notes", ["Confirm current package, bonus, benefits, and currency.", "Capture expected package and flexibility before client submission.", "Compare expectation with client budget and flag any gap early.", "Ask about notice period, competing offers, and counter-offer risk."]);
    if (id.includes("negotiation") || id.includes("offer") || id.includes("motivator") || id.includes("driver") || id.includes("retention")) return bullets("Negotiation notes", ["Lead with role scope, architecture ownership, and enterprise delivery before package discussion.", "Confirm whether progression, client exposure, or flexible work are stronger motivators than salary alone.", "Watch for current package, notice period, and counter-offer pressure."]);
    if (id.includes("strength") || id.includes("business-impact") || id.includes("leadership") || id.includes("sap-expertise")) return bullets("Strengths to lead with", ["SAP BTP depth supports a credible leadership positioning.", "Architecture relevance should be framed around client delivery outcomes, not only technical exposure.", "Leadership scope should be confirmed and then used as the client-facing differentiator."]);
    if (id.includes("stakeholder") || id.includes("client-facing")) return bullets("Stakeholder notes", ["Confirm direct client stakeholder exposure and decision-maker level.", "Capture examples of architecture governance, workshops, or steering discussions.", "Use confirmed client ownership to strengthen the submission narrative."]);
    if (id.includes("ownership") || id.includes("delivery") || id.includes("accountability")) return bullets("Ownership evidence", ["Confirm personal accountability for scope, design decisions, and delivery outcome.", "Separate hands-on contribution from true solution ownership.", "Capture one recent project example that can be used in the client submission."]);
    if (id.includes("follow-up") || id.includes("reminder") || id.includes("next-action") || id.includes("touchpoint")) return bullets("Next follow-up", ["Contact candidate to close the highest-priority validation gap.", "Owner: Recruiter.", "Timing: before client submission is prepared.", "Outcome required: submit, hold, or continue validation."]);

    if (section.includes("salary") || block.includes("salary")) return bullets("Salary notes", ["Confirm current package and expected package.", "Check budget fit before client submission.", "Record flexibility, notice period, and counter-offer risk."]);
    if (section.includes("risk") || block.includes("risk")) return checks("Key risks", ["Implementation ownership requires recruiter validation.", "Availability and notice period need confirmation.", "Compensation alignment should be captured before submission."]);
    return bullets(option.label, [basedOnNote, "Record the recruiter decision and next action in this block."]);
  }

  function getEditorRange(deleteSelection = false) {
    const editor = editorRef.current;
    if (!editor) return null;

    editor.focus();
    const selection = window.getSelection();
    let range: Range;

    if (selection && selection.rangeCount > 0 && selection.anchorNode && editor.contains(selection.anchorNode)) {
      range = selection.getRangeAt(0);
    } else {
      range = document.createRange();
      range.selectNodeContents(editor);
      range.collapse(false);
    }

    if (deleteSelection) range.deleteContents();
    if (selection) {
      selection.removeAllRanges();
      selection.addRange(range);
    }
    return range;
  }

  function insertTextNodeAtCaret(text: string, deleteSelection = false) {
    const editor = editorRef.current;
    const range = getEditorRange(deleteSelection);
    const selection = window.getSelection();
    if (!editor || !range || !selection) return;

    const node = document.createTextNode(text);
    range.insertNode(node);
    range.setStartAfter(node);
    range.setEndAfter(node);
    selection.removeAllRanges();
    selection.addRange(range);
    syncValue();
  }

  function shouldReplaceSelection(option: { id: string; label: string }) {
    return /improve|shorten|client-ready|client-pitch|client-introduction|position-against-jd|summary|decision/.test(option.id);
  }

  function insertAiContent(option: { id: string; label: string } | undefined) {
    if (!option || aiStatus === "thinking") return;

    const editor = editorRef.current;
    if (!editor) return;

    const selection = currentSelection(editor);
    const hasSelection = !!selection && selection.start !== selection.end;
    const replaceSelection = hasSelection && shouldReplaceSelection(option);
    const current = readPlainText(editor);
    const generated = buildAiContent(option);
    const prefix = !replaceSelection && current && !current.endsWith("\n") ? "\n" : "";
    const chunks = (prefix + generated).match(/.{1,90}(?:\s|$)|.+$/g) || [prefix + generated];

    setAiOpen(false);
    setMentionOpen(false);
    setActiveMode(null);
    setAiStatus("thinking");
    aiTimersRef.current.forEach((timer) => window.clearTimeout(timer));
    aiTimersRef.current = [];

    const firstTimer = window.setTimeout(() => {
      insertTextNodeAtCaret(chunks[0] || "", replaceSelection);

      chunks.slice(1).forEach((chunk, index) => {
        const timer = window.setTimeout(() => {
          insertTextNodeAtCaret(chunk, false);
          if (index === chunks.length - 2) {
            setAiStatus("inserted");
            onSave();
            const resetTimer = window.setTimeout(() => setAiStatus("idle"), 1000);
            aiTimersRef.current.push(resetTimer);
          }
        }, 45 * (index + 1));
        aiTimersRef.current.push(timer);
      });

      if (chunks.length === 1) {
        setAiStatus("inserted");
        onSave();
        const resetTimer = window.setTimeout(() => setAiStatus("idle"), 1000);
        aiTimersRef.current.push(resetTimer);
      }
    }, 180);

    aiTimersRef.current.push(firstTimer);
  }

  function insertMention(entity: string) {
    replaceTextSelection("@" + entity + " ");
    setMentionOpen(false);
  }

  function currentLineBounds(textValue: string, offset: number) {
    const lineStart = textValue.lastIndexOf("\n", offset - 1) + 1;
    const lineEndIndex = textValue.indexOf("\n", offset);
    return { lineStart, lineEnd: lineEndIndex === -1 ? textValue.length : lineEndIndex };
  }

  function handleFormattedEnter(prefix: string, event: KeyboardEvent<HTMLDivElement>) {
    const editor = editorRef.current;
    if (!editor) return false;

    const selection = ensureSelection(editor);
    if (selection.start !== selection.end) return false;

    const current = readPlainText(editor);
    const { lineStart, lineEnd } = currentLineBounds(current, selection.start);
    const currentLine = current.slice(lineStart, lineEnd);

    if (!currentLine.startsWith(prefix)) return false;

    event.preventDefault();

    if (currentLine.trim() === prefix.trim()) {
      const removeLineBreak = lineStart > 0 ? 1 : 0;
      const before = current.slice(0, lineStart - removeLineBreak);
      const after = current.slice(lineEnd);
      const next = before + after;
      setEditorText(editor, next, before.length);
      syncValue();
      setActiveMode(null);
      return true;
    }

    const insert = "\n" + prefix;
    const next = current.slice(0, selection.start) + insert + current.slice(selection.end);
    const caret = selection.start + insert.length;
    setEditorText(editor, next, caret);
    syncValue();
    setActiveMode(prefix === BULLET_PREFIX ? "bullet" : prefix === CHECK_OPEN_PREFIX ? "check" : null);
    return true;
  }

  function handleNumberedEnter(event: KeyboardEvent<HTMLDivElement>) {
    const editor = editorRef.current;
    if (!editor) return false;
    const selection = ensureSelection(editor);
    if (selection.start !== selection.end) return false;
    const current = readPlainText(editor);
    const { lineStart, lineEnd } = currentLineBounds(current, selection.start);
    const currentLine = current.slice(lineStart, lineEnd);
    const match = currentLine.match(/^(\d+)\.\s/);
    if (!match) return false;
    event.preventDefault();
    if (currentLine.trim() === match[1] + ".") {
      const removeLineBreak = lineStart > 0 ? 1 : 0;
      const before = current.slice(0, lineStart - removeLineBreak);
      const after = current.slice(lineEnd);
      const next = before + after;
      setEditorText(editor, next, before.length);
      syncValue();
      return true;
    }
    const insert = "\n" + String(Number(match[1]) + 1) + ". ";
    const next = current.slice(0, selection.start) + insert + current.slice(selection.end);
    setEditorText(editor, next, selection.start + insert.length);
    syncValue();
    return true;
  }

  function handleListBackspace(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key !== "Backspace") return false;
    const editor = editorRef.current;
    if (!editor) return false;
    const selection = ensureSelection(editor);
    if (selection.start !== selection.end) return false;
    const current = readPlainText(editor);
    const { lineStart, lineEnd } = currentLineBounds(current, selection.start);
    const currentLine = current.slice(lineStart, lineEnd);
    const emptyPrefix = currentLine === BULLET_PREFIX || currentLine === CHECK_OPEN_PREFIX || /^\d+\.\s$/.test(currentLine);
    if (!emptyPrefix || selection.start !== lineEnd) return false;
    event.preventDefault();
    const next = current.slice(0, lineStart) + current.slice(lineEnd);
    setEditorText(editor, next, lineStart);
    syncValue();
    setActiveMode(null);
    return true;
  }

  function addTableRow(after = true) {
    if (!activeCell) return;
    const row = rowFromCell(activeCell);
    if (!row) return;
    const nextRow = document.createElement("tr");
    tableCells(row).forEach(() => nextRow.appendChild(createCell("td")));
    if (after) row.after(nextRow);
    else row.before(nextRow);
    const nextCell = tableCells(nextRow)[0] || null;
    setActiveCell(nextCell);
    focusCell(nextCell);
    syncValue();
  }

  function addTableColumn(after = true) {
    if (!activeCell) return;
    const table = tableFromCell(activeCell);
    const row = rowFromCell(activeCell);
    if (!table || !row) return;
    const index = tableCells(row).indexOf(activeCell);
    Array.from(table.rows).forEach((tableRow, rowIndex) => {
      const cells = tableCells(tableRow);
      const cell = createCell(rowIndex === 0 ? "th" : "td");
      const targetIndex = after ? index + 1 : index;
      if (cells[targetIndex]) tableRow.insertBefore(cell, cells[targetIndex]);
      else tableRow.appendChild(cell);
    });
    syncValue();
  }

  function deleteTableRow() {
    if (!activeCell) return;
    const row = rowFromCell(activeCell);
    const table = tableFromCell(activeCell);
    if (!row || !table || table.rows.length <= 1) return;
    const nextFocus = row.nextElementSibling?.querySelector<HTMLTableCellElement>("td,th") || row.previousElementSibling?.querySelector<HTMLTableCellElement>("td,th") || null;
    row.remove();
    setActiveCell(nextFocus);
    focusCell(nextFocus);
    syncValue();
  }

  function deleteTableColumn() {
    if (!activeCell) return;
    const table = tableFromCell(activeCell);
    const row = rowFromCell(activeCell);
    if (!table || !row) return;
    const index = tableCells(row).indexOf(activeCell);
    if (tableCells(row).length <= 1) return;
    Array.from(table.rows).forEach((tableRow) => tableCells(tableRow)[index]?.remove());
    setActiveCell(null);
    syncValue();
  }

  function moveTableCell(backwards: boolean) {
    if (!activeCell) return false;
    const table = tableFromCell(activeCell);
    if (!table) return false;
    const cells = Array.from(table.querySelectorAll<HTMLTableCellElement>("th,td"));
    const index = cells.indexOf(activeCell);
    const next = cells[index + (backwards ? -1 : 1)];
    if (next) {
      setActiveCell(next);
      focusCell(next);
      return true;
    }
    addTableRow(true);
    return true;
  }

  function parsePastedRows(text: string) {
    const clean = text.replace(/\r/g, "").trimEnd();
    const rows = clean.split("\n").filter((row) => row.length > 0);
    return rows.map((row) => row.includes("\t") ? row.split("\t") : row.split(",").map((cell) => cell.trim()));
  }

  function fillTableFromPaste(text: string) {
    if (!activeCell) return false;
    const table = tableFromCell(activeCell);
    const startRow = rowFromCell(activeCell);
    if (!table || !startRow) return false;

    const rows = parsePastedRows(text);
    if (!rows.length || (rows.length === 1 && rows[0].length === 1)) return false;

    const startRowIndex = Array.from(table.rows).indexOf(startRow);
    const startColIndex = tableCells(startRow).indexOf(activeCell);
    const maxCols = startColIndex + Math.max(...rows.map((row) => row.length));

    while (table.rows.length < startRowIndex + rows.length) {
      const referenceRow = table.rows[table.rows.length - 1];
      const nextRow = document.createElement("tr");
      tableCells(referenceRow).forEach(() => nextRow.appendChild(createCell("td")));
      referenceRow.after(nextRow);
    }

    Array.from(table.rows).forEach((tableRow, rowIndex) => {
      while (tableCells(tableRow).length < maxCols) tableRow.appendChild(createCell(rowIndex === 0 ? "th" : "td"));
    });

    rows.forEach((row, rowOffset) => {
      const targetRow = table.rows[startRowIndex + rowOffset];
      const cells = tableCells(targetRow);
      row.forEach((cellText, colOffset) => {
        cells[startColIndex + colOffset].textContent = cellText;
      });
    });
    syncValue();
    return true;
  }

  function toggleChecklistAtCaret() {
    const editor = editorRef.current;
    if (!editor) return;
    const selection = ensureSelection(editor);
    const current = readPlainText(editor);
    const lineStart = current.lastIndexOf("\n", selection.start - 1) + 1;
    if (selection.start > lineStart + 2) return;
    const marker = current.slice(lineStart, lineStart + 2);
    if (marker !== CHECK_OPEN_PREFIX && marker !== CHECK_DONE_PREFIX) return;
    const nextMarker = marker === CHECK_OPEN_PREFIX ? CHECK_DONE_PREFIX : CHECK_OPEN_PREFIX;
    const next = current.slice(0, lineStart) + nextMarker + current.slice(lineStart + 2);
    setEditorText(editor, next, selection.start);
    syncValue();
  }

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
      event.preventDefault();
      syncValue();
      onSave();
      return;
    }

    if (event.key === "@") {
      window.setTimeout(() => setMentionOpen(true), 0);
      return;
    }

    if (activeCell && event.key === "Tab") {
      event.preventDefault();
      moveTableCell(event.shiftKey);
      return;
    }

    if (activeCell && event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      addTableRow(true);
      return;
    }

    if (handleListBackspace(event)) return;

    if (event.key === "Enter" && !event.shiftKey && !event.altKey && !event.metaKey && !event.ctrlKey) {
      if (handleNumberedEnter(event)) return;
      if (handleFormattedEnter(CHECK_OPEN_PREFIX, event)) return;
      if (handleFormattedEnter(BULLET_PREFIX, event)) return;
    }
  }

  function handlePaste(event: ClipboardEvent<HTMLDivElement>) {
    if (!activeCell) return;
    const text = event.clipboardData.getData("text/plain");
    if (!text) return;
    if (fillTableFromPaste(text)) event.preventDefault();
  }

  function keepEditorFocus(event: MouseEvent<HTMLButtonElement>) {
    event.preventDefault();
  }

  const bulletClassName = [
    "c360-focus-ring rounded-full px-2.5 py-1 ring-1 transition duration-200 hover:border-slate-600",
    activeMode === "bullet" ? "bg-cyan-500/10 text-cyan-100 ring-cyan-500/25" : "bg-slate-950/45 ring-slate-800/60",
  ].join(" ");

  const checkClassName = [
    "c360-focus-ring rounded-full px-2.5 py-1 ring-1 transition duration-200 hover:border-slate-600",
    activeMode === "check" ? "bg-cyan-500/10 text-cyan-100 ring-cyan-500/25" : "bg-slate-950/45 ring-slate-800/60",
  ].join(" ");

  return (
    <div className="space-y-2">
      <div className="relative flex flex-wrap items-center gap-2 text-[10px] font-bold text-slate-400">
        <button type="button" title="Bullet" aria-label="Bullet" onMouseDown={keepEditorFocus} onClick={() => applyLinePrefix(BULLET_PREFIX)} className={bulletClassName}>
          {BULLET_ICON} <span className="ml-1">Bullet</span>
        </button>
        <button type="button" title="Checklist" aria-label="Checklist" onMouseDown={keepEditorFocus} onClick={() => applyLinePrefix(CHECK_OPEN_PREFIX)} className={checkClassName}>
          {CHECK_ICON} <span className="ml-1">Checklist</span>
        </button>
        <button type="button" title="Numbered list" aria-label="Numbered list" onMouseDown={keepEditorFocus} onClick={insertNumberedList} className="c360-focus-ring rounded-full bg-slate-950/45 px-2.5 py-1 ring-1 ring-slate-800/60 transition duration-200 hover:border-slate-600 hover:bg-slate-900/70">
          1. <span className="ml-1">Numbered list</span>
        </button>
        <button type="button" title="Toggle" aria-label="Toggle" onMouseDown={keepEditorFocus} onClick={insertToggle} className="c360-focus-ring rounded-full bg-slate-950/45 px-2.5 py-1 ring-1 ring-slate-800/60 transition duration-200 hover:border-slate-600 hover:bg-slate-900/70">
          {TOGGLE_ICON} <span className="ml-1">Toggle</span>
        </button>
        <button type="button" title="Table" aria-label="Table" onMouseDown={keepEditorFocus} onClick={insertTable} className="c360-focus-ring rounded-full bg-slate-950/45 px-2.5 py-1 ring-1 ring-slate-800/60 transition duration-200 hover:border-slate-600 hover:bg-slate-900/70">
          {TABLE_ICON} <span className="ml-1">Table</span>
        </button>
        <button
          type="button"
          title="Help" aria-label="Help"
          onClick={() => {
            setAiOpen((open) => !open);
            setHighlightedAi(0);
          }}
          onKeyDown={(event) => {
            if (!aiOpen) return;
            if (event.key === "ArrowDown") {
              event.preventDefault();
              setHighlightedAi((index) => Math.min(index + 1, Math.max(0, aiOptions.length - 1)));
            }
            if (event.key === "ArrowUp") {
              event.preventDefault();
              setHighlightedAi((index) => Math.max(index - 1, 0));
            }
            if (event.key === "Enter") {
              event.preventDefault();
              insertAiContent(aiOptions[highlightedAi]);
            }
            if (event.key === "Escape") setAiOpen(false);
          }}
          className="c360-focus-ring rounded-full bg-cyan-500/10 px-2.5 py-1 text-cyan-100 ring-1 ring-cyan-500/20 transition duration-200 hover:bg-cyan-500/15"
        >
          {SPARK_ICON} {aiStatus === "thinking" ? "Thinking..." : aiStatus === "inserted" ? "\u2713 AI inserted" : "Help"}
        </button>
        {aiOpen ? (
          <div role="listbox" className="absolute left-0 top-9 z-20 min-w-72 max-w-md overflow-hidden rounded-2xl border border-slate-700/70 bg-[#0B1118] p-1 text-xs shadow-2xl shadow-black/35">
            {aiOptions.map((option, index) => (
              <button
                key={editorKey + "-ai-option-" + option.id + "-" + index}
                type="button"
                role="option"
                aria-selected={index === highlightedAi}
                onMouseEnter={() => setHighlightedAi(index)}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => insertAiContent(option)}
                className={(index === highlightedAi ? "bg-cyan-500/10 text-cyan-100" : "text-slate-300") + " block w-full rounded-xl px-3 py-2 text-left leading-5 transition duration-150 hover:bg-cyan-500/10 hover:text-cyan-100"}
              >
                {option.label}
              </button>
            ))}
          </div>
        ) : null}
        {mentionOpen ? (
          <div className="absolute left-20 top-9 z-20 w-56 overflow-hidden rounded-2xl border border-slate-700/70 bg-[#0B1118] p-1 text-xs shadow-2xl shadow-black/35">
            {MENTION_ENTITIES.map((entity) => (
              <button key={editorKey + "-mention-" + entity} type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => insertMention(entity)} className="block w-full rounded-xl px-3 py-2 text-left text-slate-300 transition duration-150 hover:bg-cyan-500/10 hover:text-cyan-100">
                @{entity}
              </button>
            ))}
          </div>
        ) : null}
      </div>
      {activeCell ? (
        <div className="flex flex-wrap items-center gap-2 text-[10px] font-bold text-slate-500">
          <button type="button" onMouseDown={keepEditorFocus} onClick={() => addTableRow(true)} className="rounded-full bg-slate-950/35 px-2 py-1 ring-1 ring-slate-800/60 hover:text-slate-200">Add row</button>
          <button type="button" onMouseDown={keepEditorFocus} onClick={() => addTableColumn(true)} className="rounded-full bg-slate-950/35 px-2 py-1 ring-1 ring-slate-800/60 hover:text-slate-200">Add column</button>
          <button type="button" onMouseDown={keepEditorFocus} onClick={deleteTableRow} className="rounded-full bg-slate-950/35 px-2 py-1 ring-1 ring-slate-800/60 hover:text-amber-100">Delete row</button>
          <button type="button" onMouseDown={keepEditorFocus} onClick={deleteTableColumn} className="rounded-full bg-slate-950/35 px-2 py-1 ring-1 ring-slate-800/60 hover:text-amber-100">Delete column</button>
        </div>
      ) : null}
      <div className="relative">
        {!value ? <div className="pointer-events-none absolute left-0 top-0 px-0 py-1 text-sm leading-6 text-slate-600">{placeholder}</div> : null}
        <div
          ref={editorRef}
          role="textbox"
          aria-multiline="true"
          tabIndex={0}
          contentEditable
          suppressContentEditableWarning
          onInput={syncValue}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          onClick={(event) => {
            const target = event.target as HTMLElement;
            const cell = target.closest("td,th") as HTMLTableCellElement | null;
            setActiveCell(cell);
            if (!cell) toggleChecklistAtCaret();
          }}
          className="c360-focus-ring min-h-20 whitespace-pre-wrap rounded-xl bg-transparent py-1 text-sm leading-6 text-white outline-none transition duration-200 focus:min-h-28 [&_table]:my-2 [&_table]:w-full [&_table]:border-collapse [&_td]:border [&_td]:border-slate-700/70 [&_td]:px-2 [&_td]:py-1 [&_th]:border [&_th]:border-slate-700/70 [&_th]:px-2 [&_th]:py-1 [&_th]:text-left [&_th]:text-slate-300"
          style={{
            direction: "ltr",
            unicodeBidi: "normal",
            writingMode: "horizontal-tb",
            textAlign: "left",
          }}
        />
      </div>
    </div>
  );
}
