import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Link, useNavigate } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ArrowLeft, MapPin, TrendingUp, Clock, Star, CalendarPlus, Loader2, Navigation, CalendarDays, Users, Package } from 'lucide-react';
import TrailMap from '@/components/mountains/TrailMap';

const difficultyColors = {
  beginner: 'bg-green-100 text-green-700',
  intermediate: 'bg-yellow-100 text-yellow-700',
  advanced: 'bg-orange-100 text-orange-700',
  expert: 'bg-red-100 text-red-700',
};

export default function MountainDetail() {
  const navigate = useNavigate();
  const id = window.location.pathname.split('/mountains/')[1];

  const { data: mountain, isLoading } = useQuery({
    queryKey: ['mountain', id],
    queryFn: async () => {
      const list = await base44.entities.Mountain.filter({ id });
      return list[0];
    },
    enabled: !!id,
  });

  const { data: relatedTrips = [] } = useQuery({
    queryKey: ['mountain-trips', mountain?.name],
    queryFn: () => base44.entities.Trip.filter({ mountain_name: mountain.name, status: 'open' }, '-created_date', 5),
    enabled: !!mountain?.name,
  });

  const { data: relatedPackages = [] } = useQuery({
    queryKey: ['mountain-packages', mountain?.name],
    queryFn: () => base44.entities.TourPackage.filter({ mountain_name: mountain.name, status: 'active' }, '-created_date', 5),
    enabled: !!mountain?.name,
  });

  if (isLoading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!mountain) {
    return (
      <div className="text-center py-20">
        <p className="text-muted-foreground">Mountain not found</p>
        <Button variant="link" onClick={() => navigate('/mountains')}>Back to mountains</Button>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      {/* Hero Image */}
      <div className="relative h-64 md:h-96">
        <img
          src={mountain.image_url || 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=1200'}
          alt={mountain.name}
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
        <button
          onClick={() => navigate(-1)}
          className="absolute top-4 left-4 w-10 h-10 rounded-full bg-black/30 backdrop-blur-sm text-white flex items-center justify-center"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="absolute bottom-6 left-6 right-6">
          <Badge className={`mb-2 ${difficultyColors[mountain.difficulty] || ''}`}>
            {mountain.difficulty}
          </Badge>
          <h1 className="font-display text-3xl md:text-4xl font-bold text-white">{mountain.name}</h1>
          <div className="flex items-center gap-3 mt-2 text-white/80 text-sm">
            <span className="flex items-center gap-1"><MapPin className="w-4 h-4" />{mountain.location}</span>
            <span className="flex items-center gap-1"><TrendingUp className="w-4 h-4" />{mountain.elevation?.toLocaleString()}m</span>
            {mountain.estimated_hours && (
              <span className="flex items-center gap-1"><Clock className="w-4 h-4" />{mountain.estimated_hours}h hike</span>
            )}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="px-4 md:px-6 py-6 space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-card border rounded-xl p-4 text-center">
            <TrendingUp className="w-5 h-5 mx-auto text-primary mb-1" />
            <p className="text-lg font-bold">{mountain.elevation?.toLocaleString()}</p>
            <p className="text-xs text-muted-foreground">meters (MASL)</p>
          </div>
          <div className="bg-card border rounded-xl p-4 text-center">
            <Star className="w-5 h-5 mx-auto text-secondary mb-1" />
            <p className="text-lg font-bold">Class {mountain.trail_class || 'N/A'}</p>
            <p className="text-xs text-muted-foreground">Trail Class</p>
          </div>
          <div className="bg-card border rounded-xl p-4 text-center">
            <Clock className="w-5 h-5 mx-auto text-primary mb-1" />
            <p className="text-lg font-bold">{mountain.estimated_hours || 'N/A'}</p>
            <p className="text-xs text-muted-foreground">Hours</p>
          </div>
        </div>

        {/* Description */}
        {mountain.description && (
          <div>
            <h2 className="font-display text-xl font-semibold mb-3">About this Mountain</h2>
            <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">{mountain.description}</p>
          </div>
        )}

        {/* Trail Map */}
        {(mountain.latitude || mountain.trail_waypoints?.length > 0) && (
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-display text-xl font-semibold">Trail Map</h2>
              {mountain.gpx_url && (
                <a href={mountain.gpx_url} download className="flex items-center gap-1 text-xs text-primary hover:underline">
                  <Navigation className="w-3.5 h-3.5" /> Download GPX
                </a>
              )}
            </div>
            {/* Legend */}
            <div className="flex flex-wrap gap-3 mb-3 text-xs">
              {[['#22c55e','Start'],['#ef4444','Summit'],['#f59e0b','Camp'],['#3b82f6','Water'],['#8b5cf6','Waypoint']].map(([color, label]) => (
                <span key={label} className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-full border border-white shadow-sm shrink-0" style={{ background: color }} />
                  {label}
                </span>
              ))}
            </div>
            <TrailMap mountain={mountain} />
          </div>
        )}

        {/* Gallery */}
        {mountain.gallery?.length > 0 && (
          <div>
            <h2 className="font-display text-xl font-semibold mb-3">Gallery</h2>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              {mountain.gallery.map((url, i) => (
                <img key={i} src={url} alt="" className="w-full aspect-square object-cover rounded-xl" />
              ))}
            </div>
          </div>
        )}

        {/* Related Open Trips */}
        {relatedTrips.length > 0 && (
          <div>
            <h2 className="font-display text-xl font-semibold mb-3">Open Trips</h2>
            <div className="space-y-2">
              {relatedTrips.map(trip => (
                <Link key={trip.id} to={`/trips/${trip.id}`} className="block">
                  <div className="bg-card border rounded-xl p-3 hover:shadow-sm transition-all flex items-center justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm truncate">{trip.title}</p>
                      <p className="text-xs text-muted-foreground flex items-center gap-2 mt-0.5">
                        {trip.start_date && <span className="flex items-center gap-1"><CalendarDays className="w-3 h-3" />{trip.start_date}</span>}
                        <span className="flex items-center gap-1"><Users className="w-3 h-3" />{trip.max_participants} slots</span>
                      </p>
                    </div>
                    <Badge variant="outline" className="text-xs capitalize shrink-0">{trip.status}</Badge>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Related Tour Packages */}
        {relatedPackages.length > 0 && (
          <div>
            <h2 className="font-display text-xl font-semibold mb-3">Tour Packages</h2>
            <div className="space-y-2">
              {relatedPackages.map(pkg => (
                <Link key={pkg.id} to={`/agencies/${pkg.agency_id}`} className="block">
                  <div className="bg-card border rounded-xl p-3 hover:shadow-sm transition-all flex items-center gap-3">
                    {pkg.image_url && <img src={pkg.image_url} alt="" className="w-12 h-12 rounded-lg object-cover shrink-0" />}
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm truncate">{pkg.title}</p>
                      <p className="text-xs text-muted-foreground">{pkg.agency_name}</p>
                    </div>
                    <p className="text-primary font-bold text-sm shrink-0">₱{pkg.price?.toLocaleString()}</p>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3">
          <Button className="flex-1 rounded-full" onClick={() => navigate(`/trips/new?mountain=${mountain.id}&name=${encodeURIComponent(mountain.name)}`)}>
            <CalendarPlus className="w-4 h-4 mr-2" />
            Plan a Trip
          </Button>
          <Link to="/agencies" className="flex-1">
            <Button variant="outline" className="w-full rounded-full">
              <Package className="w-4 h-4 mr-2" />
              Browse Packages
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
