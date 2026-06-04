/**
 * TripFeedShare.js
 * Helper functions for sharing trip events to the social feed (Supabase `posts` table).
 * Only uses columns that exist: author_id, post_type, trip_data, mountain_name,
 * mountain_id, content, likes_count, comments_count, status, audience, is_reel
 */

import { supabase } from '@/lib/supabase';

// ── Internal helpers ──────────────────────────────────────────────────────────

function buildTripMeta(trip) {
  return {
    id: trip.id,
    title: trip.title,
    mountain_name: trip.mountain_name || null,
    mountain_id: trip.mountain_id || null,
    start_date: trip.start_date || null,
    end_date: trip.end_date || null,
    budget_estimate: trip.budget_estimate || trip.price || null,
    max_participants: trip.max_participants || null,
    difficulty: trip.difficulty || null,
    status: trip.status || 'open',
    organizer_name: trip.agency_name || trip.organizer_name || null,
    organizer_email: trip.organizer_email || null,
    description: trip.description || null,
  };
}

function buildTripContent(trip, type) {
  const mountain = trip.mountain_name ? `🏔️ ${trip.mountain_name}` : '';
  const date = trip.start_date
    ? `📅 ${new Date(trip.start_date).toLocaleDateString('en-PH', { month: 'long', day: 'numeric', year: 'numeric' })}`
    : '';
  const budget = trip.budget_estimate
    ? `💰 ₱${Number(trip.budget_estimate).toLocaleString()}`
    : trip.price
    ? `💰 ₱${Number(trip.price).toLocaleString()}`
    : '';

  if (type === 'new') {
    return [
      `🗺️ New trip posted: ${trip.title}`,
      [mountain, date, budget].filter(Boolean).join('  '),
      trip.description ? trip.description.slice(0, 200) + (trip.description.length > 200 ? '...' : '') : '',
    ].filter(Boolean).join('\n');
  }

  if (type === 'going') {
    return [
      `✅ I'm going on a trip: ${trip.title}`,
      [mountain, date].filter(Boolean).join('  '),
    ].filter(Boolean).join('\n');
  }

  // manual
  return [
    `🏕️ Check out this trip: ${trip.title}`,
    [mountain, date, budget].filter(Boolean).join('  '),
    trip.description ? trip.description.slice(0, 200) + (trip.description.length > 200 ? '...' : '') : '',
  ].filter(Boolean).join('\n');
}

function buildInsertPayload(trip, user, type) {
  return {
    author_id: user.id,
    content: buildTripContent(trip, type),
    post_type: 'trip',
    is_reel: false,
    mountain_id: trip.mountain_id || null,
    mountain_name: trip.mountain_name || null,
    trip_data: buildTripMeta(trip),
    status: 'active',
    audience: 'public',
    likes_count: 0,
    comments_count: 0,
  };
}

// ── Share a newly created trip to the feed ────────────────────────────────────
export async function shareNewTripToFeed({ trip, user }) {
  try {
    const { error } = await supabase
      .from('posts')
      .insert(buildInsertPayload(trip, user, 'new'));
    if (error) throw error;
  } catch (err) {
    console.error('shareNewTripToFeed error:', err);
  }
}

// ── Share that a member is going on a trip ────────────────────────────────────
export async function shareRsvpGoingToFeed({ trip, user }) {
  try {
    const { error } = await supabase
      .from('posts')
      .insert(buildInsertPayload(trip, user, 'going'));
    if (error) throw error;
  } catch (err) {
    console.error('shareRsvpGoingToFeed error:', err);
  }
}

// ── Manual share (called from Share to Feed button in TripDetail) ─────────────
export async function shareTripManually({ trip, user }) {
  const { data: { user: authUser } } = await supabase.auth.getUser();
  if (!authUser) throw new Error('Not authenticated');

  const { data, error } = await supabase
    .from('posts')
    .insert(buildInsertPayload(trip, authUser, 'manual'))
    .select()
    .single();

  if (error) throw error;
  return data;
}