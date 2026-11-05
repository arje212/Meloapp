import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Users, Mountain, Store, Package, CalendarDays, MessageSquare, DollarSign } from 'lucide-react';

export default function AdminOverview() {
  const { data: users = [] } = useQuery({ queryKey: ['admin-users'], queryFn: () => base44.entities.User.list('-created_date', 1000) });
  const { data: mountains = [] } = useQuery({ queryKey: ['admin-mountains'], queryFn: () => base44.entities.Mountain.list() });
  const { data: agencies = [] } = useQuery({ queryKey: ['admin-agencies'], queryFn: () => base44.entities.Agency.list(undefined, 1000) });
  const { data: bookings = [] } = useQuery({ queryKey: ['admin-bookings'], queryFn: () => base44.entities.Booking.list(undefined, 1000) });
  const { data: trips = [] } = useQuery({ queryKey: ['admin-trips'], queryFn: () => base44.entities.Trip.list(undefined, 1000) });
  const { data: posts = [] } = useQuery({ queryKey: ['admin-posts'], queryFn: () => base44.entities.Post.list(undefined, 1000) });

  const totalRevenue = bookings.reduce((sum, b) => sum + (b.total_price || 0), 0);
  const pendingAgencies = agencies.filter(a => a.status === 'pending').length;

  const stats = [
    { label: 'Total Users', value: users.length, icon: Users, color: 'text-blue-600 bg-blue-100' },
    { label: 'Mountains', value: mountains.length, icon: Mountain, color: 'text-green-600 bg-green-100' },
    { label: 'Agencies', value: agencies.length, icon: Store, color: 'text-purple-600 bg-purple-100', sub: `${pendingAgencies} pending` },
    { label: 'Bookings', value: bookings.length, icon: Package, color: 'text-orange-600 bg-orange-100' },
    { label: 'Trips', value: trips.length, icon: CalendarDays, color: 'text-teal-600 bg-teal-100' },
    { label: 'Posts', value: posts.length, icon: MessageSquare, color: 'text-pink-600 bg-pink-100' },
    { label: 'Revenue', value: `₱${totalRevenue.toLocaleString()}`, icon: DollarSign, color: 'text-emerald-600 bg-emerald-100' },
  ];

  return (
    <div>
      <h2 className="mb-6 font-display text-xl font-bold sm:text-2xl">Dashboard Overview</h2>
      <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-4">
        {stats.map(s => (
          <Card key={s.label}>
            <CardContent className="p-3 sm:p-4">
              <div className="flex min-w-0 items-center gap-2 sm:gap-3">
                <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl sm:h-10 sm:w-10 ${s.color}`}>
                  <s.icon className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <p className="break-words text-lg font-bold sm:text-2xl">{s.value}</p>
                  <p className="text-[11px] leading-tight text-muted-foreground sm:text-xs">{s.label}</p>
                  {s.sub && <p className="text-[10px] text-yellow-600">{s.sub}</p>}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Recent activity */}
      <div className="mt-6 grid gap-4 sm:mt-8 sm:gap-6 md:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-base">Recent Bookings</CardTitle></CardHeader>
          <CardContent className="space-y-4 sm:space-y-3">
            {bookings.slice(0, 5).map(b => (
              <div key={b.id} className="flex flex-col gap-1 text-sm sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="break-words font-medium">{b.package_title}</p>
                  <p className="break-all text-xs text-muted-foreground">{b.user_name || b.user_email}</p>
                </div>
                <div className="shrink-0 sm:text-right">
                  <p className="font-semibold text-primary">₱{b.total_price?.toLocaleString()}</p>
                  <p className="text-xs text-muted-foreground">{b.status}</p>
                </div>
              </div>
            ))}
            {bookings.length === 0 && <p className="text-sm text-muted-foreground">No bookings yet</p>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Pending Agencies</CardTitle></CardHeader>
          <CardContent className="space-y-4 sm:space-y-3">
            {agencies.filter(a => a.status === 'pending').slice(0, 5).map(a => (
              <div key={a.id} className="flex flex-col gap-1 text-sm sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="break-words font-medium">{a.name}</p>
                  <p className="break-all text-xs text-muted-foreground">{a.owner_email}</p>
                </div>
                <span className="shrink-0 text-xs text-yellow-600">Pending</span>
              </div>
            ))}
            {pendingAgencies === 0 && <p className="text-sm text-muted-foreground">No pending agencies</p>}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}