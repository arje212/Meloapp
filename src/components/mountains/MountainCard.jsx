import { Link } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { MapPin, TrendingUp, Clock } from 'lucide-react';

const difficultyColors = {
  beginner: 'bg-green-100 text-green-700 border-green-200',
  intermediate: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  advanced: 'bg-orange-100 text-orange-700 border-orange-200',
  expert: 'bg-red-100 text-red-700 border-red-200',
};

export default function MountainCard({ mountain }) {
  return (
    <Link to={`/mountains/${mountain.id}`} className="block group">
      <div className="bg-card border rounded-2xl overflow-hidden hover:shadow-lg transition-all duration-300 hover:-translate-y-0.5">
        <div className="aspect-[4/3] relative overflow-hidden">
          <img
            src={mountain.image_url || 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=600'}
            alt={mountain.name}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
          <div className="absolute bottom-3 left-3 right-3">
            <h3 className="font-display text-lg font-bold text-white mb-1">{mountain.name}</h3>
            <div className="flex items-center gap-1 text-white/80 text-xs">
              <MapPin className="w-3 h-3" />
              <span>{mountain.location}</span>
            </div>
          </div>
          {mountain.status && mountain.status !== 'open' && (
            <Badge className="absolute top-3 right-3 bg-destructive text-destructive-foreground">
              {mountain.status}
            </Badge>
          )}
        </div>
        <div className="p-3 flex items-center gap-3">
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <TrendingUp className="w-3.5 h-3.5" />
            <span>{mountain.elevation?.toLocaleString()}m</span>
          </div>
          <Badge variant="outline" className={`text-[10px] ${difficultyColors[mountain.difficulty] || ''}`}>
            {mountain.difficulty}
          </Badge>
          {mountain.estimated_hours && (
            <div className="flex items-center gap-1 text-xs text-muted-foreground ml-auto">
              <Clock className="w-3.5 h-3.5" />
              <span>{mountain.estimated_hours}h</span>
            </div>
          )}
        </div>
      </div>
    </Link>
  );
}