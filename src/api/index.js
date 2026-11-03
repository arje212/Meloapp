import { supabase } from '@/lib/supabase';

const db = (table) => supabase.from(table);

const parseSort = (sort = '') => ({
  column: sort.replace('-', '') || 'created_date',
  ascending: !sort.startsWith('-')
});

const compactPayload = (payload) => Object.fromEntries(
  Object.entries(payload || {}).filter(([, value]) => value !== undefined)
);

const isMissingColumnError = (error) => {
  const message = `${error?.message || ''} ${error?.details || ''}`;
  return error?.code === 'PGRST204' || /column .* does not exist|could not find .* column/i.test(message);
};

const findMissingColumn = (error) => {
  const message = `${error?.message || ''} ${error?.details || ''}`;
  return message.match(/'([^']+)' column/i)?.[1] ||
    message.match(/column "([^"]+)"/i)?.[1] ||
    null;
};

const withoutColumn = (payload, column) => {
  const { [column]: _removed, ...rest } = payload;
  return rest;
};

// Generic helpers
const list = async (table, sort, limit = 100, select = '*') => {
  const { column, ascending } = parseSort(sort);
  const { data, error } = await db(table).select(select).order(column, { ascending }).limit(limit);
  if (error) throw error;
  return data || [];
};

const filter = async (table, filters = {}, sort, limit = 100, select = '*') => {
  const { column, ascending } = parseSort(sort);
  let query = db(table).select(select).order(column, { ascending }).limit(limit);
  Object.entries(filters).forEach(([k, v]) => {
    if (v === undefined) return;
    query = Array.isArray(v) ? query.in(k, v) : query.eq(k, v);
  });
  const { data, error } = await query;
  if (error) throw error;
  return data || [];
};

const get = async (table, id) => {
  const { data, error } = await db(table).select('*').eq('id', id).single();
  if (error) throw error;
  return data;
};

const create = async (table, payload) => {
  let nextPayload = compactPayload(payload);

  for (let attempt = 0; attempt < 8; attempt += 1) {
    const { data, error } = await db(table).insert(nextPayload).select().single();
    if (!error) return data;

    const missingColumn = findMissingColumn(error);
    if (!isMissingColumnError(error) || !missingColumn || !(missingColumn in nextPayload)) {
      throw error;
    }

    console.warn(`[api] ${table}.create: column "${missingColumn}" not found in DB - field NOT saved.`);
    nextPayload = withoutColumn(nextPayload, missingColumn);
  }

  throw new Error(`Unable to create ${table}: schema mismatch.`);
};

const update = async (table, id, payload) => {
  let nextPayload = compactPayload(payload);

  for (let attempt = 0; attempt < 8; attempt += 1) {
    const { data, error } = await db(table).update(nextPayload).eq('id', id).select().single();
    if (!error) return data;

    const missingColumn = findMissingColumn(error);
    if (!isMissingColumnError(error) || !missingColumn || !(missingColumn in nextPayload)) {
      throw error;
    }

    console.warn(`[api] ${table}.update: column "${missingColumn}" not found in DB - field NOT saved.`);
    nextPayload = withoutColumn(nextPayload, missingColumn);
  }

  throw new Error(`Unable to update ${table}: schema mismatch.`);
};

const remove = async (table, id) => {
  const { error } = await db(table).delete().eq('id', id);
  if (error) throw error;
};

// Entity factory
const entity = (table, defaultSelect = '*') => ({
  list: (sort, limit) => list(table, sort, limit, defaultSelect),
  filter: (filters, sort, limit) => filter(table, filters, sort, limit, defaultSelect),
  get: (id) => get(table, id),
  create: (payload) => create(table, payload),
  update: (id, payload) => update(table, id, payload),
  delete: (id) => remove(table, id),
});

// All tables use created_date
export const Posts = entity('posts', '*, profiles(full_name,email,avatar_url)');
export const Comments = entity('comments');
export const Mountains = entity('mountains');
export const Trips = entity('trips');
export const Agencies = entity('agencies');
export const TourPackages = entity('tour_packages');
export const Bookings = entity('bookings');
export const TripMembers = entity('trip_members');
export const ChatRooms = entity('chat_rooms');
export const ChatMessages = entity('chat_messages');
export const Achievements = entity('achievements');
export const Notifications = entity('notifications');
export const Follows = entity('follows');
export const TripReviews = entity('trip_reviews');
export const Roadmaps = entity('roadmaps');
export const AgencySubscriptions = entity('agency_subscriptions');
// Used by AgencyDetail / AgencyDashboard but previously not mapped (calls threw TypeError).
// NOTE: these tables must exist in Supabase (agency_reviews, agency_reports, agency_banners).
export const AgencyReviews = entity('agency_reviews');
export const AgencyReports = entity('agency_reports');
export const AgencyBanners = entity('agency_banners');

// Profiles — extended
export const Profiles = {
  ...entity('profiles'),
  list: (sort, limit) => list('profiles', sort || '-created_date', limit || 100),
};

// Auth helpers
export const getCurrentUser = async () => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase.from('profiles').select('*').eq('id', user.id).single();
  return data;
};
