"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { KeyboardEvent } from "react";
import { Candidate360NotebookEditor } from "./candidate-360-notebook-editor";
import { deriveCandidateWorkflow, isCandidateWorkflowStage, readStoredWorkflow, type CandidateWorkflowSnapshot, type CandidateWorkflowStage } from "./candidate-360-workflow-machine";

type ValidationItem = {
  id: string;
  label: string;
  effort: string;
  priority: "Critical" | "Important" | "Optional";
};

type WorkflowNote = Record<string, string>;

type WorkspaceField = {
  id: string;
  label: string;
  placeholder: string;
  suggestions?: Array<{ id: string; label: string }>;
};

type WorkspaceSection = {
  id: string;
  label: string;
  description: string;
  suggestions: Array<{ id: string; label: string }>;
  fields: WorkspaceField[];
};

type Candidate360NotesProps = {
  candidateId: string;
  initialNotes?: string;
  initialStatus: string;
  initialBlockers: string[];
  initialSnapshot: CandidateWorkflowSnapshot;
  validationItems: ValidationItem[];
  readinessFields: Array<[string, string]>;
};

const WORKSPACE_SECTIONS: WorkspaceSection[] = [
  {
    id: "executive-summary",
    label: "Executive Summary",
    description: "Recruiter notes for the submission decision.",
    suggestions: [],
    fields: [
      { id: "summary", label: "Summary", placeholder: "Summarize submission recommendation, fit, and decision context.", suggestions: [{ id: "improve-summary", label: "Improve executive summary" }, { id: "client-ready-summary", label: "Draft client-ready summary" }, { id: "shorten-summary", label: "Shorten summary" }] },
      { id: "decision", label: "Decision", placeholder: "Decision, owner, and current recommendation.", suggestions: [{ id: "confirm-submission-decision", label: "Confirm submission decision" }, { id: "explain-hold-reason", label: "Explain hold reason" }, { id: "prepare-decision-note", label: "Draft decision note" }] },
    ],
  },
  {
    id: "key-risks",
    label: "Key Risks",
    description: "Open risks and recruiter follow-up notes.",
    suggestions: [],
    fields: [
      { id: "risks", label: "Risks", placeholder: "Document open risks and recruiter follow-up outcome.", suggestions: [{ id: "identify-key-risks", label: "Identify key risks" }, { id: "add-missing-blocker", label: "Add missing risks" }, { id: "prepare-risk-mitigation", label: "Recommend mitigation" }] },
      { id: "follow-up", label: "Follow-up Notes", placeholder: "Next recruiter action to reduce submission risk.", suggestions: [{ id: "draft-follow-up-message", label: "Draft follow-up message" }, { id: "add-recruiter-reminder", label: "Add recruiter reminder" }, { id: "next-screening-question", label: "Draft follow-up question" }] },
    ],
  },
  {
    id: "salary-discussion",
    label: "Salary Discussion",
    description: "Salary notes, package discussion, and market context.",
    suggestions: [],
    fields: [
      { id: "current-salary", label: "Current Salary", placeholder: "Current package, currency, bonus, and benefits.", suggestions: [{ id: "capture-current-package", label: "Capture current package" }, { id: "salary-breakdown", label: "Add salary breakdown" }, { id: "bonus-benefits", label: "Clarify bonus and benefits" }] },
      { id: "expected-salary", label: "Expected Salary", placeholder: "Expected package and flexibility.", suggestions: [{ id: "capture-expected-package", label: "Capture expected package" }, { id: "confirm-flexibility", label: "Confirm flexibility" }, { id: "negotiation-range", label: "Add negotiation range" }] },
      { id: "client-budget", label: "Client Budget", placeholder: "Known client range, ceiling, or budget constraint.", suggestions: [{ id: "client-budget-range", label: "Add client budget range" }, { id: "compare-expectation", label: "Compare with candidate expectation" }, { id: "budget-gap", label: "Explain budget gap" }] },
      { id: "negotiation-notes", label: "Negotiation Notes", placeholder: "Candidate motivators, likely pushback, and close angle.", suggestions: [{ id: "negotiation-angle", label: "Create negotiation angle" }, { id: "candidate-motivators", label: "Identify candidate motivators" }, { id: "possible-pushback", label: "Note possible pushback" }] },
      { id: "decision", label: "Decision", placeholder: "Proceed, benchmark, hold, or escalate.", suggestions: [{ id: "salary-decision", label: "Recommend salary decision" }, { id: "package-acceptable", label: "Approve package" }, { id: "package-concern", label: "Escalate compensation issue" }] },
      { id: "risk", label: "Risk", placeholder: "Compensation risk and follow-up notes.", suggestions: [{ id: "compensation-risk", label: "Summarize compensation risk" }, { id: "mitigation-plan", label: "Add mitigation plan" }, { id: "client-explanation", label: "Draft client explanation" }] },
    ],
  },
  {
    id: "negotiation-strategy",
    label: "Negotiation Strategy",
    description: "Offer preparation and close strategy.",
    suggestions: [],
    fields: [
      { id: "angle", label: "Negotiation Angle", placeholder: "Lead with role scope, architecture ownership, and enterprise delivery before package.", suggestions: [{ id: "prepare-angle", label: "Create negotiation angle" }, { id: "close-strategy", label: "Improve close strategy" }, { id: "offer-positioning", label: "Frame offer positioning" }] },
      { id: "motivators", label: "Likely Motivators", placeholder: "Leadership, regional scope, flexible work, client exposure.", suggestions: [{ id: "candidate-motivators", label: "Identify candidate motivators" }, { id: "career-drivers", label: "Capture career drivers" }, { id: "retention-factors", label: "Note retention factors" }] },
      { id: "pushback", label: "Potential Pushback", placeholder: "Current package, notice period, counter-offer likelihood.", suggestions: [{ id: "identify-pushback", label: "Identify pushback" }, { id: "counter-offer-risk", label: "Draft counter-offer note" }, { id: "notice-concern", label: "Add notice period concern" }] },
    ],
  },
  {
    id: "client-positioning",
    label: "Client Positioning",
    description: "Client summary and shortlist positioning.",
    suggestions: [],
    fields: [
      { id: "pitch", label: "Pitch", placeholder: "Client-facing positioning, shortlist rationale, and intro angle.", suggestions: [{ id: "improve-client-pitch", label: "Improve client pitch" }, { id: "client-introduction", label: "Draft client introduction" }, { id: "position-against-jd", label: "Position candidate against JD" }] },
      { id: "strengths", label: "Strengths", placeholder: "Relevant strengths to lead with.", suggestions: [{ id: "key-strengths", label: "Emphasize key strengths" }, { id: "business-impact", label: "Show business impact" }, { id: "leadership-experience", label: "Show leadership experience" }] },
      { id: "weaknesses", label: "Weaknesses", placeholder: "Gaps to frame honestly.", suggestions: [{ id: "describe-gaps", label: "Describe gaps professionally" }, { id: "positive-weakness", label: "Position weakness positively" }, { id: "risk-mitigation", label: "Suggest risk mitigation" }] },
      { id: "client-concerns", label: "Client Concerns", placeholder: "Likely client concerns and response notes.", suggestions: [{ id: "client-questions", label: "Predict client concerns" }, { id: "objection-handling", label: "Draft response" }, { id: "add-risk-mitigation", label: "Recommend mitigation" }] },
      { id: "next-steps", label: "Next Steps", placeholder: "Submission, interview, validation, or hold action.", suggestions: [{ id: "next-action", label: "Recommend next action" }, { id: "submission-notes", label: "Draft submission notes" }, { id: "recruiter-follow-up", label: "Draft recruiter follow-up" }] },
    ],
  },
  {
    id: "interview-notes",
    label: "Interview Notes",
    description: "Interview notes and recruiter call outcomes.",
    suggestions: [],
    fields: [
      { id: "ownership", label: "Ownership Evidence", placeholder: "Project ownership, architecture scope, delivery accountability.", suggestions: [{ id: "ownership-evidence", label: "Capture ownership evidence" }, { id: "delivery-responsibility", label: "Summarize delivery responsibility" }, { id: "project-accountability", label: "Add project accountability note" }] },
      { id: "stakeholders", label: "Stakeholders", placeholder: "Client stakeholders, architects, business users, leadership exposure.", suggestions: [{ id: "stakeholder-exposure", label: "Capture stakeholder exposure" }, { id: "client-facing", label: "Summarize client-facing experience" }, { id: "leadership-interaction", label: "Add leadership interaction note" }] },
      { id: "outcome", label: "Outcome", placeholder: "Submit, hold, reject, or validate further.", suggestions: [{ id: "screening-outcome", label: "Record screening outcome" }, { id: "submit-hold-reject", label: "Mark submit / hold / reject reason" }, { id: "interview-summary", label: "Generate interview summary" }] },
    ],
  },
  {
    id: "next-follow-up",
    label: "Next Follow-up",
    description: "Next action, owner, and timing.",
    suggestions: [],
    fields: [
      { id: "action", label: "Action", placeholder: "Next action, owner, and follow-up timing.", suggestions: [{ id: "prepare-follow-up", label: "Draft next follow-up" }, { id: "reminder-note", label: "Add reminder note" }, { id: "assign-next-action", label: "Assign next action" }] },
      { id: "notes", label: "Notes", placeholder: "Context for the next recruiter touchpoint.", suggestions: [{ id: "draft-follow-up", label: "Create recruiter follow-up" }, { id: "open-items", label: "Summarize open items" }, { id: "next-touchpoint", label: "Plan next touchpoint" }] },
    ],
  },
];

