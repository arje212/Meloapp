// Immersive achievement and gamification UI components
import { useState, useEffect } from 'react';
import { Badge, Button } from '@/components/ui/badge';
import { Flame, Star, Zap } from 'lucide-react';
import confetti from 'canvas-confetti';

// ========== ACHIEVEMENT POPUP (Cinematic) ==========
export function AchievementPopup({ achievement, onDismiss }) {
  useEffect(() => {
    if (achievement) {
      // Trigger confetti
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.3 },
      });
      
      // Auto-dismiss after 4 seconds
      const timer = setTimeout(() => onDismiss?.(), 4000);
      return () => clearTimeout(timer);
    }
  }, [achievement, onDismiss]);

  if (!achievement) return null;

  return (
    <div className="fixed inset-0 pointer-events-none flex items-center justify-center z-50">
      <div
        className="animate-in zoom-in-50 duration-500 pointer-events-auto"
        onClick={onDismiss}
      >
        <div className="bg-gradient-to-br from-amber-900/90 to-amber-950/90 backdrop-blur-sm rounded-3xl p-8 border-2 border-amber-400/50 shadow-2xl max-w-sm mx-auto">
          {/* Golden glow effect */}
          <div className="absolute inset-0 rounded-3xl bg-gradient-to-r from-amber-400/20 to-transparent pointer-events-none animate-pulse" />
          
          {/* Achievement Icon */}
          <div className="relative mb-4 flex justify-center">
            <div className="relative">
              {/* Rotating background circle */}
              <div className="absolute inset-0 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 animate-spin blur-lg opacity-40" style={{ animationDuration: '3s' }} />
              
              <div className="relative w-24 h-24 rounded-full bg-gradient-to-br from-amber-300 to-orange-400 flex items-center justify-center text-5xl shadow-lg border-4 border-amber-200">
                {achievement.icon}
              </div>
            </div>
          </div>

          {/* Achievement Name */}
          <h3 className="text-2xl font-bold text-amber-100 text-center mb-2">
            🏆 Achievement Unlocked!
          </h3>
          
          {/* Achievement Title */}
          <p className="text-xl font-semibold text-amber-50 text-center mb-1">
            {achievement.name}
          </p>
          
          {/* Description */}
          <p className="text-sm text-amber-100/70 text-center mb-4">
            {achievement.description}
          </p>

          {/* XP Reward */}
          <div className="flex items-center justify-center gap-2 mb-4">
            <Star className="w-5 h-5 text-amber-300 fill-amber-300 animate-pulse" />
            <span className="text-lg font-bold text-amber-100">+{achievement.xp_reward} XP</span>
            <Star className="w-5 h-5 text-amber-300 fill-amber-300 animate-pulse" />
          </div>

          {/* Rarity Badge */}
          <div className="flex justify-center mb-4">
            <Badge className={`${getRarityStyle(achievement.rarity)} px-4 py-1`}>
              {achievement.rarity.charAt(0).toUpperCase() + achievement.rarity.slice(1)}
            </Badge>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2 justify-center">
            <Button
              onClick={onDismiss}
              className="bg-amber-600 hover:bg-amber-700 text-white rounded-full px-6"
            >
              Awesome! 🎉
            </Button>
            <Button
              variant="outline"
              className="bg-amber-900/30 border-amber-400 text-amber-100 rounded-full px-6"
              onClick={() => {
                // Share achievement
                navigator.share?.({
                  title: achievement.name,
                  text: `I just unlocked ${achievement.name}!`,
                });
              }}
            >
              Share 📱
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ========== XP GAIN ANIMATION ==========
export function XPGainFloat({ xpAmount, position, onComplete }) {
  useEffect(() => {
    const timer = setTimeout(onComplete, 1000);
    return () => clearTimeout(timer);
  }, [onComplete]);

  return (
    <div
      className="fixed pointer-events-none font-bold text-lg animate-out fade-out slide-out-to-top duration-1000"
      style={{
        left: position.x,
        top: position.y,
        animation: 'float-up 1s ease-out forwards',
      }}
    >
      <span className="text-yellow-300 font-bold drop-shadow-lg">
        +{xpAmount} XP
      </span>
    </div>
  );
}

// ========== LEVEL UP CELEBRATION ==========
export function LevelUpCelebration({ oldLevel, newLevel, title, onDismiss }) {
  useEffect(() => {
    confetti({
      particleCount: 200,
      spread: 180,
      origin: { y: 0.5 },
    });
    
    const timer = setTimeout(onDismiss, 5000);
    return () => clearTimeout(timer);
  }, [onDismiss]);

  return (
    <div className="fixed inset-0 pointer-events-none flex items-center justify-center z-50">
      <div
        className="animate-in zoom-in-50 duration-500 pointer-events-auto"
        onClick={onDismiss}
      >
        <div className="text-center bg-gradient-to-b from-purple-900/90 to-indigo-950/90 backdrop-blur-sm rounded-3xl p-12 border-2 border-purple-400/50 shadow-2xl max-w-sm mx-auto">
          {/* Large celebration emoji */}
          <div className="text-8xl mb-6 animate-bounce">👑</div>
          
          <h1 className="text-4xl font-bold text-white mb-2">LEVEL UP!</h1>
          
          <div className="flex items-center justify-center gap-4 mb-6">
            <div className="text-center">
              <p className="text-sm text-purple-200 mb-1">Before</p>
              <p className="text-3xl font-bold text-purple-300">{oldLevel}</p>
            </div>
            
            <Zap className="w-8 h-8 text-yellow-300 animate-pulse" />
            
            <div className="text-center">
              <p className="text-sm text-purple-200 mb-1">Now</p>
              <p className="text-3xl font-bold text-purple-100">{newLevel}</p>
            </div>
          </div>
          
          <p className="text-2xl font-semibold text-purple-100 mb-6">
            You are now a <span className="text-purple-300">{title}</span>!
          </p>
          
          <Button
            onClick={onDismiss}
            className="bg-purple-600 hover:bg-purple-700 text-white rounded-full px-8 py-2"
          >
            Continue Your Adventure 🏔️
          </Button>
        </div>
      </div>
    </div>
  );
}

// ========== DAILY CHECK-IN BUTTON ==========
export function DailyCheckInButton({ streakCount, onCheckIn, isLoading }) {
  const today = new Date().toISOString().split('T')[0];
  const [checkedInToday, setCheckedInToday] = useState(false);

  useEffect(() => {
    const lastCheckIn = localStorage.getItem('last-check-in');
    setCheckedInToday(lastCheckIn === today);
  }, [today]);

  if (checkedInToday) {
    return (
      <Button disabled className="rounded-full bg-emerald-600 text-white gap-2">
        <Flame className="w-4 h-4 fill-current animate-pulse" />
        Checked In Today • {streakCount} 🔥
      </Button>
    );
  }

  return (
    <Button
      onClick={() => {
        onCheckIn();
        localStorage.setItem('last-check-in', today);
        setCheckedInToday(true);
      }}
      disabled={isLoading}
      className="rounded-full bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white gap-2 animate-pulse"
    >
      <Flame className="w-4 h-4 fill-current" />
      {isLoading ? 'Checking in...' : `Daily Check-In • ${streakCount} 🔥`}
    </Button>
  );
}

// ========== GAMIFICATION STATS CARD ==========
export function GamificationStatsCard({ stats, isOwn = false }) {
  if (!stats) return null;

  return (
    <div className="bg-gradient-to-br from-slate-900 to-slate-950 rounded-2xl p-6 border border-slate-700 space-y-4">
      {/* Level and Title */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-slate-400 mb-1">Adventure Level</p>
          <div className="flex items-center gap-3">
            <span className="text-4xl font-bold text-white">{stats.level}</span>
            <div>
              <p className="text-lg font-bold text-amber-400">{stats.title}</p>
              <p className="text-xs text-slate-400">{stats.icon}</p>
            </div>
          </div>
        </div>
        <div className="text-5xl opacity-20">{stats.icon}</div>
      </div>

      {/* XP Progress Bar */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold text-slate-400">EXPERIENCE</p>
          <p className="text-sm font-bold text-amber-400">{stats.progressPercent?.toFixed(0)}%</p>
        </div>
        <div className="h-3 bg-slate-800 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-amber-500 to-orange-500 transition-all duration-500"
            style={{ width: `${stats.progressPercent || 0}%` }}
          />
        </div>
        <p className="text-xs text-slate-500">
          {stats.currentLevelXp?.toLocaleString()} / {stats.nextLevelXp?.toLocaleString()} XP
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-3 pt-2">
        <div className="bg-slate-800/50 rounded-lg p-3 text-center">
          <p className="text-xs text-slate-400 mb-1">Total XP</p>
          <p className="text-lg font-bold text-yellow-300">{stats.totalXp?.toLocaleString()}</p>
        </div>
        <div className="bg-slate-800/50 rounded-lg p-3 text-center">
          <p className="text-xs text-slate-400 mb-1">Achievements</p>
          <p className="text-lg font-bold text-blue-300">{stats.achievements || 0}</p>
        </div>
        <div className="bg-slate-800/50 rounded-lg p-3 text-center">
          <p className="text-xs text-slate-400 mb-1">Streak</p>
          <p className="text-lg font-bold text-red-300 flex items-center justify-center gap-1">
            {stats.currentStreak || 0}
            <Flame className="w-4 h-4 fill-current" />
          </p>
        </div>
        <div className="bg-slate-800/50 rounded-lg p-3 text-center">
          <p className="text-xs text-slate-400 mb-1">Best Streak</p>
          <p className="text-lg font-bold text-purple-300">{stats.bestStreak || 0}</p>
        </div>
      </div>
    </div>
  );
}

// ========== STREAK DISPLAY ==========
export function StreakDisplay({ current, best }) {
  return (
    <div className="flex items-center gap-6">
      <div className="text-center">
        <Flame className="w-6 h-6 text-orange-500 fill-orange-500 mx-auto mb-1 animate-pulse" />
        <p className="text-sm text-slate-400">Current</p>
        <p className="text-3xl font-bold text-orange-500">{current}</p>
      </div>
      <div className="text-slate-600">|</div>
      <div className="text-center">
        <Star className="w-6 h-6 text-yellow-500 fill-yellow-500 mx-auto mb-1" />
        <p className="text-sm text-slate-400">Best</p>
        <p className="text-3xl font-bold text-yellow-500">{best}</p>
      </div>
    </div>
  );
}

// ========== LEADERBOARD CARD ==========
export function LeaderboardEntry({ rank, profile, score, type }) {
  const getMedalEmoji = (rank) => {
    if (rank === 1) return '🥇';
    if (rank === 2) return '🥈';
    if (rank === 3) return '🥉';
    return `#${rank}`;
  };

  return (
    <div className="flex items-center gap-4 p-4 rounded-xl bg-slate-800/50 hover:bg-slate-700/50 transition-colors">
      <div className="text-2xl font-bold text-white w-8 text-center">
        {getMedalEmoji(rank)}
      </div>
      <img
        src={profile?.avatar_url}
        alt={profile?.full_name}
        className="w-10 h-10 rounded-full object-cover"
      />
      <div className="flex-1">
        <p className="font-semibold text-white">{profile?.full_name}</p>
        <p className="text-xs text-slate-400">{profile?.email}</p>
      </div>
      <div className="text-right">
        <p className="text-2xl font-bold text-amber-400">{score}</p>
        <p className="text-xs text-slate-400">{type}</p>
      </div>
    </div>
  );
}

// ========== HELPER FUNCTIONS ==========
function getRarityStyle(rarity) {
  const styles = {
    common: 'bg-gray-600 text-gray-100',
    rare: 'bg-blue-600 text-blue-100',
    epic: 'bg-purple-600 text-purple-100',
    legendary: 'bg-yellow-600 text-yellow-100',
  };
  return styles[rarity] || styles.common;
}

// Styles for animations
const style = document.createElement('style');
style.textContent = `
  @keyframes float-up {
    0% {
      opacity: 1;
      transform: translateY(0);
    }
    100% {
      opacity: 0;
      transform: translateY(-100px);
    }
  }
`;
document.head.appendChild(style);