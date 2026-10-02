export type ChatPlanRow = {
  status: string;
  plan_code: string;
  valid_from: string;
  valid_until: string | null;
};

/** Any current plan qualifies; candidate_chat is not a separate entitlement gate. */
export function anyActiveSubscription(rows: ChatPlanRow[], now: number): boolean {
  return rows.some((row) => {
    const from = Date.parse(row.valid_from);
    const until = row.valid_until ? Date.parse(row.valid_until) : Infinity;
    return row.status === "active" && Boolean(row.plan_code?.trim()) &&
      Number.isFinite(from) && from <= now && until > now;
  });
}
