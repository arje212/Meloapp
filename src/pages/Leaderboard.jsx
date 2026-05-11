import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { Badge } from '@/components/ui/badge';
import { Trophy, Loader2, Star, Mountain, MessageCircle } from 'lucide-react';
import { calcLevel } from '@/lib/achievements';

const rankColors = ['text-yellow-500', 'text-gray-400', 'text-orange-400'];
const rankBg = ['bg-yellow-50 border-yellow-200', 'bg-gray-50 border-gray-200', 'bg-orange-50 border-orange-200'];
const medals = ['🥇', '🥈', '🥉'];

export default function Leaderboard() {
  const { user } = useAuth();

  const { data: achievements = [], isLoading } = useQuery({
    queryKey: ['all-achievements'],
    queryFn: () => base44.entities.Achievement.list('-xp_earned', 500),
  });

  // Aggregate XP by user
  const userXpMap = {};
  achievements.forEach(a => {
    if (!userXpMap[a.user_email]) {
      userXpMap[a.user_email] = { email: a.user_email, name: a.user_name, totalXp: 0, count: 0 };
    }
    userXpMap[a.user_email].totalXp += a.xp_earned || 0;
    userXpMap[a.user_email].count += 1;
  });

  const leaderboard = Object.values(userXpMap)
    .sort((a, b) => b.totalXp - a.totalXp)
    .slice(0, 50);

  const myRank = leaderboard.findIndex(u => u.email === user?.email) + 1;
  const myEntry = leaderboard.find(u => u.email === user?.email);

  return (
    <div className="max-w-2xl mx-auto px-3 sm:px-4 py-4 sm:py-6">
      {/* Header */}
      <div className="bg-gradient-to-br from-yellow-400 via-yellow-500 to-orange-500 rounded-2xl p-5 mb-5 text-white">
        <div className="flex items-center gap-3 mb-1">
          <Trophy className="w-6 h-6" />
          <h1 className="font-display text-xl font-bold">Community Leaderboard</h1>
        </div>
        <p className="text-yellow-100 text-sm">Top hikers based on XP earned from trips, reviews & engagement</p>
        {myRank > 0 && (
          <div className="mt-3 bg-white/20 rounded-xl px-4 py-2 flex items-center justify-between">
            <span className="text-sm font-medium">Your Rank</span>
            <span className="font-bold text-lg">#{myRank} · {myEntry?.totalXp || 0} XP</span>
          </div>
        )}
      </div>

      {/* Top 3 podium */}
      {leaderboard.length >= 3 && (
        <div className="grid grid-cols-3 gap-2 mb-5">
          {[1, 0, 2].map(i => {
            const entry = leaderboard[i];
            if (!entry) return null;
            const { level } = calcLevel(entry.totalXp);
            return (
              <div key={i} className={`border rounded-2xl p-3 text-center ${rankBg[i] || 'bg-card border-border'} ${i === 0 ? 'col-span-1 order-2' : i === 1 ? 'order-1' : 'order-3'}`}>
                <div className="text-2xl mb-1">{medals[i]}</div>
                <div className="w-10 h-10 rounded-full bg-white border-2 flex items-center justify-center mx-auto mb-1 text-sm font-bold text-primary">
                  {entry.name?.[0] || '?'}
                </div>
                <p className="text-xs font-semibold truncate">{entry.name}</p>
                <p className={`text-xs font-bold ${rankColors[i]}`}>{entry.totalXp} XP</p>
                <Badge variant="outline" className="text-[10px] mt-1">Lv{level}</Badge>
              </div>
            );
          })}
        </div>
      )}

      {/* Full list */}
      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
      ) : leaderboard.length === 0 ? (
        <div className="text-center py-16">
          <Trophy className="w-16 h-16 text-muted-foreground/30 mx-auto mb-4" />
          <p className="text-muted-foreground">No rankings yet. Start earning XP!</p>
        </div>
      ) : (
        <div className="space-y-2">
          {leaderboard.map((entry, idx) => {
            const { level } = calcLevel(entry.totalXp);
            const isMe = entry.email === user?.email;
            return (
              <div
                key={entry.email}
                className={`flex items-center gap-3 p-3 rounded-xl border transition-colors ${isMe ? 'bg-primary/5 border-primary/30' : 'bg-card hover:bg-muted/50'}`}
              >
                <div className="w-8 text-center shrink-0">
                  {idx < 3 ? (
                    <span className="text-lg">{medals[idx]}</span>
                  ) : (
                    <span className="text-sm font-bold text-muted-foreground">#{idx + 1}</span>
                  )}
                </div>
                <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  <span className="text-sm font-bold text-primary">{entry.name?.[0] || '?'}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold truncate">{entry.name}</p>
                    {isMe && <Badge className="text-[10px] bg-primary/10 text-primary border-0 h-4 px-1.5">You</Badge>}
                  </div>
                  <p className="text-xs text-muted-foreground">{entry.count} achievements · Lv{level}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="font-bold text-primary text-sm">{entry.totalXp}</p>
                  <p className="text-[10px] text-muted-foreground">XP</p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}