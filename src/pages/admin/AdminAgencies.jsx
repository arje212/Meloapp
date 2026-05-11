import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, XCircle, Ban, Loader2 } from 'lucide-react';

const statusColors = {
  pending: 'bg-yellow-100 text-yellow-700',
  approved: 'bg-green-100 text-green-700',
  rejected: 'bg-red-100 text-red-700',
  suspended: 'bg-muted text-muted-foreground',
};

export default function AdminAgencies() {
  const queryClient = useQueryClient();
  const { data: agencies = [], isLoading } = useQuery({
    queryKey: ['admin-agencies'],
    queryFn: () => base44.entities.Agency.list('-created_date'),
  });

  const handleStatus = async (id, status) => {
    await base44.entities.Agency.update(id, { status });
    queryClient.invalidateQueries({ queryKey: ['admin-agencies'] });
  };

  const handleVerify = async (agency) => {
    await base44.entities.Agency.update(agency.id, { is_verified: !agency.is_verified });
    queryClient.invalidateQueries({ queryKey: ['admin-agencies'] });
  };

  if (isLoading) return <div className="flex justify-center py-16"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;

  return (
    <div>
      <h2 className="font-display text-2xl font-bold mb-6">Agencies ({agencies.length})</h2>
      <div className="bg-card border rounded-xl overflow-hidden overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Owner</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Verified</TableHead>
              <TableHead>Bookings</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {agencies.map(a => (
              <TableRow key={a.id}>
                <TableCell className="font-medium">{a.name}</TableCell>
                <TableCell className="text-sm">{a.owner_email}</TableCell>
                <TableCell><Badge className={statusColors[a.status] || ''}>{a.status}</Badge></TableCell>
                <TableCell>{a.is_verified ? <CheckCircle className="w-4 h-4 text-green-600" /> : <span className="text-xs text-muted-foreground">No</span>}</TableCell>
                <TableCell>{a.total_bookings || 0}</TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    {a.status === 'pending' && (
                      <>
                        <Button size="sm" className="h-7 text-xs" onClick={() => handleStatus(a.id, 'approved')}>
                          <CheckCircle className="w-3 h-3 mr-1" /> Approve
                        </Button>
                        <Button variant="destructive" size="sm" className="h-7 text-xs" onClick={() => handleStatus(a.id, 'rejected')}>
                          <XCircle className="w-3 h-3 mr-1" /> Reject
                        </Button>
                      </>
                    )}
                    {a.status === 'approved' && (
                      <>
                        <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => handleVerify(a)}>
                          {a.is_verified ? 'Unverify' : 'Verify'}
                        </Button>
                        <Button variant="destructive" size="sm" className="h-7 text-xs" onClick={() => handleStatus(a.id, 'suspended')}>
                          <Ban className="w-3 h-3 mr-1" /> Suspend
                        </Button>
                      </>
                    )}
                    {a.status === 'suspended' && (
                      <Button size="sm" className="h-7 text-xs" onClick={() => handleStatus(a.id, 'approved')}>Restore</Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}