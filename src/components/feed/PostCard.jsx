import { useState } from 'react';
import { Heart, MessageCircle, Share2, MapPin } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/AuthContext';
import { formatDistanceToNow } from 'date-fns';
import FollowButton from '@/components/social/FollowButton';

export default function PostCard({ post, onComment, onUpdate }) {
  const { user } = useAuth();
  const [isLiking, setIsLiking] = useState(false);

  // author info comes from the joined profiles table
  const authorName = post.profiles?.full_name || 'Unknown';
  const authorEmail = post.profiles?.email || '';
  const initials = authorName.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() || '?';

  const handleLike = async () => {
    if (isLiking) return;
    setIsLiking(true);
    try {
      // likes_count is just an integer in the DB — increment/decrement
      const newCount = (post.likes_count || 0) + 1;
      await supabase
        .from('posts')
        .update({ likes_count: newCount })
        .eq('id', post.id);
      onUpdate?.();
    } catch (err) {
      console.error('Like error:', err);
    } finally {
      setIsLiking(false);
    }
  };

  return (
    <div className="bg-card rounded-2xl border overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 p-4">
        <Avatar className="w-10 h-10">
          <AvatarFallback className="bg-primary/10 text-primary font-semibold text-sm">
            {initials}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm truncate">{authorName}</p>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span>
              {post.created_date
                ? formatDistanceToNow(new Date(post.created_date), { addSuffix: true })
                : 'just now'}
            </span>
            {post.mountain_name && (
              <>
                <span>·</span>
                <MapPin className="w-3 h-3" />
                <span className="text-primary font-medium">{post.mountain_name}</span>
              </>
            )}
          </div>
        </div>
        {/* FollowButton needs author_id, not email */}
        <FollowButton targetId={post.author_id} targetName={authorName} />
      </div>

      {/* Content */}
      <div className="px-4 pb-3">
        <p className="text-sm leading-relaxed whitespace-pre-wrap">{post.content}</p>
      </div>

      {/* Single image (image_url is text, not array) */}
      {post.image_url && (
        <div className="aspect-video">
          <img src={post.image_url} alt="" className="w-full h-full object-cover" />
        </div>
      )}

      {/* Stats */}
      {(post.likes_count > 0 || post.comments_count > 0) && (
        <div className="flex items-center justify-between px-4 py-2 text-xs text-muted-foreground">
          <span>{post.likes_count || 0} likes</span>
          <span>{post.comments_count || 0} comments</span>
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center border-t">
        <Button
          variant="ghost"
          className="flex-1 gap-2 rounded-none h-11 text-sm text-muted-foreground"
          onClick={handleLike}
          disabled={isLiking}
        >
          <Heart className="w-4 h-4" />
          Like
        </Button>
        <Button
          variant="ghost"
          className="flex-1 gap-2 rounded-none h-11 text-sm text-muted-foreground"
          onClick={() => onComment?.(post)}
        >
          <MessageCircle className="w-4 h-4" />
          Comment
        </Button>
        <Button
          variant="ghost"
          className="flex-1 gap-2 rounded-none h-11 text-sm text-muted-foreground"
        >
          <Share2 className="w-4 h-4" />
          Share
        </Button>
      </div>
    </div>
  );
}