import { Skeleton } from '@/components/ui/skeleton';

/** One post card placeholder (header + text + media). */
export function PostSkeleton({ media = true }) {
  return (
    <div className="bg-card border-y sm:border sm:rounded-2xl overflow-hidden">
      <div className="flex items-center gap-3 p-4">
        <Skeleton className="w-11 h-11 rounded-full" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-3.5 w-40" />
          <Skeleton className="h-3 w-24" />
        </div>
      </div>
      <div className="px-4 pb-3 space-y-2">
        <Skeleton className="h-3.5 w-full" />
        <Skeleton className="h-3.5 w-3/4" />
      </div>
      {media && <Skeleton className="w-full h-72 rounded-none" />}
      <div className="flex gap-6 p-3">
        <Skeleton className="h-5 w-16" />
        <Skeleton className="h-5 w-20" />
        <Skeleton className="h-5 w-16" />
      </div>
    </div>
  );
}

export function FeedSkeleton({ count = 3 }) {
  return (
    <div className="space-y-2 sm:space-y-4" aria-busy="true" aria-label="Loading feed">
      {Array.from({ length: count }).map((_, i) => <PostSkeleton key={i} media={i !== 1} />)}
    </div>
  );
}

/** Row list (chat rooms, notifications, agencies, trips...). */
export function ListSkeleton({ rows = 6 }) {
  return (
    <div className="divide-y" aria-busy="true">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 p-4">
          <Skeleton className="w-12 h-12 rounded-full shrink-0" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-3.5 w-1/2" />
            <Skeleton className="h-3 w-3/4" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function CardGridSkeleton({ count = 4 }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 p-3" aria-busy="true">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="rounded-2xl border bg-card overflow-hidden">
          <Skeleton className="h-36 w-full rounded-none" />
          <div className="p-3 space-y-2">
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-3 w-1/2" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function ChatSkeleton() {
  const rows = [['l', 'w-48'], ['r', 'w-40'], ['l', 'w-56'], ['r', 'w-32'], ['l', 'w-44']];
  return (
    <div className="space-y-3 py-2" aria-busy="true">
      {rows.map(([side, w], i) => (
        <div key={i} className={`flex ${side === 'r' ? 'justify-end' : 'justify-start'}`}>
          <Skeleton className={`h-9 ${w} rounded-2xl`} />
        </div>
      ))}
    </div>
  );
}

/** Whole-screen shell: header + feed placeholders + bottom nav (used instead of the spinner). */
export function AppShellSkeleton() {
  return (
    <div className="min-h-screen bg-background" aria-busy="true">
      <div className="h-14 border-b flex items-center px-4 gap-3">
        <Skeleton className="w-8 h-8 rounded-lg" />
        <Skeleton className="h-4 w-28" />
      </div>
      <div className="max-w-2xl mx-auto p-3 space-y-3">
        <div className="flex gap-3 overflow-hidden">
          {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="w-14 h-14 rounded-full shrink-0" />)}
        </div>
        <FeedSkeleton count={2} />
      </div>
      <div className="fixed bottom-0 inset-x-0 h-16 border-t bg-background flex items-center justify-around px-4">
        {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="w-8 h-8 rounded-lg" />)}
      </div>
    </div>
  );
}
