import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { pickActiveSubscription } from '@/lib/plans';

/**
 * Map of agency_id -> active plan name ('starter' | 'pro' | 'yearly' ...).
 * Selects only the columns needed for ranking (never payment proof URLs or amounts).
 * Agencies with no valid paid subscription are simply absent (= free).
 */
export function useAgencyPlans() {
  return useQuery({
    queryKey: ['agency-plans'],
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('agency_subscriptions')
        .select('agency_id, plan, status, end_date, created_date')
        .eq('status', 'verified')
        .limit(1000);
      if (error || !data) return {};
      const grouped = {};
      data.forEach((s) => { (grouped[s.agency_id] = grouped[s.agency_id] || []).push(s); });
      const out = {};
      Object.keys(grouped).forEach((id) => {
        const active = pickActiveSubscription(grouped[id]);
        if (active && active.plan !== 'free') out[id] = active.plan;
      });
      return out;
    },
  });
}
