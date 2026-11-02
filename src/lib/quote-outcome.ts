// How the shop actually tracks a quotation: still waiting on the client, they
// pushed through (approved / billed), or they didn't (declined, with a reason).
export type Outcome = "waiting" | "pushed" | "not_pushed";

type QuoteLike = {
  status: string | null;
  created_at: string | null;
  converted_bill_id?: string | null;
  followed_up_at?: string | null;
};

export function outcomeOf(q: QuoteLike): Outcome {
  if (q.status === "approved" || q.converted_bill_id) return "pushed";
  if (q.status === "declined") return "not_pushed";
  return "waiting";
}

const DAY = 86400000;

/**
 * Waiting quotes worth a nudge: 2–30 days old, and not followed up in the last
 * 3 days. Older than 30 days is treated as cold and drops off the list.
 */
export function needsFollowUp(q: QuoteLike, now = Date.now()): boolean {
  if (outcomeOf(q) !== "waiting" || !q.created_at) return false;
  const age = now - Date.parse(q.created_at);
  if (age < 2 * DAY || age > 30 * DAY) return false;
  return !q.followed_up_at || now - Date.parse(q.followed_up_at) >= 3 * DAY;
}

export const OUTCOME_LABEL: Record<Outcome, string> = {
  waiting: "Waiting",
  pushed: "Pushed through",
  not_pushed: "Didn't push through",
};

export const OUTCOME_STYLE: Record<Outcome, string> = {
  waiting: "bg-blue-50 text-blue-700 border-blue-200",
  pushed: "bg-emerald-50 text-emerald-700 border-emerald-200",
  not_pushed: "bg-stone-100 text-stone-500 border-stone-200",
};

export const DECLINE_REASONS = ["Price too high", "Went to another shop", "No reply", "Postponed / next time", "Did it themselves"];
