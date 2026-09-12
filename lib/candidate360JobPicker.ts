export type Candidate360JobPickerOption = {
  id: string;
  title: string;
  clientName: string;
  location: string;
  status: string;
  structuredRequirementsAvailable: boolean;
  [key: string]: unknown;
};

function normalizeJob(value: unknown): Candidate360JobPickerOption | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const item = value as Record<string, unknown>;
  const id = String(item.id || "").trim();
  const title = String(item.title || "").trim();
  if (!id || !title) return null;
  return {
    ...item,
    id,
    title,
    clientName: String(item.clientName || item.company || "").trim(),
    location: String(item.location || "").trim(),
    status: String(item.status || "").trim(),
    structuredRequirementsAvailable: Boolean(
      item.structuredRequirementsAvailable,
    ),
  };
}

export function jobsFromPayload(payload: unknown) {
  const jobs =
    payload && typeof payload === "object" && !Array.isArray(payload)
      ? (payload as Record<string, unknown>).jobs
      : [];
  if (!Array.isArray(jobs)) return [];
  return jobs
    .map(normalizeJob)
    .filter((job): job is Candidate360JobPickerOption => Boolean(job));
}

export function filterOpenJobs(
  jobs: Candidate360JobPickerOption[],
  query: string,
) {
  const normalizedQuery = query.normalize("NFKC").trim().toLocaleLowerCase();
  return jobs.filter((job) => {
    if (job.status && job.status !== "active") return false;
    if (!normalizedQuery) return true;
    return [job.title, job.clientName, job.location]
      .join(" ")
      .toLocaleLowerCase()
      .includes(normalizedQuery);
  });
}

export function jobClientName(job: Candidate360JobPickerOption) {
  return job.clientName.trim();
}
