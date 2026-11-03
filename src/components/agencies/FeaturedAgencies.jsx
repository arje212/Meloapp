import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Store } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useAgencyPlans } from '@/lib/useAgencyPlans';
import { planRank } from '@/lib/plans';
import PlanBadge from '@/components/agencies/PlanBadge';

/** Homepage strip: approved agencies on Pro / Yearly plans. Renders nothing when there are none. */
export default function FeaturedAgencies() {
  const { data: plans = {} } = useAgencyPlans();
  const { data: agencies = [] } = useQuery({
    queryKey: ['agencies'],
    queryFn: () => base44.entities.Agency.filter({ status: 'approved' }, '-created_date', 1000),
  });

  const featured = agencies
    .filter((a) => planRank(plans[a.id]) >= 2)
    .sort((a, b) => planRank(plans[b.id]) - planRank(plans[a.id]) || (Number(b.rating) || 0) - (Number(a.rating) || 0))
    .slice(0, 8);

  if (featured.length === 0) return null;

  return (
    <div className="mb-5">
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-sm font-semibold">Featured agencies</h2>
        <Link to="/agencies" className="text-xs text-primary hover:underline">See all</Link>
      </div>
      <div className="flex gap-3 overflow-x-auto pb-1 -mx-1 px-1">
        {featured.map((a) => (
          <Link key={a.id} to={`/agencies/${a.id}`} className="shrink-0 w-40 bg-card border rounded-2xl p-3 hover:shadow-md transition-all">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center overflow-hidden mb-2">
              {a.logo_url ? <img src={a.logo_url} alt="" className="w-full h-full object-cover" /> : <Store className="w-5 h-5 text-primary" />}
            </div>
            <p className="text-sm font-semibold truncate">{a.name}</p>
            <p className="text-[11px] text-muted-foreground truncate mb-1.5">{a.location || 'Philippines'}</p>
            <PlanBadge plan={plans[a.id]} />
          </Link>
        ))}
      </div>
    </div>
  );
}
