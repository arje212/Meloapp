import { Link } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { MapPin, TrendingUp, Clock, ChevronRight } from 'lucide-react';

const difficultyColors = {
  beginner: 'bg-green-100 text-green-700',
  intermediate: 'bg-yellow-100 text-yellow-700',
  advanced: 'bg-orange-100 text-orange-700',
  expert: 'bg-red-100 text-red-700',
};

export default function MountainListItem({ mountain }) {
  return (
    <Link to={`/mountains/${mountain.id}`} className="block">
      <div className="flex items-center gap-4 bg-card border rounded-xl p-3 hover:shadow-md transition-all">
        <img
          src={mountain.image_url || 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=200'}
          alt={mountain.name}
          className="w-16 h-16 rounded-lg object-cover shrink-0"
        />
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-sm truncate">{mountain.name}</h3>
          <div className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
            <MapPin className="w-3 h-3" />
            <span className="truncate">{mountain.location}</span>
          </div>
          <div className="flex items-center gap-2 mt-1.5">
            <Badge variant="outline" className={`text-[10px] ${difficultyColors[mountain.difficulty] || ''}`}>
              {mountain.difficulty}
            </Badge>
            <span className="text-xs text-muted-foreground flex items-center gap-0.5">
              <TrendingUp className="w-3 h-3" /> {mountain.elevation?.toLocaleString()}m
            </span>
            {mountain.estimated_hours && (
              <span className="text-xs text-muted-foreground flex items-center gap-0.5">
                <Clock className="w-3 h-3" /> {mountain.estimated_hours}h
              </span>
            )}
          </div>
        </div>
        <ChevronRight className="w-5 h-5 text-muted-foreground shrink-0" />
      </div>
    </Link>
  );
}