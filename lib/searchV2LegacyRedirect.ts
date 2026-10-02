const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function searchV2LegacyResultsUrl(
  incoming: Record<string, string | string[] | undefined>,
) {
  const query = new URLSearchParams();
  const first = (key: string) => {
    const value = incoming[key];
    return Array.isArray(value) ? value[0] : value;
  };
  const keyword = first("q") || first("keyword");
  if (keyword) query.set("q", keyword.slice(0, 500));
  for (const key of ["countries", "skills", "sapModules"]) {
    const values = incoming[key];
    for (const value of Array.isArray(values) ? values : values ? [values] : [])
      query.append(key, value.slice(0, 200));
  }
  const quality = first("matchQuality");
  if (quality && ["any", "relevant", "strong"].includes(quality))
    query.set("matchQuality", quality);
  const jobId = first("jobId");
  if (jobId && UUID.test(jobId)) query.set("jobId", jobId);
  else if (jobId?.startsWith("job-preview-")) query.set("previewJob", "1");
  return `/recruiter/talent-search/v2${query.size ? `?${query.toString()}` : ""}`;
}
