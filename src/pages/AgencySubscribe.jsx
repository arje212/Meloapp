import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, Loader2, Upload, CreditCard, Zap, Star, Crown, Gift } from 'lucide-react';

const PLANS = [
  {
    key: 'free',
    label: 'Free',
    price: 0,
    icon: Gift,
    color: 'border-gray-200 bg-gray-50',
    badge: 'bg-gray-100 text-gray-700',
    commission: 10,
    features: [
      'Up to 3 tour packages',
      'Basic agency listing',
      'Standard visibility',
      '10% platform commission',
    ],
  },
  {
    key: 'starter',
    label: 'Starter',
    price: 299,
    icon: Zap,
    color: 'border-blue-200 bg-blue-50',
    badge: 'bg-blue-100 text-blue-700',
    commission: 7,
    features: [
      'Up to 5 tour packages',
      'Better visibility',
      'Featured on explore page',
      '7% platform commission',
    ],
  },
  {
    key: 'pro',
    label: 'Pro',
    price: 999,
    icon: Star,
    color: 'border-primary/30 bg-primary/5',
    badge: 'bg-primary/10 text-primary',
    commission: 5,
    features: [
      'Unlimited tour packages',
      'Priority visibility',
      'Featured on homepage',
      'Analytics dashboard',
      '5% platform commission',
    ],
    popular: true,
  },
  {
    key: 'yearly',
    label: 'Yearly',
    price: 8999,
    icon: Crown,
    color: 'border-yellow-200 bg-yellow-50',
    badge: 'bg-yellow-100 text-yellow-700',
    commission: 3,
    features: [
      'Unlimited tour packages',
      'Top priority visibility',
      'Featured agency badge',
      'Analytics dashboard',
      '3% platform commission',
      'Save ~25% vs monthly',
    ],
  },
];

