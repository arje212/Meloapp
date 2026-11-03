import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Loader2 } from 'lucide-react';
import { format } from 'date-fns';

export default function AdminTrips() {
  const { data: trips = [], isLoading } = useQuery({
    queryKey: ['admin-trips'],
    queryFn: () => base44.entities.Trip.list('-created_date', 1000),
  });

  if (isLoading) return <div className="flex justify-center py-16"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;

  return (
    <div>
      <h2 className="font-display text-2xl font-bold mb-6">Trips ({trips.length})</h2>
      <div className="bg-card border rounded-xl overflow-hidden overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Title</TableHead>
              <TableHead>Mountain</TableHead>
              <TableHead>Organizer</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {trips.map(t => (
              <TableRow key={t.id}>
                <TableCell className="font-medium">{t.title}</TableCell>
                <TableCell className="text-sm">{t.mountain_name}</TableCell>
                <TableCell className="text-sm">{t.organizer_name || t.organizer_email}</TableCell>
                <TableCell className="text-sm">{t.start_date ? format(new Date(t.start_date), 'MMM d, yyyy') : '-'}</TableCell>
                <TableCell><Badge variant="outline">{t.status}</Badge></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}