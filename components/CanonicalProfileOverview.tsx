import type { RecruiterCanonicalProfileOverview as Overview } from "@/lib/searchV2CandidateDetailContract";
import {
  candidateProfileMissingInformation,
  formatCandidateProfilePeriod,
} from "@/lib/candidateProfilePresentation";
import { canonicalCandidateSkillCollection } from "@/lib/candidateProfileSkills";
import type { ReactNode } from "react";

type DetailDestination = "Experience" | "Projects" | "Education" | "Skills";
export type ProfileDetailFocus = "education" | "certifications" | "training";
const card = "min-w-0 rounded-xl border border-slate-800 bg-slate-950/35 p-4";
const label = "text-[11px] font-medium uppercase tracking-wide text-slate-500";
const value = "mt-1 break-words text-sm text-slate-200";

function years(value: number | null) {
  if (value == null) return "Not provided";
  const rounded = Math.round(value);
  return `${rounded} ${rounded === 1 ? "year" : "years"}`;
}

function period(start: string | null, end: string | null) {
  return formatCandidateProfilePeriod(start, end);
}

function ViewAction({
  destination,
  label,
  focus,
  onNavigate,
}: {
  destination: DetailDestination;
  label?: string;
  focus?: ProfileDetailFocus;
  onNavigate?: (
    destination: DetailDestination,
    focus?: ProfileDetailFocus,
  ) => void;
}) {
  if (!onNavigate) return null;
  return (
    <button
      type="button"
      onClick={() => onNavigate(destination, focus)}
      className="mt-3 text-xs font-semibold text-cyan-300 hover:text-cyan-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-300"
    >
      {label ? `View all ${label}` : <>View all {destination}</>}
    </button>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className={card} aria-label={title}>
      <h4 className="text-sm font-semibold text-white">{title}</h4>
      <div className="mt-3 min-w-0">{children}</div>
    </section>
  );
}

