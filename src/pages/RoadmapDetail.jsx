// Transformed Roadmap Page - Immersive Adventure Journey Experience
import { useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  MapPin, Mountain, Zap, Flame, Trophy, Calendar, AlertCircle,
  ChevronRight, Check, Clock, Target, TrendingUp, Share2, Edit,
} from 'lucide-react';
import { useAddXP, useCheckIn } from '@/lib/useGamification';
import { calculateLevel, LEVEL_TITLES } from '@/lib/gamification';

// ========== IMMERSIVE ROADMAP HERO ==========
function RoadmapHero({ roadmap, progress }) {
  const journeyPhase = roadmap.status === 'completed' 
    ? 'Conquered'
    : roadmap.status === 'ongoing' 
    ? 'Exploring'
    : 'Dreaming';

  return (
    <div className="relative h-80 rounded-3xl overflow-hidden mb-8 group">
      {/* Background image with gradient overlay */}
      {roadmap.cover_image && (
        <img
          src={roadmap.cover_image}
          alt={roadmap.title}
          className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
        />
      )}
      
      {/* Gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent" />
      
      {/* Fog effect */}
      <div className="absolute inset-0 bg-gradient-to-r from-slate-900/20 via-transparent to-slate-900/20 pointer-events-none" />
      
      {/* Content */}
      <div className="absolute inset-0 flex flex-col justify-between p-8 text-white">
        {/* Top - Status Badge */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Badge className={`${getJourneyStyle(journeyPhase)} text-lg px-4 py-2`}>
              {journeyPhase === 'Dreaming' && '🌙 Dreaming'}
              {journeyPhase === 'Exploring' && '🧗 Exploring'}
              {journeyPhase === 'Conquered' && '🏆 Conquered'}
            </Badge>
            <span className="text-sm text-white/80">
              {roadmap.status === 'completed' && '✨ Completed'}
              {roadmap.status === 'ongoing' && `📍 ${progress}% Progress`}
              {roadmap.status === 'planned' && '📅 Not Started'}
            </span>
          </div>
          <Button variant="outline" size="sm" className="rounded-full gap-2">
            <Share2 className="w-4 h-4" />
            Share
          </Button>
        </div>

        {/* Bottom - Title and Stats */}
        <div>
          <h1 className="text-5xl font-bold mb-3 drop-shadow-lg">{roadmap.title}</h1>
          <p className="text-lg text-white/90 mb-6 max-w-2xl drop-shadow-md">
            {roadmap.description}
          </p>
          
          {/* Quick Stats Row */}
          <div className="grid grid-cols-4 gap-4 max-w-2xl">
            <div className="bg-white/10 backdrop-blur rounded-lg p-3">
              <p className="text-xs text-white/70 mb-1">Journey</p>
              <p className="text-2xl font-bold text-amber-300 flex items-center gap-1">
                <Mountain className="w-5 h-5" />
                {roadmap.conquered_mountains?.length || 0}
              </p>
            </div>
            <div className="bg-white/10 backdrop-blur rounded-lg p-3">
              <p className="text-xs text-white/70 mb-1">Destinations</p>
              <p className="text-2xl font-bold text-blue-300">
                {roadmap.destinations?.length || 0}
              </p>
            </div>
            <div className="bg-white/10 backdrop-blur rounded-lg p-3">
              <p className="text-xs text-white/70 mb-1">Elevation</p>
              <p className="text-2xl font-bold text-green-300 flex items-center gap-1">
                {Math.max(...(roadmap.conquered_mountains || []).map(m => m.elevation || 0)).toLocaleString()}m
              </p>
            </div>
            <div className="bg-white/10 backdrop-blur rounded-lg p-3">
              <p className="text-xs text-white/70 mb-1">Progress</p>
              <p className="text-2xl font-bold text-purple-300">{progress}%</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ========== IMMERSIVE JOURNEY TIMELINE ==========
function JourneyTimeline({ destinations, conqueredMountains }) {
  const conqueredNames = new Set(conqueredMountains?.map(m => m.name) || []);

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-2">
        <MapPin className="w-6 h-6 text-amber-400" />
        Your Adventure Path
      </h2>

      {/* Timeline */}
      <div className="relative">
        {/* Vertical line */}
        <div className="absolute left-6 top-0 bottom-0 w-1 bg-gradient-to-b from-amber-500 via-emerald-500 to-blue-500" />

        {/* Timeline Items */}
        <div className="space-y-6">
          {destinations?.map((dest, idx) => {
            const isConquered = conqueredNames.has(dest.name);
            const isCurrent = idx === destinations.findIndex(d => !conqueredNames.has(d.name));

            return (
              <div key={idx} className="relative ml-20">
                {/* Status Icon */}
                <div
                  className={`absolute -left-8 top-2 w-5 h-5 rounded-full border-4 flex items-center justify-center font-bold text-xs ${
                    isConquered
                      ? 'bg-green-500 border-green-400 text-white'
                      : isCurrent
                      ? 'bg-amber-400 border-amber-300 text-amber-900 animate-pulse'
                      : 'bg-slate-600 border-slate-500 text-slate-300'
                  }`}
                >
                  {isConquered ? '✓' : isCurrent ? '→' : '·'}
                </div>

                {/* Destination Card */}
                <div
                  className={`rounded-2xl p-6 border-2 transition-all ${
                    isConquered
                      ? 'bg-gradient-to-r from-green-900/20 to-emerald-900/20 border-green-500/50 scale-100'
                      : isCurrent
                      ? 'bg-gradient-to-r from-amber-900/30 to-orange-900/30 border-amber-500/70 scale-105 shadow-lg shadow-amber-500/20'
                      : 'bg-slate-900/40 border-slate-600/50'
                  }`}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <h3 className={`text-xl font-bold mb-1 ${
                        isConquered ? 'text-green-300' :
                        isCurrent ? 'text-amber-300' :
                        'text-slate-300'
                      }`}>
                        {isConquered && '✨ '}{dest.name}
                      </h3>
                      <p className="text-sm text-slate-400">{dest.difficulty} • {dest.elevation}m</p>
                    </div>
                    
                    {isConquered && (
                      <Badge className="bg-green-600 text-white gap-1">
                        <Trophy className="w-3 h-3" />
                        Conquered
                      </Badge>
                    )}
                    {isCurrent && (
                      <Badge className="bg-amber-600 text-white gap-1 animate-pulse">
                        <Target className="w-3 h-3" />
                        Target
                      </Badge>
                    )}
                  </div>

                  {dest.description && (
                    <p className="text-sm text-slate-400 mb-4">{dest.description}</p>
                  )}

                  {isCurrent && (
                    <Button className="w-full rounded-full bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-700 hover:to-orange-700 gap-2">
                      <Mountain className="w-4 h-4" />
                      Start This Climb
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ========== CONQUERED MOUNTAINS GALLERY ==========
function ConqueredGallery({ mountains }) {
  if (!mountains?.length) return null;

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold text-white flex items-center gap-2">
        <Trophy className="w-6 h-6 text-amber-400" />
        Mountains Conquered
      </h2>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {mountains.map((mountain, idx) => (
          <div
            key={idx}
            className="group rounded-2xl overflow-hidden border border-emerald-500/30 hover:border-emerald-500/60 transition-all hover:shadow-lg hover:shadow-emerald-500/20"
          >
            {/* Image */}
            <div className="relative h-32 bg-gradient-to-br from-emerald-900/40 to-green-900/40 overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
              <div className="absolute inset-0 flex items-center justify-center text-4xl group-hover:scale-110 transition-transform duration-300">
                ⛰️
              </div>
            </div>

            {/* Content */}
            <div className="p-4 bg-slate-900/50 backdrop-blur">
              <h3 className="font-bold text-white mb-1">{mountain.name}</h3>
              <p className="text-xs text-slate-400 mb-3">
                {mountain.elevation}m • {mountain.difficulty}
              </p>
              <div className="flex items-center gap-2 text-xs text-emerald-400">
                <Check className="w-3 h-3" />
                Conquered
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ========== PROGRESS SECTION ==========
function ProgressSection({ roadmap, destinations, conqueredMountains }) {
  const completed = destinations?.filter(d => conqueredNames.has(d.name))?.length || 0;
  const total = destinations?.length || 0;
  const progress = total > 0 ? Math.round((completed / total) * 100) : 0;
  const conqueredNames = new Set(conqueredMountains?.map(m => m.name) || []);

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-white flex items-center gap-2">
        <TrendingUp className="w-6 h-6 text-purple-400" />
        Progress Tracking
      </h2>

      {/* Main Progress Bar */}
      <div className="bg-slate-900/50 backdrop-blur rounded-2xl p-6 border border-slate-700">
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm font-semibold text-slate-400">Overall Progress</p>
          <p className="text-3xl font-bold text-white">{progress}%</p>
        </div>

        <div className="h-6 bg-slate-800 rounded-full overflow-hidden mb-4">
          <div
            className="h-full bg-gradient-to-r from-purple-500 via-pink-500 to-red-500 transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>

        <p className="text-sm text-slate-400">
          <span className="text-white font-bold">{completed}</span> of <span className="text-white font-bold">{total}</span> summits conquered
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-gradient-to-br from-blue-900/30 to-cyan-900/30 rounded-2xl p-4 border border-blue-500/30">
          <p className="text-xs text-blue-300 font-semibold mb-2">REMAINING</p>
          <p className="text-3xl font-bold text-blue-300 mb-1">{total - completed}</p>
          <p className="text-xs text-slate-400">mountains to conquer</p>
        </div>

        <div className="bg-gradient-to-br from-emerald-900/30 to-green-900/30 rounded-2xl p-4 border border-emerald-500/30">
          <p className="text-xs text-emerald-300 font-semibold mb-2">TOTAL ELEVATION</p>
          <p className="text-3xl font-bold text-emerald-300 mb-1">
            {(conqueredMountains?.reduce((sum, m) => sum + (m.elevation || 0), 0) || 0).toLocaleString()}m
          </p>
          <p className="text-xs text-slate-400">climbed</p>
        </div>
      </div>
    </div>
  );
}

// ========== MAIN ROADMAP PAGE ==========
export default function RoadmapPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [tab, setTab] = useState('journey');

  const { data: roadmap, isLoading } = useQuery({
    queryKey: ['roadmap-detail', id],
    queryFn: async () => {
      const rm = await base44.entities.Roadmap.filter({ id }).then(r => r[0]);
      if (!rm) throw new Error('Roadmap not found');
      return rm;
    },
    enabled: !!id,
  });

  const progress = useMemo(() => {
    if (!roadmap?.destinations) return 0;
    const conqueredNames = new Set(roadmap.conquered_mountains?.map(m => m.name) || []);
    const completed = roadmap.destinations.filter(d => conqueredNames.has(d.name)).length;
    return Math.round((completed / roadmap.destinations.length) * 100);
  }, [roadmap]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <Mountain className="w-12 h-12 text-slate-500 mx-auto mb-4 animate-bounce" />
          <p className="text-slate-400">Loading your adventure...</p>
        </div>
      </div>
    );
  }

  if (!roadmap) {
    return (
      <div className="text-center py-12">
        <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
        <p className="text-red-500">Roadmap not found</p>
        <Button onClick={() => navigate('/roadmap')} className="mt-4">
          Back to Roadmaps
        </Button>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      {/* Hero Section */}
      <RoadmapHero roadmap={roadmap} progress={progress} />

      {/* Tabs */}
      <Tabs value={tab} onValueChange={setTab} className="mb-8">
        <TabsList className="grid w-full grid-cols-3 mb-8">
          <TabsTrigger value="journey" className="gap-2">
            <MapPin className="w-4 h-4" />
            Journey
          </TabsTrigger>
          <TabsTrigger value="progress" className="gap-2">
            <TrendingUp className="w-4 h-4" />
            Progress
          </TabsTrigger>
          <TabsTrigger value="gallery" className="gap-2">
            <Mountain className="w-4 h-4" />
            Gallery
          </TabsTrigger>
        </TabsList>

        {/* Journey Tab */}
        <TabsContent value="journey">
          <JourneyTimeline
            destinations={roadmap.destinations}
            conqueredMountains={roadmap.conquered_mountains}
          />
        </TabsContent>

        {/* Progress Tab */}
        <TabsContent value="progress">
          <ProgressSection
            roadmap={roadmap}
            destinations={roadmap.destinations}
            conqueredMountains={roadmap.conquered_mountains}
          />
        </TabsContent>

        {/* Gallery Tab */}
        <TabsContent value="gallery">
          <ConqueredGallery mountains={roadmap.conquered_mountains} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ========== HELPER FUNCTIONS ==========
function getJourneyStyle(phase) {
  const styles = {
    Dreaming: 'bg-indigo-900/50 text-indigo-200 border border-indigo-500/50',
    Exploring: 'bg-amber-900/50 text-amber-200 border border-amber-500/50',
    Conquered: 'bg-emerald-900/50 text-emerald-200 border border-emerald-500/50',
  };
  return styles[phase] || styles.Dreaming;
}
