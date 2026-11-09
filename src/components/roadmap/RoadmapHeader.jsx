import { Flame, Loader2, Mountain, Sparkles, Target } from 'lucide-react';

// Summit ring: the one memorable element. Arc = share of planned peaks already conquered.
function SummitRing({ conquered, total, size = 112 }) {
  const r = 46, c = 2 * Math.PI * r;
  const pct = total ? conquered / total : 0;
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }} role="img" aria-label={`${conquered} of ${total} peaks conquered`}>
      <svg viewBox="0 0 120 120" className="w-full h-full -rotate-90">
        <circle cx="60" cy="60" r={r} fill="none" stroke="rgba(255,255,255,0.10)" strokeWidth="9" />
        <circle cx="60" cy="60" r={r} fill="none" stroke="#E8A33D" strokeWidth="9" strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={c * (1 - pct)} className="transition-[stroke-dashoffset] duration-700" />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-white">
        <Mountain className="w-4 h-4 text-[#E8A33D] mb-0.5" />
        <span className="text-2xl font-bold leading-none tabular-nums">{conquered}<span className="text-sm font-medium text-white/50">/{total}</span></span>
        <span className="text-[11px] text-white/60 mt-0.5">peaks</span>
      </div>
    </div>
  );
}

export default function RoadmapHeader({
  title, nextDest, level, xpInLevel, xpPerLevel, xpPercent, streak, totalXp,
  conquered, total, maxElev, points, progress, onCheckIn, isCheckingIn,
}) {
  const facts = [
    { Icon: Flame,    label: 'Day streak',  value: streak },
    { Icon: Sparkles, label: 'Total XP',    value: totalXp.toLocaleString() },
    { Icon: Mountain, label: 'Highest',     value: maxElev ? `${maxElev.toLocaleString()} m` : 'None yet' },
    { Icon: Target,   label: 'Trail points', value: points },
  ];
  return (
    <section className="rounded-3xl mb-5 overflow-hidden bg-[#0F2A22] text-white shadow-lg ring-1 ring-black/5">
      <div className="p-5 flex items-center gap-4">
        <SummitRing conquered={conquered} total={total} />
        <div className="min-w-0 flex-1">
          <h1 className={`font-display font-bold leading-snug break-words ${String(title || '').length > 22 ? 'text-lg' : 'text-xl'}`}>{title}</h1>
          {nextDest ? (
            <p className="text-sm text-white/70 mt-1 leading-snug">
              Next climb: <span className="text-white font-medium">{nextDest.name}</span>
              {nextDest.elevation ? <span className="text-white/60"> at {Number(nextDest.elevation).toLocaleString()} m</span> : null}
            </p>
          ) : (
            <p className="text-sm text-white/70 mt-1">{total ? 'Every planned peak is conquered.' : 'Add your first peak to start the trail.'}</p>
          )}
          <p className="text-xs text-white/50 mt-2 tabular-nums">{progress}% of your trail completed</p>
        </div>
      </div>

      <div className="px-5 pb-4">
        <div className="flex items-baseline justify-between text-xs mb-1.5">
          <span className="font-semibold text-[#E8A33D]">Level {level}</span>
          <span className="text-white/60 tabular-nums">{xpInLevel} / {xpPerLevel} XP to next level</span>
        </div>
        <div className="h-2 rounded-full bg-white/10 overflow-hidden" role="progressbar" aria-valuenow={xpPercent} aria-valuemin={0} aria-valuemax={100} aria-label="Level progress">
          <div className="h-full rounded-full bg-[#E8A33D] transition-[width] duration-500" style={{ width: `${xpPercent}%` }} />
        </div>
      </div>

      <dl className="grid grid-cols-2 sm:grid-cols-4 border-t border-white/10 bg-black/15">
        {facts.map(({ Icon, label, value }, i) => (
          <div key={label} className={`px-4 py-3 ${i % 2 === 1 ? 'border-l border-white/10' : ''} ${i > 1 ? 'border-t border-white/10 sm:border-t-0' : ''} ${i > 0 ? 'sm:border-l sm:border-white/10' : ''}`}>
            <dt className="flex items-center gap-1.5 text-[11px] text-white/55"><Icon className="w-3 h-3" />{label}</dt>
            <dd className="text-base font-semibold mt-0.5 tabular-nums">{value}</dd>
          </div>
        ))}
      </dl>

      <button
        type="button"
        onClick={onCheckIn}
        disabled={isCheckingIn}
        className="w-full py-3.5 bg-[#E8A33D] text-[#1B1405] text-sm font-semibold hover:bg-[#F0B253] disabled:opacity-60 flex items-center justify-center gap-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-4px] focus-visible:outline-white"
      >
        {isCheckingIn ? <Loader2 className="w-4 h-4 animate-spin" /> : <Flame className="w-4 h-4" />}
        Check in today for +50 XP
      </button>
    </section>
  );
}
