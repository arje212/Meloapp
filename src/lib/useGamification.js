// Gamification hooks for managing XP, levels, streaks, and achievements
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { calculateLevel, XP_REWARDS, ACHIEVEMENT_CONDITIONS } from '@/lib/gamification';

// ========== USER GAMIFICATION STATE ==========
export const useUserGamification = (userId) => {
  return useQuery({
    queryKey: ['user-gamification', userId],
    queryFn: async () => {
      if (!userId) return null;
      
      const { data, error } = await supabase
        .from('user_gamification')
        .select('*')
        .eq('user_id', userId)
        .single();
      
      if (error && error.code !== 'PGRST116') throw error;
      
      // Calculate level from total XP
      const levelData = calculateLevel(data?.total_xp || 0);
      
      return {
        ...data,
        ...levelData,
      };
    },
    enabled: !!userId,
    staleTime: 60_000, // 1 minute
  });
};

// ========== ADD XP MUTATION ==========
export const useAddXP = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ userId, xpAmount, reason }) => {
      if (!userId || !xpAmount) return null;
      
      // Get current state
      const { data: current } = await supabase
        .from('user_gamification')
        .select('total_xp, current_xp, level')
        .eq('user_id', userId)
        .single();
      
      const oldLevel = current?.level || 1;
      const newTotalXp = (current?.total_xp || 0) + xpAmount;
      const newLevel = calculateLevel(newTotalXp).level;
      
      // Update gamification
      const { data, error } = await supabase
        .from('user_gamification')
        .update({
          total_xp: newTotalXp,
          current_xp: (current?.current_xp || 0) + xpAmount,
        })
        .eq('user_id', userId)
        .select()
        .single();
      
      if (error) throw error;
      
      // Log activity
      await supabase.from('activity_feed').insert({
        user_id: userId,
        activity_type: 'xp_earned',
        title: `+${xpAmount} XP`,
        description: reason,
        icon: '⭐',
        is_public: false,
      });
      
      // Check for level up
      if (newLevel > oldLevel) {
        await supabase.from('activity_feed').insert({
          user_id: userId,
          activity_type: 'level_up',
          title: `🎉 Reached Level ${newLevel}!`,
          description: `You're now a ${calculateLevel(newTotalXp).title}`,
          icon: '👑',
          is_public: true,
        });
      }
      
      return { ...data, leveledUp: newLevel > oldLevel, newLevel };
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries(['user-gamification', variables.userId]);
      queryClient.invalidateQueries(['activity-feed', variables.userId]);
    },
  });
};

// ========== DAILY CHECK-IN ==========
export const useCheckIn = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (userId) => {
      if (!userId) return null;
      
      // Get current streak
      const { data: streak } = await supabase
        .from('check_in_streak')
        .select('*')
        .eq('user_id', userId)
        .single();
      
      const today = new Date().toISOString().split('T')[0];
      const lastCheckIn = streak?.last_check_in;
      
      let newStreak = 1;
      if (lastCheckIn) {
        const yesterday = new Date(new Date().setDate(new Date().getDate() - 1))
          .toISOString()
          .split('T')[0];
        
        if (lastCheckIn === yesterday) {
          newStreak = (streak?.streak_count || 0) + 1;
        }
      }
      
      // Update streak
      const { data } = await supabase
        .from('check_in_streak')
        .upsert({
          user_id: userId,
          streak_count: newStreak,
          last_check_in: today,
          best_streak: Math.max(newStreak, streak?.best_streak || 0),
        })
        .select()
        .single();

      // Award XP by reading current gamification row and updating directly
      const xpReward = XP_REWARDS.dailyCheckIn;
      const { data: currentGam } = await supabase
        .from('user_gamification')
        .select('total_xp, current_xp')
        .eq('user_id', userId)
        .single();

      const newTotal = (currentGam?.total_xp || 0) + xpReward;
      const newCurrent = (currentGam?.current_xp || 0) + xpReward;

      await supabase
        .from('user_gamification')
        .upsert({
          user_id: userId,
          total_xp: newTotal,
          current_xp: newCurrent,
          level: calculateLevel(newTotal).level,
        })
        .select()
        .single();
      
      // Log activity
      await supabase.from('activity_feed').insert({
        user_id: userId,
        activity_type: 'check_in',
        title: `🎯 Daily Check-In Day ${newStreak}`,
        description: `Keep the adventure alive! ${newStreak} days in a row`,
        icon: '🔥',
        is_public: false,
      });
      
      return { streak: data, xpEarned: xpReward };
    },
    onSuccess: (data, userId) => {
      queryClient.invalidateQueries(['user-gamification', userId]);
      queryClient.invalidateQueries(['check-in-streak', userId]);
    },
  });
};

