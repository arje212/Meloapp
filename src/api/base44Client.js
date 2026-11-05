import * as API from '@/api/index';
import { supabase } from '@/lib/supabase';

export const base44 = {
  entities: {
    Post: API.Posts,
    Comment: API.Comments,
    Mountain: API.Mountains,
    Trip: API.Trips,
    Agency: API.Agencies,
    TourPackage: API.TourPackages,
    Booking: API.Bookings,
    TripMember: API.TripMembers,
    ChatRoom: API.ChatRooms,
    ChatMessage: API.ChatMessages,
    Achievement: API.Achievements,
    Notification: API.Notifications,
    Follow: API.Follows,
    TripReview: API.TripReviews,
    Roadmap: API.Roadmaps,
    AgencySubscription: API.AgencySubscriptions,
    AgencyReview: API.AgencyReviews,
    AgencyReport: API.AgencyReports,
    AgencyBanner: API.AgencyBanners,
    User: API.Profiles,
  },
  auth: {
    me: API.getCurrentUser,
    logout: () => supabase.auth.signOut(),
    updateMe: async (updates) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      let payload = { ...updates };
      for (let attempt = 0; attempt < 6; attempt += 1) {
        const { error } = await supabase.from('profiles').update(payload).eq('id', user.id);
        if (!error) return;
        const col = (`${error.message || ''} ${error.details || ''}`.match(/'([^']+)' column/i) || [])[1];
        if (!col || !(col in payload)) throw error;
        console.warn(`[profile] column "${col}" does not exist in profiles - saved without it.`);
        const { [col]: _dropped, ...rest } = payload;
        payload = rest;
        if (Object.keys(payload).length === 0) return;
      }
    },
  },
  integrations: {
    Core: {
      UploadFile: async ({ file }) => {
        const ext = (file.name.split('.').pop() || 'bin').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 8) || 'bin';
        const path = `uploads/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
        const { error } = await supabase.storage.from('files').upload(path, file, { contentType: file.type });
        if (error) throw error;
        const { data } = supabase.storage.from('files').getPublicUrl(path);
        return { file_url: data.publicUrl };
      }
    }
  }
};