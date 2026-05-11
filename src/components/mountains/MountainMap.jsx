import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import { Link } from 'react-router-dom';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

// Fix leaflet default markers
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

export default function MountainMap({ mountains }) {
  const validMountains = mountains.filter(m => m.latitude && m.longitude);
  const center = validMountains.length > 0
    ? [validMountains[0].latitude, validMountains[0].longitude]
    : [12.8797, 121.7740]; // Philippines center

  return (
    <div className="rounded-2xl overflow-hidden border h-[500px]">
      <MapContainer center={center} zoom={6} className="w-full h-full" scrollWheelZoom>
        <TileLayer
          attribution='&copy; <a href="https://osm.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {validMountains.map(m => (
          <Marker key={m.id} position={[m.latitude, m.longitude]}>
            <Popup>
              <div className="text-center">
                <strong>{m.name}</strong>
                <br />
                <span className="text-xs">{m.location} · {m.elevation}m</span>
                <br />
                <Link to={`/mountains/${m.id}`} className="text-xs text-blue-600 underline">View Details</Link>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}