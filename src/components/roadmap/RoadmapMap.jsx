import { useEffect, useMemo } from 'react';
import { MapContainer, TileLayer, CircleMarker, Polyline, Popup, useMap } from 'react-leaflet';
import { BadgeCheck } from 'lucide-react';
import 'leaflet/dist/leaflet.css';

const COLOR = { conquered: '#1D9E75', current: '#BA7517', planned: '#185FA5' };

function FitBounds({ points }) {
  const map = useMap();
  const key = points.map((p) => p.join(',')).join('|');
  useEffect(() => {
    if (points.length === 1) map.setView(points[0], 10);
    else if (points.length > 1) map.fitBounds(points, { padding: [32, 32], maxZoom: 11 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, map]);
  return null;
}

/** Real map of the user's peaks. Summits with a photo get a white ring and show the photo in the popup. */
export default function RoadmapMap({ nodes, coordsFor, onSelect }) {
  const pins = useMemo(
    () => nodes.map((n) => ({ n, c: coordsFor(n) })).filter((p) => p.c),
    [nodes, coordsFor]
  );
  if (pins.length === 0) {
    return <p className="px-4 pb-4 text-xs text-muted-foreground">No map location yet for these peaks. Pick a peak from the list when adding one so it can be pinned.</p>;
  }
  const all = pins.map((p) => p.c);
  const done = pins.filter((p) => p.n._status === 'conquered').map((p) => p.c);
  return (
    <div className="h-72 w-full">
      <MapContainer center={all[0]} zoom={7} className="w-full h-full" scrollWheelZoom={false}>
        <TileLayer attribution='&copy; <a href="https://osm.org/copyright">OpenStreetMap</a>' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
        <FitBounds points={all} />
        {all.length > 1 && <Polyline positions={all} pathOptions={{ color: '#64748b', weight: 2, dashArray: '4 8' }} />}
        {done.length > 1 && <Polyline positions={done} pathOptions={{ color: COLOR.conquered, weight: 3 }} />}
        {pins.map(({ n, c }) => (
          <CircleMarker key={n.name} center={c} radius={n._status === 'current' ? 11 : 9}
            pathOptions={{ color: n.proof_url ? '#fff' : COLOR[n._status], weight: n.proof_url ? 3 : 2, fillColor: COLOR[n._status], fillOpacity: 0.95 }}>
            <Popup>
              <div className="w-40">
                <p className="font-semibold text-sm leading-tight">{n.name}</p>
                <p className="text-xs text-gray-500 mb-1">{[n._province, n._elev].filter(Boolean).join(', ')}</p>
                {n.proof_url && <img src={n.proof_url} alt={`Summit photo at ${n.name}`} className="w-full h-24 object-cover rounded-md mb-1" />}
                {n._status === 'conquered' && (
                  <p className="text-xs flex items-center gap-1" style={{ color: n.proof_url ? '#047857' : '#b45309' }}>
                    {n.proof_url ? <><BadgeCheck className="w-3 h-3" /> Photo verified</> : 'No summit photo yet'}
                  </p>
                )}
                <button type="button" className="text-xs text-blue-600 underline mt-1" onClick={() => onSelect?.(n)}>Open details</button>
              </div>
            </Popup>
          </CircleMarker>
        ))}
      </MapContainer>
    </div>
  );
}
