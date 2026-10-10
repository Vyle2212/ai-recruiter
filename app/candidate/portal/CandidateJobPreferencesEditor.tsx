"use client";
import { useState } from "react";
import CandidateFieldPicker from "./CandidateFieldPicker";
import { candidateCountries } from "@/lib/candidateEditOptions";
import {
  availabilityOptions,
  employmentTypes,
  workingTypes,
  salaryStatuses,
  jobCurrencies,
  visaOptions,
  jobPreferenceIssues,
  type CandidateJobPreferences,
  type Compensation,
} from "@/lib/candidateJobPreferences";
function CompensationEditor({
  title,
  value,
  expected,
  daily,
  onChange,
  inputClass,
}: {
  title: string;
  value: Compensation;
  expected: boolean;
  daily?: boolean;
  onChange: (v: Compensation) => void;
  inputClass: string;
}) {
  const [benefitsOpen, setBenefitsOpen] = useState(Boolean(value.benefits));
  const issues = jobPreferenceIssues({
    employmentType: daily ? "Contract" : "Permanent",
    workingTypes: ["Remote"],
    availability: "Available immediately",
    [expected ? (daily ? "contract" : "permanent") : "currentSalary"]: value,
  });
  const prefix = expected
    ? daily
      ? "contract"
      : "permanent"
    : "currentSalary";
  const fieldClass = (key: string) =>
    issues[prefix + "." + key] || issues[prefix]
      ? inputClass.replace("border-slate-700", "border-red-400")
      : inputClass;
  const update = (key: string, next: unknown) =>
    onChange({ ...value, [key]: next });
  return (
    <div className="rounded-xl border border-slate-700 p-4">
      <h3 className="font-semibold">
        {title} {expected ? "*" : "(Optional)"}
      </h3>
      <label className="block mt-3 text-sm">
        {expected ? "Expected compensation" : "Disclosure"}
        <select
          className={fieldClass("status")}
          value={value.status || ""}
          onChange={(e) => update("status", e.target.value)}
        >
          <option value="">Choose…</option>
          {(expected ? ["Provided", "Open to discussion"] : salaryStatuses).map(
            (s) => (
              <option key={s}>{s}</option>
            ),
          )}
        </select>
      </label>
      {value.status === "Provided" ? (
        <>
          <div className="grid gap-3 sm:grid-cols-3">
            <label className="text-sm">
              Currency *
              <CandidateFieldPicker
                placeholder={`${title} currency`}
                inputClass={fieldClass("currency")}
                value={value.currency || ""}
                options={jobCurrencies}
                allowCustom={false}
                onChange={(v) => update("currency", v)}
              />
            </label>
            <label className="text-sm">
              {expected ? "From" : "Amount"} *
              <input
                aria-label={`${title} amount`}
                type="number"
                min="0"
                step="0.01"
                className={fieldClass("amount")}
                value={value.amount || ""}
                onChange={(e) => update("amount", e.target.value)}
              />
            </label>
            {expected ? (
              <label className="text-sm">
                To (optional)
                <input
                  aria-label={`${title} maximum`}
                  type="number"
                  min="0"
                  step="0.01"
                  className={fieldClass("maximum")}
                  value={value.maximum || ""}
                  onChange={(e) => update("maximum", e.target.value)}
                />
              </label>
            ) : null}
          </div>
          <p className="mt-2 text-xs text-slate-400">
            {daily
              ? "Gross per day, before tax."
              : "Gross per month, before tax. Enter the base amount; benefits are separate."}
          </p>
          {expected ? (
            <label className="mt-3 flex gap-2 text-sm">
              <input
                type="checkbox"
                checked={value.negotiable === true}
                onChange={(e) => update("negotiable", e.target.checked)}
              />
              Negotiable
            </label>
          ) : null}
        </>
      ) : null}
      <button
        type="button"
        onClick={() => setBenefitsOpen(!benefitsOpen)}
        className="mt-3 text-sm text-cyan-200"
      >
        {benefitsOpen ? "Hide" : "Add"} perks & benefits
      </button>
      {benefitsOpen ? (
        <label className="block text-sm mt-2">
          Perks & benefits
          <div className="my-2 flex flex-wrap gap-2">
            {[
              "Bonus",
              "13th month",
              "Allowances",
              "Health insurance",
              "Equity",
              "Paid leave",
              "Travel allowance",
            ].map((b) => (
              <button
                type="button"
                key={b}
                className="rounded-lg border border-slate-600 px-2 py-1 text-xs"
                onClick={() =>
                  update(
                    "benefits",
                    [value.benefits, b]
                      .filter(Boolean)
                      .join("; ")
                      .slice(0, 3000),
                  )
                }
              >
                {b} +
              </button>
            ))}
          </div>
          <textarea
            className={inputClass}
            maxLength={3000}
            value={value.benefits || ""}
            placeholder="Bonus, 13th/14th month, allowances, insurance, equity, paid leave, travel…"
            onChange={(e) => update("benefits", e.target.value)}
          />
        </label>
      ) : null}
    </div>
  );
}
export default function CandidateJobPreferencesEditor({
  value: p,
  onChange,
  inputClass,
}: {
  value: CandidateJobPreferences;
  onChange: (p: CandidateJobPreferences) => void;
  inputClass: string;
}) {
  const update = (key: string, next: unknown) =>
    onChange({ ...p, [key]: next });
  const issues = jobPreferenceIssues(p);
  const fieldClass = (key: string) =>
    issues[key]
      ? inputClass.replace("border-slate-700", "border-red-400")
      : inputClass;
  return (
    <section className="rounded-2xl border border-slate-800 bg-[#0B0F16] p-5">
      <h2 className="text-xl font-semibold">Job preferences & availability</h2>
      <p className="mt-2 text-sm text-slate-300">
        * Required. All salary amounts are gross. Confirm these details
        yourself; net salaries are not automatically converted.
      </p>
      <div className="mt-4 space-y-4">
        <CompensationEditor
          title="Current salary"
          value={p.currentSalary || {}}
          expected={false}
          onChange={(v) => update("currentSalary", v)}
          inputClass={inputClass}
        />
        <label className="block text-sm">
          Preferred employment type *
          <CandidateFieldPicker
            placeholder="Employment type"
            options={employmentTypes}
            allowCustom={false}
            value={p.employmentType || ""}
            inputClass={fieldClass("employmentType")}
            onChange={(v) => update("employmentType", v)}
          />
        </label>
        {p.employmentType === "Permanent" || p.employmentType === "Both" ? (
          <CompensationEditor
            title="Expected permanent salary"
            expected
            value={p.permanent || {}}
            onChange={(v) => update("permanent", v)}
            inputClass={inputClass}
          />
        ) : null}
        {p.employmentType === "Contract" || p.employmentType === "Both" ? (
          <CompensationEditor
            title="Expected contract daily rate"
            expected
            daily
            value={p.contract || {}}
            onChange={(v) => update("contract", v)}
            inputClass={inputClass}
          />
        ) : null}
        <fieldset
          className={
            issues.workingTypes ? "rounded-lg border border-red-400/60 p-3" : ""
          }
        >
          <legend className="text-sm">
            Preferred working type * (select all acceptable)
          </legend>
          <div className="mt-3 flex flex-wrap gap-5">
            {workingTypes.map((t) => (
              <label className="flex gap-2 text-sm" key={t}>
                <input
                  type="checkbox"
                  checked={p.workingTypes?.includes(t) || false}
                  onChange={(e) =>
                    update(
                      "workingTypes",
                      e.target.checked
                        ? [...(p.workingTypes || []), t]
                        : (p.workingTypes || []).filter((x) => x !== t),
                    )
                  }
                />
                {t}
              </label>
            ))}
          </div>
        </fieldset>
        <label className="block text-sm">
          Notice period / Availability *
          <CandidateFieldPicker
            placeholder="Availability"
            options={availabilityOptions}
            value={p.availability || ""}
            allowCustom={false}
            inputClass={fieldClass("availability")}
            onChange={(v) => update("availability", v)}
          />
        </label>
        {p.availability === "Specific date" ? (
          <label className="block text-sm">
            Available start date *
            <input
              type="date"
              className={inputClass}
              value={p.availabilityDate || ""}
              onChange={(e) => update("availabilityDate", e.target.value)}
            />
          </label>
        ) : null}
        {p.availability === "Other" ? (
          <label className="block text-sm">
            Availability details *
            <input
              className={inputClass}
              value={p.availabilityDetails || ""}
              onChange={(e) => update("availabilityDetails", e.target.value)}
            />
          </label>
        ) : null}
        <h3 className="font-semibold">
          Work authorization / Visa status (Optional)
        </h3>
        <p className="text-xs text-slate-400">
          Specify the country you want to work in. A visa/pass and employer
          sponsorship are separate details.
        </p>
        {(p.workAuthorization || []).map((r, i) => {
          const rowUpdate = (key: string, v: string) =>
            update(
              "workAuthorization",
              p.workAuthorization!.map((x, j) =>
                j === i
                  ? {
                      ...x,
                      [key]: v,
                      ...(key === "country"
                        ? { status: "", visaType: "" }
                        : {}),
                    }
                  : x,
              ),
            );
          return (
            <div key={i} className="rounded-xl border border-slate-700 p-3">
              <div className="grid gap-3 md:grid-cols-2">
                <label className="text-sm">
                  Work country
                  <CandidateFieldPicker
                    placeholder="Work country"
                    value={r.country}
                    options={candidateCountries.map((c) => c.name)}
                    allowCustom={false}
                    inputClass={inputClass}
                    onChange={(v) => rowUpdate("country", v)}
                  />
                </label>
                <label className="text-sm">
                  Status
                  <CandidateFieldPicker
                    placeholder="Visa status"
                    value={r.status}
                    options={visaOptions(r.country)}
                    allowCustom={false}
                    inputClass={inputClass}
                    onChange={(v) => rowUpdate("status", v)}
                  />
                </label>
                <label className="text-sm">
                  Visa / pass type (additional details)
                  <input
                    className={inputClass}
                    value={r.visaType || ""}
                    onChange={(e) => rowUpdate("visaType", e.target.value)}
                  />
                </label>
                <label className="text-sm">
                  Expiry (if applicable)
                  <input
                    type="date"
                    className={inputClass}
                    value={r.expiry || ""}
                    onChange={(e) => rowUpdate("expiry", e.target.value)}
                  />
                </label>
                <label className="text-sm">
                  Employer sponsorship required?
                  <select
                    className={inputClass}
                    value={r.sponsorship || ""}
                    onChange={(e) => rowUpdate("sponsorship", e.target.value)}
                  >
                    <option value="">Choose…</option>
                    {["Yes", "No", "Unsure"].map((s) => (
                      <option key={s}>{s}</option>
                    ))}
                  </select>
                </label>
              </div>
              <button
                type="button"
                className="mt-3 text-sm text-red-300"
                onClick={() =>
                  update(
                    "workAuthorization",
                    p.workAuthorization!.filter((_, j) => j !== i),
                  )
                }
              >
                Remove authorization
              </button>
            </div>
          );
        })}
        <button
          type="button"
          className="text-sm text-cyan-200"
          onClick={() =>
            update("workAuthorization", [
              ...(p.workAuthorization || []),
              { country: "", status: "", sponsorship: "" },
            ])
          }
        >
          Add work authorization
        </button>
        {Object.keys(issues).length ? (
          <div
            role="status"
            className="rounded-lg border border-red-400/60 p-3 text-sm text-red-300"
          >
            <ul className="list-disc pl-5">
              {Object.entries(issues).map(([key, reason]) => (
                <li key={key}>{reason}</li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
    </section>
  );
}
