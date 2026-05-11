import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Store, CheckCircle2, Loader2, Upload, Clock } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function AgencyRegister() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: '', description: '', contact_phone: '', location: '', website: '' });
  const [uploading, setUploading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const { data: existing = [] } = useQuery({
    queryKey: ['my-agency', user?.email],
    queryFn: () => base44.entities.Agency.filter({ owner_email: user?.email }),
    enabled: !!user?.email,
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.Agency.create(data),
    onSuccess: () => setSubmitted(true),
  });

  const handleSubmit = () => {
    createMutation.mutate({
      ...form,
      owner_email: user.email,
      owner_name: user.full_name,
      contact_email: user.email,
      status: 'pending',
      is_verified: false,
      rating: 0,
      total_bookings: 0,
    });
  };

  const myAgency = existing[0];

  if (myAgency) {
    return (
      <div className="max-w-lg mx-auto px-4 py-12 text-center">
        <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
          <Store className="w-9 h-9 text-primary" />
        </div>
        <h2 className="font-display text-2xl font-bold mb-2">{myAgency.name}</h2>
        <Badge className={
          myAgency.status === 'approved' ? 'bg-green-100 text-green-700 border-0' :
          myAgency.status === 'pending' ? 'bg-yellow-100 text-yellow-700 border-0' :
          'bg-red-100 text-red-700 border-0'
        }>
          {myAgency.status === 'approved' ? '✓ Approved' :
           myAgency.status === 'pending' ? '⏳ Pending Review' : '✗ Rejected'}
        </Badge>
        <p className="text-sm text-muted-foreground mt-3 mb-6">
          {myAgency.status === 'pending'
            ? 'Your agency registration is under review. We\'ll notify you once approved.'
            : myAgency.status === 'approved'
            ? 'Your agency is live! Manage your packages and bookings.'
            : 'Your application was rejected. Contact support for more info.'}
        </p>
        {myAgency.status === 'approved' && (
          <div className="flex gap-2 justify-center flex-wrap">
            <Button className="rounded-full" onClick={() => navigate('/agency-dashboard')}>Agency Dashboard</Button>
            <Button variant="outline" className="rounded-full" onClick={() => navigate(`/agencies/${myAgency.id}`)}>Public Page</Button>
          </div>
        )}
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="max-w-lg mx-auto px-4 py-12 text-center">
        <div className="w-20 h-20 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
          <CheckCircle2 className="w-9 h-9 text-green-600" />
        </div>
        <h2 className="font-display text-2xl font-bold mb-2">Application Submitted!</h2>
        <p className="text-sm text-muted-foreground mb-6">Your agency registration is under review. Our admin team will get back to you within 1-3 business days.</p>
        <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
          <Clock className="w-4 h-4" /> Expected review: 1-3 business days
        </div>
        <Button className="mt-6 rounded-full" onClick={() => navigate('/')}>Back to Home</Button>
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto px-4 py-6">
      <div className="text-center mb-8">
        <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-3">
          <Store className="w-7 h-7 text-primary" />
        </div>
        <h1 className="font-display text-2xl font-bold">Register Your Agency</h1>
        <p className="text-sm text-muted-foreground mt-1">Join as a travel agency partner on Lakbay Bundok</p>
      </div>

      <div className="bg-card border rounded-2xl p-6 space-y-4">
        <div>
          <Label>Agency Name <span className="text-destructive">*</span></Label>
          <Input placeholder="e.g. Mountain Explorers PH" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
        </div>
        <div>
          <Label>Description <span className="text-destructive">*</span></Label>
          <Textarea placeholder="Tell us about your agency, specialties, and services..." value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={3} className="resize-none" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Contact Number <span className="text-destructive">*</span></Label>
            <Input placeholder="+63 9XX XXX XXXX" value={form.contact_phone} onChange={e => setForm(f => ({ ...f, contact_phone: e.target.value }))} />
          </div>
          <div>
            <Label>Location</Label>
            <Input placeholder="City / Province" value={form.location} onChange={e => setForm(f => ({ ...f, location: e.target.value }))} />
          </div>
        </div>
        <div>
          <Label>Website / Facebook</Label>
          <Input placeholder="https://..." value={form.website} onChange={e => setForm(f => ({ ...f, website: e.target.value }))} />
        </div>

        <div className="bg-muted rounded-xl p-4 text-sm text-muted-foreground space-y-1">
          <p className="font-semibold text-foreground">Review Process</p>
          <p>1. Submit your registration</p>
          <p>2. Admin reviews your application</p>
          <p>3. Once approved, set up your subscription plan</p>
          <p>4. Start listing your tour packages!</p>
        </div>

        <Button
          className="w-full rounded-full"
          onClick={handleSubmit}
          disabled={!form.name || !form.description || !form.contact_phone || createMutation.isPending}
        >
          {createMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
          Submit Registration
        </Button>
      </div>
    </div>
  );
}