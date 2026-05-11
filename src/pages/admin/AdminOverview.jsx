import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Users, Mountain, Store, Package, CalendarDays, MessageSquare, TrendingUp, DollarSign } from 'lucide-react';

export default function AdminOverview() {
  const { data: users = [] } = useQuery({ queryKey: ['admin-users'], queryFn: () => base44.entities.User.list('-created_date') });
  const { data: mountains = [] } = useQuery({ queryKey: ['admin-mountains'], queryFn: () => base44.entities.Mountain.list() });
  const { data: agencies = [] } = useQuery({ queryKey: ['admin-agencies'], queryFn: () => base44.entities.Agency.list() });
  const { data: bookings = [] } = useQuery({ queryKey: ['admin-bookings'], queryFn: () => base44.entities.Booking.list() });
  const { data: trips = [] } = useQuery({ queryKey: ['admin-trips'], queryFn: () => base44.entities.Trip.list() });
  const { data: posts = [] } = useQuery({ queryKey: ['admin-posts'], queryFn: () => base44.entities.Post.list() });

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
      <h2 className="font-display text-2xl font-bold mb-6">Dashboard Overview</h2>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {stats.map(s => (
          <Card key={s.label}>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${s.color}`}>
                  <s.icon className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{s.value}</p>
                  <p className="text-xs text-muted-foreground">{s.label}</p>
                  {s.sub && <p className="text-[10px] text-yellow-600">{s.sub}</p>}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Recent activity */}
      <div className="grid md:grid-cols-2 gap-6 mt-8">
        <Card>
          <CardHeader><CardTitle className="text-base">Recent Bookings</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {bookings.slice(0, 5).map(b => (
              <div key={b.id} className="flex items-center justify-between text-sm">
                <div>
                  <p className="font-medium">{b.package_title}</p>
                  <p className="text-xs text-muted-foreground">{b.user_name || b.user_email}</p>
                </div>
                <div className="text-right">
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
          <CardContent className="space-y-3">
            {agencies.filter(a => a.status === 'pending').slice(0, 5).map(a => (
              <div key={a.id} className="flex items-center justify-between text-sm">
                <div>
                  <p className="font-medium">{a.name}</p>
                  <p className="text-xs text-muted-foreground">{a.owner_email}</p>
                </div>
                <span className="text-xs text-yellow-600">Pending</span>
              </div>
            ))}
            {pendingAgencies === 0 && <p className="text-sm text-muted-foreground">No pending agencies</p>}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}