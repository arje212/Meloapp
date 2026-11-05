import { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Store, CheckCircle2, Loader2, Clock, AlertCircle, ImagePlus, X, FileText, Upload } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { uploadAgencyDocument } from '@/lib/agencyDocuments';

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

const insertAgency = async (payload) => {
  let nextPayload = { ...payload };

  for (let attempt = 0; attempt < 20; attempt += 1) {
    const { data, error } = await supabase
      .from('agencies')
      .insert(nextPayload)
      .select()
      .single();

    if (!error) return data;
    const missingColumn = findMissingColumn(error);

    if (['business_reg_document_path', 'permit_document_path'].includes(missingColumn)) {
      throw new Error('Agency document storage is not configured yet. Ask an administrator to apply the latest database migration.');
    }

    if (!isMissingColumnError(error) || !missingColumn || !(missingColumn in nextPayload)) {
      throw error;
    }

    const { [missingColumn]: _removed, ...rest } = nextPayload;
    nextPayload = rest;
  }

  throw new Error('Unable to match the agency form fields with the agencies table schema.');
};

export default function AgencyRegister() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [form, setForm] = useState({ name: '', description: '', contact_phone: '', location: '', website: '' });
  const [submitted, setSubmitted] = useState(false);

  // ✅ NEW: Image upload state
  const [logoUrl, setLogoUrl] = useState('');
  const [coverUrl, setCoverUrl] = useState('');
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [uploadingCover, setUploadingCover] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [documentPaths, setDocumentPaths] = useState({
    business_reg_document_path: '',
    permit_document_path: '',
  });
  const [uploadingDocument, setUploadingDocument] = useState(null);
  const [savingDocuments, setSavingDocuments] = useState(false);

  const { data: existing = [] } = useQuery({
    queryKey: ['my-agency', user?.email],
    queryFn: () => base44.entities.Agency.filter({ owner_email: user?.email }),
    enabled: !!user?.email,
  });

  useEffect(() => {
    const agency = existing[0];
    if (!agency) return;
    setDocumentPaths({
      business_reg_document_path: agency.business_reg_document_path || '',
      permit_document_path: agency.permit_document_path || '',
    });
  }, [existing]);

  const createMutation = useMutation({
    mutationFn: insertAgency,
    onSuccess: () => setSubmitted(true),
  });

  // ✅ NEW: Upload handler for logo and cover
  const handleUpload = async (file, type) => {
    setUploadError('');
    const setLoading = type === 'logo' ? setUploadingLogo : setUploadingCover;
    const setUrl = type === 'logo' ? setLogoUrl : setCoverUrl;
    setLoading(true);
    try {
      const path = `uploads/${Date.now()}_${file.name}`;
      const { error } = await supabase.storage.from('files').upload(path, file, { contentType: file.type });
      if (error) throw error;
      const { data } = supabase.storage.from('files').getPublicUrl(path);
      setUrl(data.publicUrl);
    } catch (err) {
      setUploadError('Upload failed: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDocumentUpload = async (file, field, agencyId = 'applications') => {
    if (!file) return;
    setUploadError('');
    setUploadingDocument(field);
    try {
      const path = await uploadAgencyDocument(file, user.id, agencyId);
      setDocumentPaths(current => ({ ...current, [field]: path }));
    } catch (err) {
      setUploadError(err.message || 'Document upload failed.');
    } finally {
      setUploadingDocument(null);
    }
  };

  const handleSubmit = () => {
    if (!user?.id || !user?.email) return;

    createMutation.mutate({
      name: form.name.trim(),
      description: form.description.trim(),
      contact_phone: form.contact_phone.trim(),
      location: form.location.trim() || null,
      website: form.website.trim() || null,
      owner_id: user.id,
      owner_email: user.email,
      owner_name: user.full_name || user.email,
      contact_email: user.email,
      status: 'pending',
      is_verified: false,
      rating: 0,
      total_bookings: 0,
      // ✅ NEW: include images
      logo_url: logoUrl || null,
      cover_url: coverUrl || null,
      ...documentPaths,
    });
  };

  const myAgency = existing[0];

  const handleSaveDocuments = async () => {
    if (!myAgency) return;
    setSavingDocuments(true);
    setUploadError('');
    try {
      const updatedAgency = await base44.entities.Agency.update(myAgency.id, {
        business_reg_document_path: documentPaths.business_reg_document_path || null,
        permit_document_path: documentPaths.permit_document_path || null,
      });
      for (const field of ['business_reg_document_path', 'permit_document_path']) {
        if (!Object.prototype.hasOwnProperty.call(updatedAgency || {}, field)) {
          throw new Error('Agency document storage is not configured yet. Ask an administrator to apply the latest database migration.');
        }
      }
      await queryClient.invalidateQueries({ queryKey: ['my-agency', user?.email] });
    } catch (error) {
      setUploadError(error.message || 'Could not save your agency documents.');
    } finally {
      setSavingDocuments(false);
    }
  };

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
        <div className="text-left bg-card border rounded-2xl p-4 space-y-3">
          <div>
            <p className="text-sm font-semibold">Verification documents</p>
            <p className="text-xs text-muted-foreground mt-1">Upload privately for Melotrip admin review. PDF, JPG, PNG, or WebP up to 10MB.</p>
          </div>
          {[
            { field: 'business_reg_document_path', label: 'Business Registration' },
            { field: 'permit_document_path', label: 'DOLE / Operating Permit' },
          ].map(({ field, label }) => (
            <div key={field} className="flex items-center gap-3 rounded-lg border p-3">
              <FileText className="w-5 h-5 text-primary shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium">{label}</p>
                <p className="text-xs text-muted-foreground">{documentPaths[field] ? 'Uploaded privately' : 'Not submitted'}</p>
              </div>
              <label className="inline-flex items-center gap-1.5 rounded-full border px-3 py-2 text-xs font-medium cursor-pointer hover:bg-muted shrink-0">
                {uploadingDocument === field ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                {documentPaths[field] ? 'Replace' : 'Upload'}
                <input
                  type="file"
                  accept=".pdf,image/jpeg,image/png,image/webp"
                  className="hidden"
                  disabled={!!uploadingDocument}
                  onChange={event => {
                    handleDocumentUpload(event.target.files?.[0], field, myAgency.id);
                    event.target.value = '';
                  }}
                />
              </label>
            </div>
          ))}
          {uploadError && <p role="alert" className="text-xs text-destructive">{uploadError}</p>}
          <Button
            type="button"
            className="w-full min-h-10 rounded-xl"
            onClick={handleSaveDocuments}
            disabled={savingDocuments || !!uploadingDocument}
          >
            {savingDocuments && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Save verification documents
          </Button>
        </div>
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
        <p className="text-sm text-muted-foreground mt-1">Join as a travel agency partner on Melotrip</p>
      </div>

      <div className="bg-card border rounded-2xl p-6 space-y-4">

        {/* ✅ NEW: Cover Photo Upload */}
        <div>
          <Label>Cover Photo <span className="text-muted-foreground text-xs">(optional)</span></Label>
          {coverUrl ? (
            <div className="relative mt-1 h-36 rounded-xl overflow-hidden bg-muted">
              <img src={coverUrl} alt="Cover" className="w-full h-full object-cover" />
              <button
                onClick={() => setCoverUrl('')}
                className="absolute top-2 right-2 w-7 h-7 bg-black/60 text-white rounded-full flex items-center justify-center hover:bg-black/80 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <label className="flex items-center gap-3 mt-1 p-4 border-2 border-dashed rounded-xl cursor-pointer hover:bg-muted transition-colors">
              {uploadingCover
                ? <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                : <ImagePlus className="w-5 h-5 text-muted-foreground" />}
              <span className="text-sm text-muted-foreground">
                {uploadingCover ? 'Uploading...' : 'Upload cover photo (landscape recommended)'}
              </span>
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={e => e.target.files[0] && handleUpload(e.target.files[0], 'cover')}
              />
            </label>
          )}
        </div>

        {/* ✅ NEW: Logo Upload */}
        <div>
          <Label>Agency Logo <span className="text-muted-foreground text-xs">(optional)</span></Label>
          {logoUrl ? (
            <div className="flex items-center gap-3 mt-1">
              <div className="relative w-20 h-20 rounded-xl overflow-hidden bg-muted border">
                <img src={logoUrl} alt="Logo" className="w-full h-full object-cover" />
                <button
                  onClick={() => setLogoUrl('')}
                  className="absolute top-1 right-1 w-5 h-5 bg-black/60 text-white rounded-full flex items-center justify-center hover:bg-black/80 transition-colors"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
              <p className="text-xs text-muted-foreground">Logo uploaded ✓</p>
            </div>
          ) : (
            <label className="flex items-center gap-3 mt-1 p-4 border-2 border-dashed rounded-xl cursor-pointer hover:bg-muted transition-colors">
              {uploadingLogo
                ? <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                : <ImagePlus className="w-5 h-5 text-muted-foreground" />}
              <span className="text-sm text-muted-foreground">
                {uploadingLogo ? 'Uploading...' : 'Upload agency logo (square recommended)'}
              </span>
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={e => e.target.files[0] && handleUpload(e.target.files[0], 'logo')}
              />
            </label>
          )}
        </div>

        <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 space-y-3">
          <div>
            <p className="text-sm font-semibold">Agency verification documents</p>
            <p className="text-xs text-muted-foreground mt-1">
              Optional for now. Upload a business registration and/or DOLE or operating permit for admin review.
              These files are private to you and Melotrip admins.
            </p>
          </div>
          {[
            { field: 'business_reg_document_path', label: 'Business Registration' },
            { field: 'permit_document_path', label: 'DOLE / Operating Permit' },
          ].map(({ field, label }) => (
            <div key={field} className="flex items-center gap-3 rounded-lg border bg-background p-3">
              <FileText className="w-5 h-5 text-primary shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium">{label}</p>
                <p className="text-xs text-muted-foreground">
                  {documentPaths[field] ? 'Uploaded privately' : 'PDF, JPG, PNG, or WebP · max 10MB'}
                </p>
              </div>
              {documentPaths[field] ? (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="rounded-full shrink-0"
                  onClick={() => setDocumentPaths(current => ({ ...current, [field]: '' }))}
                >
                  <X className="w-3.5 h-3.5 mr-1" /> Remove
                </Button>
              ) : (
                <label className="inline-flex items-center gap-1.5 rounded-full border px-3 py-2 text-xs font-medium cursor-pointer hover:bg-muted shrink-0">
                  {uploadingDocument === field ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                  {uploadingDocument === field ? 'Uploading' : 'Upload'}
                  <input
                    type="file"
                    accept=".pdf,image/jpeg,image/png,image/webp"
                    className="hidden"
                    disabled={!!uploadingDocument}
                    onChange={event => {
                      handleDocumentUpload(event.target.files?.[0], field);
                      event.target.value = '';
                    }}
                  />
                </label>
              )}
            </div>
          ))}
        </div>

        {uploadError && (
          <div className="flex gap-2 rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <p className="text-xs">{uploadError}</p>
          </div>
        )}

        <div>
          <Label>Agency Name <span className="text-destructive">*</span></Label>
          <Input placeholder="e.g. Island Trails PH, CityHop Tours, Mountain Explorers PH" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
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

        {createMutation.error && (
          <div className="flex gap-2 rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <div>
              <p className="font-medium">Registration failed</p>
              <p className="text-xs">{createMutation.error.message}</p>
            </div>
          </div>
        )}

        <Button
          className="w-full rounded-full"
          onClick={handleSubmit}
          disabled={!form.name || !form.description || !form.contact_phone || createMutation.isPending || uploadingLogo || uploadingCover || !!uploadingDocument}
        >
          {createMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
          Submit Registration
        </Button>
      </div>
    </div>
  );
}
