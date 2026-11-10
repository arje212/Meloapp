import React, { useState, useMemo, useEffect, useRef, lazy, Suspense } from 'react';
import RoadmapHeader from '@/components/roadmap/RoadmapHeader';
import SummitProofDialog from '@/components/roadmap/SummitProofDialog';
import { resolveCoords, PROOF_MATCH_KM } from '@/lib/peaks';
import { todayStr } from '@/lib/plans';

const RoadmapMap = lazy(() => import('@/components/roadmap/RoadmapMap'));
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import {
  Plus, Mountain, Trophy, Target,
  Trash2, Loader2, Award, CheckCircle2, Circle, BadgeCheck, Camera
} from 'lucide-react';
import { unlockAchievement } from '@/lib/achievements';
import { useUserGamification, useAddXP, useCheckIn, useCheckInStreak } from '@/lib/useGamification';
import AchievementPopup from '@/components/achievements/AchievementPopup';
import confetti from 'canvas-confetti'; // <── Idinagdag para sa engaging effects

// ─── Colors ────────────────────────────────────────────────────────────────────
const C = {
  conquered: { line: '#1D9E75', bg: '#EAF3DE', text: '#3B6D11' },
  current:   { line: '#BA7517', bg: '#FAEEDA', text: '#854F0B' },
  planned:   { line: '#185FA5', bg: '#E6F1FB', text: '#0C447C' },
};

// Gamification Constant
const XP_PER_LEVEL = 1000;

// ─── PH Mountains ──────────────────────────────────────────────────────────────
const PH_MOUNTAINS = [
  { name:'Mt. Apo',             province:'Davao del Sur',    difficulty:'Difficult', elevation:2954 },
  { name:'Mt. Pulag',           province:'Benguet',          difficulty:'Moderate',  elevation:2922 },
  { name:'Mt. Halcon',          province:'Oriental Mindoro', difficulty:'Difficult', elevation:2586 },
  { name:'Mt. Mayon',           province:'Albay',            difficulty:'Difficult', elevation:2463 },
  { name:'Mt. Banahaw',         province:'Quezon',           difficulty:'Moderate',  elevation:2158 },
  { name:'Mt. Ugo',             province:'Benguet',          difficulty:'Moderate',  elevation:2150 },
  { name:'Mt. Guiting-Guiting', province:'Romblon',          difficulty:'Difficult', elevation:2058 },
  { name:'Mt. Ulap',            province:'Benguet',          difficulty:'Moderate',  elevation:1846 },
  { name:'Mt. Cristobal',       province:'Quezon',           difficulty:'Moderate',  elevation:1470 },
  { name:'Mt. Makiling',        province:'Laguna',            difficulty:'Difficult', elevation:1090 },
  { name:'Mt. Arayat',          province:'Pampanga',         difficulty:'Moderate',  elevation:1026 },
  { name:'Mt. Maculot',         province:'Batangas',         difficulty:'Easy',      elevation:947  },
  { name:'Mt. Batulao',         province:'Batangas',         difficulty:'Easy',      elevation:811  },
  { name:'Mt. Daraitan',        province:'Rizal',            difficulty:'Easy',      elevation:740  },
  { name:'Mt. Pico de Loro',    province:'Cavite',           difficulty:'Moderate',  elevation:664  },
  { name:'Mt. Talamitam',       province:'Batangas',         difficulty:'Easy',      elevation:630  },
];
const PH_MAP = Object.fromEntries(PH_MOUNTAINS.map(m => [m.name.toLowerCase(), m]));
function getPH(name = '') { return PH_MAP[name?.toLowerCase()] || null; }

// ─── Achievements ──────────────────────────────────────────────────────────────
const ACHIEVEMENTS = [
  { id:'first_summit',   label:'First Summit',   icon:'🏅', req: s => s.conquered >= 1 },
  { id:'cloud_chaser',   label:'Cloud Chaser',   icon:'🌤️', req: s => s.maxElev >= 2000 },
  { id:'eagle_climber',  label:'Eagle Climber',  icon:'🦅', req: s => s.conquered >= 5 },
  { id:'peak_collector', label:'Peak Collector', icon:'👑', req: s => s.conquered >= 10 },
  { id:'trailblazer',    label:'Trailblazer',    icon:'🔥', req: s => s.completed },
  { id:'luzon_legend',   label:'Luzon Legend',   icon:'⭐', req: s => s.names.includes('Mt. Pulag') },
  { id:'highest_peak',   label:'Top of PH',      icon:'🏆', req: s => s.names.includes('Mt. Apo') },
];

function computePoints(destinations = []) {
  return destinations.filter(d => d.status === 'conquered').length * 50;
}
function computeProgress(destinations = []) {
  if (!destinations.length) return 0;
  return Math.round(destinations.filter(d => d.status === 'conquered').length / destinations.length * 100);
}