export default function AgencySubscribe() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [selectedPlan, setSelectedPlan] = useState('pro');
  const [gcashRef, setGcashRef] = useState('');
  const [proofUrl, setProofUrl] = useState('');
  const [uploading, setUploading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const { data: myAgencies = [] } = useQuery({
    queryKey: ['my-agency', user?.email],
    queryFn: () => base44.entities.Agency.filter({ owner_email: user?.email }),
    enabled: !!user?.email,
  });

  const { data: mySubs = [] } = useQuery({
    queryKey: ['my-subs', myAgencies[0]?.id],
    queryFn: () => base44.entities.AgencySubscription.filter({ agency_id: myAgencies[0]?.id }),
    enabled: !!myAgencies[0]?.id,
  });

  const submitMutation = useMutation({
    mutationFn: (data) => base44.entities.AgencySubscription.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['my-subs'] });
      setSubmitted(true);
    },
  });

  const handleUploadProof = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploading(true);
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    setProofUrl(file_url);
    setUploading(false);
  };

  const agency = myAgencies[0];
  const plan = PLANS.find(p => p.key === selectedPlan);
  const activeSub = mySubs.find(s => s.status === 'verified');
  const pendingSub = mySubs.find(s => s.status === 'pending');
  const isPaidPlan = selectedPlan !== 'free';

  if (!agency) {
    return (
      <div className="max-w-lg mx-auto px-4 py-12 text-center">
        <p className="text-muted-foreground">You need to register an agency first.</p>
        <Button className="mt-4 rounded-full" onClick={() => window.location.href = '/agency-register'}>Register Agency</Button>
      </div>
    );
  }

  if (activeSub) {
    return (
      <div className="max-w-lg mx-auto px-4 py-12 text-center">
        <div className="w-20 h-20 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
          <CheckCircle2 className="w-9 h-9 text-green-600" />
        </div>
        <h2 className="font-display text-2xl font-bold mb-2">Subscription Active</h2>
        <Badge className="bg-green-100 text-green-700 border-0 text-sm capitalize">{activeSub.plan} Plan</Badge>
        <p className="text-sm text-muted-foreground mt-3">Valid until: <strong>{activeSub.end_date || 'N/A'}</strong></p>
        <Button variant="outline" className="mt-4 rounded-full" onClick={() => window.location.href = '/agency-dashboard'}>
          Go to Dashboard
        </Button>
      </div>
    );
  }

  if (pendingSub || submitted) {
    return (
      <div className="max-w-lg mx-auto px-4 py-12 text-center">
        <div className="w-20 h-20 rounded-full bg-yellow-100 flex items-center justify-center mx-auto mb-4">
          <CreditCard className="w-9 h-9 text-yellow-600" />
        </div>
        <h2 className="font-display text-2xl font-bold mb-2">Payment Under Review</h2>
        <p className="text-sm text-muted-foreground">Our admin team is verifying your payment. This usually takes 1–24 hours.</p>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      <div className="text-center mb-8">
        <h1 className="font-display text-2xl font-bold">Choose a Plan</h1>
        <p className="text-sm text-muted-foreground mt-1">Unlock premium features for {agency.name}</p>
      </div>

      {/* Plans grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-8">
        {PLANS.map(p => {
          const Icon = p.icon;
          const isSelected = selectedPlan === p.key;
          return (
            <button
              key={p.key}
              onClick={() => setSelectedPlan(p.key)}
              className={`relative text-left p-4 rounded-2xl border-2 transition-all ${
                isSelected ? 'border-primary shadow-md scale-[1.02]' : p.color
              } ${p.popular ? 'ring-2 ring-primary/30' : ''}`}
            >
              {p.popular && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground text-[10px] font-bold px-3 py-0.5 rounded-full whitespace-nowrap">
                  POPULAR
                </span>
              )}
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center mb-3 ${p.badge}`}>
                <Icon className="w-5 h-5" />
              </div>
              <p className="font-bold">{p.label}</p>
              {p.price === 0 ? (
                <p className="text-2xl font-display font-bold text-primary mb-1">Free</p>
              ) : (
                <p className="text-2xl font-display font-bold text-primary mb-1">₱{p.price.toLocaleString()}</p>
              )}
              <p className="text-[10px] text-muted-foreground mb-3">
                {p.key === 'yearly' ? 'per year' : p.key === 'free' ? 'no payment needed' : 'per month'}
              </p>

              {/* Commission highlight */}
              <div className={`text-[10px] font-bold px-2 py-1 rounded-lg mb-3 text-center ${p.badge}`}>
                {p.commission}% commission
              </div>

              <ul className="space-y-1">
                {p.features.map((f, i) => (
                  <li key={i} className="text-xs text-muted-foreground flex items-start gap-1.5">
                    <CheckCircle2 className="w-3 h-3 text-primary shrink-0 mt-0.5" /> {f}
                  </li>
                ))}
              </ul>

              {isSelected && (
                <div className="mt-3 w-full flex items-center justify-center">
                  <CheckCircle2 className="w-5 h-5 text-primary" />
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* Free plan CTA — no payment needed */}
      {!isPaidPlan ? (
        <div className="bg-card border rounded-2xl p-6 text-center space-y-4">
          <div className="w-14 h-14 rounded-full bg-gray-100 flex items-center justify-center mx-auto">
            <Gift className="w-7 h-7 text-gray-500" />
          </div>
          <div>
            <h3 className="font-semibold text-lg">Start with Free Plan</h3>
            <p className="text-sm text-muted-foreground mt-1">
              No payment needed. You can create up to 3 packages and start receiving bookings right away.
              A <strong>10% platform commission</strong> applies per completed booking.
            </p>
          </div>
          <Button
            className="w-full rounded-full"
            onClick={() => submitMutation.mutate({
              agency_id: agency.id,
              agency_name: agency.name,
              plan: 'free',
              amount: 0,
              status: 'verified', // free plan auto-verified
            })}
            disabled={submitMutation.isPending}
          >
            {submitMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Gift className="w-4 h-4 mr-2" />}
            Activate Free Plan
          </Button>
          <p className="text-xs text-muted-foreground">You can upgrade anytime to reduce your commission rate.</p>
        </div>
      ) : (
        /* Paid plan — GCash payment */
        <div className="bg-card border rounded-2xl p-6 space-y-4">
          <h3 className="font-semibold">GCash Payment</h3>
          <div className="bg-gradient-to-br from-blue-500 to-blue-700 text-white rounded-xl p-4 flex items-center gap-4">
            <div className="text-4xl">📱</div>
            <div>
              <p className="text-sm font-medium opacity-90">Send payment to:</p>
              <p className="text-xl font-bold">09XX XXX XXXX</p>
              <p className="text-sm opacity-90">Melotrip Admin</p>
              <p className="font-bold mt-1">Amount: ₱{plan?.price.toLocaleString()}</p>
            </div>
          </div>

          <div>
            <Label>GCash Reference Number</Label>
            <Input
              placeholder="e.g. 1234567890"
              value={gcashRef}
              onChange={e => setGcashRef(e.target.value)}
              className="mt-1"
            />
          </div>

          <div>
            <Label>Upload Payment Screenshot</Label>
            <label className="flex items-center gap-3 mt-1 p-3 border-2 border-dashed rounded-xl cursor-pointer hover:bg-muted transition-colors">
              <Upload className="w-5 h-5 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">
                {proofUrl ? '✓ Screenshot uploaded' : 'Click to upload screenshot'}
              </span>
              <input type="file" accept="image/*" className="hidden" onChange={handleUploadProof} />
            </label>
            {uploading && (
              <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                <Loader2 className="w-3 h-3 animate-spin" /> Uploading...
              </div>
            )}
          </div>

          <Button
            className="w-full rounded-full"
            disabled={!gcashRef || !proofUrl || submitMutation.isPending}
            onClick={() => submitMutation.mutate({
              agency_id: agency.id,
              agency_name: agency.name,
              plan: selectedPlan,
              amount: plan?.price,
              payment_proof_url: proofUrl,
              gcash_reference: gcashRef,
              status: 'pending',
            })}
          >
            {submitMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
            Submit Payment for Review
          </Button>
        </div>
      )}
    </div>
  );
}
