import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { CheckCircle2, ChevronLeft, ChevronRight, Clock, MapPin, Megaphone, Mountain, Package, Users, X } from 'lucide-react';

const asList = value => Array.isArray(value)
  ? value.filter(Boolean)
  : String(value || '').split(/\r?\n|,/).map(item => item.trim()).filter(Boolean);

const uniqueImages = (pkg, agency) => [...new Set([
  pkg.image_url,
  agency.cover_url,
  ...asList(agency.gallery_photos),
  ...asList(pkg.package_photos),
].filter(Boolean))].slice(0, 10);

const formatDate = value => {
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' });
};

const PACKAGE_DETAILS_MARKER = '\n\n[[MELOTRIP_PACKAGE_DETAILS:';

export default function SharePackageDialog({ pkg, agency, user, onClose }) {
  const queryClient = useQueryClient();
  const images = uniqueImages(pkg, agency);
  const includes = asList(pkg.includes);
  const itinerary = asList(pkg.nature_spots);
  const pickups = asList(pkg.pickup_locations);
  const dropoffs = asList(pkg.dropoff_locations);
  const otherPickups = asList(pkg.other_pickup_locations);
  const dates = asList(pkg.available_dates).sort().slice(0, 4);
  const openFor = asList(pkg.open_for);
  const [caption, setCaption] = useState(`Now open for booking: ${pkg.title} at ${pkg.mountain_name}!`);
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  const [imageIndex, setImageIndex] = useState(0);

  const handlePost = async () => {
    if (!caption.trim() || posting) return;
    setPosting(true);
    setError('');
    try {
      const packageDetails = {
        title: pkg.title,
        mountain_name: pkg.mountain_name,
        description: pkg.description,
        price: pkg.price,
        duration_days: pkg.duration_days,
        max_pax: pkg.max_pax,
        includes,
        nature_spots: itinerary,
        pickup_locations: pickups,
        dropoff_locations: dropoffs,
        other_pickup_locations: otherPickups,
        open_for: openFor,
        available_dates: dates,
        promo_text: pkg.promo_text,
      };
      await base44.entities.Post.create({
        author_id: user.id,
        author_email: user.email,
        author_name: user.full_name || agency.name,
        content: `${caption.trim()}${PACKAGE_DETAILS_MARKER}${JSON.stringify(packageDetails)}]]`,
        image_url: images[0] || null,
        media_type: images.length ? 'image' : null,
        post_images: images,
        post_type: images.length > 1 ? 'carousel' : images.length ? 'photo' : 'tour_package',
        mountain_name: pkg.mountain_name || null,
        status: 'active',
        audience: 'public',
        package_id: pkg.id,
        package_title: pkg.title,
        package_details: packageDetails,
        package_price: pkg.price,
        agency_id: agency.id,
        agency_name: agency.name,
      });
      await queryClient.invalidateQueries({ queryKey: ['posts'] });
      setDone(true);
    } catch (postError) {
      console.error('Share package post failed:', postError);
      setError('Hindi na-share ang package. Pakisubukan ulit.');
    } finally {
      setPosting(false);
    }
  };

  return (
    <Dialog open onOpenChange={open => { if (!open && !posting) onClose(); }}>
      <DialogContent className="max-w-lg max-h-[92vh] overflow-y-auto rounded-2xl p-0">
        <DialogHeader className="px-5 pt-5">
          <DialogTitle className="flex items-center gap-2">
            <Megaphone className="w-4 h-4 text-primary" />
            Share tour package to Feed
          </DialogTitle>
        </DialogHeader>
        {done ? (
          <div className="px-5 pb-5 pt-2 text-center space-y-3">
            <CheckCircle2 className="w-12 h-12 text-primary mx-auto" />
            <div><p className="font-semibold">Na-share na sa Feed!</p><p className="text-sm text-muted-foreground">Makikita na ng users ang package details at booking information.</p></div>
            <Button className="w-full rounded-full" onClick={onClose}>Done</Button>
          </div>
        ) : (
          <div className="space-y-4 px-5 pb-5">
            <div className="overflow-hidden rounded-xl border bg-card">
              <div className="relative aspect-[16/9] bg-muted">
                {images.length > 0 ? (
                  <img src={images[imageIndex]} alt={`${pkg.title} destination`} className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full flex-col items-center justify-center gap-2 text-muted-foreground"><Mountain className="h-8 w-8" /><span className="text-xs">Add destination photos to your package</span></div>
                )}
                {images.length > 1 && <>
                  <button type="button" aria-label="Previous photo" onClick={() => setImageIndex(i => (i - 1 + images.length) % images.length)} className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-black/60 p-2 text-white"><ChevronLeft className="h-5 w-5" /></button>
                  <button type="button" aria-label="Next photo" onClick={() => setImageIndex(i => (i + 1) % images.length)} className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-black/60 p-2 text-white"><ChevronRight className="h-5 w-5" /></button>
                  <span className="absolute bottom-2 right-2 rounded-full bg-black/60 px-2 py-1 text-[10px] font-medium text-white">{imageIndex + 1} / {images.length}</span>
                </>}
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 to-transparent p-4 pt-12 text-white">
                  <p className="text-lg font-bold leading-tight">{pkg.title}</p>
                  <p className="mt-1 flex items-center gap-1 text-xs"><MapPin className="h-3.5 w-3.5" />{pkg.mountain_name}</p>
                </div>
              </div>
              <div className="space-y-3 p-4">
                <p className="text-[11px] leading-relaxed text-muted-foreground">Kasama sa post ang destination photos at mga larawan mula sa agency gallery, gaya ng group photos.</p>
                <div className="grid grid-cols-2 gap-2">
                  <div className="rounded-lg bg-primary/5 p-2.5"><p className="text-[10px] text-muted-foreground">Price per person</p><p className="font-bold text-primary">₱{Number(pkg.price || 0).toLocaleString()}</p></div>
                  <div className="rounded-lg bg-muted/60 p-2.5"><p className="text-[10px] text-muted-foreground">Trip duration</p><p className="flex items-center gap-1 text-sm font-semibold"><Clock className="h-3.5 w-3.5" />{pkg.duration_days || 1} day{Number(pkg.duration_days || 1) === 1 ? '' : 's'}</p></div>
                </div>
                {pkg.description && <p className="text-xs leading-relaxed text-muted-foreground">{pkg.description}</p>}
                {pkg.promo_text && <p className="rounded-lg bg-orange-50 px-3 py-2 text-xs font-semibold text-orange-700">{pkg.promo_text}</p>}
                <div className="grid gap-3 sm:grid-cols-2">
                  {includes.length > 0 && <div><p className="mb-1 text-xs font-semibold">Included</p><p className="text-xs leading-relaxed text-muted-foreground">{includes.slice(0, 6).join(' · ')}</p></div>}
                  {itinerary.length > 0 && <div><p className="mb-1 text-xs font-semibold">Places to visit</p><p className="text-xs leading-relaxed text-muted-foreground">{itinerary.slice(0, 5).join(' · ')}</p></div>}
                  {pickups.length > 0 && <div><p className="mb-1 flex items-center gap-1 text-xs font-semibold"><MapPin className="h-3 w-3" />Pickup points</p><p className="text-xs leading-relaxed text-muted-foreground">{pickups.slice(0, 4).join(' · ')}</p></div>}
                  {dropoffs.length > 0 && <div><p className="mb-1 flex items-center gap-1 text-xs font-semibold"><MapPin className="h-3 w-3" />Drop-off points</p><p className="text-xs leading-relaxed text-muted-foreground">{dropoffs.slice(0, 4).join(' · ')}</p></div>}
                  {otherPickups.length > 0 && <div><p className="mb-1 flex items-center gap-1 text-xs font-semibold"><MapPin className="h-3 w-3" />Other pickup options</p><p className="text-xs leading-relaxed text-muted-foreground">{otherPickups.slice(0, 4).join(' · ')}</p></div>}
                  {openFor.length > 0 && <div><p className="mb-1 text-xs font-semibold">Good for</p><p className="text-xs leading-relaxed text-muted-foreground">{openFor.slice(0, 5).join(' · ')}</p></div>}
                </div>
                <div className="flex flex-wrap gap-2 text-[11px] text-muted-foreground">
                  {dates.length > 0 && <span className="rounded-full bg-muted px-2.5 py-1">Dates: {dates.map(formatDate).join(', ')}</span>}
                  {pkg.max_pax && <span className="flex items-center gap-1 rounded-full bg-muted px-2.5 py-1"><Users className="h-3 w-3" />Max {pkg.max_pax} pax</span>}
                  {pkg.allow_custom_dates !== false && <span className="rounded-full bg-muted px-2.5 py-1">Custom date available</span>}
                </div>
              </div>
            </div>

            {images.length > 1 && <div className="space-y-1.5">
              <p className="text-xs font-medium text-muted-foreground">Destination at agency/group photos · {images.length} photos</p>
              <div className="flex gap-2 overflow-x-auto">{images.map((image, index) => (
              <button key={image} type="button" onClick={() => setImageIndex(index)} aria-label={`Show photo ${index + 1}`} className={`h-14 w-16 shrink-0 overflow-hidden rounded-lg border-2 ${imageIndex === index ? 'border-primary' : 'border-transparent'}`}>
                <img src={image} alt="" className="h-full w-full object-cover" />
              </button>
              ))}</div>
            </div>}

            <div>
              <label htmlFor="package-share-caption" className="mb-1 block text-sm font-medium">Caption</label>
              <Textarea id="package-share-caption" value={caption} onChange={event => setCaption(event.target.value)} rows={3} className="resize-none text-sm" placeholder="Ipakilala ang tour package sa users..." />
              <p className="mt-1 text-[11px] text-muted-foreground">Lalabas din sa post ang package photos, inclusions, itinerary, presyo at pickup details.</p>
            </div>
            {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1 rounded-full" onClick={onClose} disabled={posting}><X className="mr-1 h-4 w-4" />Cancel</Button>
              <Button className="flex-1 rounded-full" onClick={handlePost} disabled={!caption.trim() || posting}>
                {posting ? <Package className="mr-2 h-4 w-4 animate-pulse" /> : <Megaphone className="mr-2 h-4 w-4" />}
                {posting ? 'Sharing...' : 'Share to Feed'}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
