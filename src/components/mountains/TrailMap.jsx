import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import { useEffect } from 'react';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

// Fix Leaflet default marker icons
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

const waypointColors = {
  start: '#22c55e',
  summit: '#ef4444',
  camp: '#f59e0b',
  water: '#3b82f6',
  waypoint: '#8b5cf6',
};

const createColoredIcon = (color) => L.divIcon({
  className: '',
  html: `<div style="width:14px;height:14px;border-radius:50%;background:${color};border:2px solid white;box-shadow:0 1px 4px rgba(0,0,0,0.4)"></div>`,
  iconSize: [14, 14],
  iconAnchor: [7, 7],
});

const difficultyColors = {
  beginner: '#22c55e',
  intermediate: '#f59e0b',
  advanced: '#ef4444',
  expert: '#7c3aed',
};

function FitBounds({ waypoints, center }) {
  const map = useMap();
  useEffect(() => {
    if (waypoints?.length > 1) {
      const bounds = L.latLngBounds(waypoints.map(w => [w.lat, w.lng]));
      map.fitBounds(bounds, { padding: [30, 30] });
    } else if (center) {
      map.setView(center, 13);
    }
  }, [waypoints, center, map]);
  return null;
}

export default function TrailMap({ mountain }) {
  const center = mountain.latitude && mountain.longitude
    ? [mountain.latitude, mountain.longitude]
    : [14.5995, 120.9842]; // default Manila

  const waypoints = mountain.trail_waypoints || [];
  const trailLine = waypoints.length > 1 ? waypoints.map(w => [w.lat, w.lng]) : null;
  const diffColor = difficultyColors[mountain.difficulty] || '#6b7280';

  return (
    <div className="rounded-2xl overflow-hidden border shadow-sm" style={{ height: 340 }}>
      <MapContainer center={center} zoom={13} style={{ height: '100%', width: '100%' }} scrollWheelZoom={false}>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <FitBounds waypoints={waypoints.length > 1 ? waypoints : null} center={center} />

        {/* Trail polyline */}
        {trailLine && (
          <Polyline positions={trailLine} pathOptions={{ color: diffColor, weight: 4, opacity: 0.85 }} />
        )}

        {/* Waypoint markers */}
        {waypoints.map((wp, i) => (
          <Marker
            key={i}
            position={[wp.lat, wp.lng]}
            icon={createColoredIcon(waypointColors[wp.type] || waypointColors.waypoint)}
          >
            <Popup>
              <div className="text-xs font-semibold">{wp.label || wp.type}</div>
            </Popup>
          </Marker>
        ))}

        {/* Main mountain marker if no waypoints */}
        {waypoints.length === 0 && mountain.latitude && mountain.longitude && (
          <Marker position={center}>
            <Popup>
              <div className="font-semibold">{mountain.name}</div>
              <div className="text-xs text-gray-500">{mountain.elevation}m · {mountain.difficulty}</div>
            </Popup>
          </Marker>
        )}
      </MapContainer>
    </div>
  );
}