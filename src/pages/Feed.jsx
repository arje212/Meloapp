import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { PenSquare, Loader2, Mountain } from 'lucide-react';
import PostCard from '@/components/feed/PostCard';
import CreatePostDialog from '@/components/feed/CreatePostDialog';
import CommentsSheet from '@/components/feed/CommentsSheet';

// Fetch posts with author profile info via JOIN
async function fetchPosts() {
  const { data, error } = await supabase
    .from('posts')
    .select(`
      id,
      author_id,
      content,
      image_url,
      mountain_id,
      mountain_name,
      status,
      likes_count,
      comments_count,
      created_date,
      profiles (
        full_name,
        email,
        avatar_url
      )
    `)
    .eq('status', 'active')
    .order('created_date', { ascending: false })
    .limit(50);

  if (error) throw error;
  return data || [];
}

export default function Feed() {
  const [showCreate, setShowCreate] = useState(false);
  const [commentPost, setCommentPost] = useState(null);
  const queryClient = useQueryClient();

  const { data: posts = [], isLoading, error } = useQuery({
    queryKey: ['posts'],
    queryFn: fetchPosts,
  });

  const refresh = () => queryClient.invalidateQueries({ queryKey: ['posts'] });

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      {/* Hero banner */}
      <div className="relative rounded-3xl overflow-hidden mb-6 bg-gradient-to-br from-primary/90 to-primary p-6 md:p-8">
        <div className="relative z-10">
          <div className="flex items-center gap-2 mb-2">
            <Mountain className="w-6 h-6 text-primary-foreground/80" />
            <span className="text-primary-foreground/80 text-sm font-medium">Lakbay Bundok</span>
          </div>
          <h1 className="font-display text-2xl md:text-3xl font-bold text-primary-foreground mb-2">
            Discover Philippine Mountains
          </h1>
          <p className="text-primary-foreground/70 text-sm max-w-md">
            Share your adventures, plan hikes, and connect with fellow mountaineers across the archipelago.
          </p>
        </div>
        <div className="absolute top-0 right-0 w-40 h-40 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2" />
        <div className="absolute bottom-0 left-1/2 w-32 h-32 bg-white/5 rounded-full translate-y-1/2" />
      </div>

      {/* Create post bar */}
      <button
        onClick={() => setShowCreate(true)}
        className="w-full flex items-center gap-3 bg-card border rounded-2xl p-4 mb-6 text-left hover:border-primary/30 transition-colors"
      >
        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
          <PenSquare className="w-5 h-5 text-primary" />
        </div>
        <span className="text-muted-foreground text-sm">Share your hiking experience...</span>
      </button>

      {/* Posts */}
      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      ) : error ? (
        <div className="text-center py-16 text-destructive text-sm">
          Error loading posts: {error.message}
        </div>
      ) : posts.length === 0 ? (
        <div className="text-center py-16">
          <Mountain className="w-16 h-16 text-muted-foreground/30 mx-auto mb-4" />
          <h3 className="font-display text-lg font-semibold mb-1">No posts yet</h3>
          <p className="text-sm text-muted-foreground">Be the first to share your adventure!</p>
        </div>
      ) : (
        <div className="space-y-4">
          {posts.map(post => (
            <PostCard
              key={post.id}
              post={post}
              onComment={setCommentPost}
              onUpdate={refresh}
            />
          ))}
        </div>
      )}

      <CreatePostDialog open={showCreate} onOpenChange={setShowCreate} onCreated={refresh} />
      <CommentsSheet post={commentPost} open={!!commentPost} onOpenChange={() => setCommentPost(null)} />

      {/* FAB for mobile */}
      <Button
        onClick={() => setShowCreate(true)}
        className="md:hidden fixed bottom-20 right-4 w-14 h-14 rounded-full shadow-lg z-40"
        size="icon"
      >
        <PenSquare className="w-6 h-6" />
      </Button>
    </div>
  );
}