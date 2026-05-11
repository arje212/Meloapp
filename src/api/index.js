import { supabase } from '@/lib/supabase';

const db = (table) => supabase.from(table);

const parseSort = (sort = '') => ({
  column: sort.replace('-', '') || 'created_date',
  ascending: !sort.startsWith('-')
});

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
  Object.entries(filters).forEach(([k, v]) => { query = query.eq(k, v); });
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
  const { data, error } = await db(table).insert(payload).select().single();
  if (error) throw error;
  return data;
};

const update = async (table, id, payload) => {
  const { data, error } = await db(table).update(payload).eq('id', id).select().single();
  if (error) throw error;
  return data;
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
export const Posts = entity('posts');
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