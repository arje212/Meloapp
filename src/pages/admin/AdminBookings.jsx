import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2 } from 'lucide-react';
import { format } from 'date-fns';

const statusColors = {
  pending: 'bg-yellow-100 text-yellow-700',
  confirmed: 'bg-blue-100 text-blue-700',
  paid: 'bg-green-100 text-green-700',
  completed: 'bg-muted text-muted-foreground',
  cancelled: 'bg-red-100 text-red-700',
  refunded: 'bg-purple-100 text-purple-700',
};

export default function AdminBookings() {
  const queryClient = useQueryClient();
  const { data: bookings = [], isLoading } = useQuery({
    queryKey: ['admin-bookings'],
    queryFn: () => base44.entities.Booking.list('-created_date'),
  });

  const handleStatusChange = async (id, status) => {
    await base44.entities.Booking.update(id, { status });
    queryClient.invalidateQueries({ queryKey: ['admin-bookings'] });
  };

  if (isLoading) return <div className="flex justify-center py-16"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;

  const total = bookings.reduce((sum, b) => sum + (b.total_price || 0), 0);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="font-display text-2xl font-bold">Bookings ({bookings.length})</h2>
        <p className="text-lg font-bold text-primary">Total: ₱{total.toLocaleString()}</p>
      </div>
      <div className="bg-card border rounded-xl overflow-hidden overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Package</TableHead>
              <TableHead>User</TableHead>
              <TableHead>Agency</TableHead>
              <TableHead>Amount</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {bookings.map(b => (
              <TableRow key={b.id}>
                <TableCell className="font-medium">{b.package_title}</TableCell>
                <TableCell className="text-sm">{b.user_name || b.user_email}</TableCell>
                <TableCell className="text-sm">{b.agency_name}</TableCell>
                <TableCell className="font-semibold">₱{b.total_price?.toLocaleString()}</TableCell>
                <TableCell className="text-sm">{b.travel_date ? format(new Date(b.travel_date), 'MMM d, yyyy') : '-'}</TableCell>
                <TableCell>
                  <Select value={b.status} onValueChange={v => handleStatusChange(b.id, v)}>
                    <SelectTrigger className="w-32 h-8">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {['pending', 'confirmed', 'paid', 'completed', 'cancelled', 'refunded'].map(s => (
                        <SelectItem key={s} value={s}>{s}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}