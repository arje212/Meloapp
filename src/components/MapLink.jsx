import { MapPin } from 'lucide-react';

/**
 * Opens the place in Google Maps (app or browser). Uses the official Maps URL, so it needs no API key.
 * Coordinates are used when we have them; otherwise the name is searched.
 */
export function mapsUrl({ name, latitude, longitude }) {
  const hasCoords = Number.isFinite(Number(latitude)) && Number.isFinite(Number(longitude)) && latitude !== null && longitude !== null && latitude !== '';
  const query = hasCoords ? `${latitude},${longitude}` : `${name || ''}, Philippines`;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}

export default function MapLink({ name, latitude, longitude, label = 'Tingnan sa Google Maps', className = '' }) {
  if (!name && (latitude == null || longitude == null)) return null;
  return (
    <a
      href={mapsUrl({ name, latitude, longitude })}
      target="_blank"
      rel="noopener noreferrer"
      className={`inline-flex items-center justify-center gap-2 rounded-full border border-primary/30 bg-primary/5 px-4 py-2 text-sm font-semibold text-primary hover:bg-primary/10 active:bg-primary/15 transition-colors ${className}`}
    >
      <MapPin className="w-4 h-4" />
      {label}
    </a>
  );
}
