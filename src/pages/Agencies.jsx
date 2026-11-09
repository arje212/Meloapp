import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Search, MapPin, Star, Store, CheckCircle } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useAgencyPlans } from '@/lib/useAgencyPlans';
import { planRank } from '@/lib/plans';
import PlanBadge from '@/components/agencies/PlanBadge';
import { CardGridSkeleton } from '@/components/Skeletons';

export default function Agencies() {
  const [search, setSearch] = useState('');

  const { data: agencies = [], isLoading } = useQuery({
    queryKey: ['agencies'],
    queryFn: () => base44.entities.Agency.filter({ status: 'approved' }, '-created_date', 1000),
  });
  const { data: plans = {} } = useAgencyPlans();

  const { data: packages = [] } = useQuery({
    queryKey: ['packages'],
    queryFn: () => base44.entities.TourPackage.filter({ status: 'active' }, '-created_date', 1000),
  });
  const packagesByAgency = packages.reduce((grouped, pkg) => {
    const agencyPackages = grouped.get(pkg.agency_id) || [];
    agencyPackages.push(pkg);
    grouped.set(pkg.agency_id, agencyPackages);
    return grouped;
  }, new Map());
  const searchTerm = search.trim().toLowerCase();

  // Paid plans are listed first (Yearly > Pro > Starter > Free), then by rating.
  const filtered = agencies
    .filter(agency => {
      if (!searchTerm) return true;
      const agencyMatches = [agency.name, agency.location]
        .some(value => String(value || '').toLowerCase().includes(searchTerm));
      const packageMatches = (packagesByAgency.get(agency.id) || []).some(pkg =>
        [pkg.title, pkg.mountain_name, pkg.description, pkg.nature_spots]
          .some(value => String(value || '').toLowerCase().includes(searchTerm))
      );
      return agencyMatches || packageMatches;
    })
    .sort((a, b) => planRank(plans[b.id]) - planRank(plans[a.id]) || (Number(b.rating) || 0) - (Number(a.rating) || 0));

  return (
    <div className="max-w-6xl mx-auto px-4 py-6">
      <div className="mb-6">
        <h1 className="font-display text-2xl md:text-3xl font-bold mb-1">Travel Agencies</h1>
        <p className="text-muted-foreground text-sm">Book tours from verified agencies</p>
      </div>

      <div className="relative mb-6">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input placeholder="Search agencies, packages, or destinations..." value={search} onChange={e => setSearch(e.target.value)} className="pl-10 rounded-full" />
      </div>

      {isLoading ? (
        <CardGridSkeleton count={4} />
      ) : filtered.length === 0 ? (
        <div className="text-center py-16">
          <Store className="w-16 h-16 text-muted-foreground/30 mx-auto mb-4" />
          <h3 className="font-semibold mb-1">No agencies found</h3>
          <p className="text-sm text-muted-foreground">Check back later for new agencies</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map(agency => {
            const agencyPackages = packagesByAgency.get(agency.id) || [];
            return (
              <Link key={agency.id} to={`/agencies/${agency.id}`}>
                <div className="bg-card border rounded-2xl overflow-hidden hover:shadow-md transition-all">
                  <div className="h-32 bg-gradient-to-br from-primary/20 to-primary/5 relative">
                    {agency.cover_url && <img src={agency.cover_url} alt="" className="w-full h-full object-cover" />}
                    <div className="absolute -bottom-6 left-4">
                      <div className="w-14 h-14 rounded-xl bg-card border shadow-sm flex items-center justify-center overflow-hidden">
                        {agency.logo_url ? (
                          <img src={agency.logo_url} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <Store className="w-6 h-6 text-primary" />
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="p-4 pt-8">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-base">{agency.name}</h3>
                      {agency.is_verified && <CheckCircle className="w-4 h-4 text-primary fill-primary/20" />}
                      <PlanBadge plan={plans[agency.id]} className="ml-auto" />
                    </div>
                    {agency.location && (
                      <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                        <MapPin className="w-3 h-3" /> {agency.location}
                      </p>
                    )}
                    <div className="flex items-center gap-3 mt-3 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1"><Star className="w-3 h-3 text-yellow-500" /> {agency.rating || 'New'}</span>
                      <span>{agencyPackages.length} packages</span>
                      <span>{agency.total_bookings || 0} bookings</span>
                    </div>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}

      {/* Featured Packages */}
      {packages.filter(p => p.is_featured).length > 0 && (
        <div className="mt-10">
          <h2 className="font-display text-xl font-semibold mb-4">Featured Packages</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {packages.filter(p => p.is_featured).map(pkg => (
              <div key={pkg.id} className="bg-card border rounded-2xl overflow-hidden hover:shadow-md transition-all">
                <Link to={`/agencies/${pkg.agency_id}`}>
                  <div className="aspect-video relative">
                    <img src={pkg.image_url || 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=600'} alt="" className="w-full h-full object-cover" />
                    <Badge className="absolute top-3 right-3 bg-secondary text-secondary-foreground">Featured</Badge>
                  </div>
                </Link>
                <div className="p-4">
                  <Link to={`/agencies/${pkg.agency_id}`}>
                    <h3 className="font-semibold text-sm hover:text-primary transition-colors">{pkg.title}</h3>
                  </Link>
                  <p className="text-xs text-muted-foreground mt-1">{pkg.mountain_name} · {pkg.duration_days} days</p>
                  <div className="flex items-center justify-between mt-3">
                    <div>
                      <p className="text-lg font-bold text-primary">₱{pkg.price?.toLocaleString()}</p>
                      <p className="text-xs text-muted-foreground">by {pkg.agency_name}</p>
                    </div>
                    <Link to={`/agencies/${pkg.agency_id}`}>
                      <Button size="sm" className="rounded-full">Book Now</Button>
                    </Link>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}