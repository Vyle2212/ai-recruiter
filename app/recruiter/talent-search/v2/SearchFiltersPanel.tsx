"use client";
import { useEffect, useMemo, useState } from "react";
import type { CandidateSearchV2Filters } from "@/lib/candidateSearchV2Types";
import {
  emptyFilterDrafts,
  validateAndCommitFilterDrafts,
  type FilterSection,
  type SearchFilterDrafts,
} from "@/lib/searchV2ReviewState";
import type { CommittedSearchRequirements } from "@/lib/searchV2CommittedRequirements";
import { canonicalHardRequirementCounts } from "@/lib/searchV2CommittedRequirements";
import TransactionalDrawer from "./TransactionalDrawer";
const SECTIONS: Array<{
  id: FilterSection;
  label: string;
  placeholder: string;
}> = [
  {
    id: "general",
    label: "Name, title, role and seniority",
    placeholder: "e.g. Current: Finance Systems Consultant, Role: Consultant",
  },
  {
    id: "location",
    label: "Location",
    placeholder: "e.g. Malaysia OR Singapore",
  },
  {
    id: "experience",
    label: "Total experience",
    placeholder: "e.g. 5+ years or 5-10 years",
  },
  {
    id: "relevantExperience",
    label: "Relevant experience",
    placeholder: "e.g. 3+ years or 3-7 years",
  },
  {
    id: "company",
    label: "Current or any company",
    placeholder: "e.g. Current: Example company",
  },
  {
    id: "industry",
    label: "Industry",
    placeholder: "e.g. Manufacturing, Banking",
  },
  {
    id: "skills",
    label: "Skills and modules",
    placeholder: "e.g. ERP finance, data migration",
  },
  {
    id: "delivery",
    label: "Project and delivery experience",
    placeholder: "e.g. Implementation, rollout, migration",
  },
  {
    id: "education",
    label: "Education",
    placeholder: "e.g. Bachelor's degree",
  },
  {
    id: "languages",
    label: "Required languages and proficiency",
    placeholder: "e.g. Japanese: business",
  },
  {
    id: "certifications",
    label: "Certifications",
    placeholder: "e.g. Required certification",
  },
  {
    id: "availability",
    label: "Availability and salary",
    placeholder: "e.g. Notice: 30",
  },
  {
    id: "authorization",
    label: "Work authorization",
    placeholder: "e.g. Local work authorization",
  },
  {
    id: "status",
    label: "Candidate status",
    placeholder: "e.g. Workflow: screened",
  },
  {
    id: "exclusions",
    label: "Exclusions",
    placeholder: "e.g. employer or skill to exclude",
  },
];
export default function SearchFiltersPanel({
  initial,
  onApply,
  onCancel,
  previewFor,
  committed,
}: {
  initial: CandidateSearchV2Filters;
  onApply: (filters: CandidateSearchV2Filters) => void;
  onCancel: () => void;
  previewFor: (
    filters: CandidateSearchV2Filters,
  ) => CommittedSearchRequirements;
  committed: CommittedSearchRequirements;
}) {
  const [drafts, setDrafts] = useState<SearchFilterDrafts>(emptyFilterDrafts()),
    [errors, setErrors] = useState<Record<string, string>>({}),
    [deliveryOperator, setDeliveryOperator] = useState<"any" | "all">("any");
  useEffect(() => {
    setDrafts({
      general: [
        ...(initial.candidateNames || []).map((value) => `Name: ${value}`),
        ...(initial.currentTitles || []).map((value) => `Current: ${value}`),
        ...(initial.professionalRoles || []).map((value) => `Role: ${value}`),
        ...(initial.seniorities || []).map((value) => `Seniority: ${value}`),
        ...(initial.anyTitles || []),
      ].join(", "),
      location: [
        ...(initial.countries || []),
        ...(initial.locations || []),
      ].join(", "),
      experience:
        initial.minimumTotalYearsExperience !== undefined
          ? `${initial.minimumTotalYearsExperience}${initial.maximumTotalYearsExperience !== undefined ? `-${initial.maximumTotalYearsExperience}` : "+"} years`
          : "",
      relevantExperience:
        initial.minimumRelevantYearsExperience !== undefined
          ? `${initial.minimumRelevantYearsExperience}${initial.maximumRelevantYearsExperience !== undefined ? `-${initial.maximumRelevantYearsExperience}` : "+"} years`
          : "",
      company: [
        ...(initial.currentEmployers || []).map((value) => `Current: ${value}`),
        ...(initial.anyEmployers || []).map((value) => `Any: ${value}`),
      ].join(", "),
      industry: (initial.industries || []).join(", "),
      skills: [...(initial.sapModules || []), ...(initial.skills || [])].join(
        ", ",
      ),
      delivery: (initial.deliveryExperience || []).join(", "),
      education: (initial.education || []).join(", "),
      languages: (initial.languages || [])
        .map((value) =>
          initial.languageProficiencies?.[value]
            ? `${value}: ${initial.languageProficiencies[value]}`
            : value,
        )
        .join(", "),
      certifications: (initial.certifications || []).join(", "),
      availability: [
        initial.maximumNoticePeriodDays !== undefined
          ? `Notice: ${initial.maximumNoticePeriodDays}`
          : "",
        initial.maximumExpectedSalary !== undefined
          ? `Salary: ${initial.maximumExpectedSalary}`
          : "",
      ]
        .filter(Boolean)
        .join(", "),
      authorization: (initial.workAuthorization || []).join(", "),
      status: [
        ...(initial.workflowStatuses || []).map(
          (value) => `Workflow: ${value}`,
        ),
        ...(initial.qualityStatuses || []).map((value) => `Quality: ${value}`),
      ].join(", "),
      exclusions: (initial.exclusions || []).join(", "),
    });
    setErrors({});
    setDeliveryOperator(
      initial.deliveryExperienceOperator === "all" ? "all" : "any",
    );
  }, [initial]);
  const preview = useMemo(
      () => validateAndCommitFilterDrafts(drafts, initial),
      [drafts, initial],
    ),
    counts = canonicalHardRequirementCounts(previewFor(preview.filters));
  const activeValues = useMemo(() => {
    const values = new Map<FilterSection, string[]>();
    for (const requirement of committed.requirements) {
      const section: FilterSection =
        requirement.kind === "location"
          ? "location"
          : requirement.kind === "experience"
            ? "experience"
            : requirement.kind === "company"
              ? "company"
              : requirement.kind === "industry"
                ? "industry"
                : requirement.kind === "education"
                  ? "education"
                  : requirement.kind === "certification"
                    ? "certifications"
                    : requirement.kind === "language"
                      ? "languages"
                      : requirement.kind === "lifecycle"
                        ? "delivery"
                        : requirement.kind === "exclusion"
                          ? "exclusions"
                          : ["professional_role", "seniority"].includes(
                                requirement.kind,
                              )
                            ? "general"
                            : "skills";
      values.set(section, [
        ...(values.get(section) || []),
        requirement.label.replace(/ · Required$/i, ""),
      ]);
    }
    return values;
  }, [committed]);
  const reset = (section: FilterSection) => {
      setDrafts((current) => ({ ...current, [section]: "" }));
      if (section === "delivery") setDeliveryOperator("any");
    },
    apply = () => {
      const result = validateAndCommitFilterDrafts(drafts, initial);
      setErrors({ ...result.errors });
      if (result.valid)
        onApply({
          ...result.filters,
          deliveryExperienceOperator: deliveryOperator,
        });
    };
  return (
    <TransactionalDrawer
      id="search-filter-panel"
      title="Candidate filters"
      description="Required Filters determine eligibility before scoring, totals and ranking."
      onCancel={onCancel}
      footer={
        <div className="flex items-center justify-between gap-3">
          <span className="text-sm text-slate-400">
            {counts.total} active Required Filters
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onCancel}
              className="rounded-lg border border-slate-700 px-4 py-2 text-sm text-slate-200"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={apply}
              className="rounded-lg bg-cyan-300 px-4 py-2 text-sm font-semibold text-slate-950"
            >
              Apply filters
            </button>
          </div>
        </div>
      }
    >
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="font-semibold text-white">Required Filters</h3>
          <p className="text-xs text-slate-400">
            {counts.total} active · every filter is enforced before totals and
            ranking
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            if (
              !Object.values(drafts).some(Boolean) ||
              window.confirm(
                "Reset all candidate filters? This only changes the open draft until you apply.",
              )
            ) {
              setDrafts(emptyFilterDrafts());
              setDeliveryOperator("any");
            }
          }}
          className="text-xs text-slate-300 underline"
        >
          Reset all
        </button>
      </div>
      <div className="mt-4 space-y-3">
        {SECTIONS.map((section) => (
          <details
            key={section.id}
            className="group rounded-xl border border-slate-800 bg-slate-900/30 p-3"
            open={Boolean(counts.counts[section.id])}
          >
            <summary className="flex cursor-pointer list-none items-center justify-between text-sm font-semibold text-slate-200">
              <span>
                {section.label}{" "}
                {counts.counts[section.id] ? (
                  <span className="ml-2 rounded-full bg-cyan-950 px-2 py-0.5 text-xs text-cyan-200">
                    {counts.counts[section.id]} active
                  </span>
                ) : null}
              </span>
              <button
                type="button"
                onClick={() => reset(section.id)}
                className="font-normal text-slate-500 hover:text-white"
              >
                Reset
              </button>
            </summary>
            <label className="mt-3 block">
              <span className="sr-only">{section.label}</span>
              {activeValues.get(section.id)?.length ? (
                <div
                  className="mb-2 flex flex-wrap gap-1.5"
                  aria-label={`Active ${section.label}`}
                >
                  {activeValues.get(section.id)!.map((value) => (
                    <span
                      key={value}
                      className="rounded-full border border-cyan-900 bg-cyan-950/40 px-2.5 py-1 text-xs text-cyan-100"
                    >
                      {value}
                    </span>
                  ))}
                </div>
              ) : null}
              <input
                value={drafts[section.id]}
                onChange={(event) =>
                  setDrafts((current) => ({
                    ...current,
                    [section.id]: event.target.value,
                  }))
                }
                placeholder={section.placeholder}
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm text-white placeholder:text-slate-600"
              />
            </label>
            {section.id === "delivery" ? (
              <label className="mt-3 block text-xs text-slate-300">
                Multiple lifecycle values require
                <select
                  value={deliveryOperator}
                  onChange={(event) =>
                    setDeliveryOperator(event.target.value as "any" | "all")
                  }
                  className="mt-1 block w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"
                >
                  <option value="any">Any of these (default)</option>
                  <option value="all">All of these</option>
                </select>
              </label>
            ) : null}
            {Object.entries(errors)
              .filter(
                ([key]) =>
                  key === section.id || key.startsWith(section.id.slice(0, -1)),
              )
              .map(([key, message]) => (
                <span
                  key={key}
                  role="alert"
                  className="mt-1 block text-xs text-rose-300"
                >
                  {message}
                </span>
              ))}
          </details>
        ))}
      </div>
    </TransactionalDrawer>
  );
}
