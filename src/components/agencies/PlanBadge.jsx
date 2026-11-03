import { Star, Zap, Crown } from 'lucide-react';
import { planRank } from '@/lib/plans';

/** Small visibility badge shown for paid plans (Free shows nothing). */
export default function PlanBadge({ plan, className = '' }) {
  const rank = planRank(plan);
  if (rank === 0) return null;
  const cfg =
    rank >= 3 ? { label: 'Featured Agency', Icon: Crown, cls: 'bg-amber-100 text-amber-800 border-amber-300' } :
    rank === 2 ? { label: 'Pro',             Icon: Star,  cls: 'bg-primary/10 text-primary border-primary/30' } :
                 { label: 'Featured',        Icon: Zap,   cls: 'bg-blue-50 text-blue-700 border-blue-200' };
  return (
    <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full border ${cfg.cls} ${className}`}>
      <cfg.Icon className="w-3 h-3" /> {cfg.label}
    </span>
  );
}