function noteKey(sectionId: string, fieldId: string) {
  return sectionId + ":" + fieldId;
}

function parseEffort(value: string) {
  const match = value.match(/\d+/);
  return match ? Number(match[0]) : 2;
}

function effortLabel(minutes: number) {
  if (minutes <= 0) return "Completed";
  return String(minutes) + " mins";
}

function emptyWorkspaceNotes() {
  const notes: WorkflowNote = {};
  WORKSPACE_SECTIONS.forEach((section) => {
    section.fields.forEach((field) => {
      notes[noteKey(section.id, field.id)] = "";
    });
  });
  return notes;
}

function parseSavedNotebook(initialNotes: string) {
  const empty = emptyWorkspaceNotes();
  if (!initialNotes) return empty;

  try {
    const parsed = JSON.parse(initialNotes) as { workspaceNotes?: WorkflowNote };
    if (parsed && typeof parsed === "object" && parsed.workspaceNotes) {
      return { ...empty, ...parsed.workspaceNotes };
    }
  } catch {}

  if (/Validation workflow:/i.test(initialNotes)) return empty;
  return { ...empty, [noteKey("executive-summary", "summary")]: initialNotes };
}

function parseSavedValidationNotes(initialNotes: string) {
  if (!initialNotes) return {};
  try {
    const parsed = JSON.parse(initialNotes) as { workflowNotes?: WorkflowNote };
    if (parsed && typeof parsed === "object" && parsed.workflowNotes) return parsed.workflowNotes;
  } catch {}
  return {};
}