export default function CanonicalProfileOverview({
  overview,
  onNavigate,
}: {
  overview: Overview;
  onNavigate?: (
    destination: DetailDestination,
    focus?: ProfileDetailFocus,
  ) => void;
}) {
  const current = overview.career.currentEmployment;
  const latest = overview.career.latestEmployment;
  const arrangement = overview.workArrangement;
  const canonicalSkills = canonicalCandidateSkillCollection(overview);
  const skillItemsWithoutLanguages = canonicalSkills.items.filter(
    (item) => item.group !== "Languages",
  );
  const skillPreview = skillItemsWithoutLanguages.slice(0, 8);
  const arrangementLine = (
    _key: keyof typeof arrangement.evidence,
    fieldLabel: string,
    fieldValue: string | null,
  ) => (fieldValue ? `${fieldLabel}: ${fieldValue}` : null);
  const arrangements = [
    arrangementLine(
      "workAuthorization",
      "Work authorization",
      arrangement.workAuthorization,
    ),
    arrangementLine("remote", "Work arrangement", arrangement.remote),
    arrangementLine("relocation", "Relocation", arrangement.relocation),
    arrangementLine("travel", "Travel", arrangement.travel),
    arrangementLine("noticePeriod", "Notice", arrangement.noticePeriod),
    arrangementLine("availability", "Availability", arrangement.availability),
  ].filter(Boolean);
  const hasCareer = Boolean(
    current ||
    latest ||
    overview.career.totalExperienceYears != null ||
    overview.career.employmentCount,
  );
  const hasSkills = skillItemsWithoutLanguages.length > 0;
  const hasEducation = Boolean(
    overview.education.count ||
    overview.certifications.count ||
    overview.training.count,
  );
  const missingInformation = candidateProfileMissingInformation(overview);
  const credentialPreview = [
    ...overview.certifications.items.map((item) => ({
      ...item,
      category: "Certification",
    })),
    ...overview.training.items.map((item) => ({
      ...item,
      category: "Training",
    })),
  ].slice(0, overview.education.highestOrLatest ? 1 : 2);

  return (
    <section
      data-testid="canonical-profile-overview"
      data-overview-version={overview.version}
      className="space-y-3 py-5"
      aria-labelledby="canonical-profile-overview-heading"
    >
      <div>
        <h3
          id="canonical-profile-overview-heading"
          className="text-lg font-semibold text-white"
        >
          Profile overview
        </h3>
        <p className="mt-1 text-xs text-slate-500">
          Key information from this candidate profile.
        </p>
      </div>

      {overview.professionalSummary ? (
        <Section title="Professional summary">
          <p className="line-clamp-3 break-words text-sm leading-6 text-slate-300">
            {overview.professionalSummary}
          </p>
          {overview.professionalSummary.length > 280 ? (
            <details className="mt-2">
              <summary className="cursor-pointer text-xs font-semibold text-cyan-300">
                Show more
              </summary>
              <p className="mt-2 break-words text-sm leading-6 text-slate-300">
                {overview.professionalSummary}
              </p>
            </details>
          ) : null}
        </Section>
      ) : null}

      {hasCareer || overview.career.projectCount ? (
        <Section title="Career overview">
          <dl className="grid min-w-0 gap-3 sm:grid-cols-2">
            {overview.career.employmentCount ? (
              <div>
                <dt className={label}>Verified employment history</dt>
                <dd className={value}>
                  {years(overview.career.totalExperienceYears)}
                </dd>
              </div>
            ) : (
              <div>
                <dt className={label}>Verified employment history</dt>
                <dd className={value}>Not provided</dd>
              </div>
            )}
            <div>
              <dt className={label}>Project assignments</dt>
              <dd className={value}>{overview.career.projectCount}</dd>
            </div>
            {current ? (
              <div>
                <dt className={label}>Current role</dt>
                <dd className={value}>
                  {current.title || "Role not provided"}
                  {current.employer ? ` · ${current.employer}` : ""}
                  {current.start ? ` · Since ${current.start}` : ""}
                </dd>
              </div>
            ) : latest ? (
              <div>
                <dt className={label}>Latest known role</dt>
                <dd className={value}>
                  {latest.title || "Role not provided"}
                  {latest.employer ? ` · ${latest.employer}` : ""}
                  {latest.start && latest.end
                    ? ` · ${period(latest.start, latest.end)}`
                    : ""}
                </dd>
              </div>
            ) : null}
            {!current ? (
              <p className="text-sm text-slate-400 sm:col-span-2">
                Current employment is not confirmed in this profile.
              </p>
            ) : null}
          </dl>
        </Section>
      ) : null}

      {hasSkills ? (
        <Section title="Skills and expertise">
          <div className="flex flex-wrap gap-2">
            {skillPreview.map((item) => (
              <span
                key={item.key}
                className="max-w-full break-words rounded-full border border-slate-700 px-2.5 py-1 text-xs text-slate-300"
                title={item.group}
              >
                {item.value}
              </span>
            ))}
            {skillItemsWithoutLanguages.length > skillPreview.length ? (
              <span className="px-1 py-1 text-xs font-medium text-slate-400">
                +{skillItemsWithoutLanguages.length - skillPreview.length} more
              </span>
            ) : null}
          </div>
          <p className="mt-2 text-xs text-slate-500">
            Grouped by SAP modules, expertise, delivery experience, tools and
            languages.
          </p>
          <ViewAction
            destination="Skills"
            onNavigate={hasSkills ? onNavigate : undefined}
          />
        </Section>
      ) : null}

      {overview.employmentHighlights.length ? (
        <Section title="Employment highlights">
          {
            <ol className="space-y-3">
              {overview.employmentHighlights.map((item) => (
                <li
                  key={item.id}
                  className="min-w-0 border-l border-slate-700 pl-3"
                >
                  <p className="break-words text-sm font-medium text-slate-200">
                    {item.title || "Role not provided"}
                  </p>
                  <p className="break-words text-xs text-slate-400">
                    {item.employer || "Company not provided"}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    {period(item.start, item.end)}
                  </p>
                </li>
              ))}
            </ol>
          }
          <ViewAction
            destination="Experience"
            onNavigate={
              overview.employmentHighlights.length ? onNavigate : undefined
            }
          />
        </Section>
      ) : null}

      {overview.projectHighlights.length ? (
        <Section title="Project highlights">
          {
            <ol className="space-y-3">
              {overview.projectHighlights.map((item) => (
                <li
                  key={item.id}
                  className="min-w-0 rounded-lg border border-slate-800 p-3"
                >
                  <p className="break-words text-sm font-medium text-slate-200">
                    {item.name || "Project name not provided in source"}
                  </p>
                  <p className="mt-1 break-words text-xs text-slate-400">
                    {[item.role, item.client ? `Client: ${item.client}` : ""]
                      .filter(Boolean)
                      .join(" · ") || "Project details not provided"}
                  </p>
                  {item.employer ? (
                    <p className="mt-1 break-words text-xs text-slate-400">
                      Employer: {item.employer}
                    </p>
                  ) : null}
                  <p className="mt-1 break-words text-xs text-slate-500">
                    {[
                      period(item.start, item.end),
                      ...item.lifecycle,
                      ...item.modules,
                    ]
                      .filter(Boolean)
                      .join(" - ")}
                  </p>
                  {item.linkedEmploymentIds.length ? (
                    <p className="mt-1 text-xs text-cyan-300">
                      Linked to employment history
                    </p>
                  ) : null}
                </li>
              ))}
            </ol>
          }
          <ViewAction
            destination="Projects"
            onNavigate={overview.career.projectCount ? onNavigate : undefined}
          />
        </Section>
      ) : null}

      {hasEducation ? (
        <Section title="Education and certifications">
          {overview.education.highestOrLatest ? (
            <div>
              <p className={label}>Highest or latest education</p>
              <p className={value}>
                {[
                  overview.education.highestOrLatest.qualification,
                  overview.education.highestOrLatest.institution,
                  overview.education.highestOrLatest.fieldOfStudy,
                  overview.education.highestOrLatest.completionDate,
                ]
                  .filter(Boolean)
                  .join(" - ")}
              </p>
              <p className="mt-1 text-xs text-slate-500">
                {overview.education.count} education record
                {overview.education.count === 1 ? "" : "s"}
              </p>
            </div>
          ) : null}
          {overview.certifications.count || overview.training.count ? (
            <div className={overview.education.count ? "mt-3" : ""}>
              <p className={label}>
                {overview.certifications.count} certification
                {overview.certifications.count === 1 ? "" : "s"} ·{" "}
                {overview.training.count} training course
                {overview.training.count === 1 ? "" : "s"}
              </p>
              <ul className="mt-2 space-y-1 text-sm text-slate-200">
                {credentialPreview.map((item) => (
                  <li
                    key={`${item.category}:${item.value}`}
                    className="break-words"
                  >
                    <span className="text-slate-500">{item.category}: </span>
                    {item.value}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          <div className="flex flex-wrap gap-4">
            <ViewAction
              destination="Education"
              focus="education"
              onNavigate={overview.education.count ? onNavigate : undefined}
            />
            <ViewAction
              destination="Education"
              focus="certifications"
              label="Certifications"
              onNavigate={
                overview.certifications.count ? onNavigate : undefined
              }
            />
            <ViewAction
              destination="Education"
              focus="training"
              label="Training"
              onNavigate={overview.training.count ? onNavigate : undefined}
            />
          </div>
        </Section>
      ) : null}

      {overview.languages.length || arrangements.length ? (
        <Section title="Languages and work arrangement">
          {overview.languages.length ? (
            <p className="break-words text-sm text-slate-300">
              {overview.languages
                .map(
                  (item) =>
                    `${item.value}${item.proficiency ? ` (${item.proficiency})` : ""}`,
                )
                .join(", ")}
            </p>
          ) : null}
          {arrangements.length ? (
            <p
              className={`${overview.languages.length ? "mt-3 " : ""}break-words text-sm text-slate-400`}
            >
              {arrangements.join("; ")}
            </p>
          ) : null}
        </Section>
      ) : null}

      {missingInformation.length ? (
        <p className="rounded-lg border border-slate-800 bg-slate-950/25 px-4 py-3 text-xs text-slate-400">
          Information not available: {missingInformation.join(", ")}.
        </p>
      ) : null}
    </section>
  );
}
