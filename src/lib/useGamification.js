// Gamification hooks for managing XP, levels, streaks, and achievements
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { calculateLevel, XP_REWARDS } from '@/lib/gamification';
import { todayStr } from '@/lib/plans';

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
      
      // Get current state (maybeSingle: a brand-new user has no row yet)
      const { data: current } = await supabase
        .from('user_gamification')
        .select('total_xp, current_xp, level')
        .eq('user_id', userId)
        .maybeSingle();

      const oldLevel = current?.level || 1;
      const newTotalXp = (current?.total_xp || 0) + xpAmount;
      const newLevel = calculateLevel(newTotalXp).level;

      // Update the row, or create it the first time (update alone failed for new users)
      const row = {
        total_xp: newTotalXp,
        current_xp: (current?.current_xp || 0) + xpAmount,
        level: newLevel,
      };
      const { data, error } = current
        ? await supabase.from('user_gamification').update(row).eq('user_id', userId).select().single()
        : await supabase.from('user_gamification').insert({ user_id: userId, ...row }).select().single();

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
// Fixes: (1) "today" is the user's LOCAL date (it was UTC, so Manila users checking in before 8am
// were counted on the previous day and streaks broke); (2) one check-in per day (XP could be
// re-claimed); (3) streak row is updated/inserted explicitly (a plain upsert hit the UNIQUE(user_id)
// constraint after day 1, so the streak never grew); (4) XP is awarded ONCE by useAddXP, not twice.
export const useCheckIn = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (userId) => {
      if (!userId) return null;

      const { data: streak } = await supabase
        .from('check_in_streak')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();

      const today = todayStr();
      const lastCheckIn = streak?.last_check_in ? String(streak.last_check_in).slice(0, 10) : null;
      if (lastCheckIn === today) {
        return { streak, xpEarned: 0, alreadyCheckedIn: true };
      }

      const yesterdayDate = new Date();
      yesterdayDate.setDate(yesterdayDate.getDate() - 1);
      const newStreak = lastCheckIn === todayStr(yesterdayDate) ? (streak?.streak_count || 0) + 1 : 1;

      const payload = {
        streak_count: newStreak,
        last_check_in: today,
        best_streak: Math.max(newStreak, streak?.best_streak || 0),
      };
      const { data, error } = streak
        ? await supabase.from('check_in_streak').update(payload).eq('user_id', userId).select().single()
        : await supabase.from('check_in_streak').insert({ user_id: userId, ...payload }).select().single();
      if (error) throw error;

      await supabase.from('activity_feed').insert({
        user_id: userId,
        activity_type: 'check_in',
        title: `Daily Check-In Day ${newStreak}`,
        description: `Keep the adventure alive! ${newStreak} days in a row`,
        icon: '\u2705',
        is_public: false,
      });

      return { streak: data, xpEarned: XP_REWARDS.dailyCheckIn };
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
      const totalXp = (achievement?.xp_reward || 0) + (xpBonus || 0);
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
