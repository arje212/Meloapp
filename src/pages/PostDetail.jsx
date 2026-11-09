import { useEffect, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import PostCard from '@/components/feed/PostCard';
import CommentsSheet from '@/components/feed/CommentsSheet';
import { PostSkeleton } from '@/components/Skeletons';
import { Button } from '@/components/ui/button';

// A single post. Notifications (likes, comments, @mentions) open here: /post/<id>?comments=1
async function fetchPost(id) {
  const { data: post, error } = await supabase
    .from('posts')
    .select(`
      id, author_id, content, image_url, media_type, post_images,
      post_type, is_reel, mountain_id, mountain_name, status,
      likes_count, comments_count, created_date, trip_data,
      package_id, package_price, agency_id, agency_name,
      profiles ( full_name, email, avatar_url )
    `)
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  if (!post || post.status === 'deleted') return null;

  let agency = null;
  if (post.profiles?.email) {
    const { data } = await supabase
      .from('agencies')
      .select('owner_email, name, logo_url, is_verified')
      .eq('owner_email', post.profiles.email)
      .eq('status', 'approved')
      .maybeSingle();
    agency = data || null;
  }
  return { ...post, agency };
}

export default function PostDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [commentPost, setCommentPost] = useState(null);

  const { data: post, isLoading, error, refetch } = useQuery({
    queryKey: ['post', id],
    queryFn: () => fetchPost(id),
    enabled: !!id,
  });

  // Opened from a comment / mention notification: show the comments right away
  useEffect(() => {
    if (post && params.get('comments') === '1') setCommentPost(post);
  }, [post, params]);

  return (
    <div className="max-w-2xl mx-auto px-0 sm:px-4 py-4">
      <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-sm text-muted-foreground mb-3 px-4 sm:px-0 hover:text-foreground">
        <ArrowLeft className="w-4 h-4" /> Back
      </button>

      {isLoading ? (
        <PostSkeleton />
      ) : error ? (
        <div className="text-center py-12 px-4 space-y-3">
          <p className="font-semibold">Could not load this post</p>
          <p className="text-xs text-muted-foreground">{String(error.message || '').slice(0, 160)}</p>
          <Button variant="outline" className="rounded-full" onClick={() => refetch()}>Try again</Button>
        </div>
      ) : !post ? (
        <div className="text-center py-16 px-4">
          <p className="font-semibold">This post is no longer available</p>
          <p className="text-sm text-muted-foreground mt-1">It may have been deleted.</p>
          <Button className="rounded-full mt-4" onClick={() => navigate('/')}>Go to Feed</Button>
        </div>
      ) : (
        <PostCard post={post} onComment={setCommentPost} />
      )}

      <CommentsSheet post={commentPost} open={!!commentPost} onOpenChange={(o) => !o && setCommentPost(null)} />
    </div>
  );
}
