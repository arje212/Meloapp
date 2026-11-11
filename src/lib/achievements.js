import { base44 } from '@/api/base44Client';

export const ACHIEVEMENT_DEFINITIONS = {
  first_post: {
    title: 'First Step',
    description: 'Published your first travel post',
    icon: '📝',
    xp_earned: 50,
    badge_color: 'bronze',
  },
  first_mountain: {
    title: 'Summit Seeker',
    description: 'Joined your first mountain trip',
    icon: '⛰️',
    xp_earned: 100,
    badge_color: 'silver',
  },
  five_mountains: {
    title: 'Peak Bagger',
    description: 'Completed 5 mountains',
    icon: '🏔️',
    xp_earned: 300,
    badge_color: 'gold',
  },
  first_roadmap: {
    title: 'Adventure Planner',
    description: 'Created your first adventure roadmap',
    icon: '🗺️',
    xp_earned: 75,
    badge_color: 'bronze',
  },
  first_summit: {
    title: 'First Summit',
    description: 'Logged your first conquered mountain',
    icon: '🏔️',
    xp_earned: 100,
    badge_color: 'bronze',
  },
  cloud_chaser: {
    title: 'Cloud Chaser',
    description: 'Climbed a peak above 2,000m',
    icon: '🌤️',
    xp_earned: 150,
    badge_color: 'silver',
  },
  camp_master: {
    title: 'Camp Master',
    description: 'Completed 3 roadmap destinations',
    icon: '⛺',
    xp_earned: 150,
    badge_color: 'silver',
  },
  eagle_climber: {
    title: 'Eagle Climber',
    description: 'Climbed 5 peaks',
    icon: '🦅',
    xp_earned: 300,
    badge_color: 'gold',
  },
  peak_collector: {
    title: 'Peak Collector',
    description: 'Climbed 10 peaks',
    icon: '👑',
    xp_earned: 500,
    badge_color: 'gold',
  },
  roadmap_completed: {
    title: 'Quest Completed',
    description: 'Finished a roadmap adventure',
    icon: '✅',
    xp_earned: 500,
    badge_color: 'gold',
  },
  trailblazer: {
    title: 'Trailblazer',
    description: 'Completed a full roadmap',
    icon: '🔥',
    xp_earned: 500,
    badge_color: 'gold',
  },
  luzon_legend: {
    title: 'Luzon Legend',
    description: 'Climbed Mt. Pulag',
    icon: '⭐',
    xp_earned: 250,
    badge_color: 'gold',
  },
  highest_peak: {
    title: 'Top of PH',
    description: 'Climbed Mt. Apo, the highest peak in the Philippines',
    icon: '🏆',
    xp_earned: 300,
    badge_color: 'gold',
  },
  community_contributor: {
    title: 'Community Star',
    description: 'Received 10 likes on your posts',
    icon: '⭐',
    xp_earned: 200,
    badge_color: 'silver',
  },
  first_booking: {
    title: 'Tour Pioneer',
    description: 'Made your first tour booking',
    icon: '🎫',
    xp_earned: 100,
    badge_color: 'bronze',
  },
  first_review: {
    title: 'Trail Critic',
    description: 'Wrote your first trip review',
    icon: '📝',
    xp_earned: 75,
    badge_color: 'bronze',
  },
  follow_hiker: {
    title: 'Social Climber',
    description: 'Followed another hiker',
    icon: '🤝',
    xp_earned: 25,
    badge_color: 'bronze',
  },
};

const unlocking = new Set(); // calls running right now (stops the same badge being created twice at once)

export async function unlockAchievement(userEmail, userName, achievementKey, customDef) {
  const lockKey = `${userEmail}:${achievementKey}`;
  if (unlocking.has(lockKey)) return null;
  unlocking.add(lockKey);
  try {
    // Check if already unlocked
    const existing = await base44.entities.Achievement.filter({
      user_email: userEmail,
      achievement_key: achievementKey,
    });
    if (existing.length > 0) return null;

    // customDef lets a caller define a one-off achievement (e.g. the review dialog's "Trail Writer")
    const def = ACHIEVEMENT_DEFINITIONS[achievementKey] || customDef;
    if (!def) return null;

    const achievement = await base44.entities.Achievement.create({
      user_email: userEmail,
      user_name: userName,
      achievement_key: achievementKey,
      ...def,
    });

    // Also create a notification
    await base44.entities.Notification.create({
      user_email: userEmail,
      title: `Achievement Unlocked: ${def.title}`,
      message: def.description,
      type: 'achievement',
      icon: def.icon,
      link: '/profile',
    });

    return achievement;
  } catch (e) {
    console.error('Achievement unlock failed', e);
    return null;
  } finally {
    unlocking.delete(lockKey);
  }
}

export function calcLevel(totalXp) {
  const level = Math.floor(totalXp / 200) + 1;
  const xpInLevel = totalXp % 200;
  const xpNeeded = 200;
  return { level, xpInLevel, xpNeeded, percent: Math.round((xpInLevel / xpNeeded) * 100) };
}
