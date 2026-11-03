// Single source of truth for plan -> commission rate (percent).
// Values are the SAME ones that were previously duplicated across files.
// `weekly` was only defined in AgencyDashboard (7%) and is kept for legacy rows.
export const PLAN_COMMISSION = { free: 10, starter: 7, weekly: 7, pro: 5, yearly: 3 };

// Visibility rank used for agency sorting / featured placement (higher = shown first).
export const PLAN_RANK = { free: 0, starter: 1, weekly: 1, pro: 2, yearly: 3 };
export const planRank = (planName) => PLAN_RANK[String(planName || 'free').toLowerCase()] ?? 0;

export const getCommissionRate = (planName) =>
  PLAN_COMMISSION[String(planName || 'free').toLowerCase()] ?? PLAN_COMMISSION.free;

// ---- Validity: every PAID plan (starter / pro / yearly) lasts 1 year from approval. ----
// Free never expires. Rows with no end_date (approved before dates were stored) are treated as
// still active, so nobody is silently downgraded; set their end_date to start the clock.
const pad = (n) => String(n).padStart(2, '0');

/** Local calendar date as YYYY-MM-DD. */
export const todayStr = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

/** Same calendar day one year later (Feb 29 -> Feb 28 on non-leap years). */
export function addOneYear(dateStr) {
  const [y, m, d] = String(dateStr).slice(0, 10).split('-').map(Number);
  let next = new Date(y + 1, m - 1, d);
  if (next.getMonth() !== m - 1) next = new Date(y + 1, m, 0);
  return todayStr(next);
}

/** Whole days from `today` to `dateStr` (negative if already past). */
export function daysUntil(dateStr, today = todayStr()) {
  const toMs = (s) => { const [y, m, d] = String(s).slice(0, 10).split('-').map(Number); return new Date(y, m - 1, d).getTime(); };
  return Math.round((toMs(dateStr) - toMs(today)) / 86400000);
}

/** A subscription is expired once its end_date has passed (valid THROUGH end_date). */
export const isSubscriptionExpired = (sub, today = todayStr()) =>
  !!sub?.end_date && String(sub.end_date).slice(0, 10) < today;

/**
 * End date for a newly approved PAID subscription: 1 year from today, or from the end of the
 * agency's still-active paid plan if they renew early (so remaining days are not lost).
 */
export function subscriptionEndDateFor(otherVerifiedSubs = [], today = todayStr()) {
  const activeEnds = (otherVerifiedSubs || [])
    .filter((s) => s?.status === 'verified' && s.plan !== 'free' && s.end_date && String(s.end_date).slice(0, 10) >= today)
    .map((s) => String(s.end_date).slice(0, 10))
    .sort();
  const base = activeEnds.length ? activeEnds[activeEnds.length - 1] : today;
  return addOneYear(base);
}

/**
 * Pick the subscription that should apply to an agency.
 * Only `verified`, NOT-expired rows count; if there are several, the NEWEST wins
 * (previously each screen used `[0]`, which is the OLDEST row).
 * Returns null when nothing applies - callers treat that as the Free plan.
 */
export function pickActiveSubscription(subs = [], today = todayStr()) {
  const valid = (subs || []).filter((s) => s?.status === 'verified' && !isSubscriptionExpired(s, today));
  if (valid.length === 0) return null;
  return [...valid].sort(
    (a, b) => String(b.created_date || '').localeCompare(String(a.created_date || ''))
  )[0];
}
