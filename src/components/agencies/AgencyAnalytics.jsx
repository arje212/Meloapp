import { useMemo } from 'react';
import { BarChart3, Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { isCommissionConfirmed } from '@/lib/commission';

const DONE = ['completed', 'commission_sent', 'commission_confirmed'];
const monthKey = (d) => String(d || '').slice(0, 7);
const money = (n) => `\u20B1${Math.round(n || 0).toLocaleString()}`;

/** Booking analytics built only from the agency's own bookings (no page-view tracking exists). */
export default function AgencyAnalytics({ bookings = [], locked = false, onUpgrade }) {
  const stats = useMemo(() => {
    const now = new Date();
    const months = Array.from({ length: 6 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
      return { key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`, label: d.toLocaleString('en', { month: 'short' }), bookings: 0, revenue: 0 };
    });
    const byKey = Object.fromEntries(months.map((m) => [m.key, m]));
    const perPackage = {};
    const perCustomer = {};
    let cancelled = 0, done = 0, pax = 0;

    bookings.forEach((b) => {
      const created = byKey[monthKey(b.created_date)];
      if (created) created.bookings += 1;
      if (DONE.includes(b.status)) {
        done += 1;
        const rev = byKey[monthKey(b.completed_at || b.created_date)];
        if (rev) rev.revenue += Number(b.actual_total_price ?? b.total_price) || 0;
      }
      if (b.status === 'cancelled') cancelled += 1;
      pax += Number(b.num_pax) || 0;
      if (b.package_title) perPackage[b.package_title] = (perPackage[b.package_title] || 0) + 1;
      if (b.user_email) perCustomer[b.user_email] = (perCustomer[b.user_email] || 0) + 1;
    });

    const customers = Object.values(perCustomer);
    const maxB = Math.max(1, ...months.map((m) => m.bookings));
    const maxR = Math.max(1, ...months.map((m) => m.revenue));
    return {
      months, maxB, maxR, total: bookings.length, done, cancelled,
      confirmedCommission: bookings.filter(isCommissionConfirmed).length,
      avgPax: bookings.length ? (pax / bookings.length).toFixed(1) : '0',
      repeatRate: customers.length ? Math.round((customers.filter((c) => c > 1).length / customers.length) * 100) : 0,
      topPackages: Object.entries(perPackage).sort((a, b) => b[1] - a[1]).slice(0, 3),
    };
  }, [bookings]);

  if (locked) {
    return (
      <div className="rounded-2xl p-4 border bg-card">
        <div className="flex items-center gap-2 mb-2"><BarChart3 className="w-4 h-4 text-primary" /><p className="font-semibold text-sm">Analytics</p><Lock className="w-3.5 h-3.5 text-muted-foreground" /></div>
        <p className="text-xs text-muted-foreground mb-3">See bookings and revenue trends, your top packages and repeat customers. Available on the Pro and Yearly plans.</p>
        {onUpgrade && <Button size="sm" className="rounded-full h-8 text-xs" onClick={onUpgrade}>Upgrade to unlock</Button>}
      </div>
    );
  }

  const pct = (n, d) => (d ? Math.round((n / d) * 100) : 0);
  return (
    <div className="rounded-2xl p-4 border bg-card space-y-4">
      <div className="flex items-center gap-2"><BarChart3 className="w-4 h-4 text-primary" /><p className="font-semibold text-sm">Analytics</p><span className="text-[10px] text-muted-foreground">last 6 months</span></div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
        {[
          ['Bookings', stats.total],
          ['Completion', `${pct(stats.done, stats.total)}%`],
          ['Cancelled', `${pct(stats.cancelled, stats.total)}%`],
          ['Repeat guests', `${stats.repeatRate}%`],
        ].map(([label, value]) => (
          <div key={label} className="bg-muted rounded-xl p-2"><p className="text-[10px] text-muted-foreground">{label}</p><p className="font-bold text-sm">{value}</p></div>
        ))}
      </div>

      <div>
        <p className="text-xs font-medium mb-2">Bookings and revenue per month</p>
        <div className="space-y-1.5">
          {stats.months.map((m) => (
            <div key={m.key} className="flex items-center gap-2 text-[11px]">
              <span className="w-8 text-muted-foreground">{m.label}</span>
              <div className="flex-1 space-y-0.5">
                <div className="h-2 rounded-full bg-primary/70" style={{ width: `${(m.bookings / stats.maxB) * 100}%`, minWidth: m.bookings ? 4 : 0 }} />
                <div className="h-2 rounded-full bg-green-500/70" style={{ width: `${(m.revenue / stats.maxR) * 100}%`, minWidth: m.revenue ? 4 : 0 }} />
              </div>
              <span className="w-24 text-right text-muted-foreground">{m.bookings} - {money(m.revenue)}</span>
            </div>
          ))}
        </div>
        <p className="text-[10px] text-muted-foreground mt-1.5"><span className="inline-block w-2 h-2 rounded-full bg-primary/70 mr-1" />bookings <span className="inline-block w-2 h-2 rounded-full bg-green-500/70 mx-1 ml-3" />revenue (completed)</p>
      </div>

      {stats.topPackages.length > 0 && (
        <div>
          <p className="text-xs font-medium mb-1">Top packages</p>
          {stats.topPackages.map(([title, n]) => (
            <div key={title} className="flex justify-between text-xs py-0.5"><span className="truncate pr-2">{title}</span><span className="text-muted-foreground shrink-0">{n} booking{n > 1 ? 's' : ''}</span></div>
          ))}
        </div>
      )}
      <p className="text-[10px] text-muted-foreground">Average group size: {stats.avgPax} pax.</p>
    </div>
  );
}