// ========== UNLOCK ACHIEVEMENT ==========
export const useUnlockAchievement = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ userId, achievementId, xpBonus = 0 }) => {
      if (!userId || !achievementId) return null;
      
      // Check if already unlocked
      const { data: existing } = await supabase
        .from('user_achievements')
        .select('id')
        .eq('user_id', userId)
        .eq('achievement_id', achievementId)
        .single();
      
      if (existing) return { alreadyUnlocked: true };
      
      // Get achievement details
      const { data: achievement } = await supabase
        .from('achievement_templates')
        .select('*')
        .eq('id', achievementId)
        .single();
      
      // Unlock achievement
      const { data } = await supabase
        .from('user_achievements')
        .insert({
          user_id: userId,
          achievement_id: achievementId,
        })
        .select()
        .single();
      
      // Award XP by updating user's gamification row
      const totalXp = achievement?.xp_reward + (xpBonus || 0);
      const { data: curr } = await supabase
        .from('user_gamification')
        .select('total_xp, current_xp')
        .eq('user_id', userId)
        .single();

      const updatedTotal = (curr?.total_xp || 0) + totalXp;
      const updatedCurrent = (curr?.current_xp || 0) + totalXp;

      await supabase
        .from('user_gamification')
        .upsert({
          user_id: userId,
          total_xp: updatedTotal,
          current_xp: updatedCurrent,
          level: calculateLevel(updatedTotal).level,
        })
        .select()
        .single();
      
      // Log achievement
      await supabase.from('activity_feed').insert({
        user_id: userId,
        activity_type: 'achievement_unlocked',
        title: `🏆 ${achievement?.name}`,
        description: achievement?.description,
        icon: achievement?.icon,
        is_public: true,
      });
      
      return { achievement: data, xpEarned: totalXp };
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries(['user-gamification', variables.userId]);
      queryClient.invalidateQueries(['user-achievements', variables.userId]);
    },
  });
};

// ========== USER ACHIEVEMENTS ==========
export const useUserAchievements = (userId) => {
  return useQuery({
    queryKey: ['user-achievements', userId],
    queryFn: async () => {
      if (!userId) return [];
      
      const { data, error } = await supabase
        .from('user_achievements')
        .select('*, achievement_templates(*)')
        .eq('user_id', userId)
        .order('unlocked_at', { ascending: false });
      
      if (error) {
        console.warn('User achievements load failed, falling back:', error);
        return [];
      }
      return data || [];
    },
    enabled: !!userId,
  });
};

// ========== STREAK TRACKING ==========
export const useCheckInStreak = (userId) => {
  return useQuery({
    queryKey: ['check-in-streak', userId],
    queryFn: async () => {
      if (!userId) return null;
      
      const { data, error } = await supabase
        .from('check_in_streak')
        .select('*')
        .eq('user_id', userId)
        .single();
      
      if (error && error.code !== 'PGRST116') throw error;
      return data || { streak_count: 0, best_streak: 0 };
    },
    enabled: !!userId,
  });
};

// ========== ACTIVITY FEED ==========
export const useActivityFeed = (userId) => {
  return useQuery({
    queryKey: ['activity-feed', userId],
    queryFn: async () => {
      if (!userId) return [];
      
      const { data, error } = await supabase
        .from('activity_feed')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(20);
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!userId,
  });
};

// ========== LEADERBOARD ==========
export const useLeaderboard = (type = 'xp', period = 'all_time') => {
  return useQuery({
    queryKey: ['leaderboard', type, period],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('leaderboard_entries')
        .select('*, profiles(full_name, avatar_url, email)')
        .eq('leaderboard_type', type)
        .eq('period', period)
        .order('rank')
        .limit(50);
      
      if (error) throw error;
      return data || [];
    },
  });
};

// ========== MARK ACHIEVEMENT AS SEEN ==========
export const useMarkAchievementSeen = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (achievementId) => {
      const { data, error } = await supabase
        .from('user_achievements')
        .update({ seen: true })
        .eq('id', achievementId)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: (_, achievementId) => {
      queryClient.invalidateQueries(['user-achievements']);
    },
  });
};
