import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import { Link } from 'react-router-dom';
import L from 'leaflet';
import { format } from 'date-fns';
import 'leaflet/dist/leaflet.css';

// Fix leaflet icons
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

const statusColor = { open: '#22c55e', planning: '#3b82f6', full: '#f59e0b', completed: '#6b7280', cancelled: '#ef4444' };

function colorIcon(color) {
  return L.divIcon({
    className: '',
    html: `<div style="width:16px;height:16px;border-radius:50%;background:${color};border:2px solid white;box-shadow:0 1px 4px rgba(0,0,0,0.3)"></div>`,
    iconSize: [16, 16],
    iconAnchor: [8, 8],
  });
}

export default function TripsMapView({ trips, mountains }) {
  const mountainMap = {};
  mountains.forEach(m => { mountainMap[m.name] = m; });

  const tripsWithCoords = trips
    .filter(t => t.status !== 'completed' && t.status !== 'cancelled')
    .map(t => {
      const m = mountainMap[t.mountain_name];
      if (!m?.latitude || !m?.longitude) return null;
      return { ...t, lat: m.latitude, lng: m.longitude };
    })
    .filter(Boolean);

  return (
    <div className="rounded-2xl overflow-hidden border h-[420px]">
      <MapContainer center={[12.8797, 121.774]} zoom={6} className="w-full h-full" scrollWheelZoom={false}>
        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution="© OpenStreetMap" />
        {tripsWithCoords.map(trip => (
          <Marker key={trip.id} position={[trip.lat, trip.lng]} icon={colorIcon(statusColor[trip.status] || '#6b7280')}>
            <Popup>
              <div className="min-w-[160px]">
                <p className="font-semibold text-sm mb-0.5">{trip.title}</p>
                <p className="text-xs text-gray-500">{trip.mountain_name}</p>
                {trip.start_date && <p className="text-xs text-gray-500 mt-1">{format(new Date(trip.start_date), 'MMM d, yyyy')}</p>}
                <p className="text-xs mt-1 capitalize font-medium" style={{ color: statusColor[trip.status] }}>{trip.status}</p>
                <Link to={`/trips/${trip.id}`} className="text-xs text-blue-600 underline block mt-1">View details →</Link>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}
