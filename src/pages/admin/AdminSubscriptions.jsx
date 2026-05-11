import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Loader2, CheckCircle, XCircle, ExternalLink } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

const statusColors = {
  pending: 'bg-yellow-100 text-yellow-700',
  verified: 'bg-green-100 text-green-700',
  rejected: 'bg-red-100 text-red-700',
  expired: 'bg-gray-100 text-gray-600',
};

const PLAN_DURATIONS = { weekly: 7, monthly: 30, yearly: 365 };

export default function AdminSubscriptions() {
  const qc = useQueryClient();

  const { data: subs = [], isLoading } = useQuery({
    queryKey: ['admin-subs'],
    queryFn: () => base44.entities.AgencySubscription.list('-created_date', 100),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.AgencySubscription.update(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-subs'] }),
  });

  const approve = (sub) => {
    const start = new Date();
    const end = new Date();
    end.setDate(end.getDate() + PLAN_DURATIONS[sub.plan]);
    updateMutation.mutate({
      id: sub.id,
      data: {
        status: 'verified',
        start_date: start.toISOString().split('T')[0],
        end_date: end.toISOString().split('T')[0],
      },
    });
  };

  const reject = (id) => updateMutation.mutate({ id, data: { status: 'rejected' } });

  if (isLoading) return <div className="flex justify-center py-16"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;

  return (
    <div>
      <h2 className="text-xl font-semibold mb-4">Agency Subscriptions</h2>
      <div className="bg-card border rounded-2xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted">
            <tr>
              {['Agency', 'Plan', 'Amount', 'GCash Ref', 'Proof', 'Status', 'Submitted', 'Actions'].map(h => (
                <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {subs.map(sub => (
              <tr key={sub.id} className="border-t hover:bg-muted/30">
                <td className="px-4 py-3 font-medium">{sub.agency_name}</td>
                <td className="px-4 py-3"><Badge variant="outline" className="capitalize">{sub.plan}</Badge></td>
                <td className="px-4 py-3">₱{sub.amount?.toLocaleString()}</td>
                <td className="px-4 py-3 font-mono text-xs">{sub.gcash_reference || '—'}</td>
                <td className="px-4 py-3">
                  {sub.payment_proof_url ? (
                    <a href={sub.payment_proof_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline text-xs">
                      View <ExternalLink className="w-3 h-3" />
                    </a>
                  ) : '—'}
                </td>
                <td className="px-4 py-3">
                  <Badge className={`${statusColors[sub.status] || ''} border-0 capitalize`}>{sub.status}</Badge>
                </td>
                <td className="px-4 py-3 text-xs text-muted-foreground">
                  {sub.created_date ? formatDistanceToNow(new Date(sub.created_date), { addSuffix: true }) : '—'}
                </td>
                <td className="px-4 py-3">
                  {sub.status === 'pending' && (
                    <div className="flex gap-1">
                      <Button size="sm" className="h-7 text-xs rounded-full" onClick={() => approve(sub)}>
                        <CheckCircle className="w-3 h-3 mr-1" /> Approve
                      </Button>
                      <Button size="sm" variant="destructive" className="h-7 text-xs rounded-full" onClick={() => reject(sub.id)}>
                        <XCircle className="w-3 h-3 mr-1" /> Reject
                      </Button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {subs.length === 0 && <p className="text-center py-8 text-muted-foreground text-sm">No subscription requests yet</p>}
      </div>
    </div>
  );
}