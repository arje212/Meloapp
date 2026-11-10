import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { startDirectChat } from '@/lib/chatHelpers';
import { syncLikesCount } from '@/lib/postCounts';
import { withConquered } from '@/lib/peaks';
import ComparePeaksDialog from '@/components/profile/ComparePeaksDialog';
import { notifyUser } from '@/lib/notify';
import { useAuth } from '@/lib/AuthContext';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  MapPin, Trophy, Map, Globe, Clock, Target,
  CheckCircle2, Loader2, MessageCircle, ChevronDown, ChevronUp,
  Flame, TrendingUp, Mountain, Users, Star,
} from 'lucide-react';
import { calcLevel } from '@/lib/achievements';
import { useUserAchievements, useUserGamification } from '@/lib/useGamification';
import FollowButton from '@/components/social/FollowButton';
import { useState, useEffect, useMemo } from 'react';
import CommentsSheet from '@/components/feed/CommentsSheet';
import { useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import React from 'react';

// ─── Leaflet ───────────────────────────────────────────────────────────────────
import { MapContainer, TileLayer, Polyline, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

const createEmojiIcon = (emoji, size = 26) =>
  L.divIcon({
    html: `<div style="font-size:${size}px;line-height:1;filter:drop-shadow(0 1px 3px rgba(0,0,0,0.35))">${emoji}</div>`,
    className: '',
    iconAnchor: [size / 2, size / 2],
    popupAnchor: [0, -(size / 2 + 4)],
  });

const DIFFICULTY_COLOR = {
  Easy:      'bg-green-100 text-green-700',
  Moderate:  'bg-yellow-100 text-yellow-700',
  Difficult: 'bg-red-100 text-red-700',
};

const TRAIL_COLORS = { completed: '#1D9E75', ongoing: '#BA7517', planned: '#185FA5' };

// ─── PH Mountains ─────────────────────────────────────────────────────────────
const PH_MOUNTAINS = [
  { name: 'Mt. Apo', province: 'Davao del Sur', difficulty: 'Difficult', elevation: 2954,
    center: [6.9888, 125.2704],
    trail: [[6.9514,125.2421],[6.958,125.248],[6.965,125.254],[6.973,125.261],[6.9888,125.2704]],
    pois: [
      { pos:[6.9514,125.2421], emoji:'🚩', label:'Kidapawan trailhead', desc:'Register here before ascending.' },
      { pos:[6.958,125.248],   emoji:'💧', label:'Mainit hot spring',   desc:'Natural hot spring along the trail.' },
      { pos:[6.965,125.254],   emoji:'⛺', label:'Lake Venado camp',    desc:'Beautiful lake campsite at 2,800m.' },
      { pos:[6.9888,125.2704], emoji:'🏔️', label:'Summit (2,954m)',    desc:'Highest peak in the Philippines!' },
    ]},
  { name: 'Mt. Pulag', province: 'Benguet', difficulty: 'Moderate', elevation: 2922,
    center: [16.5858, 120.8897],
    trail: [[16.561,120.871],[16.565,120.876],[16.571,120.882],[16.578,120.887],[16.5858,120.8897]],
    pois: [
      { pos:[16.561,120.871],   emoji:'🚩', label:'Ambangeg trailhead', desc:'Main jump-off point. Ranger station here.' },
      { pos:[16.571,120.882],   emoji:'💧', label:'Water source',       desc:'Fresh spring. Safe to drink when filtered.' },
      { pos:[16.578,120.887],   emoji:'⛺', label:'Camp 2 campsite',    desc:'Established campsite. Fits ~30 tents.' },
      { pos:[16.5858,120.8897], emoji:'🏔️', label:'Summit (2,922m)',   desc:'Highest in Luzon! Famous cloud sea views.' },
    ]},
  { name: 'Mt. Ulap', province: 'Benguet', difficulty: 'Moderate', elevation: 1846,
    center: [16.5244, 120.7519],
    trail: [[16.508,120.741],[16.513,120.745],[16.518,120.749],[16.521,120.751],[16.5244,120.7519]],
    pois: [
      { pos:[16.508,120.741],   emoji:'🚩', label:'Ampucao trailhead', desc:'Jump-off point. Parking available.' },
      { pos:[16.513,120.745],   emoji:'💧', label:'Stream crossing',   desc:'Seasonal stream. Best during wet season.' },
      { pos:[16.518,120.749],   emoji:'⛺', label:'Grassland camp',    desc:'Open grassland camping with views.' },
      { pos:[16.5244,120.7519], emoji:'🏔️', label:'Summit (1,846m)',  desc:'Stunning views of Itogon valley.' },
    ]},
  { name: 'Mt. Ugo', province: 'Benguet', difficulty: 'Moderate', elevation: 2150,
    center: [16.518, 120.766],
    trail: [[16.495,120.748],[16.503,120.754],[16.510,120.759],[16.516,120.764],[16.518,120.766]],
    pois: [
      { pos:[16.495,120.748], emoji:'🚩', label:'Kayapa trailhead', desc:'Register at the barangay hall.' },
      { pos:[16.503,120.754], emoji:'💧', label:'Spring water',     desc:'Natural spring, safe when filtered.' },
      { pos:[16.518,120.766], emoji:'🏔️', label:'Summit (2,150m)', desc:'Cloud sea views, especially in December.' },
    ]},
  { name: 'Mt. Batulao', province: 'Batangas', difficulty: 'Easy', elevation: 811,
    center: [14.0167, 120.8167],
    trail: [[14.005,120.808],[14.009,120.812],[14.013,120.815],[14.016,120.817],[14.0167,120.8167]],
    pois: [
      { pos:[14.005,120.808],   emoji:'🚩', label:'Trailhead',      desc:'Main entry point. Registration fee.' },
      { pos:[14.0167,120.8167], emoji:'🏔️', label:'Summit (811m)', desc:'Great views of Laguna de Bay.' },
    ]},
  { name: 'Mt. Maculot', province: 'Batangas', difficulty: 'Easy', elevation: 947,
    center: [13.9500, 121.0667],
    trail: [[13.941,121.059],[13.944,121.062],[13.947,121.064],[13.9500,121.0667]],
    pois: [
      { pos:[13.941,121.059],   emoji:'🚩', label:'Trailhead',         desc:'Jump-off at Cuenca, Batangas.' },
      { pos:[13.9500,121.0667], emoji:'🏔️', label:'Rockies / summit', desc:'Famous "Rockies" formation viewpoint.' },
    ]},
  { name: 'Mt. Pico de Loro', province: 'Cavite', difficulty: 'Moderate', elevation: 664,
    center: [14.2100, 120.5800],
    trail: [[14.200,120.571],[14.204,120.575],[14.208,120.578],[14.2100,120.5800]],
    pois: [
      { pos:[14.200,120.571],   emoji:'🚩', label:'Trailhead',      desc:'Entry at Maragondon, Cavite.' },
      { pos:[14.2100,120.5800], emoji:'🏔️', label:'Summit (664m)', desc:'Iconic parrot-beak monolith at the top.' },
    ]},
  { name: 'Mt. Halcon', province: 'Oriental Mindoro', difficulty: 'Difficult', elevation: 2586,
    center: [13.2600, 121.0500],
    trail: [[13.230,121.028],[13.238,121.034],[13.247,121.040],[13.256,121.046],[13.2600,121.0500]],
    pois: [
      { pos:[13.230,121.028],   emoji:'🚩', label:'Baco trailhead',   desc:"One of PH's most challenging climbs." },
      { pos:[13.2600,121.0500], emoji:'🏔️', label:'Summit (2,586m)', desc:'Fourth highest peak in the Philippines.' },
    ]},
  { name: 'Mt. Mayon', province: 'Albay', difficulty: 'Difficult', elevation: 2463,
    center: [13.2575, 123.6851],
    trail: [[13.248,123.677],[13.251,123.680],[13.254,123.682],[13.2575,123.6851]],
    pois: [
      { pos:[13.248,123.677],   emoji:'🚩', label:'Lignon Hill trailhead', desc:'Base camp. Active volcano — check PHIVOLCS.' },
      { pos:[13.2575,123.6851], emoji:'🏔️', label:'Summit (2,463m)',      desc:'Most perfect volcanic cone in the world.' },
    ]},
  { name: 'Mt. Banahaw', province: 'Quezon', difficulty: 'Moderate', elevation: 2158,
    center: [14.0667, 121.4833],
    trail: [[14.054,121.471],[14.058,121.476],[14.062,121.479],[14.0667,121.4833]],
    pois: [
      { pos:[14.054,121.471],   emoji:'🚩', label:'Kinabuhayan trailhead', desc:'Check DENR permit requirements first.' },
      { pos:[14.0667,121.4833], emoji:'🏔️', label:'Summit (2,158m)',      desc:'Sacred mountain, spiritual significance.' },
    ]},
  { name: 'Mt. Daraitan', province: 'Rizal', difficulty: 'Easy', elevation: 740,
    center: [14.7436, 121.3864],
    trail: [[14.733,121.377],[14.737,121.381],[14.741,121.384],[14.7436,121.3864]],
    pois: [
      { pos:[14.733,121.377],   emoji:'🚩', label:'Daraitan village', desc:'Boat crossing across Tinipak River.' },
      { pos:[14.7436,121.3864], emoji:'🏔️', label:'Summit (740m)',   desc:'Views of the Sierra Madre mountain range.' },
    ]},
  { name: 'Mt. Guiting-Guiting', province: 'Romblon', difficulty: 'Difficult', elevation: 2058,
    center: [12.6522, 122.4672],
    trail: [[12.640,122.454],[12.645,122.459],[12.649,122.463],[12.6522,122.4672]],
    pois: [
      { pos:[12.640,122.454],   emoji:'🚩', label:'Sibuyan trailhead', desc:'One of the most technical climbs in PH.' },
      { pos:[12.6522,122.4672], emoji:'🏔️', label:'Summit (2,058m)',  desc:'Razor-sharp summit ridge.' },
    ]},
  { name: 'Mt. Cristobal', province: 'Quezon', difficulty: 'Moderate', elevation: 1470,
    center: [14.0222, 121.5039],
    trail: [[14.012,121.494],[14.016,121.498],[14.019,121.501],[14.0222,121.5039]],
    pois: [
      { pos:[14.012,121.494],   emoji:'🚩', label:'Trailhead',        desc:'Twin peak of Mt. Banahaw.' },
      { pos:[14.0222,121.5039], emoji:'🏔️', label:'Summit (1,470m)', desc:'Mysterious, often cloud-covered.' },
    ]},
  { name: 'Mt. Makiling', province: 'Laguna', difficulty: 'Difficult', elevation: 1090,
    center: [14.1333, 121.2167],
    trail: [[14.124,121.207],[14.128,121.211],[14.131,121.214],[14.1333,121.2167]],
    pois: [
      { pos:[14.124,121.207],   emoji:'🚩', label:'UPLB trailhead',   desc:'Special DENR permit required.' },
      { pos:[14.1333,121.2167], emoji:'🏔️', label:'Summit (1,090m)', desc:'Home of the legendary Maria Makiling.' },
    ]},
  { name: 'Mt. Arayat', province: 'Pampanga', difficulty: 'Moderate', elevation: 1026,
    center: [15.2025, 120.7394],
    trail: [[15.193,120.730],[15.197,120.734],[15.200,120.737],[15.2025,120.7394]],
    pois: [
      { pos:[15.193,120.730],   emoji:'🚩', label:'Arayat trailhead', desc:'National park entry fee required.' },
      { pos:[15.2025,120.7394], emoji:'🏔️', label:'Summit (1,026m)', desc:'Lone sentinel of the Central Luzon plains.' },
    ]},
  { name: 'Mt. Talamitam', province: 'Batangas', difficulty: 'Easy', elevation: 630,
    center: [14.0500, 120.7667],
    trail: [[14.042,120.758],[14.046,120.762],[14.0500,120.7667]],
    pois: [
      { pos:[14.042,120.758],   emoji:'🚩', label:'Trailhead',      desc:'Beginner-friendly trail in Batangas.' },
      { pos:[14.0500,120.7667], emoji:'🏔️', label:'Summit (630m)', desc:'Good views of Taal Lake and volcano.' },
    ]},
];

const MT_MAP = Object.fromEntries(PH_MOUNTAINS.map(m => [m.name, m]));

function normalizeMtName(name = '') {
  return name.replace(/Mt\./gi, 'Mt. ').replace(/\s+/g, ' ').trim();
}
function getMtData(name = '') {
  if (!name) return null;
  return MT_MAP[name] || MT_MAP[normalizeMtName(name)] || null;
}

// ─── FlyTo ────────────────────────────────────────────────────────────────────
function FlyTo({ center, zoom }) {
  const map = useMap();
  useEffect(() => { map.flyTo(center, zoom, { duration: 1.1 }); }, [center, zoom]);
  return null;
}

// ─── Connected Trail Map ───────────────────────────────────────────────────────
function ConnectedTrailMap({ destinations, conqueredMountains }) {
  const [activeMt, setActiveMt] = useState(null);
  const [flyTarget, setFlyTarget] = useState(null);

  const allMountains = useMemo(() => [
    ...destinations.map(d => ({ ...d, source: 'dest' })),
    ...(conqueredMountains || []).map(c => ({ ...c, source: 'conquered' })),
  ].map(m => ({ ...m, gps: getMtData(m.name) })), [destinations, conqueredMountains]);

  const withGps = useMemo(() => allMountains.filter(m => m.gps), [allMountains]);
  const noGps   = useMemo(() => allMountains.filter(m => !m.gps), [allMountains]);

  const conqueredNameSet = useMemo(() => new Set(
    (conqueredMountains || []).map(c => normalizeMtName(c.name))
  ), [conqueredMountains]);

  const defaultCenter = [12.8797, 121.7740];
  const defaultZoom   = 6;

  useEffect(() => {
    if (!activeMt) {
      if (withGps.length > 0) {
        setActiveMt(withGps[0]);
        setFlyTarget({ center: withGps[0].gps.center, zoom: 13 });
      } else {
        setFlyTarget({ center: defaultCenter, zoom: defaultZoom });
      }
    }
  }, [allMountains.length]);

  const connectedTrail = useMemo(() => withGps.map(m => m.gps.center), [withGps]);

  function getMarkerEmoji(m) {
    if (m.source === 'conquered') return '✅';
    if (conqueredNameSet.has(normalizeMtName(m.name))) return '🚩';
    return '🎯';
  }

  function getStatusLabel(m) {
    if (m.source === 'conquered') return '✓ Conquered';
    if (conqueredNameSet.has(normalizeMtName(m.name))) return '🚩 Conquered!';
    return m.status || 'Planned';
  }

  function getPopupStyle(m) {
    if (m.source === 'conquered') return { background: '#EAF3DE', color: '#27500A' };
    if (conqueredNameSet.has(normalizeMtName(m.name))) return { background: '#D4EDDA', color: '#155724' };
    return { background: '#E6F1FB', color: '#0C447C' };
  }

  return (
    <div className="rounded-xl overflow-hidden">
      {allMountains.length > 0 && (
        <div className="flex gap-2 p-3 flex-wrap bg-muted/30 border-b border-border">
          {allMountains.map((m, i) => (
            <button
              key={i}
              onClick={() => { if (m.gps) { setActiveMt(m); setFlyTarget({ center: m.gps.center, zoom: 13 }); } }}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-all border ${
                activeMt?.name === m.name
                  ? 'bg-primary text-primary-foreground border-primary'
                  : m.gps
                    ? 'bg-background text-muted-foreground border-border hover:text-foreground cursor-pointer'
                    : 'bg-muted text-muted-foreground border-border cursor-default opacity-60'
              }`}
            >
              {getMarkerEmoji(m)} {m.name}
              {!m.gps && <span className="ml-1 opacity-50 text-[10px]">(no GPS)</span>}
            </button>
          ))}
        </div>
      )}
      <div style={{ height: 340 }}>
        <MapContainer
          center={withGps.length > 0 ? withGps[0].gps.center : defaultCenter}
          zoom={withGps.length > 0 ? 13 : defaultZoom}
          style={{ height: '100%', width: '100%' }}
          zoomControl
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          {flyTarget && <FlyTo center={flyTarget.center} zoom={flyTarget.zoom} key={flyTarget.center.toString()} />}
          {connectedTrail.length >= 2 && (
            <Polyline positions={connectedTrail} pathOptions={{ color: '#888780', weight: 2, opacity: 0.5, dashArray: '4,6' }} />
          )}
          {withGps.map((m, i) => {
            const isConqueredDest = m.source === 'dest' && conqueredNameSet.has(normalizeMtName(m.name));
            const popupStyle = getPopupStyle(m);
            return (
              <React.Fragment key={i}>
                {m.gps.trail && (
                  <Polyline
                    positions={m.gps.trail}
                    pathOptions={{
                      color: (m.source === 'conquered' || isConqueredDest) ? '#1D9E75' : TRAIL_COLORS[m.status] || '#185FA5',
                      weight: 4, opacity: 0.85, dashArray: '8,4',
                    }}
                  />
                )}
                {m.gps.pois?.map((poi, j) => (
                  <Marker key={j} position={poi.pos} icon={createEmojiIcon(poi.emoji)}>
                    <Popup>
                      <div style={{ minWidth: 160 }}>
                        <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 4 }}>{poi.emoji} {poi.label}</div>
                        <div style={{ fontSize: 12, color: '#555', lineHeight: 1.5 }}>{poi.desc}</div>
                      </div>
                    </Popup>
                  </Marker>
                ))}
                <Marker position={m.gps.center} icon={createEmojiIcon(getMarkerEmoji(m), 28)}>
                  <Popup>
                    <div style={{ minWidth: 160 }}>
                      <div style={{ fontWeight: 700, fontSize: 14 }}>{m.name}</div>
                      <div style={{ fontSize: 12, color: '#555' }}>
                        {m.gps.province} · {m.gps.elevation}m<br />
                        <span style={{ display: 'inline-block', marginTop: 4, padding: '2px 8px', borderRadius: 99, fontSize: 11, fontWeight: 600, ...popupStyle }}>
                          {getStatusLabel(m)}
                        </span>
                      </div>
                    </div>
                  </Popup>
                </Marker>
              </React.Fragment>
            );
          })}
        </MapContainer>
      </div>
      {noGps.length > 0 && (
        <div className="px-4 py-2 bg-muted/30 border-t border-border text-xs text-muted-foreground">
          ⚠️ No GPS data: {noGps.map(m => m.name).join(', ')}
        </div>
      )}
      {activeMt?.gps && (
        <div className="flex items-center gap-3 px-4 py-3 bg-muted/20 border-t border-border text-sm">
          <div className="flex-1">
            <span className="font-medium">{activeMt.name}</span>
            <span className="text-muted-foreground ml-2">{activeMt.gps.province} · {activeMt.gps.elevation}m</span>
          </div>
          <span className={`text-xs font-semibold px-2 py-1 rounded-full ${
            activeMt.source === 'conquered' || conqueredNameSet.has(normalizeMtName(activeMt.name))
              ? 'bg-green-100 text-green-700'
              : DIFFICULTY_COLOR[activeMt.gps?.difficulty] || 'bg-gray-100 text-gray-600'
          }`}>
            {activeMt.source === 'conquered' || conqueredNameSet.has(normalizeMtName(activeMt.name))
              ? '✓ Conquered' : (activeMt.gps?.difficulty || 'Unknown')}
          </span>
        </div>
      )}
    </div>
  );
}

// ─── Status config ─────────────────────────────────────────────────────────────
const statusConfig = {
  planned:   { label: 'Dreaming',   color: 'bg-blue-100 text-blue-700',     icon: Clock,           bannerBg: '#185FA5' },
  ongoing:   { label: 'Exploring',  color: 'bg-yellow-100 text-yellow-700', icon: Target,          bannerBg: '#854F0B' },
  completed: { label: 'Conquered',  color: 'bg-green-100 text-green-700',   icon: CheckCircle2,    bannerBg: '#0F6E56' },
};

function computeRoadmapPoints(rm) {
  return (rm.conquered_mountains?.length || 0) * 50
    + (rm.destinations?.filter(d => d.status === 'completed').length || 0) * 30
    + (rm.status === 'completed' ? 100 : 0);
}

// ─── Summit Stories Row ────────────────────────────────────────────────────────
function SummitStoriesRow({ posts, roadmaps }) {
  const mountainGroups = useMemo(() => {
    const groups = {};
    posts.forEach(p => {
      const mt = p.mountain_name || 'Other';
      if (!groups[mt]) groups[mt] = [];
      groups[mt].push(p);
    });
    return Object.entries(groups).sort((a, b) => b[1].length - a[1].length).slice(0, 8);
  }, [posts]);

  if (mountainGroups.length === 0) return null;

  const conqueredMountains = new Set(
    roadmaps.flatMap(r => r.conquered_mountains || []).map(m => m.name)
  );

  return (
    <div className="mb-4">
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Summit Stories</p>
      <div className="flex gap-3 overflow-x-auto pb-2 -mx-3 px-3">
        {mountainGroups.map(([mtName, mtPosts]) => {
          const isConquered = conqueredMountains.has(mtName);
          const firstImg = mtPosts.find(p => p.image_url)?.image_url;
          return (
            <div
              key={mtName}
              className={`flex-shrink-0 w-20 h-20 rounded-2xl overflow-hidden cursor-pointer transition-transform hover:scale-105 ring-2 relative ${
                isConquered ? 'ring-green-500' : 'ring-amber-500'
              }`}
            >
              {firstImg ? (
                <img src={firstImg} alt={mtName} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white text-xs font-semibold text-center px-2">
                  {mtName.replace('Mt. ', '')}
                </div>
              )}
              <div className="absolute inset-0 bg-black/20 flex items-end justify-center pb-1">
                <span className="text-xs font-bold text-white">{mtPosts.length}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Gallery View ────────────────────────────────────────────────────────────
function GalleryView({ posts, roadmaps }) {
  const [groupBy, setGroupBy] = useState('all');

  const mountainGroups = useMemo(() => {
    const groups = {};
    posts.filter(p => p.image_url).forEach(p => {
      const mt = p.mountain_name || 'Other';
      if (!groups[mt]) groups[mt] = [];
      groups[mt].push(p);
    });
    return groups;
  }, [posts]);

  const conqueredMountains = new Set(
    roadmaps.flatMap(r => r.conquered_mountains || []).map(m => m.name)
  );

  const allImages = posts.filter(p => p.image_url);

  if (allImages.length === 0) {
    return (
      <div className="text-center py-12">
        <Mountain className="w-10 h-10 text-muted-foreground/30 mx-auto mb-2" />
        <p className="text-sm text-muted-foreground">No photos yet</p>
      </div>
    );
  }

  return (
    <div>
      {/* View toggle */}
      <div className="flex items-center gap-2 mb-4">
        <button
          onClick={() => setGroupBy('all')}
          className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all border ${
            groupBy === 'all'
              ? 'bg-primary text-primary-foreground border-primary'
              : 'bg-muted text-muted-foreground border-border hover:text-foreground'
          }`}
        >
          All photos
        </button>
        <button
          onClick={() => setGroupBy('mountain')}
          className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all border ${
            groupBy === 'mountain'
              ? 'bg-primary text-primary-foreground border-primary'
              : 'bg-muted text-muted-foreground border-border hover:text-foreground'
          }`}
        >
          By mountain
        </button>
      </div>

      {/* Content */}
      {groupBy === 'mountain' ? (
        <div className="space-y-4">
          {Object.entries(mountainGroups).map(([mtName, mtPosts]) => {
            const isConquered = conqueredMountains.has(mtName);
            return (
              <div key={mtName} className="bg-card border rounded-2xl overflow-hidden">
                <div className={`px-4 py-3 flex items-center justify-between ${
                  isConquered ? 'bg-green-50 border-b border-green-100' : 'bg-blue-50 border-b border-blue-100'
                }`}>
                  <div className="flex items-center gap-2">
                    <span className="text-lg">{isConquered ? '✅' : '🎯'}</span>
                    <div>
                      <p className="font-semibold text-sm">{mtName}</p>
                      <p className={`text-xs ${isConquered ? 'text-green-700' : 'text-blue-700'}`}>
                        {isConquered ? 'Conquered' : 'Dreaming'}
                      </p>
                    </div>
                  </div>
                  <Badge variant="outline" className="text-xs">{mtPosts.length} photos</Badge>
                </div>
                <div className="grid grid-cols-3 gap-1 p-2">
                  {mtPosts.map(p => (
                    <div key={p.id} className="aspect-square rounded-lg overflow-hidden bg-muted">
                      <img src={p.image_url} alt="" className="w-full h-full object-cover hover:scale-110 transition-transform cursor-pointer" />
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-2">
          {allImages.map(p => (
            <div key={p.id} className="aspect-square rounded-xl overflow-hidden bg-muted">
              <img src={p.image_url} alt="" className="w-full h-full object-cover hover:scale-110 transition-transform cursor-pointer" />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Public Profile Stats ──────────────────────────────────────────────────────
function ProfileRoadmapStats({ roadmaps }) {
  const stats = useMemo(() => {
    const allConquered = roadmaps.flatMap(r => r.conquered_mountains || []);
    return {
      totalConquered: allConquered.length,
      maxElevation: Math.max(0, ...allConquered.map(m => m.elevation || 0)),
      completedRoadmaps: roadmaps.filter(r => r.status === 'completed').length,
      trailPoints: roadmaps.reduce((sum, r) => sum + computeRoadmapPoints(r), 0),
    };
  }, [roadmaps]);

  if (roadmaps.length === 0) return null;

  return (
    <div className="grid grid-cols-4 gap-2 mb-3">
      {[
        { label: 'Peaks',    value: stats.totalConquered, icon: Mountain,   color: 'text-green-600' },
        { label: 'Highest',  value: stats.maxElevation > 0 ? `${stats.maxElevation.toLocaleString()}m` : '—', icon: TrendingUp, color: 'text-amber-600' },
        { label: 'Finished', value: stats.completedRoadmaps, icon: Map,      color: 'text-primary' },
        { label: 'Points',   value: stats.trailPoints,    icon: Flame,      color: 'text-orange-500' },
      ].map(({ label, value, icon: Icon, color }) => (
        <div key={label} className="bg-muted/50 rounded-xl p-2.5 text-center">
          <Icon className={`w-3.5 h-3.5 mx-auto mb-0.5 ${color}`} />
          <p className="text-sm font-semibold">{value}</p>
          <p className="text-[10px] text-muted-foreground">{label}</p>
        </div>
      ))}
    </div>
  );
}

// ─── Public Roadmap Card ───────────────────────────────────────────────────────
function PublicRoadmapCard({ rm }) {
  const [mapOpen, setMapOpen] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const sc = statusConfig[rm.status] || statusConfig.planned;
  const Icon = sc.icon;
  const trailPts = computeRoadmapPoints(rm);
  const completedDests = rm.destinations?.filter(d => d.status === 'completed').length || 0;
  const totalDests = rm.destinations?.length || 0;
  const nextDest = rm.destinations?.find(d => d.status !== 'completed');
  const highestPeak = Math.max(
    0,
    ...(rm.conquered_mountains || []).map(c => c.elevation || 0),
    ...(rm.destinations || []).filter(d => d.status === 'completed').map(d => d.elevation || 0)
  );

  const visibleDests = showAll ? (rm.destinations || []) : (rm.destinations || []).slice(0, 3);

  return (
    <div className="bg-card border rounded-2xl overflow-hidden">
      {rm.cover_image ? (
        <div className="relative h-28 overflow-hidden">
          <img src={rm.cover_image} alt="" className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-black/30" />
        </div>
      ) : (
        <div className="h-28 bg-gradient-to-r" style={{ backgroundImage: `linear-gradient(135deg, ${sc.bannerBg}88, ${sc.bannerBg}44)` }} />
      )}
      <div className="p-4">
        {/* Header */}
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              <h3 className="font-semibold text-sm truncate">{rm.title}</h3>
              <Globe className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
            </div>
            {rm.description && <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{rm.description}</p>}
          </div>
          <Badge className={`${sc.color} border-0 shrink-0 text-xs`}>
            <Icon className="w-3 h-3 mr-1" />{sc.label}
          </Badge>
        </div>

        {/* Progress */}
        <div className="mb-3">
          <div className="flex items-center justify-between text-xs text-muted-foreground mb-1.5">
            <span>{completedDests} of {totalDests} summits</span>
            <span className="font-medium">{rm.progress_percent || 0}%</span>
          </div>
          <div className="w-full bg-muted rounded-full h-1.5">
            <div className="bg-primary h-1.5 rounded-full transition-all" style={{ width: `${rm.progress_percent || 0}%` }} />
          </div>
        </div>

        {/* Quick stats */}
        <div className="flex items-center gap-3 flex-wrap text-xs mb-3">
          {rm.conquered_mountains?.length > 0 && (
            <div className="flex items-center gap-1 text-amber-600 font-semibold">
              <Trophy className="w-3 h-3" /> {rm.conquered_mountains.length} conquered
            </div>
          )}
          {highestPeak > 0 && (
            <div className="flex items-center gap-1 text-muted-foreground">
              <TrendingUp className="w-3 h-3" /> {highestPeak.toLocaleString()}m
            </div>
          )}
          {trailPts > 0 && (
            <div className="flex items-center gap-1 text-orange-500 font-semibold">
              <Flame className="w-3 h-3" /> {trailPts} pts
            </div>
          )}
          {rm.target_year && (
            <div className="flex items-center gap-1 text-muted-foreground">
              <Clock className="w-3 h-3" /> {rm.target_year}
            </div>
          )}
        </div>

        {/* Next destination callout */}
        {nextDest && rm.status !== 'completed' && (
          <div className="flex items-center gap-2 bg-primary/5 border border-primary/15 rounded-xl px-3 py-2 mb-3">
            <Target className="w-3.5 h-3.5 text-primary shrink-0" />
            <span className="text-xs text-muted-foreground">Next: </span>
            <span className="text-xs font-semibold text-primary">{nextDest.name}</span>
            {nextDest.elevation && <span className="text-xs text-muted-foreground">· {nextDest.elevation}m</span>}
          </div>
        )}

        {/* Destinations timeline */}
        {rm.destinations?.length > 0 && (
          <div className="space-y-1 mb-3">
            {visibleDests.map((d, i) => (
              <div key={i} className="flex items-center gap-2.5 px-2 py-1.5 rounded-lg">
                <div className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 text-[10px] font-semibold ${
                  d.status === 'completed' ? 'bg-green-100 text-green-600' : 'bg-muted text-muted-foreground border border-border'
                }`}>
                  {d.status === 'completed' ? '✓' : i + 1}
                </div>
                <span className={`text-xs font-medium flex-1 truncate ${d.status === 'completed' ? 'line-through text-muted-foreground' : ''}`}>
                  {d.name}
                </span>
                {d.difficulty && (
                  <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full shrink-0 ${DIFFICULTY_COLOR[d.difficulty] || ''}`}>
                    {d.difficulty}
                  </span>
                )}
              </div>
            ))}
            {rm.destinations.length > 3 && (
              <button
                onClick={() => setShowAll(v => !v)}
                className="w-full text-center text-xs text-muted-foreground hover:text-foreground py-1"
              >
                {showAll ? 'Show less' : `+ ${rm.destinations.length - 3} more`}
              </button>
            )}
          </div>
        )}

        {/* Trail map toggle */}
        <button
          className="w-full flex items-center justify-center gap-2 py-2 text-xs font-medium text-green-700 bg-green-50 hover:bg-green-100 border border-green-200 rounded-xl transition-colors"
          onClick={() => setMapOpen(o => !o)}
        >
          <MapPin className="w-3.5 h-3.5" />
          {mapOpen ? 'Hide trail map' : 'View trail map'}
          {mapOpen ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
        </button>
      </div>

      {mapOpen && (
        <div className="border-t border-border">
          <ConnectedTrailMap destinations={rm.destinations || []} conqueredMountains={rm.conquered_mountains || []} />
        </div>
      )}
    </div>
  );
}

// ─── Roadmap Story Mode ────────────────────────────────────────────────────────
function RoadmapStoryMode({ rm }) {
  const completedDests = rm.destinations?.filter(d => d.status === 'completed') || [];
  const nextDest = rm.destinations?.find(d => d.status !== 'completed');
  const totalConquered = rm.conquered_mountains?.length || 0;

  return (
    <div className="bg-card border rounded-2xl overflow-hidden">
      <div className="relative h-32 bg-gradient-to-r from-blue-900/40 to-emerald-900/40 flex items-center justify-center">
        <div className="text-center">
          <h3 className="font-semibold text-lg text-white mb-1">{rm.title}</h3>
          <p className="text-xs text-white/80">{rm.status === 'completed' ? 'Completed' : 'In Progress'}</p>
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* Progress timeline */}
        <div className="relative">
          <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-gradient-to-b from-amber-500 to-emerald-500" />
          
          {/* Start marker */}
          <div className="flex gap-3 mb-3 relative z-10">
            <div className="w-9 h-9 rounded-full bg-blue-100 border-2 border-blue-500 flex items-center justify-center shrink-0">
              <span className="text-xs font-bold text-blue-700">Start</span>
            </div>
            <div className="pt-1">
              <p className="text-xs font-semibold">Roadmap began</p>
              <p className="text-xs text-muted-foreground">{rm.created_date || 'Recently'}</p>
            </div>
          </div>

          {/* Conquered peaks */}
          {completedDests.map((d, i) => (
            <div key={i} className="flex gap-3 mb-3 relative z-10">
              <div className="w-9 h-9 rounded-full bg-green-100 border-2 border-green-500 flex items-center justify-center shrink-0 text-sm">
                ✓
              </div>
              <div className="pt-1">
                <p className="text-xs font-semibold text-green-700">{d.name}</p>
                <p className="text-xs text-muted-foreground">{d.elevation}m</p>
              </div>
            </div>
          ))}

          {/* Current/Next marker */}
          {nextDest && (
            <div className="flex gap-3 mb-3 relative z-10">
              <div className="w-9 h-9 rounded-full bg-amber-100 border-2 border-amber-500 flex items-center justify-center shrink-0 text-sm animate-pulse">
                🎯
              </div>
              <div className="pt-1">
                <p className="text-xs font-semibold text-amber-700">Currently targeting</p>
                <p className="text-xs font-medium">{nextDest.name}</p>
                <p className="text-xs text-muted-foreground">{nextDest.elevation}m · {nextDest.difficulty}</p>
              </div>
            </div>
          )}
        </div>

        {/* Stats bar */}
        <div className="grid grid-cols-3 gap-2 pt-3 border-t">
          <div className="text-center">
            <p className="text-sm font-bold text-emerald-600">{totalConquered}</p>
            <p className="text-xs text-muted-foreground">Conquered</p>
          </div>
          <div className="text-center">
            <p className="text-sm font-bold text-amber-600">{completedDests.length}</p>
            <p className="text-xs text-muted-foreground">Milestones</p>
          </div>
          <div className="text-center">
            <p className="text-sm font-bold text-blue-600">{rm.progress_percent || 0}%</p>
            <p className="text-xs text-muted-foreground">Progress</p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Utility Functions ────────────────────────────────────────────────────────
function getClimberIdentity(roadmaps) {
  const totalConquered = roadmaps.flatMap(r => r.conquered_mountains || []).length;
  
  if (totalConquered === 0) return 'Aspiring Explorer';
  if (totalConquered < 5) return `Emerging Climber • ${totalConquered} peaks`;
  if (totalConquered < 12) return `Mountain Explorer • ${totalConquered} peaks`;
  if (totalConquered < 20) return `Trail Veteran • ${totalConquered} peaks`;
  return `Philippine Legend • ${totalConquered} peaks`;
}

function getCurrentGoal(roadmaps) {
  const activeRoadmap = roadmaps.find(r => r.status === 'ongoing');
  if (!activeRoadmap) return null;
  
  const nextDest = activeRoadmap.destinations?.find(d => d.status !== 'completed');
  return nextDest ? { mountain: nextDest.name, roadmapTitle: activeRoadmap.title } : null;
}

function getFeaturedAchievement(achievements) {
  if (!achievements || achievements.length === 0) return null;
  // Sort by XP earned descending to get the most valuable badge
  return [...achievements].sort((a, b) => (b.xp_earned || 0) - (a.xp_earned || 0))[0];
}

function getFeaturedPhoto(posts) {
  if (!posts || posts.length === 0) return null;
  // Prefer posts with images, sorted by likes
  const withImages = posts.filter(p => p.image_url);
  if (withImages.length === 0) return null;
  return withImages.sort((a, b) => (b.likes_count || 0) - (a.likes_count || 0))[0];
}

// ─── Action CTA Row ────────────────────────────────────────────────────────────
function ActionCTARow({ isOwnProfile, onMessage, isMsgLoading, targetEmail, onCompare }) {
  if (isOwnProfile) return null;

  return (
    <div className="grid grid-cols-2 gap-2 mb-4">
      <Button
        onClick={onMessage}
        disabled={isMsgLoading}
        className="rounded-xl h-9 text-xs font-medium bg-primary hover:bg-primary/90"
      >
        {isMsgLoading ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <MessageCircle className="w-3.5 h-3.5 mr-1" />}
        Message
      </Button>
      <Button
        variant="outline"
        className="rounded-xl h-9 text-xs font-medium"
        onClick={onCompare}
      >
        <Mountain className="w-3.5 h-3.5 mr-1" />
        Compare Peaks
      </Button>
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────
export default function PublicProfile() {
  const { id } = useParams();
  const { user: currentUser } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [commentPost, setCommentPost] = useState(null);
  const [isMsgLoading, setIsMsgLoading] = useState(false);
  const [shareStatus, setShareStatus] = useState('');
  const [roadmapMode, setRoadmapMode] = useState('default'); // 'default' or 'story'
  const [compareOpen, setCompareOpen] = useState(false);

  const handleMessage = async () => {
    if (!profile?.email) return;
    setIsMsgLoading(true);
    try {
      const room = await startDirectChat(currentUser, profile);
      navigate(`/chat/${room.id}`);
    } catch (err) {
      console.error('DM error:', err);
    } finally {
      setIsMsgLoading(false);
    }
  };

  const handleShareProfile = async () => {
    const url = typeof window !== 'undefined' ? `${window.location.origin}/profile/${id}` : '';
    try {
      if (navigator?.share) {
        await navigator.share({ title: `${profile.full_name}'s Adventure`, url });
      } else if (navigator?.clipboard) {
        await navigator.clipboard.writeText(url);
      }
      setShareStatus('Profile link copied!');
      setTimeout(() => setShareStatus(''), 1800);
    } catch (err) {
      console.error('Share failed', err);
      setShareStatus('Share failed.');
      setTimeout(() => setShareStatus(''), 1800);
    }
  };

  const handleLikePost = async (post) => {
    if (!currentUser?.id) return;
    try {
      const { data: existing, error: readErr } = await supabase
        .from('post_likes').select('id')
        .eq('post_id', post.id).eq('user_id', currentUser.id).maybeSingle();
      if (readErr) throw readErr;
      let result;
      if (existing) {
        result = await supabase.from('post_likes').delete().eq('post_id', post.id).eq('user_id', currentUser.id);
      } else {
        result = await supabase.from('post_likes').insert({ post_id: post.id, user_id: currentUser.id });
        if (result.error?.code === '23505') result = { error: null };
        if (!result.error) {
          notifyUser({
            toEmail: profile?.email,
            fromEmail: currentUser.email,
            title: 'New like on your post',
            message: `${currentUser.full_name || currentUser.email} liked your post.`,
            type: 'comment',
            link: `/post/${post.id}`,
            icon: '\u2764\uFE0F',
          });
        }
      }
      if (result.error) throw result.error; // supabase-js returns errors instead of throwing them
      await syncLikesCount(post.id);
      queryClient.invalidateQueries({ queryKey: ['public-posts', id] });
    } catch (err) {
      console.error('Like failed:', err);
    }
  };

  const { data: profile, isLoading: loadingProfile } = useQuery({
    queryKey: ['public-profile', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, email, avatar_url, bio, role, xp, level, posts_count, followers_count, following_count')
        .eq('id', id)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  const { data: posts = [] } = useQuery({
    queryKey: ['public-posts', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('posts')
        .select('id, author_id, content, image_url, mountain_name, status, likes_count, comments_count, created_date, profiles(full_name, email, avatar_url)')
        .eq('author_id', id)
        .eq('status', 'active')
        .order('created_date', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!id,
  });

  const { data: roadmaps = [] } = useQuery({
    queryKey: ['public-roadmaps', profile?.email],
    queryFn: async () => {
      const all = await base44.entities.Roadmap.filter({ user_email: profile.email });
      return all.filter(r => r.is_public).map(withConquered);
    },
    enabled: !!profile?.email,
  });

  const { data: achievements = [] } = useQuery({
    queryKey: ['public-achievements', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('achievements')
        .select('id, title, description, icon, xp_earned, badge_color')
        .eq('user_id', id);
      if (error) return [];
      return data || [];
    },
    enabled: !!id,
  });

  const { data: userAchievements = [] } = useUserAchievements(id);
  const { data: publicGam } = useUserGamification(id);

  const profileAchievements = useMemo(() => {
    if (userAchievements.length) {
      return userAchievements.map(item => ({
        id: item.id,
        title: item?.achievement_templates?.title || item.title,
        description: item?.achievement_templates?.description || item.description,
        icon: item?.achievement_templates?.icon || item.icon || '🏔️',
        xp_earned: item?.achievement_templates?.xp_reward || item?.xp_earned || 0,
        badge_color: item?.achievement_templates?.badge_color || item.badge_color,
      }));
    }
    return achievements;
  }, [userAchievements, achievements]);

  // Memoized computed values for performance optimization - BEFORE early returns
  const profileStats = useMemo(() => {
    if (!profile) return { totalConquered: 0, totalXp: 0, maxElevation: 0, level: 1 };
    const totalConquered = roadmaps.flatMap(r => r.conquered_mountains || []).length;
    const totalXp = publicGam?.total_xp ?? profile?.xp ?? profileAchievements.reduce((sum, a) => sum + (a.xp_earned || 0), 0);
    const maxElevation = Math.max(0, ...roadmaps.flatMap(r => r.conquered_mountains || []).map(m => m.elevation || 0));
    const { level } = publicGam?.level ? { level: publicGam.level } : calcLevel(totalXp);
    
    return { totalConquered, totalXp, maxElevation, level };
  }, [roadmaps, profile?.xp, publicGam, profileAchievements, profile]);

  const climberIdentity = useMemo(() => {
    if (!roadmaps.length) return 'Aspiring Explorer';
    return getClimberIdentity(roadmaps);
  }, [roadmaps]);

  const currentGoal = useMemo(() => getCurrentGoal(roadmaps), [roadmaps]);
  const featuredAchievement = useMemo(() => getFeaturedAchievement(profileAchievements), [profileAchievements]);
  const featuredPhoto = useMemo(() => getFeaturedPhoto(posts), [posts]);

  if (loadingProfile) {
    return <div className="flex justify-center py-24"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
  }

  if (!profile) {
    return <div className="text-center py-24"><p className="text-muted-foreground">User not found.</p></div>;
  }

  const initials = profile.full_name?.split(' ').map(n => n[0]).join('').slice(0, 2) || '?';
  const isOwnProfile = currentUser?.id === id;

  return (
    <div className="public-profile-page max-w-2xl mx-auto px-3 sm:px-4 py-4 sm:py-6">

      {/* ── Profile Header Card (Cinematic) ── */}
      <div className="bg-card border rounded-2xl overflow-hidden mb-4">
        {/* Hero banner */}
        <div className="h-24 bg-gradient-to-r from-emerald-900/60 to-emerald-700/40 relative overflow-hidden flex items-center px-4">
          <div className="absolute inset-0 opacity-20 bg-[repeating-linear-gradient(45deg,transparent,transparent_10px,rgba(255,255,255,.1)_10px,rgba(255,255,255,.1)_20px)]" />
          <div className="relative">
            <p className="text-sm font-semibold text-white/90">{climberIdentity}</p>
            {currentGoal && (
              <p className="text-xs text-white/70 mt-1">
                Chasing {currentGoal.mountain}
              </p>
            )}
          </div>
        </div>

        {/* Profile info section */}
        <div className="px-4 pb-4 -mt-8">
          <div className="flex items-end justify-between mb-3">
            <Avatar className="w-16 h-16 ring-4 ring-card shrink-0">
              {profile.avatar_url
                ? <img src={profile.avatar_url} alt="" className="w-full h-full object-cover rounded-full" />
                : <AvatarFallback className="text-lg bg-primary/10 text-primary font-bold">{initials}</AvatarFallback>
              }
            </Avatar>
            {!isOwnProfile && (
              <div className="flex items-center gap-1">
                <FollowButton targetEmail={profile.email} targetName={profile.full_name} />
              </div>
            )}
          </div>

          <h1 className="font-display text-lg font-bold">{profile.full_name}</h1>
          {profile.bio && <p className="text-sm text-muted-foreground mt-1 line-clamp-3">{profile.bio}</p>}

          {/* Highlight badges */}
          <div className="flex items-center gap-2 flex-wrap mt-3 mb-3">
            <Badge className="bg-primary/10 text-primary border-0 text-xs">
              Lv{profileStats.level}
            </Badge>
            {profileStats.totalConquered > 0 && (
              <Badge variant="outline" className="text-xs">
                {profileStats.totalConquered} peaks
              </Badge>
            )}
          </div>

          {/* XP Progress Bar - Animated */}
          <div className="bg-muted/50 rounded-lg p-2.5 mb-3">
            <div className="flex items-center justify-between text-xs text-muted-foreground mb-1.5">
              <span className="font-medium">{profileStats.totalXp} XP</span>
              <span className="text-primary font-semibold">{Math.min(100, (profileStats.totalXp % 1000 / 10)).toFixed(0)}%</span>
            </div>
            <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
              <div 
                className="h-full bg-gradient-to-r from-primary to-primary/60 rounded-full transition-all duration-500" 
                style={{ width: `${Math.min(100, (profileStats.totalXp % 1000 / 10))}%` }} 
              />
            </div>
          </div>

          {/* Social proof stats */}
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="flex items-center gap-2">
              <Users className="w-3.5 h-3.5 text-primary" />
              <span><span className="font-semibold">{profile.followers_count || 0}</span> followers</span>
            </div>
            <div className="flex items-center gap-2">
              <Mountain className="w-3.5 h-3.5 text-emerald-600" />
              <span><span className="font-semibold">{posts.length}</span> stories</span>
            </div>
          </div>

          <div className="mt-4 rounded-3xl border bg-white/80 p-4 shadow-sm">
            <div className="flex items-center justify-between gap-3 mb-3">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Adventure Portfolio</p>
                <p className="text-sm font-semibold text-foreground">Achievements & journey highlights</p>
              </div>
              <Button size="sm" variant="ghost" onClick={handleShareProfile}>
                {shareStatus || 'Share profile'}
              </Button>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {profileAchievements.slice(0, 6).map(a => (
                <div key={a.id} className="rounded-2xl border bg-slate-50 p-3 text-center text-xs">
                  <div className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-2xl bg-amber-100 text-lg">{a.icon}</div>
                  <p className="font-semibold truncate">{a.title}</p>
                  <p className="text-muted-foreground mt-1">+{a.xp_earned} XP</p>
                </div>
              ))}
              {!profileAchievements.length && (
                <div className="col-span-full rounded-2xl border border-dashed border-slate-300 p-5 text-center text-sm text-muted-foreground">
                  No public achievements are displayed on this profile yet.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Action CTAs ── */}
      <ActionCTARow isOwnProfile={isOwnProfile} onMessage={handleMessage} isMsgLoading={isMsgLoading} targetEmail={profile.email}
          onCompare={() => setCompareOpen(true)}
        />

      {/* ── Featured Achievement Spotlight ── */}
      {featuredAchievement && (
        <div className="mb-4 bg-gradient-to-r from-amber-50 to-amber-50/50 border border-amber-200 rounded-2xl p-4">
          <p className="text-xs font-semibold text-amber-700 uppercase tracking-wide mb-2">Featured Achievement</p>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-white border border-amber-200 flex items-center justify-center text-xl">
              {featuredAchievement.icon}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-sm">{featuredAchievement.title}</p>
              <p className="text-xs text-amber-700">{featuredAchievement.description}</p>
            </div>
            <Badge className="bg-amber-100 text-amber-700 border-0 shrink-0">+{featuredAchievement.xp_earned} XP</Badge>
          </div>
        </div>
      )}

      {/* ── Featured Photo ── */}
      {featuredPhoto && (
        <div className="mb-4 rounded-2xl overflow-hidden border">
          <div className="relative">
            <img src={featuredPhoto.image_url} alt="" className="w-full h-40 object-cover" />
            <div className="absolute top-2 right-2 bg-white/90 backdrop-blur-sm rounded-full px-2 py-1 text-xs font-semibold text-amber-700 flex items-center gap-1">
              <Star className="w-3 h-3" /> Featured
            </div>
          </div>
          <div className="bg-card p-3">
            {featuredPhoto.mountain_name && (
              <p className="text-xs font-semibold text-primary uppercase tracking-wide flex items-center gap-1 mb-1">
                <Mountain className="w-3 h-3" /> {featuredPhoto.mountain_name}
              </p>
            )}
            <p className="text-sm line-clamp-2">{featuredPhoto.content}</p>
          </div>
        </div>
      )}

      {/* ── Summit Stories Row ── */}
      <SummitStoriesRow posts={posts} roadmaps={roadmaps} />

      {/* ── Tabs ── */}
      <Tabs defaultValue="posts">
        <TabsList className="w-full grid grid-cols-4 h-auto p-1 mb-3">
          <TabsTrigger value="posts" className="text-xs py-1.5">
            Posts {posts.length > 0 && <span className="ml-1 text-muted-foreground">({posts.length})</span>}
          </TabsTrigger>
          <TabsTrigger value="gallery" className="text-xs py-1.5">
             Gallery
          </TabsTrigger>
          <TabsTrigger value="roadmap" className="text-xs py-1.5">
            <Map className="w-3 h-3 mr-1" />
            Roadmaps {roadmaps.length > 0 && <span className="ml-1 text-muted-foreground">({roadmaps.length})</span>}
          </TabsTrigger>
          <TabsTrigger value="achievements" className="text-xs py-1.5">
            <Trophy className="w-3 h-3 mr-1" />
            Badges {profileAchievements.length > 0 && <span className="ml-1 text-muted-foreground">({profileAchievements.length})</span>}
          </TabsTrigger>
        </TabsList>

        {/* Posts Tab */}
        <TabsContent value="posts" className="mt-0 space-y-3">
          {posts.length === 0 ? (
            <div className="text-center py-12">
              <Mountain className="w-10 h-10 text-muted-foreground/30 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">No stories yet</p>
            </div>
          ) : (
            posts.map((post, idx) => (
              <div key={post.id} className="bg-card border rounded-2xl overflow-hidden hover:shadow-md transition-shadow">
                {post.image_url && (
                  <div className="h-48 overflow-hidden bg-muted">
                    <img src={post.image_url} alt="" className="w-full h-full object-cover hover:scale-105 transition-transform duration-300" />
                  </div>
                )}
                <div className="p-4">
                  {post.mountain_name && (
                    <p className="text-xs font-semibold text-primary uppercase tracking-wide mb-2 flex items-center gap-1">
                      <Mountain className="w-3 h-3" /> {post.mountain_name}
                    </p>
                  )}
                  <p className="text-sm text-foreground mb-2">{post.content}</p>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <button onClick={() => handleLikePost(post)} className="flex items-center gap-1 hover:text-foreground transition-colors">
                      <Star className="w-3 h-3" /> {post.likes_count || 0}
                    </button>
                    <button 
                      onClick={() => setCommentPost(post)}
                      className="flex items-center gap-1 hover:text-foreground transition-colors"
                    >
                      <MessageCircle className="w-3 h-3" /> {post.comments_count || 0}
                    </button>
                    <button
                      onClick={async () => {
                        const url = typeof window !== 'undefined' ? `${window.location.origin}/profile/${id}` : '';
                        if (navigator?.share) {
                          await navigator.share({ title: post.mountain_name || 'Story', text: post.content, url });
                        } else if (navigator?.clipboard) {
                          await navigator.clipboard.writeText(url);
                        }
                      }}
                      className="flex items-center gap-1 hover:text-foreground transition-colors"
                    >
                      <Map className="w-3 h-3" /> Share
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </TabsContent>

        {/* Gallery */}
        <TabsContent value="gallery" className="mt-0">
          <GalleryView posts={posts} roadmaps={roadmaps} />
        </TabsContent>

        {/* Roadmap Tab - with Story Mode Toggle */}
        <TabsContent value="roadmap" className="mt-0">
          {roadmaps.length === 0 ? (
            <div className="text-center py-12">
              <Map className="w-10 h-10 text-muted-foreground/30 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">No journeys yet</p>
            </div>
          ) : (
            <>
              {/* Story Mode Toggle */}
              <div className="flex items-center gap-2 mb-4">
                <button
                  onClick={() => setRoadmapMode('default')}
                  className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all border ${
                    roadmapMode === 'default'
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'bg-muted text-muted-foreground border-border hover:text-foreground'
                  }`}
                >
                  List View
                </button>
                <button
                  onClick={() => setRoadmapMode('story')}
                  className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all border ${
                    roadmapMode === 'story'
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'bg-muted text-muted-foreground border-border hover:text-foreground'
                  }`}
                >
                  Story Mode
                </button>
              </div>

              <ProfileRoadmapStats roadmaps={roadmaps} />
              
              <div className="space-y-3">
                {roadmapMode === 'story'
                  ? roadmaps.map(rm => <RoadmapStoryMode key={rm.id} rm={rm} />)
                  : roadmaps.map(rm => <PublicRoadmapCard key={rm.id} rm={rm} />)
                }
              </div>
            </>
          )}
        </TabsContent>

        {/* Achievements */}
        <TabsContent value="achievements" className="mt-0">
          {profileAchievements.length === 0 ? (
            <div className="text-center py-12">
              <Trophy className="w-10 h-10 text-muted-foreground/30 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">Wala pang achievements</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2 sm:gap-3">
              {profileAchievements.map(a => (
                <div key={a.id} className="bg-card border rounded-2xl p-3 flex flex-col items-center text-center gap-2">
                  <div className="w-12 h-12 rounded-2xl bg-amber-50 border border-amber-100 flex items-center justify-center">
                    <span className="text-2xl">{a.icon}</span>
                  </div>
                  <div>
                    <p className="font-semibold text-sm">{a.title}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{a.description}</p>
                  </div>
                  <Badge variant="outline" className="text-[10px] text-amber-700 border-amber-200 bg-amber-50">
                    +{a.xp_earned} XP
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      <ComparePeaksDialog open={compareOpen} onOpenChange={setCompareOpen} theirName={profile?.full_name} theirRoadmaps={roadmaps} myEmail={currentUser?.email} />
      <CommentsSheet post={commentPost} open={!!commentPost} onOpenChange={() => setCommentPost(null)} />
    </div>
  );
}