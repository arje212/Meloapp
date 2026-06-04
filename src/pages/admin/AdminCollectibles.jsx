import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Loader2, Store, CheckCircle, Search,
  TrendingUp, ChevronDown, ChevronUp,
  CreditCard, Camera
} from 'lucide-react';
import { format } from 'date-fns';

const PLAN_COMMISSION = { free: 10, starter: 7, pro: 5, yearly: 3 };

const QUERY_KEYS = {
  completedBookings: ['admin-completed-bookings'],
  agencies:          ['admin-agencies'],
  subs:              ['admin-subs'],
};

export default function AdminCollectibles() {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [expandedAgency, setExpandedAgency] = useState(null);
  const [filter, setFilter] = useState('all');

  const { data: bookings = [], isLoading: loadingBookings } = useQuery({
    queryKey: QUERY_KEYS.completedBookings,
    queryFn: async () => {
      const all = await base44.entities.Booking.filter({ status: 'completed' }, '-completed_at', 500);
      return all;
    },
  });

  const { data: agencies = [], isLoading: loadingAgencies } = useQuery({
    queryKey: QUERY_KEYS.agencies,
    queryFn: () => base44.entities.Agency.list(),
  });

  const { data: subs = [] } = useQuery({
    queryKey: QUERY_KEYS.subs,
    queryFn: () => base44.entities.AgencySubscription.filter({ status: 'verified' }),
  });

  const isLoading = loadingBookings || loadingAgencies;

  const agencyMap = agencies.reduce((acc, a) => { acc[a.id] = a; return acc; }, {});
  const subMap    = subs.reduce((acc, s)     => { acc[s.agency_id] = s; return acc; }, {});

  const grouped = bookings.reduce((acc, b) => {
    const id = b.agency_id;
    if (!id) return acc;
    if (!acc[id]) acc[id] = [];
    acc[id].push(b);
    return acc;
  }, {});

  const summaryRows = Object.entries(grouped).map(([agencyId, agencyBookings]) => {
    const agency = agencyMap[agencyId];
    const sub    = subMap[agencyId];
    const plan   = sub?.plan ?? 'free';
    const commissionRate = PLAN_COMMISSION[plan] ?? 10;

    const calcFee = (b) => b.platform_fee != null
      ? b.platform_fee
      : Math.round((b.actual_total_price || b.total_price || 0) * commissionRate / 100);

    const totalGross    = agencyBookings.reduce((s, b) => s + (b.actual_total_price || b.total_price || 0), 0);
    const totalFee      = agencyBookings.reduce((s, b) => s + calcFee(b), 0);
    const totalEarnings = totalGross - totalFee;

    const collectedBookings = agencyBookings.filter(b =>  b.commission_collected);
    const pendingBookings   = agencyBookings.filter(b => !b.commission_collected);
    const pendingFee    = pendingBookings.reduce((s, b)   => s + calcFee(b), 0);
    const collectedFee  = collectedBookings.reduce((s, b) => s + calcFee(b), 0);

    return { agencyId, agency, plan, commissionRate, totalGross, totalFee, totalEarnings, pendingFee, collectedFee, pendingBookings, collectedBookings, allBookings: agencyBookings };
  }).filter(r => r.agency).sort((a, b) => b.pendingFee - a.pendingFee);

  const grandTotal = summaryRows.reduce((acc, r) => ({
    gross:     acc.gross     + r.totalGross,
    fee:       acc.fee       + r.totalFee,
    pending:   acc.pending   + r.pendingFee,
    collected: acc.collected + r.collectedFee,
  }), { gross: 0, fee: 0, pending: 0, collected: 0 });

  const filtered = summaryRows.filter(r => {
    const matchesSearch = !search || r.agency?.name?.toLowerCase().includes(search.toLowerCase());
    const matchesFilter =
      filter === 'all' ||
      (filter === 'pending'   && r.pendingFee > 0) ||
      (filter === 'collected' && r.pendingFee === 0 && r.collectedFee > 0);
    return matchesSearch && matchesFilter;
  });

  // ── Mark collected — no more window.location.reload() ──────────────────────
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: QUERY_KEYS.completedBookings });
    qc.invalidateQueries({ queryKey: QUERY_KEYS.agencies });
  };

  const handleMarkCollected = async (bookingId) => {
    try {
      await base44.entities.Booking.update(bookingId, {
        commission_collected:    true,
        commission_collected_at: new Date().toISOString(),
      });
      invalidate();
    } catch (err) {
      alert('Error: ' + err.message);
    }
  };

  const handleMarkAgencyCollected = async (bookingIds) => {
    try {
      await Promise.all(
        bookingIds.map(id =>
          base44.entities.Booking.update(id, {
            commission_collected:    true,
            commission_collected_at: new Date().toISOString(),
          })
        )
      );
      invalidate();
    } catch (err) {
      alert('Error: ' + err.message);
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-bold flex items-center gap-2">
          <CreditCard className="w-5 h-5 text-primary" /> Commission Collectibles
        </h2>
        <p className="text-sm text-muted-foreground mt-0.5">
          Track platform fees owed from each agency based on completed trips
        </p>
      </div>

      {/* Grand totals */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Total Gross Revenue', value: grandTotal.gross,     color: 'text-primary' },
          { label: 'Total Platform Fees', value: grandTotal.fee,       color: 'text-blue-600' },
          { label: 'Pending Collection',  value: grandTotal.pending,   color: 'text-yellow-600', highlight: true },
          { label: 'Already Collected',   value: grandTotal.collected, color: 'text-green-600' },
        ].map(({ label, value, color, highlight }) => (
          <div key={label} className={`rounded-2xl p-4 border ${highlight ? 'bg-yellow-50 border-yellow-200' : 'bg-card'}`}>
            <p className="text-[10px] text-muted-foreground mb-1">{label}</p>
            <p className={`text-lg font-bold ${color}`}>₱{value.toLocaleString()}</p>
          </div>
        ))}
      </div>

      {/* Filter & search */}
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            className="pl-9 rounded-full"
            placeholder="Search agency..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <div className="flex gap-1">
          {['all', 'pending', 'collected'].map(f => (
            <Button
              key={f}
              size="sm"
              variant={filter === f ? 'default' : 'outline'}
              className="rounded-full capitalize text-xs"
              onClick={() => setFilter(f)}
            >
              {f}
            </Button>
          ))}
        </div>
      </div>

      {/* Per-agency cards */}
      {filtered.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <TrendingUp className="w-12 h-12 mx-auto mb-3 opacity-20" />
          <p className="text-sm">No collectibles found</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(row => {
            const isExpanded = expandedAgency === row.agencyId;
            const hasPending = row.pendingFee > 0;
            const calcFee    = (b) => b.platform_fee != null
              ? b.platform_fee
              : Math.round((b.actual_total_price || b.total_price || 0) * row.commissionRate / 100);

            return (
              <div key={row.agencyId} className={`border rounded-2xl overflow-hidden ${hasPending ? 'border-yellow-300' : 'border-border'}`}>
                <div className={`p-4 ${hasPending ? 'bg-yellow-50' : 'bg-card'}`}>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center shrink-0 overflow-hidden">
                      {row.agency?.logo_url
                        ? <img src={row.agency.logo_url} className="w-full h-full object-cover" />
                        : <Store className="w-5 h-5 text-muted-foreground" />
                      }
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-semibold text-sm">{row.agency?.name}</p>
                        <Badge className={`text-[10px] border-0 capitalize ${
                          row.plan === 'pro' || row.plan === 'yearly' ? 'bg-primary/10 text-primary' :
                          row.plan === 'starter' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-700'
                        }`}>{row.plan} · {row.commissionRate}%</Badge>
                      </div>
                      <p className="text-[10px] text-muted-foreground">{row.allBookings.length} completed trips</p>
                    </div>
                    <div className="text-right shrink-0">
                      {hasPending ? (
                        <div>
                          <p className="text-xs text-muted-foreground">Pending</p>
                          <p className="font-bold text-yellow-700">₱{row.pendingFee.toLocaleString()}</p>
                        </div>
                      ) : (
                        <div>
                          <p className="text-xs text-muted-foreground">All collected</p>
                          <p className="font-bold text-green-600">₱{row.collectedFee.toLocaleString()}</p>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2 mt-3">
                    {[
                      { label: 'Gross',         value: row.totalGross,    color: '' },
                      { label: 'Total Fee',      value: row.totalFee,      color: 'text-blue-600' },
                      { label: 'Agency Nets',    value: row.totalEarnings, color: 'text-green-600' },
                    ].map(({ label, value, color }) => (
                      <div key={label} className="bg-white/60 rounded-xl p-2 text-center border">
                        <p className="text-[10px] text-muted-foreground">{label}</p>
                        <p className={`text-xs font-bold ${color}`}>₱{value.toLocaleString()}</p>
                      </div>
                    ))}
                  </div>

                  <div className="flex gap-2 mt-3">
                    {hasPending && row.pendingBookings.length > 1 && (
                      <Button
                        size="sm"
                        className="rounded-full h-7 text-xs bg-green-600 hover:bg-green-700"
                        onClick={() => handleMarkAgencyCollected(row.pendingBookings.map(b => b.id))}
                      >
                        <CheckCircle className="w-3 h-3 mr-1" />
                        Mark All Collected (₱{row.pendingFee.toLocaleString()})
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="outline"
                      className="rounded-full h-7 text-xs ml-auto"
                      onClick={() => setExpandedAgency(isExpanded ? null : row.agencyId)}
                    >
                      {isExpanded ? <ChevronUp className="w-3 h-3 mr-1" /> : <ChevronDown className="w-3 h-3 mr-1" />}
                      {isExpanded ? 'Hide' : 'View'} Trips
                    </Button>
                  </div>
                </div>

                {isExpanded && (
                  <div className="border-t divide-y">
                    {row.allBookings.map(b => {
                      const fee   = calcFee(b);
                      const gross = b.actual_total_price || b.total_price || 0;

                      return (
                        <div key={b.id} className={`p-3 ${b.commission_collected ? 'bg-muted/30' : 'bg-background'}`}>
                          <div className="flex items-start gap-3">
                            {b.completion_proof_url ? (
                              <a href={b.completion_proof_url} target="_blank" rel="noopener noreferrer" className="shrink-0">
                                <img
                                  src={b.completion_proof_url}
                                  alt="proof"
                                  className="w-14 h-14 rounded-lg object-cover border hover:opacity-80 transition-opacity"
                                />
                              </a>
                            ) : (
                              <div className="w-14 h-14 rounded-lg bg-muted flex items-center justify-center shrink-0 border">
                                <Camera className="w-5 h-5 text-muted-foreground/40" />
                              </div>
                            )}

                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium truncate">{b.package_title}</p>
                              <p className="text-[10px] text-muted-foreground">{b.user_name} · {b.travel_date}</p>
                              <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1 text-[10px] text-muted-foreground">
                                <span>Actual: {b.actual_pax ?? b.num_pax} pax</span>
                                <span className="text-primary font-medium">Gross ₱{gross.toLocaleString()}</span>
                                <span className="text-blue-600 font-medium">Fee ₱{fee.toLocaleString()}</span>
                                {b.completed_at && (
                                  <span>{format(new Date(b.completed_at), 'MMM d, yyyy')}</span>
                                )}
                              </div>
                            </div>

                            <div className="shrink-0">
                              {b.commission_collected ? (
                                <div className="flex items-center gap-1 text-green-600 text-[10px] font-medium">
                                  <CheckCircle className="w-3 h-3" /> Collected
                                </div>
                              ) : (
                                <Button
                                  size="sm"
                                  className="h-6 text-[10px] rounded-full bg-green-600 hover:bg-green-700 px-2"
                                  onClick={() => handleMarkCollected(b.id)}
                                >
                                  Collect ₱{fee.toLocaleString()}
                                </Button>
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
          })}
        </div>
      )}
    </div>
  );
}