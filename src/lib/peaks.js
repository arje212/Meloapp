// Peak coordinates + distance helpers for the Roadmap map and summit-photo check.
// The table below is a FALLBACK for peaks whose coordinates are not in the `mountains` table
// (values are approximate, good enough to place a pin and to check "were you near the peak?").
export const PEAK_COORDS = {
  'mt. apo': [6.9873, 125.2706], 'mt. pulag': [16.5961, 120.899], 'mt. halcon': [13.2744, 121.0036],
  'mt. mayon': [13.2569, 123.6856], 'mt. banahaw': [14.0658, 121.489], 'mt. ugo': [16.2933, 120.8956],
  'mt. guiting-guiting': [12.4097, 122.015], 'mt. ulap': [16.3436, 120.65], 'mt. cristobal': [14.02, 121.37],
  'mt. makiling': [14.136, 121.1965], 'mt. arayat': [15.202, 120.741], 'mt. maculot': [13.906, 121.053],
  'mt. batulao': [14.0847, 120.8003], 'mt. daraitan': [14.65, 121.45], 'mt. pico de loro': [14.2183, 120.6458],
  'mt. talamitam': [14.097, 120.767],
};

// Generous because peak coordinates are approximate and summits are wide.
export const PROOF_MATCH_KM = 5;

/** [lat, lng] for a roadmap destination: its own coords, then the mountains table, then the fallback table. */
export function resolveCoords(dest, mountainCoords = {}) {
  const lat = Number(dest?.lat ?? dest?.latitude);
  const lng = Number(dest?.lng ?? dest?.longitude);
  if (Number.isFinite(lat) && Number.isFinite(lng) && (lat || lng)) return [lat, lng];
  const key = String(dest?.name || '').toLowerCase();
  return mountainCoords[key] || PEAK_COORDS[key] || null;
}

/** Great-circle distance in km between two [lat, lng] pairs. */
export function distanceKm([lat1, lng1], [lat2, lng2]) {
  const rad = (d) => (d * Math.PI) / 180;
  const a = Math.sin(rad(lat2 - lat1) / 2) ** 2 +
    Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(rad(lng2 - lng1) / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/** Roadmaps written by the Roadmap page only have `destinations`; the public profile reads `conquered_mountains`. */
export function withConquered(roadmap) {
  if (roadmap?.conquered_mountains?.length) return roadmap;
  const conquered = (roadmap?.destinations || [])
    .filter((d) => d.status === 'conquered')
    .map((d) => ({ ...d, image_url: d.proof_url || d.image_url }));
  return { ...roadmap, conquered_mountains: conquered };
}

/** Map of lower-cased peak name -> display name for every conquered peak across roadmaps. */
export function conqueredPeakMap(roadmaps = []) {
  const map = new Map();
  roadmaps.map(withConquered).forEach((r) => (r.conquered_mountains || []).forEach((m) => {
    if (m?.name) map.set(String(m.name).toLowerCase(), m.name);
  }));
  return map;
}
