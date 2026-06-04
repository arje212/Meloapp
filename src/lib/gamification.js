// Game mechanics constants and utilities
// Defines progression curves, level thresholds, XP formulas

export const LEVEL_TITLES = {
  1: 'Aspiring Adventurer',
  2: 'Trail Wanderer',
  3: 'Peak Seeker',
  4: 'Mountain Explorer',
  5: 'Cloud Hunter',
  6: 'Ridge Runner',
  7: 'Summit Stalker',
  8: 'Alpine Master',
  9: 'Trail Legendary',
  10: 'Philippine Legend',
};

export const LEVEL_ICONS = {
  1: '🥾',
  2: '🎒',
  3: '🧗',
  4: '⛰️',
  5: '☁️',
  6: '🏔️',
  7: '👑',
  8: '🎖️',
  9: '⭐',
  10: '👸',
};

export const LEVEL_COLORS = {
  1: 'gray',
  2: 'blue',
  3: 'cyan',
  4: 'emerald',
  5: 'amber',
  6: 'orange',
  7: 'red',
  8: 'purple',
  9: 'pink',
  10: 'gold',
};

// XP thresholds for each level
export const calculateXPForLevel = (level) => {
  // Exponential growth: each level requires 1000 * (level ^ 1.2) XP
  return Math.floor(1000 * Math.pow(level, 1.2));
};

export const calculateLevel = (totalXp) => {
  let level = 1;
  let xpThreshold = 0;
  
  while (level <= 10) {
    const nextThreshold = xpThreshold + calculateXPForLevel(level);
    if (totalXp < nextThreshold) break;
    xpThreshold = nextThreshold;
    level++;
  }
  
  return {
    level: Math.min(level, 10),
    title: LEVEL_TITLES[Math.min(level, 10)],
    icon: LEVEL_ICONS[Math.min(level, 10)],
    color: LEVEL_COLORS[Math.min(level, 10)],
    currentLevelXp: xpThreshold,
    nextLevelXp: xpThreshold + calculateXPForLevel(Math.min(level, 10)),
    progressPercent: Math.min(
      100,
      ((totalXp - xpThreshold) / calculateXPForLevel(Math.min(level, 10))) * 100
    ),
  };
};

// XP reward system
export const XP_REWARDS = {
  // Core activities
  mountainConquered: (elevation) => 100 + Math.floor(elevation / 100),
  roadmapCompleted: 500,
  postShared: 25,
  postLiked: 5,
  
  // Daily activities
  dailyCheckIn: 50,
  adventureShare: 75,
  communityComment: 10,
  
  // Achievements
  firstPeak: 100,
  streakBonus: (days) => 10 * days,
  
  // Social
  followedByUser: 5,
  friendMountainMatch: 50,
};

export const STREAK_BONUSES = {
  3: { xp: 100, badge: '🔥' },
  7: { xp: 300, badge: '🌟' },
  14: { xp: 700, badge: '⚡' },
  30: { xp: 1500, badge: '👑' },
};

// Achievement unlock conditions
export const ACHIEVEMENT_CONDITIONS = {
  firstPeak: (stats) => stats.peaksClimbed >= 1,
  summitCollector: (stats) => stats.peaksClimbed >= 5,
  skyChaser: (stats) => stats.maxElevation >= 2000,
  weekWarrior: (stats) => stats.currentStreak >= 7,
  socialButterfly: (stats) => stats.totalLikes >= 50,
  trailExplorer: (stats) => stats.regionsExplored >= 3,
  legendStatus: (stats) => stats.level >= 10,
};

// Milestone thresholds
export const MILESTONES = [
  { peaks: 1, title: '🏔️ First Summit', icon: '🥾' },
  { peaks: 5, title: '⛰️ Peak Collector', icon: '🎒' },
  { peaks: 10, title: '🌄 Mountain Master', icon: '🧗' },
  { peaks: 20, title: '🏔️ Alpine Legend', icon: '👑' },
  { peaks: 50, title: '⭐ Philippine Explorer', icon: '⭐' },
];
