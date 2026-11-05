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