function serializeNotebook(workspaceNotes: WorkflowNote, workflowNotes: WorkflowNote) {
  return JSON.stringify({
    version: 1,
    workspaceNotes: { ...emptyWorkspaceNotes(), ...workspaceNotes },
    workflowNotes,
  });
}

export default function Candidate360Notes({
  candidateId,
  initialNotes = "",
  initialStatus,
  initialBlockers,
  initialSnapshot,
  validationItems,
  readinessFields,
}: Candidate360NotesProps) {
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<"idle" | "syncing" | "saved" | "error">("idle");
  const [completedActions, setCompletedActions] = useState<Set<string>>(new Set());
  const [completedWorkflowActions, setCompletedWorkflowActions] = useState<Set<string>>(new Set());
  const [completedAt, setCompletedAt] = useState<Record<string, string>>({});
  const [workflowNotes, setWorkflowNotes] = useState<WorkflowNote>(() => parseSavedValidationNotes(initialNotes));
  const [expandedValidationNotes, setExpandedValidationNotes] = useState<Set<string>>(new Set());
  const [expandedWorkspace, setExpandedWorkspace] = useState<Set<string>>(new Set(["executive-summary"]));
  const [workspaceNotes, setWorkspaceNotes] = useState<WorkflowNote>(() => parseSavedNotebook(initialNotes));
  const [lastEdited, setLastEdited] = useState<Record<string, string>>({});
  const [stageOverride, setStageOverride] = useState<CandidateWorkflowStage | undefined>(initialSnapshot.currentStage);
  const hydratedRef = useRef(false);

  const completedCount = completedActions.size;
  const remainingCount = Math.max(0, validationItems.length - completedCount);
  const criticalRemaining = validationItems.filter((item) => item.priority === "Critical" && !completedActions.has(item.id)).length;
  const importantRemaining = validationItems.filter((item) => item.priority === "Important" && !completedActions.has(item.id)).length;
  const optionalRemaining = validationItems.filter((item) => item.priority === "Optional" && !completedActions.has(item.id)).length;
  const remainingEffort = validationItems
    .filter((item) => !completedActions.has(item.id))
    .reduce((sum, item) => sum + parseEffort(item.effort), 0);
  const validationCompletedIds = useMemo(() => Array.from(completedActions), [completedActions]);
  const actionCompletedIds = useMemo(() => Array.from(completedWorkflowActions), [completedWorkflowActions]);
  const pendingValidationIds = useMemo(() => validationItems.filter((item) => !completedActions.has(item.id)).map((item) => item.id), [completedActions, validationItems]);
  const blockers = useMemo(() => {
    const workflowBlockers = validationItems
      .filter((item) => item.priority === "Critical" && !completedActions.has(item.id))
      .map((item) => item.label);
    return Array.from(new Set([...(initialBlockers || []), ...workflowBlockers])).slice(0, 4);
  }, [completedActions, initialBlockers, validationItems]);
  const workflow = useMemo(() => deriveCandidateWorkflow({
    candidateId,
    totalCount: validationItems.length,
    validationCompletedIds,
    actionCompletedIds,
    pendingValidationIds,
    remainingCount,
    criticalRemaining,
    importantRemaining,
    optionalRemaining,
    remainingEffort,
    initialStatus,
    blockers,
    requestedStage: stageOverride,
  }), [candidateId, validationItems.length, validationCompletedIds, actionCompletedIds, pendingValidationIds, remainingCount, criticalRemaining, importantRemaining, optionalRemaining, remainingEffort, initialStatus, blockers, stageOverride]);

  function buildSavedNotes() {
    return serializeNotebook(workspaceNotes, workflowNotes);
  }

  async function persistWorkspace(manual = false) {
    setSaving(manual);
    setStatus("syncing");

    try {
      const response = await fetch("/api/recruiter-notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ candidate_id: candidateId, notes: buildSavedNotes() }),
      });

      if (!response.ok) throw new Error("Failed to save notes");
      setStatus("saved");
    } catch {
      setStatus("error");
    } finally {
      setSaving(false);
    }
  }

  useEffect(() => {
    const stored = readStoredWorkflow(candidateId).currentStage;
    if (isCandidateWorkflowStage(stored)) setStageOverride(stored);
  }, [candidateId]);

  useEffect(() => {
    try {
      window.localStorage.setItem("candidate360-workflow-" + candidateId, JSON.stringify(workflow));
      window.dispatchEvent(new CustomEvent("candidate360-workflow", { detail: workflow }));
    } catch {}
  }, [candidateId, workflow]);

  useEffect(() => {
    function handleWorkflowAction(event: Event) {
      const detail = (event as CustomEvent<{ candidateId?: string; taskId?: string; workspaceSection?: string }>).detail;
      if (!detail || detail.candidateId !== candidateId || !detail.taskId) return;
      const exists = validationItems.some((item) => item.id === detail.taskId);

      if (exists) {
        setCompletedActions((current) => {
          if (current.has(detail.taskId!)) return current;
          const next = new Set(current);
          next.add(detail.taskId!);
          return next;
        });
        setExpandedValidationNotes((current) => {
          const next = new Set(current);
          next.add(detail.taskId!);
          return next;
        });
      } else {
        setCompletedWorkflowActions((current) => {
          if (current.has(detail.taskId!)) return current;
          const next = new Set(current);
          next.add(detail.taskId!);
          return next;
        });
      }

      setCompletedAt((current) => ({ ...current, [detail.taskId!]: "Completed by Vy just now" }));

      if (detail.taskId === "submit-candidate") setStageOverride("Client Review");
      if (detail.taskId === "prepare-interview") setStageOverride("Interview");
      if (detail.taskId === "create-offer") setStageOverride("Offer");
      if (detail.taskId === "placement") setStageOverride("Placement");

      if (detail.workspaceSection) {
        setExpandedWorkspace((current) => {
          const next = new Set(current);
          next.add(detail.workspaceSection!);
          return next;
        });
      }
    }

    function handleStageAction(event: Event) {
      const detail = (event as CustomEvent<{ candidateId?: string; stage?: string }>).detail;
      if (!detail || detail.candidateId !== candidateId || !isCandidateWorkflowStage(detail.stage)) return;
      setStageOverride(detail.stage);
    }

    window.addEventListener("candidate360-complete-task", handleWorkflowAction);
    window.addEventListener("candidate360-advance-stage", handleStageAction);
    return () => {
      window.removeEventListener("candidate360-complete-task", handleWorkflowAction);
      window.removeEventListener("candidate360-advance-stage", handleStageAction);
    };
  }, [candidateId, validationItems]);

  useEffect(() => {
    if (!hydratedRef.current) {
      hydratedRef.current = true;
      return;
    }

    setStatus("syncing");
    const timeout = window.setTimeout(() => {
      void persistWorkspace(false);
    }, 900);
    return () => window.clearTimeout(timeout);
  }, [completedActions, completedWorkflowActions, workflowNotes, workspaceNotes]);

  function toggleAction(id: string) {
    setCompletedActions((current) => {
      const next = new Set(current);
      setCompletedAt((existing) => {
        const copy = { ...existing };
        if (next.has(id)) delete copy[id];
        else copy[id] = "Completed by Vy just now";
        return copy;
      });
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleValidationNote(id: string) {
    setExpandedValidationNotes((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleWorkspace(id: string) {
    setExpandedWorkspace((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function updateWorkspaceNote(key: string, value: string) {
    setWorkspaceNotes((current) => ({ ...current, [key]: value }));
    setLastEdited((current) => ({ ...current, [key]: "Edited just now" }));
  }

  function handleShortcut(event: KeyboardEvent<HTMLElement>) {
    if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
      event.preventDefault();
      void persistWorkspace(true);
    }
  }

  return (
    <div className="space-y-7">
      <section className="c360-surface-1 rounded-[24px] p-3 ring-1" id="validation-checklist">
        {workflow.allComplete ? (
          <div className="mb-3 c360-hover-lift rounded-2xl bg-emerald-950/18 p-3 ring-1 ring-emerald-500/20 transition-all duration-200">
            <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-emerald-200">Ready</div>
            <div className="mt-1 text-xl font-black text-white">Ready for Client Submission</div>
            <div className="mt-1 text-sm text-emerald-100">Required validations are complete. Generate the client submission package next.</div>
            <button type="button" aria-label="Prepare client summary" onClick={() => setStageOverride("Client Review")} className="mt-3 inline-flex rounded-full bg-emerald-500/15 px-3 py-1.5 text-xs font-bold text-emerald-100 ring-1 ring-emerald-500/25 transition hover:bg-emerald-500/20">Prepare Client Summary</button>
          </div>
        ) : null}

        <div className="mb-3 grid gap-3 border-b border-slate-800/50 pb-3 md:grid-cols-[240px_minmax(0,1fr)_240px]">
          <div>
            <div className="text-[10px] uppercase tracking-[0.16em] text-slate-500">Validation Progress</div>
            <div className="mt-1 text-2xl font-black text-white transition-all duration-200">{completedCount} / {validationItems.length} completed</div>
            <div className="mt-1 text-xs font-semibold text-slate-500">{remainingCount} validation checks remaining</div>
          </div>
          <div className="self-center">
            <div className="flex gap-1">
              {validationItems.map((item) => (
                <div key={item.id} className={(completedActions.has(item.id) ? "bg-cyan-300" : "bg-slate-800") + " h-2 flex-1 rounded-full transition-all duration-500"} />
              ))}
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2 text-center text-xs">
            <div><div className="text-lg font-black text-amber-100">{criticalRemaining}</div><div className="text-slate-500">Critical</div></div>
            <div><div className="text-lg font-black text-slate-200">{importantRemaining}</div><div className="text-slate-500">Important</div></div>
            <div><div className="text-lg font-black text-white">{optionalRemaining}</div><div className="text-slate-500">Optional</div></div>
          </div>
        </div>

        <div className="grid gap-2 md:grid-cols-2">
          {validationItems.map((item) => {
            const completed = completedActions.has(item.id);
            return (
              <div key={item.id} className={(completed ? "bg-emerald-950/12 ring-emerald-500/15" : "bg-[#111820]/75 ring-slate-800/25") + " c360-hover-lift rounded-xl px-3 py-2 text-sm text-slate-200 ring-1 transition-all duration-200"}>
                <button type="button" aria-pressed={completed} onClick={() => toggleAction(item.id)} className="c360-focus-ring flex w-full items-start gap-3 text-left">
                  <span aria-hidden="true" className={(completed ? "text-emerald-300" : "text-slate-500") + " mt-0.5 text-sm transition-colors duration-300"}>{completed ? "\u2713" : "\u25CB"}</span>
                  <span className="flex-1">
                    <span className="block font-semibold text-slate-100">{item.label}</span>
                    <span className="mt-1 flex flex-wrap gap-2 text-[11px] text-slate-500"><span>Priority: {item.priority}</span><span>Status: {completed ? "Completed" : "Pending"}</span><span>Owner: Recruiter</span></span>{completed ? <span className="mt-1 block text-[11px] text-emerald-200">{completedAt[item.id]}</span> : null}
                  </span>
                  <span className="rounded-full bg-slate-950/60 px-2 py-0.5 text-[10px] font-bold text-slate-400 ring-1 ring-slate-800/60">{item.effort}</span>
                </button>
                {expandedValidationNotes.has(item.id) ? (
                  <textarea
                    value={workflowNotes[item.id] || ""}
                    onChange={(event) => setWorkflowNotes((current) => ({ ...current, [item.id]: event.target.value }))}
                    onKeyDown={handleShortcut}
                    placeholder="Add validation note"
                    className="c360-focus-ring mt-2 min-h-16 w-full rounded-xl border border-slate-800/50 bg-[#0B1118] px-3 py-2 text-xs text-slate-200 outline-none transition-all duration-200 placeholder:text-slate-600 focus:border-cyan-500/35"
                  />
                ) : (
                  <button type="button" onClick={() => toggleValidationNote(item.id)} className="c360-focus-ring mt-2 text-xs font-semibold text-cyan-100 transition hover:text-white">+ Add validation note</button>
                )}
              </div>
            );
          })}
        </div>
      </section>

      <section className="c360-surface-1 rounded-[24px] p-3 ring-1" id="candidate-readiness">
        <div className="mb-3 grid gap-3 border-b border-slate-800/50 pb-3 xl:grid-cols-[220px_minmax(0,1fr)_220px]">
          <div>
            <div className="text-[10px] uppercase tracking-[0.16em] text-slate-500">Submission Status</div>
            <div className={(workflow.allComplete ? "text-emerald-100" : "text-white") + " mt-1 text-3xl font-black transition-colors duration-200"}>{workflow.submissionStatus}</div>
            <div className="mt-1 text-xs font-semibold text-slate-500">{workflow.statusReason}</div>
          </div>
          <div>
            <div className="text-[11px] uppercase tracking-[0.16em] text-slate-500">Current Blockers</div>
            <div className="mt-2 flex flex-wrap gap-2">
              {(workflow.blockers.length ? workflow.blockers : ["Required validations complete"]).map((item) => (
                <span key={item} className={(workflow.blockers.length ? "bg-amber-950/20 text-amber-100 ring-amber-500/20" : "bg-emerald-950/20 text-emerald-100 ring-emerald-500/20") + " rounded-full px-3 py-1 text-xs font-semibold ring-1 transition-all duration-200"}>{item}</span>
              ))}
            </div>
          </div>
          <div className="c360-surface-2 rounded-2xl px-3 py-2 ring-1">
            <div className="text-[10px] uppercase tracking-[0.16em] text-slate-500">Estimated Effort</div>
            <div className="mt-1 text-sm font-semibold text-white transition-all duration-200">{effortLabel(workflow.remainingEffort)}</div>
            <div className="mt-2 text-[10px] uppercase tracking-[0.16em] text-slate-500">Suggested Next Step</div>
            <div className="mt-1 text-xs font-semibold text-cyan-100">{workflow.nextBestAction}</div>
          </div>
        </div>
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-6">
          {readinessFields.map(([label, value]) => {
            const updatedValue = workflow.allComplete && /availability|notice|work authorization|relocation|travel/i.test(label) ? "Verified" : value;
            return (
              <div key={label} className="c360-surface-2 c360-hover-lift rounded-2xl px-3 py-2.5 ring-1 transition-all duration-200">
                <div className="text-[10px] uppercase tracking-[0.16em] text-slate-500">{label}</div>
                <div className="mt-1 text-sm font-semibold leading-5 text-white">{updatedValue}</div>
              </div>
            );
          })}
        </div>
      </section>

      <section className="c360-surface-1 rounded-[24px] p-3 ring-1" id="recruiter-notes">
        <div className="space-y-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">Recruiter Workspace</div>
              <div className="mt-1 text-sm font-semibold text-slate-200">Recruiter notebook with rich notes, tables, mentions and Ctrl+Enter save.</div>
            </div>
            <div className={(status === "syncing" ? "text-cyan-200" : status === "error" ? "text-red-200" : "text-emerald-200") + " c360-autosave-pulse rounded-full bg-slate-950/50 px-3 py-1 text-xs font-bold ring-1 ring-slate-800/60"}>
              {status === "syncing" ? "Syncing..." : status === "error" ? "Save failed" : status === "saved" ? "Saved just now" : "Saved"}
            </div>
          </div>

          <div className="space-y-2">
            {WORKSPACE_SECTIONS.map((section) => {
              const open = expandedWorkspace.has(section.id);
              return (
                <div key={section.id} className="c360-surface-2 c360-hover-lift rounded-2xl ring-1 transition duration-200 hover:ring-slate-700/55">
                  <button type="button" onClick={() => toggleWorkspace(section.id)} className="c360-focus-ring flex w-full items-center justify-between gap-3 px-3 py-2 text-left">
                    <span>
                      <span className="block text-sm font-semibold text-slate-100">{section.label}</span>
                      <span className="mt-0.5 block text-xs text-slate-500">{section.description}</span>
                    </span>
                    <span className="text-xs font-semibold text-slate-500">{open ? "Collapse" : "Expand"}</span>
                  </button>
                  {open ? (
                    <div className="border-t border-slate-800/45 px-3 py-3 transition-all duration-200">
                      <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-[11px] font-semibold">
                        <span className="rounded-full bg-slate-950/35 px-2.5 py-1 text-slate-500 ring-1 ring-slate-800/45">Saved just now</span>
                        <span className="text-slate-600">Autosaves each section</span>
                      </div>
                      <div className="grid gap-3 lg:grid-cols-2">
                        {section.fields.map((field) => {
                          const key = noteKey(section.id, field.id);
                          const value = workspaceNotes[key] || "";
                          return (
                            <div key={field.id} className="c360-surface-3 rounded-2xl p-3 ring-1 ring-slate-800/45">
                              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                                <div>
                                  <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">{field.label}</div>
                                  <div className="mt-0.5 text-[11px] text-slate-600">{lastEdited[key] || "Saved just now"}</div>
                                </div>
                              </div>
                              <Candidate360NotebookEditor
                                editorKey={key}
                                value={value}
                                placeholder={field.placeholder}
                                suggestions={field.suggestions || section.suggestions}
                                sectionLabel={section.label}
                                sectionDescription={section.description}
                                blockLabel={field.label}
                                onChange={(nextValue) => updateWorkspaceNote(key, nextValue)}
                                onSave={() => persistWorkspace(true)}
                              />
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>

          <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-600">
            <span>{saving ? "Syncing..." : status === "saved" ? "Saved just now" : "Autosave enabled"}</span>
            <span>Ctrl+Enter saves the active block.</span>
          </div>
        </div>
      </section>
    </div>
  );
}
