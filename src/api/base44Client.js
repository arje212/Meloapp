import * as API from '@/api/index';
import { supabase } from '@/lib/supabase';

export const base44 = {
  entities: {
    Post: API.Posts,
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
    User: API.Profiles,
  },
  auth: {
    me: API.getCurrentUser,
    logout: () => supabase.auth.signOut(),
    updateMe: async (updates) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      await supabase.from('profiles').update(updates).eq('id', user.id);
    },
  },
  integrations: {
    Core: {
      UploadFile: async ({ file }) => {
        const path = `uploads/${Date.now()}_${file.name}`;
        const { error } = await supabase.storage.from('files').upload(path, file);
        if (error) throw error;
        const { data } = supabase.storage.from('files').getPublicUrl(path);
        return { file_url: data.publicUrl };
      }
    }
  }
};