import { addDays, isValid, parseISO, startOfDay } from 'date-fns';

export const TRIP_EXPIRY_GRACE_DAYS = 2;

export function isTripExpired(trip, now = new Date()) {
  const lastTripDate = trip?.end_date || trip?.start_date;
  if (typeof lastTripDate !== 'string' || !lastTripDate) return false;

  const parsedDate = parseISO(lastTripDate);
  if (!isValid(parsedDate)) return false;

  const expiryDate = addDays(startOfDay(parsedDate), TRIP_EXPIRY_GRACE_DAYS);
  return startOfDay(now).getTime() >= expiryDate.getTime();
}

/**
 * Dates arrive as 'YYYY-MM-DD', as full ISO timestamps, or as Date objects.
 * (new Date(value + 'T00:00:00') broke on the last two and printed "Invalid Date".)
 * Returns a local Date at midnight, or null when the value is not a date.
 */
export function toLocalDate(value) {
  if (value instanceof Date) return isValid(value) ? value : null;
  if (typeof value !== 'string' && typeof value !== 'number') return null;
  const text = String(value).trim();
  const ymd = text.match(/^(\d{4})-(\d{2})-(\d{2})/);
  const date = ymd ? new Date(Number(ymd[1]), Number(ymd[2]) - 1, Number(ymd[3])) : new Date(text);
  return isValid(date) ? date : null;
}

/** Safe replacement for new Date(x + 'T00:00:00').toLocaleDateString(...): never prints "Invalid Date". */
export function formatDay(value, locale = 'en-PH', options = { month: 'short', day: 'numeric' }) {
  const date = toLocalDate(value);
  return date ? date.toLocaleDateString(locale, options) : '';
}
