import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Loader2, CheckCircle, XCircle, ExternalLink, AlertCircle } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { supabase } from '@/lib/supabase';
import { todayStr, subscriptionEndDateFor } from '@/lib/plans';

const statusColors = {
  pending: 'bg-yellow-100 text-yellow-700',
  verified: 'bg-green-100 text-green-700',
  rejected: 'bg-red-100 text-red-700',
  expired: 'bg-gray-100 text-gray-600',
};

const isMissingColumnError = (error) => {
  const message = `${error?.message || ''} ${error?.details || ''}`;
  return error?.code === 'PGRST204' || /column .* does not exist|could not find .* column/i.test(message);
};

const findMissingColumn = (error) => {
  const message = `${error?.message || ''} ${error?.details || ''}`;
  return message.match(/'([^']+)' column/i)?.[1] ||
    message.match(/column "([^"]+)"/i)?.[1] ||
    null;
};

export default function AdminSubscriptions() {
  const qc = useQueryClient();
  const [actionError, setActionError] = useState('');

  const { data: subs = [], isLoading } = useQuery({
    queryKey: ['admin-subs'],
    queryFn: () => base44.entities.AgencySubscription.list('-created_date', 1000),
  });

  const updateSubscription = async (id, data) => {
    let payload = { ...data };

    for (let attempt = 0; attempt < 6; attempt += 1) {
      const { error } = await supabase
        .from('agency_subscriptions')
        .update(payload)
        .eq('id', id);
      if (!error) return;

      const missingColumn = findMissingColumn(error);
      if (!isMissingColumnError(error) || !missingColumn || !(missingColumn in payload)) {
        throw error;
      }

      const { [missingColumn]: _removed, ...rest } = payload;
      payload = rest;
    }

    throw new Error('Unable to update subscription because the table schema does not match the app fields.');
  };

  const updateAgency = async (id, data) => {
    if (!id) return;
    const { error } = await supabase
      .from('agencies')
      .update(data)
      .eq('id', id);
    if (error) throw error;
  };

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['admin-subs'] });
    qc.invalidateQueries({ queryKey: ['my-subs'] });
    qc.invalidateQueries({ queryKey: ['my-agency'] });
    qc.invalidateQueries({ queryKey: ['admin-agencies'] });
  };

  const approve = async (sub) => {
    setActionError('');
    try {
      const patch = { status: 'verified' };
      if (sub.plan !== 'free') {
        // Paid plans are valid for 1 year. Early renewals extend from the current end date.
        let others = [];
        try {
          const { data } = await supabase
            .from('agency_subscriptions').select('*')
            .eq('agency_id', sub.agency_id).eq('status', 'verified').neq('id', sub.id);
          others = data || [];
        } catch { /* fall back to today + 1 year */ }
        patch.start_date = todayStr();
        patch.end_date = subscriptionEndDateFor(others);
      }
      await updateSubscription(sub.id, patch);
      try {
        await updateAgency(sub.agency_id, {
          status: 'approved',
          is_verified: true,
        });
      } catch (agencyError) {
        console.warn('Subscription approved, but agency verification update failed:', agencyError);
      }
      refresh();
    } catch (error) {
      setActionError(error.message || 'Unable to approve subscription.');
    }
  };

  const reject = async (id) => {
    setActionError('');
    try {
      await updateSubscription(id, { status: 'rejected' });
      refresh();
    } catch (error) {
      setActionError(error.message || 'Unable to reject subscription.');
    }
  };

  if (isLoading) return <div className="flex justify-center py-16"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;

  return (
    <div>
      <h2 className="text-xl font-semibold mb-4">Agency Subscriptions</h2>
      {actionError && (
        <div className="mb-4 flex gap-2 rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            <p className="font-medium">Action failed</p>
            <p className="text-xs">{actionError}</p>
          </div>
        </div>
      )}
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
