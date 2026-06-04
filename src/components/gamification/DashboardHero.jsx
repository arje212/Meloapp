import React, { useMemo } from 'react';
import { useUserGamification, useCheckIn, useAddXP } from '@/lib/useGamification';

export default function DashboardHero({ user }) {
  const userId = user?.id;
  const { data: gam } = useUserGamification(userId);
  const checkIn = useCheckIn();
  const addXp = useAddXP();

  const progress = useMemo(() => {
    if (!gam) return 0;
    return Math.round(gam.progressPercent || 0);
  }, [gam]);

  const handleCheckIn = async () => {
    if (!userId) return;
    try {
      const res = await checkIn.mutateAsync(userId);
      // small XP visual reward
      await addXp.mutateAsync({ userId, xpAmount: res.xpEarned, reason: 'Daily check-in' });
    } catch (e) {
      console.error('Check-in failed', e);
    }
  };

  return (
    <section className="relative overflow-hidden rounded-lg bg-gradient-to-b from-sky-900 via-slate-900 to-black p-6 text-white">
      <div className="absolute inset-0 opacity-30 pointer-events-none bg-[radial-gradient(ellipse_at_top_left,_var(--tw-gradient-stops))] from-indigo-700 via-purple-700 to-transparent"></div>
      <div className="relative z-10 flex flex-col md:flex-row items-center gap-6">
        <div className="flex-1">
          <h2 className="text-2xl md:text-4xl font-extrabold">Your Adventure</h2>
          <p className="mt-2 text-slate-200">You are <span className="font-semibold">{Math.max(0, 2)}</span> summits away from becoming a <span className="font-semibold">{gam?.title || 'Trail Explorer'}</span></p>

          <div className="mt-4 flex items-center gap-3">
            <div className="w-48 bg-slate-800 rounded-full h-4 overflow-hidden">
              <div style={{ width: `${progress}%` }} className="h-full bg-gradient-to-r from-emerald-400 to-amber-400" />
            </div>
            <div className="text-sm">Level {gam?.level || 1} • {progress}%</div>
          </div>

          <div className="mt-4 flex gap-3">
            <button onClick={handleCheckIn} className="px-4 py-2 bg-amber-400 text-black rounded-md shadow hover:scale-[1.02] transition">Daily Check-in</button>
            <button className="px-4 py-2 bg-transparent border border-slate-600 rounded-md">Plan Adventure</button>
          </div>
        </div>

        <div className="w-40 h-40 rounded-lg bg-gradient-to-br from-slate-700 to-slate-900 flex items-center justify-center">
          <div className="text-center">
            <div className="text-3xl">{gam?.icon || '🥾'}</div>
            <div className="text-xs text-slate-300 mt-2">{gam?.title || 'Aspiring Adventurer'}</div>
          </div>
        </div>
      </div>

      <div className="absolute -bottom-8 left-4 right-4 opacity-50 blur-2xl h-16 bg-gradient-to-r from-violet-600 via-amber-400 to-emerald-400 rounded-full" />
    </section>
  );
}
