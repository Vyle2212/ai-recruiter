import type {
  CandidateJobPreferences,
  Compensation,
} from "@/lib/candidateJobPreferences";
function compensation(c: Compensation, daily = false) {
  if (c.status !== "Provided") return c.status || "Not provided";
  return `${c.currency} ${c.amount}${c.maximum ? ` – ${c.maximum}` : ""} gross/${daily ? "day" : "month"}${c.negotiable ? " · Negotiable" : ""}`;
}
export default function CandidateJobPreferencesSummary({
  value: p,
}: {
  value: CandidateJobPreferences;
}) {
  if (!p.employmentType) return null;
  return (
    <section className="mt-5 rounded-xl border border-slate-700 bg-slate-900/40 p-4">
      <h3 className="font-semibold text-white">
        Job preferences & availability
      </h3>
      <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-slate-400">Employment type</dt>
          <dd>{p.employmentType}</dd>
        </div>
        <div>
          <dt className="text-slate-400">Working type</dt>
          <dd>{p.workingTypes?.join(" / ")}</dd>
        </div>
        <div>
          <dt className="text-slate-400">Notice period / Availability</dt>
          <dd>
            {p.availability}
            {p.availabilityDate ? ` · ${p.availabilityDate}` : ""}
            {p.availabilityDetails ? ` · ${p.availabilityDetails}` : ""}
          </dd>
        </div>
        {(
          [
            ["Current salary", p.currentSalary, false],
            ["Expected permanent salary", p.permanent, false],
            ["Expected contract daily rate", p.contract, true],
          ] as const
        ).map(([title, c, daily]) =>
          c?.status ? (
            <div key={title}>
              <dt className="text-slate-400">{title}</dt>
              <dd>{compensation(c, daily)}</dd>
              {c.benefits ? (
                <dd className="mt-1 whitespace-pre-wrap">
                  Perks & benefits: {c.benefits}
                </dd>
              ) : null}
            </div>
          ) : null,
        )}
      </dl>
      {p.workAuthorization?.length ? (
        <div className="mt-4">
          <h4 className="text-sm text-slate-400">Work authorization</h4>
          <ul className="mt-2 space-y-2 text-sm">
            {p.workAuthorization.map((r, i) => (
              <li key={i}>
                {r.country}: {r.status}
                {r.visaType ? ` · ${r.visaType}` : ""}
                {r.expiry ? ` · Expires ${r.expiry}` : ""} · Sponsorship:{" "}
                {r.sponsorship}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
