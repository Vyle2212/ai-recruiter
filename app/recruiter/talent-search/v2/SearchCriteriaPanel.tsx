"use client";
import { useEffect, useState } from "react";
import type { CandidateSearchCriterion } from "@/lib/candidateSearchV2Types";
import TransactionalDrawer from "./TransactionalDrawer";
export default function SearchCriteriaPanel({
  criteria,
  onApply,
  onCancel,
}: {
  criteria: readonly CandidateSearchCriterion[];
  onApply: (criteria: CandidateSearchCriterion[], promoteIds: string[]) => void;
  onCancel: () => void;
}) {
  const [draft, setDraft] = useState<CandidateSearchCriterion[]>([...criteria]);
  const [promoteIds,setPromoteIds]=useState<string[]>([]);
  const [label, setLabel] = useState(""),
    update = (id: string, patch: Partial<CandidateSearchCriterion>) =>
      setDraft(
        draft.map((item) => (item.id === id ? { ...item, ...patch } : item)),
      ),
    move = (index: number, direction: -1 | 1) => {
      const target = index + direction;
      if (target < 0 || target >= draft.length) return;
      const next = [...draft];
      [next[index], next[target]] = [next[target], next[index]];
      setDraft(next);
    },
    add = () => {
      const value = label.trim();
      if (!value) return;
      setDraft([
        ...draft,
        {
          id: `criterion:user:${Date.now()}`,
          label: value,
          importance: "important",
          source: "filter",
        },
      ]);
      setLabel("");
    };
  useEffect(() => {setDraft([...criteria]);setPromoteIds([])}, [criteria]);
  return (
    <TransactionalDrawer id="search-criteria-panel" title="Ranking Criteria" description="Criteria rank only candidates who passed all Required Filters. They never exclude candidates unless you explicitly make them required." onCancel={onCancel} footer={<div className="flex items-center justify-between gap-3"><span className="text-sm text-slate-400">{draft.length} {draft.length===1?"criterion":"criteria"} will be applied</span><div className="flex gap-2"><button type="button" onClick={onCancel} className="rounded-lg border border-slate-700 px-4 py-2 text-sm text-slate-200">Cancel</button><button type="button" onClick={()=>onApply(draft,promoteIds)} className="rounded-lg bg-cyan-300 px-4 py-2 text-sm font-semibold text-slate-950">Apply criteria</button></div></div>}>
      <ol className="mt-4 space-y-2">
        {draft.map((criterion, index) => (
          <li
            key={criterion.id}
            draggable
            onDragStart={(event) =>
              event.dataTransfer.setData("text/criterion-id", criterion.id)
            }
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => {
              const id = event.dataTransfer.getData("text/criterion-id"),
                from = draft.findIndex((item) => item.id === id);
              if (from < 0) return;
              const next = [...draft],
                [item] = next.splice(from, 1);
              next.splice(index, 0, item);
              setDraft(next);
            }}
            className="grid gap-3 rounded-xl border border-slate-800 bg-slate-900/30 p-4 md:grid-cols-[auto_1fr]"
          >
            <span aria-hidden="true" className="cursor-grab text-slate-500">
              ⋮⋮
            </span>
            <div className="md:col-span-1"><textarea
              aria-label={`Criterion ${index + 1}`}
              value={criterion.label}
              onChange={(event) =>
                update(criterion.id, { label: event.target.value })
              }
              rows={2}
              className="w-full resize-y rounded-lg border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm leading-5 text-white focus:border-cyan-400 focus:outline-none focus:ring-2 focus:ring-cyan-900"
            />
            {criterion.source==="ai_suggestion"?<span className="mt-1 block text-[11px] text-violet-300">AI suggestion · editable and removable</span>:null}</div>
            <select
              aria-label={`Importance for ${criterion.label}`}
              value={criterion.importance}
              onChange={(event) =>
                update(criterion.id, {
                  importance: event.target
                    .value as CandidateSearchCriterion["importance"],
                })
              }
              className="rounded border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white md:col-start-2"
            >
              <option value="most_important">Most important</option>
              <option value="important">Important</option>
              <option value="nice_to_have">Nice to have</option>
            </select>
            <div className="flex gap-1">
              <button
                type="button"
                aria-label={`Move ${criterion.label} up`}
                onClick={() => move(index, -1)}
                className="px-2 text-slate-300"
              >
                ↑
              </button>
              <button
                type="button"
                aria-label={`Move ${criterion.label} down`}
                onClick={() => move(index, 1)}
                className="px-2 text-slate-300"
              >
                ↓
              </button>
              <button
                type="button"
                onClick={() => {if(window.confirm(`Make “${criterion.label}” a Required Filter? This can exclude candidates after the next committed Search.`))setPromoteIds(current=>current.includes(criterion.id)?current:[...current,criterion.id])}}
                className="text-xs text-cyan-300 disabled:text-emerald-300"
                disabled={promoteIds.includes(criterion.id)}
              >
                {promoteIds.includes(criterion.id)?"Will be required":"Make required"}
              </button>
              <button
                type="button"
                onClick={() =>
                  setDraft(draft.filter((item) => item.id !== criterion.id))
                }
                className="text-xs text-rose-300"
              >
                Remove
              </button>
            </div>
          </li>
        ))}
      </ol>
      <div className="mt-3 flex gap-2">
        <input
          aria-label="Add ranking criterion"
          value={label}
          onChange={(event) => setLabel(event.target.value)}
          placeholder="Add evidence-based criterion"
          className="min-w-0 flex-1 rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"
        />
        <button
          type="button"
          onClick={add}
          className="rounded-lg border border-cyan-800 px-3 text-sm text-cyan-200"
        >
          Add
        </button>
      </div>
    </TransactionalDrawer>
  );
}