// ─── Mountain Search Autocomplete ─────────────────────────────────────────────
function MountainSearch({ value, onChange, placeholder }) {
  const [open, setOpen]   = useState(false);
  const [query, setQuery] = useState(value || '');
  const ref       = useRef(null);
  const selecting = useRef(false);

  const suggestions = query.length >= 1
    ? PH_MOUNTAINS.filter(m =>
        m.name.toLowerCase().includes(query.toLowerCase()) ||
        (m.province && m.province.toLowerCase().includes(query.toLowerCase()))
      ).slice(0, 7)
    : PH_MOUNTAINS.slice(0, 7);

  useEffect(() => { setQuery(value || ''); }, [value]);

  function commit(raw = query) {
    const t = raw.trim();
    if (!t) { onChange({ name: '' }); return; }
    const match = PH_MOUNTAINS.find(m => m.name.toLowerCase() === t.toLowerCase());
    onChange(match || { name: t });
  }

  useEffect(() => {
    const h = e => {
      if (ref.current && !ref.current.contains(e.target)) { commit(); setOpen(false); }
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [query]);

  return (
    <div className="relative" ref={ref}>
      <Input
        placeholder={placeholder || 'Search mountain...'}
        value={query}
        onChange={e => { setQuery(e.target.value); setOpen(true); }}
        onBlur={() => { if (selecting.current) return; commit(); setOpen(false); }}
        onFocus={() => setOpen(true)}
        autoComplete="off"
        className="rounded-xl"
      />
      {open && suggestions.length > 0 && (
        <div className="absolute z-[100] mt-1 w-full bg-background border border-border rounded-xl shadow-xl overflow-hidden max-h-52 overflow-y-auto">
          {suggestions.map((m) => (
            <button key={m.name} type="button"
              className="w-full flex items-center justify-between px-3 py-2.5 text-left hover:bg-muted transition-colors"
              onMouseDown={() => {
                selecting.current = true;
                setQuery(m.name); onChange(m); setOpen(false);
                setTimeout(() => { selecting.current = false; }, 0);
              }}
            >
              <div>
                <p className="text-sm font-medium">{m.name}</p>
                <p className="text-xs text-muted-foreground">{m.province || 'PH'}</p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-xs text-muted-foreground">{m.elevation}m</span>
                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                  m.difficulty === 'Easy'     ? 'bg-green-100 text-green-700' :
                  m.difficulty === 'Moderate' ? 'bg-yellow-100 text-yellow-700' :
                                                'bg-red-100 text-red-700'
                }`}>{m.difficulty}</span>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Add Mountain Modal ────────────────────────────────────────────────────────
function AddMountainModal({ open, onClose, onAdd }) {
  const emptyInput = {
    name: '', province: '', elevation: '', difficulty: 'Moderate',
    date_conquered: '', target_date: '', notes: '', status: 'planned',
  };
  const [input, setInput]     = useState(emptyInput);
  const [alreadyDone, setAlreadyDone] = useState(false);

  useEffect(() => {
    if (open) { setInput(emptyInput); setAlreadyDone(false); }
  }, [open]);

  function toggleDone(val) {
    setAlreadyDone(val);
    setInput(p => ({ ...p, status: val ? 'conquered' : 'planned' }));
  }

  function handleAdd() {
    if (!input.name.trim()) return;
    onAdd({
      name:           input.name.trim(),
      province:       input.province,
      elevation:      input.elevation ? parseInt(input.elevation, 10) : null,
      difficulty:     input.difficulty,
      target_date:    alreadyDone ? '' : input.target_date,
      date_conquered: alreadyDone ? (input.date_conquered || new Date().toISOString().slice(0,10)) : '',
      notes:          input.notes,
      status:         alreadyDone ? 'conquered' : 'planned',
    });
    onClose();
  }

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) onClose(); }}>
      <DialogContent className="max-w-sm rounded-2xl">
        <DialogHeader>
          <DialogTitle className="text-base">Add Mountain to Journey</DialogTitle>
        </DialogHeader>

        <div className="space-y-3 mt-1">
          <div className="flex rounded-xl overflow-hidden border border-border">
            <button
              type="button"
              onClick={() => toggleDone(false)}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-sm font-medium transition-colors ${
                !alreadyDone ? 'bg-primary text-primary-foreground' : 'bg-background text-muted-foreground hover:bg-muted'
              }`}
            >
              <Target className="w-3.5 h-3.5" /> Planning
            </button>
            <button
              type="button"
              onClick={() => toggleDone(true)}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-sm font-medium transition-colors ${
                alreadyDone ? 'bg-emerald-600 text-white' : 'bg-background text-muted-foreground hover:bg-muted'
              }`}
            >
              <Trophy className="w-3.5 h-3.5" /> Conquered
            </button>
          </div>

          <div>
            <Label className="text-xs text-muted-foreground mb-1 block">Mountain name *</Label>
            <MountainSearch
              value={input.name}
              placeholder="Search or type mountain name..."
              onChange={m => setInput(p => ({
                ...p,
                name:       m.name || '',
                province:   m.province   || p.province,
                elevation:  m.elevation  ? String(m.elevation) : p.elevation,
                difficulty: m.difficulty || p.difficulty,
              }))}
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs text-muted-foreground mb-1 block">Province</Label>
              <Input placeholder="e.g. Benguet" value={input.province}
                onChange={e => setInput(p => ({ ...p, province: e.target.value }))}
                className="rounded-xl" />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground mb-1 block">Elevation (m)</Label>
              <Input placeholder="e.g. 2922" type="number" value={input.elevation}
                onChange={e => setInput(p => ({ ...p, elevation: e.target.value }))}
                className="rounded-xl" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs text-muted-foreground mb-1 block">Difficulty</Label>
              <Select value={input.difficulty} onValueChange={v => setInput(p => ({ ...p, difficulty: v }))}>
                <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Easy">Easy</SelectItem>
                  <SelectItem value="Moderate">Moderate</SelectItem>
                  <SelectItem value="Difficult">Difficult</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              {alreadyDone ? (
                <>
                  <Label className="text-xs text-muted-foreground mb-1 block">Date conquered</Label>
                  <Input type="date" value={input.date_conquered}
                    onChange={e => setInput(p => ({ ...p, date_conquered: e.target.value }))}
                    className="rounded-xl" />
                </>
              ) : (
                <>
                  <Label className="text-xs text-muted-foreground mb-1 block">Target date</Label>
                  <Input type="date" value={input.target_date}
                    onChange={e => setInput(p => ({ ...p, target_date: e.target.value }))}
                    className="rounded-xl" />
                </>
              )}
            </div>
          </div>

          <div>
            <Label className="text-xs text-muted-foreground mb-1 block">
              {alreadyDone ? 'Your story / memory (optional)' : 'Notes (optional)'}
            </Label>
            <Textarea
              rows={2}
              className="rounded-xl resize-none"
              placeholder={alreadyDone ? 'Tell the story of your adventure...' : 'Plans, requirements...'}
              value={input.notes}
              onChange={e => setInput(p => ({ ...p, notes: e.target.value }))}
            />
          </div>

          <div className="flex gap-2 pt-1">
            <Button
              className={`flex-1 rounded-full ${alreadyDone ? 'bg-emerald-600 hover:bg-emerald-700' : ''}`}
              onClick={handleAdd}
              disabled={!input.name.trim()}
            >
              {alreadyDone ? <><Trophy className="w-4 h-4 mr-1.5" /> Log Peak</> : <><Plus className="w-4 h-4 mr-1.5" /> Add to Trail</>}
            </Button>
            <Button variant="outline" className="rounded-full" onClick={onClose}>Cancel</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Mountain Detail Modal ─────────────────────────────────────────────────────
function MountainModal({ node, open, onClose, onMarkConquered, onRemove, isOwner }) {
  if (!node) return null;
  const col         = C[node._status] || C.planned;
  const isConquered = node._status === 'conquered';

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) onClose(); }}>
      <DialogContent className="p-0 overflow-hidden max-w-sm rounded-2xl border-0 gap-0">
        <div className="relative h-52 w-full overflow-hidden shrink-0">
          {node.image_url ? (
            <img src={node.image_url} alt={node.name} className="w-full h-full object-cover"
              onError={e => { e.currentTarget.style.display = 'none'; }} />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-[72px]"
              style={{
                background: isConquered
                  ? 'linear-gradient(135deg,#9FE1CB,#0F6E56)'
                  : node._status === 'current' ? 'linear-gradient(135deg,#FAC775,#BA7517)' : 'linear-gradient(135deg,#B5D4F4,#185FA5)',
              }}>⛰️</div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
          <span className="absolute top-3 right-3 text-xs font-medium px-3 py-1 rounded-full"
            style={{ background: col.bg, color: col.text }}>
            {isConquered ? '✓ Conquered' : node._status === 'current' ? '⛰ Next target' : '🎯 Planned'}
          </span>
          <div className="absolute bottom-3 left-4 right-4">
            <p className="text-white font-semibold text-lg drop-shadow">{node.name}</p>
            <p className="text-white/75 text-xs mt-0.5">
              {[node._province, node._elev, node._difficulty].filter(Boolean).join(' · ')}
            </p>
          </div>
        </div>

        <div className="p-4 space-y-3 bg-background max-h-[45vh] overflow-y-auto">
          {node._story ? (
            <p className="text-sm text-foreground leading-relaxed">{node._story}</p>
          ) : (
            <p className="text-sm text-muted-foreground italic">
              {isConquered ? 'You reached this — an awesome achievement!' : node._status === 'current' ? 'This is your next target. You can do it!' : 'One day you will reach this too. ✨'}
            </p>
          )}

          <div className="grid grid-cols-2 gap-2">
            {[
              { label: 'Elevation',  value: node._elev },
              { label: isConquered ? 'Conquered' : 'Target', value: node._date },
              { label: 'Difficulty', value: node._difficulty },
              { label: 'Province',   value: node._province },
            ].filter(r => r.value).map(({ label, value }) => (
              <div key={label} className="bg-muted/50 rounded-xl p-2.5">
                <p className="text-[10px] text-muted-foreground mb-0.5">{label}</p>
                <p className="text-sm font-medium truncate">{value}</p>
              </div>
            ))}
          </div>

          {isConquered && (node.proof_url ? (
            <div className="rounded-xl overflow-hidden border">
              <img src={node.proof_url} alt={`Summit photo at ${node.name}`} className="w-full max-h-56 object-cover" />
              <div className="flex items-center gap-1.5 px-3 py-2 text-xs bg-emerald-50 text-emerald-800">
                <BadgeCheck className="w-3.5 h-3.5 shrink-0" />
                <span>Verified with summit photo{node.proof_gps ? (node.proof_distance_km <= PROOF_MATCH_KM ? `, location matched (${node.proof_distance_km} km from the peak)` : `, ${node.proof_distance_km} km from the peak`) : ''}</span>
              </div>
            </div>
          ) : (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
              No summit photo yet.
              {isOwner && <button type="button" className="underline font-semibold ml-1" onClick={() => { onMarkConquered(node); onClose(); }}>Add photo</button>}
            </div>
          ))}

          {isOwner && (
            <div className="flex gap-2 pt-1">
              {!isConquered && (
                <Button size="sm" className="flex-1 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white"
                  onClick={() => { onMarkConquered(node); onClose(); }}>
                  <Camera className="w-3.5 h-3.5 mr-1" /> Conquer with summit photo
                </Button>
              )}
              <Button size="sm" variant="outline" className="rounded-full text-destructive border-destructive/30 hover:bg-destructive/10"
                onClick={() => { onRemove(node); onClose(); }}>
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Snake Trail SVG ───────────────────────────────────────────────────────────
function SnakeTrail({ nodes, onNodeClick }) {
  const n       = nodes.length;
  const half    = Math.ceil(n / 2);
  const row1    = nodes.slice(0, half);
  const row2    = nodes.slice(half).reverse();

  const W       = 320;
  const NODE_R  = 22;
  const PAD     = 40;
  const ROW1_Y  = 60;
  const ROW2_Y  = 155;
  const H       = row2.length > 0 ? 210 : 115;

  function xOf(idx, count) {
    if (count <= 1) return W / 2;
    const avail = W - PAD * 2;
    return PAD + idx * (avail / (count - 1));
  }

  const pathPts = [];
  row1.forEach((_, i)  => pathPts.push([xOf(i, row1.length), ROW1_Y]));
  if (row2.length > 0) {
    pathPts.push([xOf(row1.length - 1, row1.length), ROW2_Y]);
    row2.forEach((_, i) => {
      const visualIdx = row2.length - 1 - i;
      pathPts.push([xOf(visualIdx, row2.length), ROW2_Y]);
    });
  }

  function smoothPath(pts) {
    if (pts.length < 2) return '';
    let d = `M${pts[0][0]},${pts[0][1]}`;
    for (let i = 1; i < pts.length; i++) {
      const a = pts[i - 1], b = pts[i];
      const mx = (a[0] + b[0]) / 2;
      d += ` C${mx},${a[1]} ${mx},${b[1]} ${b[0]},${b[1]}`;
    }
    return d;
  }

  const conqueredCount = nodes.filter(nd => nd._status === 'conquered').length;
  const greenPts = pathPts.slice(0, conqueredCount <= half ? conqueredCount : half + 1 + (conqueredCount - half));

  function nodeXY(i) {
    if (i < half) return [xOf(i, row1.length), ROW1_Y];
    const r2i = i - half;
    const visualIdx = row2.length - 1 - r2i;
    return [xOf(visualIdx, row2.length), ROW2_Y];
  }

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', display: 'block', overflow: 'visible' }}>
      <defs>
        <style>{`
          @keyframes snakeDash { to { stroke-dashoffset: -22; } }
          @keyframes snakePulse { 0%{opacity:.35;r:14} 100%{opacity:0;r:30} }
          .snode { cursor: pointer; }
          .snode:focus { outline: none; }
          .snode:hover .snodeRing { stroke-width: 3.5; }
        `}</style>
        {nodes.map((nd) => {
          const safeId = nd.name.replace(/\s+/g, '-').toLowerCase();
          const i = nodes.findIndex(n => n.name === nd.name);
          const [cx, cy] = nodeXY(i);
          return (
            <clipPath key={safeId} id={`sc-${safeId}`}>
              <circle cx={cx} cy={cy} r={NODE_R} />
            </clipPath>
          );
        })}
      </defs>

      {pathPts.length > 0 && (
        <text x={pathPts[0][0] - 20} y={ROW1_Y + 6} fontSize="15" textAnchor="middle" style={{ userSelect: 'none' }}>🚀</text>
      )}

      {pathPts.length >= 2 && (
        <path d={smoothPath(pathPts)} fill="none" stroke="#D3D1C7"
          strokeWidth="2" strokeLinecap="round" strokeDasharray="6 4"
          style={{ animation: 'snakeDash 1s linear infinite' }} />
      )}

      {greenPts.length >= 2 && (
        <path d={smoothPath(greenPts)} fill="none" stroke="#1D9E75" strokeWidth="3" strokeLinecap="round" opacity="0.75" />
      )}

      {pathPts.length > 1 && (
        <text x={pathPts[pathPts.length - 1][0] + 18} y={pathPts[pathPts.length - 1][1] + 6} fontSize="15" textAnchor="middle" style={{ userSelect: 'none' }}>🏁</text>
      )}

      {nodes.map((nd, i) => {
        const [cx, cy] = nodeXY(i);
        const col      = C[nd._status] || C.planned;
        const isTop    = cy === ROW1_Y;
        const nameY    = isTop ? cy - NODE_R - 20 : cy + NODE_R + 15;
        const shortName = (nd.name || '').replace(/Mt\.\s*/i, '');
        const safeId = nd.name.replace(/\s+/g, '-').toLowerCase();

        return (
          <g key={safeId} className="snode" onClick={() => onNodeClick(nd)} role="button" tabIndex={0}>
            {nd._status === 'current' && (
              <circle cx={cx} cy={cy} r="14" fill={col.line} opacity="0.18"
                style={{ animation: 'snakePulse 1.8s ease-out infinite', transformOrigin: `${cx}px ${cy}px` }} />
            )}

            <circle cx={cx} cy={cy} r={NODE_R + 4} fill={col.bg} stroke={col.line} strokeWidth="2" className="snodeRing" />

            {nd.image_url
              ? <image x={cx - NODE_R} y={cy - NODE_R} width={NODE_R * 2} height={NODE_R * 2} href={nd.image_url} preserveAspectRatio="xMidYMid slice" clipPath={`url(#sc-${safeId})`} />
              : <text x={cx} y={cy + 8} fontSize="20" textAnchor="middle">⛰️</text>
            }

            {nd._status === 'conquered' && (
              <>
                <circle cx={cx + NODE_R} cy={cy - NODE_R} r="9" fill="#1D9E75" stroke="white" strokeWidth="1.5" />
                <text x={cx + NODE_R} y={cy - NODE_R + 4} fontSize="9" textAnchor="middle" fill="white" fontWeight="bold">✓</text>
              </>
            )}

            <text x={cx} y={nameY} fontSize="10" textAnchor="middle" fontWeight="500" fill="var(--foreground,#111)">
              {shortName.length > 10 ? shortName.slice(0, 9) + '…' : shortName}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

// ─── Main Component ────────────────────────────────────────────────────────────
export default function Roadmap() {
  const { user } = useAuth();
  const addXp    = useAddXP();
  const qc       = useQueryClient();

  const [addOpen,      setAddOpen]      = useState(false);
  const [selectedNode, setSelectedNode] = useState(null);
  const [modalOpen,    setModalOpen]    = useState(false);
  const [proofNode,    setProofNode]    = useState(null);   // peak waiting for its summit photo
  const [newAch,       setNewAch]       = useState(null);
  const [achQueue,     setAchQueue]     = useState([]);
  const checkedOnce = useRef(false);

  // ── Queries ────────────────────────────────────────────────────────────────
  const { data: roadmapList = [], isLoading } = useQuery({
    queryKey: ['roadmap', 'mine', user?.email],
    queryFn:  () => base44.entities.Roadmap.filter({ user_email: user?.email }),
    enabled:  !!user?.email,
  });

  const { data: allMountains = [] } = useQuery({
    queryKey: ['mountains'],
    queryFn:  () => base44.entities.Mountain.list('name', 200),
    staleTime: 5 * 60 * 1000,
  });

  const { data: gam }    = useUserGamification(user?.id);
  const { data: streak } = useCheckInStreak(user?.id);
  const checkIn          = useCheckIn();

  // Coordinates from the mountains table (fallback table lives in lib/peaks.js)
  const mountainCoords = useMemo(() => {
    const map = {};
    allMountains.forEach(m => {
      const lat = Number(m.latitude ?? m.lat), lng = Number(m.longitude ?? m.lng);
      if (Number.isFinite(lat) && Number.isFinite(lng) && (lat || lng)) map[m.name?.toLowerCase()] = [lat, lng];
    });
    return map;
  }, [allMountains]);
  const coordsFor = useMemo(() => (d) => resolveCoords(d, mountainCoords), [mountainCoords]);

  const mountainImgMap = useMemo(() => {
    const map = {};
    allMountains.forEach(m => { map[m.name?.toLowerCase()] = m.image_url || null; });
    return map;
  }, [allMountains]);

  const roadmap = roadmapList[0] || null;

  // ── Mutations with Error Catching for Supabase 406 ──────────────────────────
  const createMutation = useMutation({
    mutationFn: () => base44.entities.Roadmap.create({
      title:        `${user?.full_name || 'Explorer'}'s Journey`,
      user_email:   user?.email,
      user_name:    user?.full_name,
      status:       'ongoing',
      is_public:    true,
      destinations: [],
    }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['roadmap', 'mine', user?.email] }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Roadmap.update(id, data),
    onSuccess:  () => {
      qc.invalidateQueries({ queryKey: ['roadmap', 'mine', user?.email] });
    },
    onError: (err) => {
      console.error("Supabase Error 406/Quota Restriction:", err);
      alert(`⚠️ Supabase quota restriction or table error: the peak could not be saved because your project exceeded the Supabase usage limits.`);
    }
  });

  useEffect(() => {
    if (!isLoading && roadmapList.length === 0 && user?.email && !createMutation.isPending) {
      createMutation.mutate();
    }
  }, [isLoading, roadmapList.length, user?.email]);

  const nodes = useMemo(() => {
    if (!roadmap) return [];
    const dests   = roadmap.destinations || [];
    const nextIdx = dests.findIndex(d => d.status !== 'conquered');

    return dests.map((d, i) => {
      const ph     = getPH(d.name);
      const isConq = d.status === 'conquered';
      const isCurr = i === nextIdx;
      return {
        ...d,
        _status:     isConq ? 'conquered' : isCurr ? 'current' : 'planned',
        _elev:       d.elevation   ? `${Number(d.elevation).toLocaleString()}m`   : ph?.elevation ? `${ph.elevation}m` : null,
        _province:   d.province    || ph?.province   || null,
        _difficulty: d.difficulty  || ph?.difficulty || null,
        _date:       isConq ? (d.date_conquered ? `Conquered ${d.date_conquered}` : 'Conquered ✓') : (d.target_date || null),
        _story:      d.notes || null,
        image_url:   mountainImgMap[d.name?.toLowerCase()] || null,
      };
    });
  }, [roadmap, mountainImgMap]);

  // ── Handlers ───────────────────────────────────────────────────────────────
  function saveDestinations(dests) {
    if (!roadmap) return;
    updateMutation.mutate({
      id:   roadmap.id,
      data: { destinations: dests, progress_percent: computeProgress(dests) },
    });
  }

  function handleAdd(dest) {
    // "Already climbed" peaks are saved as planned and immediately ask for the summit photo.
    const needsProof = dest.status === 'conquered';
    const stored = needsProof ? { ...dest, status: 'planned' } : dest;
    saveDestinations([...(roadmap?.destinations || []), stored]);
    if (needsProof) setProofNode(stored);
  }

  // A peak is conquered only together with a summit photo (see SummitProofDialog).
  function handleMarkConquered(node) { setProofNode(node); }

  function handleConfirmProof(proof) {
    const node = proofNode;
    if (!node) return;
    const wasConquered = node.status === 'conquered' || node._status === 'conquered';
    const base   = roadmap?.destinations || [];
    const patch  = {
      status: 'conquered',
      date_conquered: proof.date_conquered || todayStr(),
      proof_url: proof.proof_url,
      proof_distance_km: proof.proof_distance_km,
      proof_gps: proof.proof_gps,
      proof_at: new Date().toISOString(),
    };
    const raw = Object.fromEntries(Object.entries(node).filter(([k]) => !k.startsWith('_') && k !== 'image_url')); // strip derived fields
    const exists  = base.some(d => d.name === node.name);
    saveDestinations(exists ? base.map(d => (d.name === node.name ? { ...d, ...patch } : d)) : [...base, { ...raw, ...patch }]);
    if (!wasConquered) triggerSummitEffect();
    setProofNode(null);
  }

  function handleToggleConquer(node) {
    if (node.status !== 'conquered') { setProofNode(node); return; }       // conquering needs a photo
    if (!window.confirm(`Remove "${node.name}" from your conquered peaks? Its summit photo will be removed too.`)) return;
    const updated = (roadmap?.destinations || []).map(d =>
      d.name === node.name
        ? { ...d, status: 'planned', date_conquered: '', proof_url: '', proof_distance_km: null, proof_gps: false, proof_at: '' }
        : d
    );
    saveDestinations(updated);
  }

  function handleRemove(node) {
    const updated = (roadmap?.destinations || []).filter(d => d.name !== node.name);
    saveDestinations(updated);
  }

  // Visual Reward Effect (Confetti)
  function triggerSummitEffect() {
    confetti({ particleCount: 120, spread: 80, origin: { y: 0.6 }, colors: ['#1D9E75', '#34d399', '#fbbf24'] });
  }

  async function handleCheckIn() {
    if (!user?.id) return;
    try {
      const res = await checkIn.mutateAsync(user.id);
      if (res?.xpEarned) {
        await addXp.mutateAsync({ userId: user.id, xpAmount: res.xpEarned, reason: 'Daily check-in' });
        confetti({ particleCount: 40, angle: 60, spread: 55, origin: { x: 0 } });
        confetti({ particleCount: 40, angle: 120, spread: 55, origin: { x: 1 } });
      }
    } catch (e) { console.error(e); }
  }

  // Achievement checker (Fixed infinite loop dependency)
  const conqueredCount = (roadmap?.destinations || []).filter(d => d.status === 'conquered').length;
  useEffect(() => {
    if (!user?.email || !roadmap) return;
    if (!checkedOnce.current) { checkedOnce.current = true; return; }
    const dests   = roadmap.destinations || [];
    const names   = dests.filter(d => d.status === 'conquered').map(d => d.name);
    const maxElev = Math.max(0, ...dests.filter(d => d.status === 'conquered').map(d => Number(d.elevation) || 0));
    const stats   = { conquered: names.length, maxElev, completed: dests.length > 0 && dests.every(d => d.status === 'conquered'), names };
    let cancelled = false;
    (async () => {
      const unlocked = [];
      for (const ach of ACHIEVEMENTS) {
        if (!ach.req(stats)) continue;
        const c = await unlockAchievement(user.email, user.full_name, ach.id);
        if (c) unlocked.push(c);
      }
      if (!cancelled && unlocked.length) setAchQueue(q => [...q, ...unlocked]);
    })();
    return () => { cancelled = true; };
  // BUG FIX: previously keyed only on destinations.length, so marking an EXISTING planned mountain as
  // conquered (length unchanged) never re-ran the checker and achievements never unlocked.
  }, [roadmap?.destinations?.length, conqueredCount, user?.email]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!newAch && achQueue.length > 0) { setNewAch(achQueue[0]); setAchQueue(q => q.slice(1)); }
  }, [newAch, achQueue]);

  // Gamification Level Calculation
  const currentLevelXp = (gam?.total_xp || 0) % XP_PER_LEVEL;
  const xpPercentage   = Math.min(Math.round((currentLevelXp / XP_PER_LEVEL) * 100), 100);

  const nextDest  = nodes.find(n => n._status !== 'conquered');
  const progress  = computeProgress(roadmap?.destinations || []);
  const isOwner   = roadmap?.user_email === user?.email;
  const isCheckingIn = checkIn.isPending || addXp.isPending;

  if (isLoading || createMutation.isPending) {
    return (
      <div className="flex justify-center items-center py-24">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto px-4 py-6">
      <AchievementPopup achievement={newAch} onDismiss={() => setNewAch(null)} />

      <RoadmapHeader
        title={roadmap?.title || `${user?.full_name || 'Explorer'}'s Journey`}
        nextDest={nextDest}
        level={gam?.level || 1}
        xpInLevel={currentLevelXp}
        xpPerLevel={XP_PER_LEVEL}
        xpPercent={xpPercentage}
        streak={streak?.streak_count || 0}
        totalXp={gam?.total_xp || 0}
        conquered={nodes.filter(n => n._status === 'conquered').length}
        total={nodes.length}
        maxElev={Math.max(0, ...nodes.filter(n => n._status === 'conquered').map(n => Number(n.elevation) || 0))}
        points={computePoints(roadmap?.destinations || [])}
        progress={progress}
        onCheckIn={handleCheckIn}
        isCheckingIn={isCheckingIn}
      />

      {/* ── Achievements ── */}
      <AchievementsStrip destinations={roadmap?.destinations || []} />

      {/* Real map of your peaks */}
      {nodes.length > 0 && (
        <div className="bg-card border rounded-2xl overflow-hidden mb-3 shadow-sm">
          <div className="px-4 pt-4 pb-2">
            <p className="font-display font-semibold text-base">Peak map</p>
            <p className="text-xs text-muted-foreground">Pins with a white ring have a summit photo. Tap a pin to see it.</p>
          </div>
          <Suspense fallback={<div className="h-72 flex items-center justify-center"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>}>
            <RoadmapMap nodes={nodes} coordsFor={coordsFor} onSelect={nd => { setSelectedNode(nd); setModalOpen(true); }} />
          </Suspense>
        </div>
      )}

      {/* ── Snake Trail Card ── */}
      <div className="bg-card border rounded-2xl p-4 mb-3 shadow-sm">
        <div className="flex items-center justify-between mb-2">
          <div><p className="font-display font-semibold text-base">Trail map</p><p className="text-xs text-muted-foreground">Tap a peak to see details</p></div>
          <button onClick={() => setAddOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-primary mercantile text-primary-foreground text-xs font-semibold rounded-full hover:bg-primary/90 transition-colors">
            <Plus className="w-3.5 h-3.5" /> Add Peak
          </button>
        </div>

        {nodes.length === 0 ? (
          <div className="flex flex-col items-center py-10 text-muted-foreground">
            <Mountain className="w-12 h-12 mb-3 opacity-20" />
            <p className="text-sm font-medium mb-1">Wala pang bundok</p>
            <p className="text-xs mb-4 text-center">Add the mountains you want to climb!</p>
            <button onClick={() => setAddOpen(true)} className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground text-sm font-semibold rounded-full">
              <Plus className="w-4 h-4" /> Add First Peak
            </button>
          </div>
        ) : (
          <>
            <SnakeTrail nodes={nodes} onNodeClick={nd => { setSelectedNode(nd); setModalOpen(true); }} />
            <div className="flex gap-4 flex-wrap mt-2 pt-3 border-t border-border">
              {[
                { c: '#1D9E75', l: 'Conquered' },
                { c: '#BA7517', l: 'Next target' },
                { c: '#185FA5', l: 'Planned' },
              ].map(({ c, l }) => (
                <div key={l} className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                  <div className="w-2 h-2 rounded-full" style={{ background: c }} />{l}
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* ── Peak List ── */}
      {nodes.length > 0 && (
        <div className="bg-card border rounded-2xl overflow-hidden mb-4 shadow-sm">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <p className="font-display font-semibold text-base">All peaks <span className="text-muted-foreground font-normal text-sm">({nodes.length})</span></p>
            <span className="text-xs text-muted-foreground">{nodes.filter(n => n._status === 'conquered').length} conquered</span>
          </div>
          <div className="divide-y divide-border">
            {nodes.map((nd) => (
              <PeakListItem
                key={nd.name.replace(/\s+/g, '-').toLowerCase()}
                node={nd}
                onClick={() => { setSelectedNode(nd); setModalOpen(true); }}
                onToggleConquer={handleToggleConquer}
                onRemove={handleRemove}
                isOwner={isOwner}
              />
            ))}
          </div>
        </div>
      )}

      {/* Modals */}
      <SummitProofDialog node={proofNode} open={!!proofNode} onClose={() => setProofNode(null)} onConfirm={handleConfirmProof} coords={proofNode ? coordsFor(proofNode) : null} />
      <AddMountainModal open={addOpen} onClose={() => setAddOpen(false)} onAdd={handleAdd} />
      <MountainModal node={selectedNode} open={modalOpen} onClose={() => setModalOpen(false)} onMarkConquered={handleMarkConquered} onRemove={handleRemove} isOwner={isOwner} />
    </div>
  );
}

// Sub-components helpers
function AchievementsStrip({ destinations }) {
  const names     = destinations.filter(d => d.status === 'conquered').map(d => d.name);
  const maxElev   = Math.max(0, ...destinations.filter(d => d.status === 'conquered').map(d => Number(d.elevation) || 0));
  const completed = destinations.length > 0 && destinations.every(d => d.status === 'conquered');
  const unlocked  = ACHIEVEMENTS.filter(a => a.req({ conquered: names.length, maxElev, completed, names }));
  if (!unlocked.length) return null;

  return (
    <div className="mb-4">
      <p className="text-[11px] text-muted-foreground font-medium mb-2 uppercase tracking-wide flex items-center gap-1">
        <Award className="w-3.5 h-3.5 text-amber-500" /> Achievements
      </p>
      <div className="flex gap-2 overflow-x-auto pb-1">
        {unlocked.map(a => (
          <div key={a.id} className="flex-shrink-0 flex items-center gap-1.5 px-2.5 py-1.5 rounded-full border border-amber-200 bg-amber-50 text-amber-800 text-xs font-medium whitespace-nowrap">
            <span>{a.icon}</span>{a.label}
          </div>
        ))}
      </div>
    </div>
  );
}

function PeakListItem({ node, onClick, onToggleConquer, onRemove, isOwner }) {
  const col = C[node._status] || C.planned;
  return (
    <div className="flex items-center gap-3 px-4 py-3 hover:bg-muted/40 transition-colors">
      <button onClick={onClick} className="w-11 h-11 rounded-full overflow-hidden shrink-0 border-2 flex items-center justify-center" style={{ borderColor: col.line, background: col.bg }}>
        {(node.proof_url || node.image_url) ? <img src={node.proof_url || node.image_url} alt={node.name} className="w-full h-full object-cover" /> : <span className="text-xl">⛰️</span>}
      </button>
      <button onClick={onClick} className="flex-1 min-w-0 text-left">
        <p className="text-sm font-medium truncate">{node.name}</p>
        <p className="text-xs text-muted-foreground truncate">{[node._province, node._elev].filter(Boolean).join(' · ')}</p>
      
        {node._status === 'conquered' && (node.proof_url
          ? <span className="inline-flex items-center gap-1 text-[11px] text-emerald-700"><BadgeCheck className="w-3 h-3" />Photo verified</span>
          : <span className="text-[11px] text-amber-700">No summit photo yet</span>)}
      </button>
      {isOwner && (
        <div className="flex items-center gap-1 shrink-0">
          <button onClick={() => onToggleConquer(node)} className={`p-1.5 rounded-full ${node._status === 'conquered' ? 'text-emerald-600' : 'text-muted-foreground'}`}>
            {node._status === 'conquered' ? <CheckCircle2 className="w-5 h-5" /> : <Circle className="w-5 h-5" />}
          </button>
          <button onClick={() => onRemove(node)} className="p-1.5 rounded-full text-muted-foreground hover:text-destructive">
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
}