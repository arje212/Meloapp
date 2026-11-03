import { useQuery } from '@tanstack/react-query';
import { Loader2, Mountain } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { base44 } from '@/api/base44Client';
import { conqueredPeakMap } from '@/lib/peaks';

function Section({ title, names, tone }) {
  return (
    <div>
      <p className="text-xs font-semibold mb-1.5">{title} <span className="text-muted-foreground font-normal">({names.length})</span></p>
      {names.length === 0 ? (
        <p className="text-xs text-muted-foreground">None yet</p>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {names.map((n) => (
            <span key={n} className={`inline-flex items-center gap-1 whitespace-nowrap text-[11px] rounded-full px-2 py-0.5 ${tone}`}><Mountain className="w-3 h-3" />{n}</span>
          ))}
        </div>
      )}
    </div>
  );
}

/** "Compare Peaks": which conquered peaks you and another hiker share, and which only one of you has. */
export default function ComparePeaksDialog({ open, onOpenChange, theirName, theirRoadmaps = [], myEmail }) {
  const { data: mine = [], isLoading } = useQuery({
    queryKey: ['my-roadmaps-compare', myEmail],
    enabled: open && !!myEmail,
    queryFn: () => base44.entities.Roadmap.filter({ user_email: myEmail }),
  });
  const mineMap = conqueredPeakMap(mine);
  const theirMap = conqueredPeakMap(theirRoadmaps);
  const both = [...theirMap.keys()].filter((k) => mineMap.has(k)).map((k) => theirMap.get(k));
  const onlyThem = [...theirMap.keys()].filter((k) => !mineMap.has(k)).map((k) => theirMap.get(k));
  const onlyMe = [...mineMap.keys()].filter((k) => !theirMap.has(k)).map((k) => mineMap.get(k));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm rounded-2xl">
        <DialogHeader><DialogTitle className="font-display">You vs {theirName || 'this hiker'}</DialogTitle></DialogHeader>
        {isLoading ? (
          <div className="py-8 flex justify-center"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="bg-muted rounded-xl p-2"><p className="text-lg font-bold tabular-nums">{mineMap.size}</p><p className="text-[10px] text-muted-foreground">You</p></div>
              <div className="bg-primary/10 rounded-xl p-2"><p className="text-lg font-bold tabular-nums">{both.length}</p><p className="text-[10px] text-muted-foreground">Both</p></div>
              <div className="bg-muted rounded-xl p-2"><p className="text-lg font-bold tabular-nums">{theirMap.size}</p><p className="text-[10px] text-muted-foreground">{(theirName || 'Them').split(' ')[0]}</p></div>
            </div>
            <Section title="You both climbed" names={both} tone="bg-primary/10 text-primary" />
            <Section title={`Only ${(theirName || 'they').split(' ')[0]} climbed`} names={onlyThem} tone="bg-muted text-muted-foreground" />
            <Section title="Only you climbed" names={onlyMe} tone="bg-muted text-muted-foreground" />
            {theirMap.size === 0 && <p className="text-xs text-muted-foreground">{(theirName || 'This hiker')} has no public conquered peaks yet.</p>}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
