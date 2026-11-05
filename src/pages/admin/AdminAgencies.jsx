import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { isCommissionConfirmed } from '@/lib/commission';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, XCircle, Ban, Loader2, AlertTriangle } from 'lucide-react';
import { getAgencyDocumentUrl } from '@/lib/agencyDocuments';

const statusColors = {
  pending:   'bg-yellow-100 text-yellow-700',
  approved:  'bg-green-100 text-green-700',
  rejected:  'bg-red-100 text-red-700',
  suspended: 'bg-muted text-muted-foreground',
};

export default function AdminAgencies() {
  const queryClient = useQueryClient();

  const { data: agencies = [], isLoading } = useQuery({
    queryKey: ['admin-agencies'],
    queryFn: () => base44.entities.Agency.list('-created_date', 1000),
  });

  const { data: documentUrls = {}, error: documentsError } = useQuery({
    queryKey: ['admin-agency-document-urls', agencies.map(a => [a.id, a.business_reg_document_path, a.permit_document_path])],
    queryFn: async () => {
      const documents = await Promise.all(agencies.flatMap(agency => [
        ['business_reg_document_path', 'business'],
        ['permit_document_path', 'permit'],
      ].filter(([field]) => agency[field]).map(async ([field, kind]) => [
        `${agency.id}:${kind}`,
        await getAgencyDocumentUrl(agency[field]),
      ])));
      return Object.fromEntries(documents);
    },
    enabled: agencies.some(a => a.business_reg_document_path || a.permit_document_path),
    staleTime: 5 * 60 * 1000,
    refetchInterval: 8 * 60 * 1000,
  });

  // Fetch all completed bookings to compute per-agency commission status
  const { data: bookings = [] } = useQuery({
    queryKey: ['admin-bookings'],
    queryFn: () => base44.entities.Booking.list('-created_date', 1000),
  });

  const handleStatus = async (id, status) => {
    await base44.entities.Agency.update(id, { status });
    queryClient.invalidateQueries({ queryKey: ['admin-agencies'] });
  };

  const handleVerify = async (agency) => {
    await base44.entities.Agency.update(agency.id, { is_verified: !agency.is_verified });
    queryClient.invalidateQueries({ queryKey: ['admin-agencies'] });
  };

  // Per-agency: count pending (unpaid) commissions on completed bookings
  const pendingCommissionMap = bookings.reduce((acc, b) => {
    if (b.status === 'completed' && !isCommissionConfirmed(b)) {
      acc[b.agency_id] = (acc[b.agency_id] || 0) + 1;
    }
    return acc;
  }, {});

  if (isLoading) return (
    <div className="flex justify-center py-16">
      <Loader2 className="w-8 h-8 animate-spin text-primary" />
    </div>
  );

  return (
    <div>
      <h2 className="font-display text-2xl font-bold mb-6">Agencies ({agencies.length})</h2>
      {documentsError && (
        <p role="alert" className="mb-4 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
          Could not load agency documents: {documentsError.message}
        </p>
      )}
      <div className="bg-card border rounded-xl overflow-hidden overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Owner</TableHead>
              <TableHead>Documents</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Verified</TableHead>
              <TableHead>Bookings</TableHead>
              <TableHead>Commission</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {agencies.map(a => {
              const pendingCount = pendingCommissionMap[a.id] || 0;
              return (
                <TableRow key={a.id}>
                  <TableCell className="font-medium">{a.name}</TableCell>
                  <TableCell className="text-sm">{a.owner_email}</TableCell>
                  <TableCell>
                    <div className="flex flex-col items-start gap-1 text-xs">
                      {a.business_reg_document_path && (
                        documentUrls[`${a.id}:business`]
                          ? <a href={documentUrls[`${a.id}:business`]} target="_blank" rel="noreferrer" className="text-primary underline">Business registration</a>
                          : <span className="text-muted-foreground">Business registration · loading</span>
                      )}
                      {a.permit_document_path && (
                        documentUrls[`${a.id}:permit`]
                          ? <a href={documentUrls[`${a.id}:permit`]} target="_blank" rel="noreferrer" className="text-primary underline">DOLE / Permit</a>
                          : <span className="text-muted-foreground">DOLE / Permit · loading</span>
                      )}
                      {!a.business_reg_document_path && !a.permit_document_path && (
                        <span className="text-muted-foreground">Not submitted</span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge className={statusColors[a.status] || ''}>{a.status}</Badge>
                  </TableCell>
                  <TableCell>
                    {a.is_verified
                      ? <CheckCircle className="w-4 h-4 text-green-600" />
                      : <span className="text-xs text-muted-foreground">No</span>}
                  </TableCell>
                  <TableCell>{a.total_bookings || 0}</TableCell>
                  <TableCell>
                    {pendingCount > 0 ? (
                      <Badge className="bg-orange-100 text-orange-700 border-orange-200 gap-1 text-xs">
                        <AlertTriangle className="w-3 h-3" />
                        {pendingCount} unpaid
                      </Badge>
                    ) : (
                      <Badge className="bg-green-100 text-green-700 border-green-200 text-xs">
                        <CheckCircle className="w-3 h-3 mr-1" /> Clear
                      </Badge>
                    )}
                    {a.commission_warning && (
                      <Badge className="bg-red-100 text-red-700 text-[10px] mt-1 block w-fit">
                        ⚠ Warning on record
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1 flex-wrap">
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
                        <Button size="sm" className="h-7 text-xs" onClick={() => handleStatus(a.id, 'approved')}>
                          Restore
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}