/**
 * TripPostCard.jsx
 * Rendered inside PostCard when post.post_type === 'trip'.
 * Shows a rich trip preview card with mountain, date, budget, and a Join button.
 */

import { useNavigate } from 'react-router-dom';
import { Mountain, CalendarDays, Wallet, Users, ArrowRight, CheckCircle2 } from 'lucide-react';
import { format } from 'date-fns';

export default function TripPostCard({ post }) {
  const navigate = useNavigate();
  const trip = post.trip_data;

  if (!trip) return null;

  const isGoing = post.content?.startsWith('✅');
  const isNew = post.content?.startsWith('🗺️');

  const tagLabel = isGoing ? 'Going' : isNew ? 'New Trip' : 'Trip';
  const tagColor = isGoing
    ? 'bg-green-100 text-green-700 border-green-200'
    : 'bg-primary/10 text-primary border-primary/20';

  return (
    <div
      className="mx-4 mb-3 rounded-2xl border border-border bg-muted/40 overflow-hidden cursor-pointer hover:bg-muted/60 transition-colors"
      onClick={() => navigate(`/trips/${trip.id}`)}
    >
      {/* Top color bar */}
      <div className="h-1.5 bg-gradient-to-r from-primary to-primary/50" />

      <div className="p-4">
        {/* Tag + title */}
        <div className="flex items-start gap-2 mb-3">
          <span className={`shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full border ${tagColor}`}>
            {tagLabel}
          </span>
          <p className="text-sm font-bold leading-snug line-clamp-2">{trip.title}</p>
        </div>

        {/* Meta grid */}
        <div className="grid grid-cols-2 gap-x-4 gap-y-2 mb-3">
          {trip.mountain_name && (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground col-span-2">
              <Mountain className="w-3.5 h-3.5 text-primary shrink-0" />
              <span className="font-semibold text-foreground">{trip.mountain_name}</span>
            </div>
          )}
          {trip.start_date && (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <CalendarDays className="w-3.5 h-3.5 shrink-0" />
              <span>{format(new Date(trip.start_date), 'MMM d, yyyy')}</span>
            </div>
          )}
          {trip.budget_estimate && (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Wallet className="w-3.5 h-3.5 shrink-0" />
              <span>₱{Number(trip.budget_estimate).toLocaleString()}</span>
            </div>
          )}
          {trip.max_participants && (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Users className="w-3.5 h-3.5 shrink-0" />
              <span>Max {trip.max_participants} pax</span>
            </div>
          )}
          {trip.difficulty && (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">
                {trip.difficulty}
              </span>
            </div>
          )}
        </div>

        {/* CTA row */}
        <div className="flex items-center justify-between pt-2 border-t border-border">
          {trip.organizer_name && (
            <p className="text-[10px] text-muted-foreground">
              by <span className="font-semibold text-foreground">{trip.organizer_name}</span>
            </p>
          )}
          <div className="flex items-center gap-1 text-xs font-semibold text-primary ml-auto">
            {isGoing
              ? <><CheckCircle2 className="w-3.5 h-3.5" /> View trip</>
              : <><span>View &amp; Join</span><ArrowRight className="w-3.5 h-3.5" /></>
            }
          </div>
        </div>
      </div>
    </div>
  );
}
