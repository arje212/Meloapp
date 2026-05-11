import { useMemo } from 'react';
import { TrendingUp, Clock, CheckCircle, XCircle, DollarSign, BookOpen } from 'lucide-react';

export default function FinancialSummary({ bookings = [], packages = [] }) {
  const stats = useMemo(() => {
    const confirmed = bookings.filter(b => ['confirmed', 'paid', 'completed'].includes(b.status));
    const pending = bookings.filter(b => b.status === 'pending');
    const cancelled = bookings.filter(b => ['cancelled', 'refunded'].includes(b.status));

    const totalRevenue = confirmed.reduce((sum, b) => sum + (b.total_price || 0), 0);
    const pendingRevenue = pending.reduce((sum, b) => sum + (b.total_price || 0), 0);
    const completedRevenue = bookings
      .filter(b => b.status === 'completed')
      .reduce((sum, b) => sum + (b.total_price || 0), 0);

    // Group revenue by package
    const revenueByPackage = {};
    confirmed.forEach(b => {
      const key = b.package_title || 'Unknown';
      revenueByPackage[key] = (revenueByPackage[key] || 0) + (b.total_price || 0);
    });
    const topPackages = Object.entries(revenueByPackage)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3);

    // Monthly breakdown (last 6 months)
    const now = new Date();
    const months = Array.from({ length: 6 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
      return { label: d.toLocaleString('en-PH', { month: 'short' }), year: d.getFullYear(), month: d.getMonth() };
    });
    const monthly = months.map(({ label, year, month }) => {
      const rev = confirmed
        .filter(b => {
          const d = new Date(b.created_date);
          return d.getFullYear() === year && d.getMonth() === month;
        })
        .reduce((sum, b) => sum + (b.total_price || 0), 0);
      return { label, rev };
    });
    const maxRev = Math.max(...monthly.map(m => m.rev), 1);

    return { totalRevenue, pendingRevenue, completedRevenue, confirmed: confirmed.length, pending: pending.length, cancelled: cancelled.length, topPackages, monthly, maxRev };
  }, [bookings]);

  return (
    <div className="space-y-4">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <KpiCard icon={BookOpen} label="Total Bookings" value={bookings.length} color="text-primary" bg="bg-primary/10" />
        <KpiCard icon={TrendingUp} label="Confirmed Revenue" value={`₱${stats.totalRevenue.toLocaleString()}`} color="text-green-600" bg="bg-green-50" />
        <KpiCard icon={Clock} label="Pending Payout" value={`₱${stats.pendingRevenue.toLocaleString()}`} color="text-yellow-600" bg="bg-yellow-50" />
        <KpiCard icon={CheckCircle} label="Completed Rev." value={`₱${stats.completedRevenue.toLocaleString()}`} color="text-blue-600" bg="bg-blue-50" />
      </div>

      {/* Booking Status Breakdown */}
      <div className="bg-card border rounded-xl p-4">
        <h3 className="text-sm font-semibold mb-3">Booking Status</h3>
        <div className="flex gap-4 text-sm flex-wrap">
          <span className="flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-full bg-green-500 inline-block" /><span className="text-muted-foreground">Confirmed:</span> <b>{stats.confirmed}</b></span>
          <span className="flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-full bg-yellow-400 inline-block" /><span className="text-muted-foreground">Pending:</span> <b>{stats.pending}</b></span>
          <span className="flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-full bg-red-400 inline-block" /><span className="text-muted-foreground">Cancelled:</span> <b>{stats.cancelled}</b></span>
        </div>
        {/* Progress bar */}
        {bookings.length > 0 && (
          <div className="mt-3 h-3 rounded-full overflow-hidden bg-muted flex">
            <div className="bg-green-500 h-full transition-all" style={{ width: `${(stats.confirmed / bookings.length) * 100}%` }} />
            <div className="bg-yellow-400 h-full transition-all" style={{ width: `${(stats.pending / bookings.length) * 100}%` }} />
            <div className="bg-red-400 h-full transition-all" style={{ width: `${(stats.cancelled / bookings.length) * 100}%` }} />
          </div>
        )}
      </div>

      {/* Revenue Bar Chart (last 6 months) */}
      <div className="bg-card border rounded-xl p-4">
        <h3 className="text-sm font-semibold mb-4">Revenue — Last 6 Months</h3>
        <div className="flex items-end gap-2 h-28">
          {stats.monthly.map(({ label, rev }) => (
            <div key={label} className="flex-1 flex flex-col items-center gap-1">
              <span className="text-[10px] text-muted-foreground font-medium">
                {rev > 0 ? `₱${rev >= 1000 ? (rev / 1000).toFixed(0) + 'k' : rev}` : ''}
              </span>
              <div
                className="w-full rounded-t-md bg-primary/80 transition-all"
                style={{ height: `${Math.max((rev / stats.maxRev) * 80, rev > 0 ? 4 : 0)}px` }}
              />
              <span className="text-[10px] text-muted-foreground">{label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Top Packages */}
      {stats.topPackages.length > 0 && (
        <div className="bg-card border rounded-xl p-4">
          <h3 className="text-sm font-semibold mb-3">Top Packages by Revenue</h3>
          <div className="space-y-2">
            {stats.topPackages.map(([name, rev], i) => (
              <div key={name} className="flex items-center gap-3">
                <span className="w-5 h-5 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center shrink-0">{i + 1}</span>
                <p className="flex-1 text-sm truncate">{name}</p>
                <p className="text-sm font-bold text-primary">₱{rev.toLocaleString()}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Payout Note */}
      <div className="bg-muted rounded-xl p-3 flex items-start gap-2 text-xs text-muted-foreground">
        <DollarSign className="w-4 h-4 shrink-0 mt-0.5 text-primary" />
        <p><span className="font-semibold text-foreground">Pending Payout: ₱{stats.pendingRevenue.toLocaleString()}</span> — This is revenue from bookings awaiting your confirmation. Confirm bookings to move them to confirmed revenue.</p>
      </div>
    </div>
  );
}

function KpiCard({ icon: Icon, label, value, color, bg }) {
  return (
    <div className="bg-card border rounded-xl p-3">
      <div className={`w-8 h-8 rounded-lg ${bg} flex items-center justify-center mb-2`}>
        <Icon className={`w-4 h-4 ${color}`} />
      </div>
      <p className={`text-lg font-bold ${color}`}>{value}</p>
      <p className="text-[11px] text-muted-foreground leading-tight">{label}</p>
    </div>
  );
}