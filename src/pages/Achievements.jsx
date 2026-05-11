import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/AuthContext';
import { ACHIEVEMENT_DEFINITIONS, calcLevel } from '@/lib/achievements';
import { Loader2, Star } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

const badgeColors = {
  gold: 'from-yellow-400 to-yellow-600',
  silver: 'from-gray-300 to-gray-500',
  bronze: 'from-orange-400 to-orange-600',
};

async function fetchAchievements(userEmail) {
  const { data, error } = await supabase
    .from('achievements')
    .select('id, achievement_key, title, description, icon, xp_earned, badge_color, created_date')
    .eq('user_email', userEmail);
  if (error) throw error;
  return data || [];
}

export default function Achievements() {
  const { user } = useAuth();

  const { data: achievements = [], isLoading } = useQuery({
    queryKey: ['achievements', user?.email],
    queryFn: () => fetchAchievements(user.email),
    enabled: !!user?.email,
  });

  const totalXp = achievements.reduce((sum, a) => sum + (a.xp_earned || 0), 0);
  const { level, xpInLevel, xpNeeded, percent } = calcLevel(totalXp);
  const unlockedKeys = new Set(achievements.map(a => a.achievement_key));

  return (
    <div className="max-w-3xl mx-auto px-4 py-6">
      <div className="mb-6">
        <h1 className="font-display text-2xl md:text-3xl font-bold">Achievements</h1>
        <p className="text-sm text-muted-foreground">Earn badges and XP by exploring</p>
      </div>

      {/* XP / Level Card */}
      <div className="bg-gradient-to-br from-primary/10 to-primary/5 border rounded-2xl p-6 mb-6">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-full bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center shadow-lg">
            <span className="text-2xl font-bold text-primary-foreground">Lv{level}</span>
          </div>
          <div className="flex-1">
            <p className="font-semibold text-lg">{user?.full_name}</p>
            <p className="text-sm text-muted-foreground">
              {totalXp} XP total · {achievements.length} achievements
            </p>
            <div className="mt-2">
              <div className="flex justify-between text-xs text-muted-foreground mb-1">
                <span>Level {level}</span>
                <span>{xpInLevel}/{xpNeeded} XP</span>
              </div>
              <div className="w-full bg-muted rounded-full h-2">
                <div
                  className="bg-primary h-2 rounded-full transition-all"
                  style={{ width: `${percent}%` }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {Object.entries(ACHIEVEMENT_DEFINITIONS).map(([key, def]) => {
            const unlocked = unlockedKeys.has(key);
            return (
              <div
                key={key}
                className={`flex items-center gap-4 p-4 rounded-2xl border transition-all ${
                  unlocked ? 'bg-card shadow-sm' : 'bg-muted/40 opacity-60'
                }`}
              >
                <div className={`w-12 h-12 rounded-full flex items-center justify-center shrink-0 ${
                  unlocked
                    ? `bg-gradient-to-br ${badgeColors[def.badge_color] || badgeColors.bronze} shadow`
                    : 'bg-muted'
                }`}>
                  <span className="text-xl">{unlocked ? def.icon : '🔒'}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm">{def.title}</p>
                  <p className="text-xs text-muted-foreground">{def.description}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge variant="outline" className="text-[10px]">+{def.xp_earned} XP</Badge>
                    {unlocked && (
                      <span className="text-[10px] text-green-600 font-semibold flex items-center gap-0.5">
                        <Star className="w-3 h-3" /> Unlocked
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}