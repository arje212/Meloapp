import { describe, it, expect } from 'vitest';
import { distanceKm, resolveCoords, PEAK_COORDS, PROOF_MATCH_KM } from './peaks';

describe('peak coordinates and summit distance', () => {
  it('measures distance between two points (Pulag to Baguio is roughly 45-60 km)', () => {
    const d = distanceKm(PEAK_COORDS['mt. pulag'], [16.4023, 120.596]);
    expect(d).toBeGreaterThan(30);
    expect(d).toBeLessThan(60);
  });
  it('is ~0 at the same spot and counts as a match', () => {
    expect(distanceKm([14.1, 121.2], [14.1, 121.2])).toBeCloseTo(0, 5);
    expect(distanceKm(PEAK_COORDS['mt. batulao'], [14.09, 120.81])).toBeLessThan(PROOF_MATCH_KM);
  });
  it('prefers the peak own coords, then the mountains table, then the fallback table', () => {
    expect(resolveCoords({ name: 'Mt. X', lat: 10, lng: 120 })).toEqual([10, 120]);
    expect(resolveCoords({ name: 'Mt. X' }, { 'mt. x': [11, 121] })).toEqual([11, 121]);
    expect(resolveCoords({ name: 'Mt. Apo' })).toEqual(PEAK_COORDS['mt. apo']);
    expect(resolveCoords({ name: 'Unknown peak' })).toBeNull();
  });
});
