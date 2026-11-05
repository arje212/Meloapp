import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Search, Loader2, Mountain, LayoutGrid, List } from 'lucide-react';
import MountainCard from '@/components/mountains/MountainCard';
import MountainListItem from '@/components/mountains/MountainListItem';
import MountainMap from '@/components/mountains/MountainMap';

export default function Mountains() {
  const [search, setSearch] = useState('');
  const [difficulty, setDifficulty] = useState('all');
  const [viewMode, setViewMode] = useState('grid');

  const { data: mountains = [], isLoading } = useQuery({
    queryKey: ['mountains'],
    queryFn: () => base44.entities.Mountain.list('name', 200),
  });

  const filtered = mountains.filter(m => {
    const matchSearch = !search || m.name?.toLowerCase().includes(search.toLowerCase()) || m.location?.toLowerCase().includes(search.toLowerCase());
    const matchDiff = difficulty === 'all' || m.difficulty === difficulty;
    return matchSearch && matchDiff;
  });

  return (
    <div className="max-w-6xl mx-auto px-5 md:px-4 py-6">
      <div className="mb-6">
        <h1 className="font-display text-2xl md:text-3xl font-bold mb-1">Explore Destinations</h1>
        <p className="text-muted-foreground text-sm">Discover {mountains.length} mountains now, with beaches and city trips coming into the same flow</p>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search destinations or locations..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-10 rounded-full"
          />
        </div>
        <Tabs value={difficulty} onValueChange={setDifficulty}>
          <TabsList className="bg-muted">
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="beginner">Easy</TabsTrigger>
            <TabsTrigger value="intermediate">Mid</TabsTrigger>
            <TabsTrigger value="advanced">Hard</TabsTrigger>
            <TabsTrigger value="expert">Expert</TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="flex gap-1">
          <Button variant={viewMode === 'grid' ? 'default' : 'outline'} size="icon" onClick={() => setViewMode('grid')} className="rounded-full">
            <LayoutGrid className="w-4 h-4" />
          </Button>
          <Button variant={viewMode === 'list' ? 'default' : 'outline'} size="icon" onClick={() => setViewMode('list')} className="rounded-full">
            <List className="w-4 h-4" />
          </Button>
          <Button variant={viewMode === 'map' ? 'default' : 'outline'} size="icon" onClick={() => setViewMode('map')} className="rounded-full">
            <Mountain className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16">
          <Mountain className="w-16 h-16 text-muted-foreground/30 mx-auto mb-4" />
          <h3 className="font-semibold mb-1">No destinations found</h3>
          <p className="text-sm text-muted-foreground">Try adjusting your search or filters</p>
        </div>
      ) : viewMode === 'map' ? (
        <MountainMap mountains={filtered} />
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(m => <MountainCard key={m.id} mountain={m} />)}
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(m => <MountainListItem key={m.id} mountain={m} />)}
        </div>
      )}
    </div>
  );
}
