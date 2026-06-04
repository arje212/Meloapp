import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/AuthContext';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Trophy, Loader2 } from 'lucide-react';
import { calcLevel } from '@/lib/achievements';

const rankColors = ['text-yellow-500', 'text-gray-400', 'text-orange-400'];
const rankBg    = ['bg-yellow-50 border-yellow-200', 'bg-gray-50 border-gray-200', 'bg-orange-50 border-orange-200'];
const medals    = ['🥇', '🥈', '🥉'];

export default function Leaderboard() {
  const { user } = useAuth();

  // ── Fetch all achievements + join profiles for avatar/name ─────────────────
  const { data: leaderboard = [], isLoading } = useQuery({
    queryKey: ['leaderboard'],
    queryFn: async () => {
      const { data: achvs, error } = await supabase
        .from('achievements')
        .select('user_id, xp_earned, profiles(id, full_name, email, avatar_url)')
        .order('xp_earned', { ascending: false });

      if (error) throw error;

      // Aggregate XP by user_id
      const userMap = {};
      achvs?.forEach(a => {
        const uid = a.user_id;
        if (!uid) return;
        if (!userMap[uid]) {
          userMap[uid] = {
            id:       uid,
            name:     a.profiles?.full_name || 'Unknown Hiker',
            email:    a.profiles?.email || '',
            avatar:   a.profiles?.avatar_url || null,
            totalXp:  0,
            count:    0,
          };
        }
        userMap[uid].totalXp += a.xp_earned || 0;
        userMap[uid].count   += 1;
      });

      return Object.values(userMap)
        .sort((a, b) => b.totalXp - a.totalXp)
        .slice(0, 50);
    },
    staleTime: 2 * 60 * 1000,
  });

  const myRank  = leaderboard.findIndex(u => u.id === user?.id) + 1;
  const myEntry = leaderboard.find(u => u.id === user?.id);

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
        <div className="flex items-end justify-center gap-3 mb-6">
          {/* 2nd place */}
          <div className={`flex-1 border rounded-2xl p-3 text-center ${rankBg[1]}`}>
            <div className="text-2xl mb-2">🥈</div>
            <Avatar className="w-12 h-12 mx-auto mb-2">
              {leaderboard[1].avatar
                ? <img src={leaderboard[1].avatar} alt="" className="w-full h-full object-cover rounded-full" />
                : <AvatarFallback className="bg-gray-200 text-gray-700 font-bold">{leaderboard[1].name?.[0] || '?'}</AvatarFallback>
              }
            </Avatar>
            <p className="text-xs font-semibold truncate">{leaderboard[1].name}</p>
            <p className={`text-xs font-bold ${rankColors[1]}`}>{leaderboard[1].totalXp} XP</p>
            <Badge variant="outline" className="text-[10px] mt-1">Lv{calcLevel(leaderboard[1].totalXp).level}</Badge>
          </div>

          {/* 1st place — taller */}
          <div className={`flex-1 border rounded-2xl p-4 text-center -mt-4 ${rankBg[0]} shadow-md`}>
            <div className="text-3xl mb-2">🥇</div>
            <Avatar className="w-14 h-14 mx-auto mb-2 ring-2 ring-yellow-400">
              {leaderboard[0].avatar
                ? <img src={leaderboard[0].avatar} alt="" className="w-full h-full object-cover rounded-full" />
                : <AvatarFallback className="bg-yellow-100 text-yellow-700 font-bold text-lg">{leaderboard[0].name?.[0] || '?'}</AvatarFallback>
              }
            </Avatar>
            <p className="text-sm font-bold truncate">{leaderboard[0].name}</p>
            <p className={`text-sm font-bold ${rankColors[0]}`}>{leaderboard[0].totalXp} XP</p>
            <Badge variant="outline" className="text-[10px] mt-1">Lv{calcLevel(leaderboard[0].totalXp).level}</Badge>
          </div>

          {/* 3rd place */}
          <div className={`flex-1 border rounded-2xl p-3 text-center ${rankBg[2]}`}>
            <div className="text-2xl mb-2">🥉</div>
            <Avatar className="w-12 h-12 mx-auto mb-2">
              {leaderboard[2].avatar
                ? <img src={leaderboard[2].avatar} alt="" className="w-full h-full object-cover rounded-full" />
                : <AvatarFallback className="bg-orange-100 text-orange-700 font-bold">{leaderboard[2].name?.[0] || '?'}</AvatarFallback>
              }
            </Avatar>
            <p className="text-xs font-semibold truncate">{leaderboard[2].name}</p>
            <p className={`text-xs font-bold ${rankColors[2]}`}>{leaderboard[2].totalXp} XP</p>
            <Badge variant="outline" className="text-[10px] mt-1">Lv{calcLevel(leaderboard[2].totalXp).level}</Badge>
          </div>
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
            const isMe = entry.id === user?.id;
            return (
              <div
                key={entry.id}
                className={`flex items-center gap-3 p-3 rounded-xl border transition-colors ${isMe ? 'bg-primary/5 border-primary/30' : 'bg-card hover:bg-muted/50'}`}
              >
                {/* Rank */}
                <div className="w-8 text-center shrink-0">
                  {idx < 3
                    ? <span className="text-lg">{medals[idx]}</span>
                    : <span className="text-sm font-bold text-muted-foreground">#{idx + 1}</span>
                  }
                </div>

                {/* Avatar */}
                <Avatar className="w-9 h-9 shrink-0">
                  {entry.avatar
                    ? <img src={entry.avatar} alt="" className="w-full h-full object-cover rounded-full" />
                    : <AvatarFallback className="bg-primary/10 text-primary text-sm font-bold">{entry.name?.[0] || '?'}</AvatarFallback>
                  }
                </Avatar>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold truncate">{entry.name}</p>
                    {isMe && <Badge className="text-[10px] bg-primary/10 text-primary border-0 h-4 px-1.5">You</Badge>}
                  </div>
                  <p className="text-xs text-muted-foreground">{entry.count} achievement{entry.count !== 1 ? 's' : ''} · Lv{level}</p>
                </div>

                {/* XP */}
                <div className="text-right shrink-0">
                  <p className="font-bold text-primary text-sm">{entry.totalXp.toLocaleString()}</p>
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