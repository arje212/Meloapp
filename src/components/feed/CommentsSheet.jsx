import { useState, useRef, useEffect } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Send, Loader2, MessageCircle, Heart } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/AuthContext';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { formatDistanceToNow } from 'date-fns';
import { syncCommentsCount } from '@/lib/postCounts';
import { notifyUser } from '@/lib/notify';

// ── Comment Item ──────────────────────────────────────────────────────────────
function CommentItem({ c, onReply }) {
  const [liked, setLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(c.likes_count || 0);

  const handleLike = async () => {
    setLiked(v => !v);
    setLikeCount(n => liked ? Math.max(0, n - 1) : n + 1);
  };

  const avatarUrl = c.profiles?.avatar_url || null;
  const initials = c.author_name?.[0]?.toUpperCase() || '?';

  return (
    <div className="flex gap-3">
      <Avatar className="w-8 h-8 shrink-0 mt-0.5">
        {avatarUrl
          ? <img src={avatarUrl} alt="" className="w-full h-full object-cover rounded-full" />
          : <AvatarFallback className="text-xs bg-primary/10 text-primary font-bold">
              {initials}
            </AvatarFallback>
        }
      </Avatar>
      <div className="flex-1 min-w-0">
        <div className="bg-muted rounded-2xl rounded-tl-sm px-3 py-2 inline-block max-w-full">
          <p className="text-xs font-bold text-foreground mb-0.5">{c.author_name}</p>
          <p className="text-sm leading-relaxed break-words">{c.content}</p>
        </div>
        <div className="flex items-center gap-3 mt-1 ml-1">
          <span className="text-[10px] text-muted-foreground">
            {(c.created_at || c.created_date)
              ? formatDistanceToNow(new Date(c.created_at || c.created_date), { addSuffix: true })
              : 'just now'}
          </span>
          <button
            onClick={handleLike}
            className={`text-[11px] font-semibold transition-colors flex items-center gap-1 ${liked ? 'text-red-500' : 'text-muted-foreground hover:text-foreground'}`}
          >
            <Heart className={`w-3 h-3 ${liked ? 'fill-red-500' : ''}`} />
            {liked ? 'Liked' : 'Like'}
            {likeCount > 0 && <span className="text-[10px]">· {likeCount}</span>}
          </button>
          <button type="button" onClick={() => onReply?.(c)} className="text-[11px] font-semibold text-muted-foreground hover:text-foreground transition-colors">
            Reply
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Comments Sheet ────────────────────────────────────────────────────────────
export default function CommentsSheet({ post, open, onOpenChange }) {
  const { user } = useAuth();
  const [text, setText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [sendError, setSendError] = useState('');
  const bottomRef = useRef(null);
  const inputRef = useRef(null);
  const queryClient = useQueryClient();

  const { data: comments = [], isLoading, isError, error: loadError, refetch } = useQuery({
    queryKey: ['comments', post?.id],
    retry: 1,
    queryFn: async () => {
      // `select *` and no table join: the old query named fixed columns (created_at, likes_count) and joined
      // profiles, and any mismatch with the real table made the whole list fail silently (endless spinner).
      const { data, error } = await supabase.from('comments').select('*').eq('post_id', post.id);
      if (error) throw error;
      const rows = data || [];
      const ids = [...new Set(rows.map((r) => r.user_id).filter(Boolean))];
      const avatars = {};
      if (ids.length) {
        const { data: profs } = await supabase.from('profiles').select('id, avatar_url').in('id', ids);
        (profs || []).forEach((pr) => { avatars[pr.id] = pr.avatar_url; });
      }
      const when = (r) => String(r.created_at || r.created_date || '');
      return rows
        .map((r) => ({ ...r, profiles: { avatar_url: avatars[r.user_id] || null } }))
        .sort((x, y) => when(x).localeCompare(when(y)));
    },
    enabled: !!post?.id && open,
    refetchOnWindowFocus: false,
  });

  useEffect(() => {
    if (open && !isLoading) {
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
    }
  }, [open, isLoading, comments.length]);

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 400);
    } else {
      setText('');
      setSendError('');
    }
  }, [open]);

  // Reply: starts the comment with @name and puts the cursor in the box
  const handleReply = (c) => {
    const who = (c.author_name || '').split(' ')[0];
    if (who) setText(`@${who} `);
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  const handleSend = async () => {
    const trimmed = text.trim();
    if (!trimmed || !post?.id || !user?.id || isSending) return;

    setIsSending(true);
    setSendError('');

    try {
      // 1. Insert comment
      const { error: commentError } = await supabase
        .from('comments')
        .insert({
          post_id: post.id,
          content: trimmed,
          author_name: user.full_name || user.email,
          user_id: user.id,
        });

      if (commentError) throw commentError;

      // 2. Recompute comments_count from the comments table (no stale read-modify-write)
      const freshCount = await syncCommentsCount(post.id);

      // 3. Let the post author know
      notifyUser({
        toEmail: post.profiles?.email,
        fromEmail: user.email,
        title: 'New comment on your post',
        message: `${user.full_name || user.email}: ${trimmed.slice(0, 80)}`,
        type: 'comment',
        link: '/',
        icon: '\uD83D\uDCAC',
      });

      setText('');
      queryClient.invalidateQueries({ queryKey: ['comments', post.id] });
      // update the number on the post in place - invalidating ['posts'] reloaded the whole feed
      queryClient.setQueriesData({ queryKey: ['posts'] }, (old) =>
        old?.pages
          ? { ...old, pages: old.pages.map((pg) => ({ ...pg, posts: (pg.posts || []).map((p) =>
              p.id === post.id ? { ...p, comments_count: freshCount ?? (p.comments_count || 0) + 1 } : p) })) }
          : old);
    } catch (err) {
      console.error('Comment send error:', err);
      setSendError(`Failed to send. Please try again.${err?.message ? ` (${String(err.message).slice(0, 120)})` : ''}`);
    } finally {
      setIsSending(false);
    }
  };

  const userInitials = user?.full_name
    ? user.full_name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()
    : '?';

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="h-[80vh] rounded-t-3xl flex flex-col p-0">
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 bg-muted-foreground/30 rounded-full" />
        </div>

        <SheetHeader className="px-4 pb-3 border-b">
          <SheetTitle className="text-base flex items-center gap-2">
            <MessageCircle className="w-4 h-4 text-muted-foreground" />
            Comments
            {comments.length > 0 && (
              <span className="text-sm text-muted-foreground font-normal">({comments.length})</span>
            )}
          </SheetTitle>
          {post?.content && (
            <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{post.content}</p>
          )}
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4 min-h-0">
          {isLoading && (
            <div className="flex justify-center py-10">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          )}
          {isError && (
            <div className="text-center py-10 space-y-2">
              <p className="text-sm font-semibold">Could not load the comments</p>
              <p className="text-xs text-muted-foreground break-words">{String(loadError?.message || '').slice(0, 160)}</p>
              <button type="button" onClick={() => refetch()} className="text-xs font-semibold text-primary underline">Try again</button>
            </div>
          )}
          {!isLoading && !isError && comments.length === 0 && (
            <div className="text-center py-10">
              <MessageCircle className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-sm font-semibold mb-1">No comments yet</p>
              <p className="text-xs text-muted-foreground">Be the first to comment!</p>
            </div>
          )}
          {comments.map(c => (
            <CommentItem key={c.id} c={c} onReply={handleReply} />
          ))}
          <div ref={bottomRef} />
        </div>

        <div className="px-4 py-3 border-t bg-card shrink-0">
          {sendError && (
            <p className="text-xs text-destructive mb-2 px-1">{sendError}</p>
          )}
          <div className="flex items-center gap-2">
            <Avatar className="w-9 h-9 shrink-0">
              {user?.avatar_url
                ? <img src={user.avatar_url} alt="" className="w-full h-full object-cover rounded-full" />
                : <AvatarFallback className="bg-primary/10 text-primary font-bold text-xs">{userInitials}</AvatarFallback>
              }
            </Avatar>
            <div className="flex-1 flex items-center bg-muted rounded-full px-4 py-2.5">
              <input
                ref={inputRef}
                type="text"
                placeholder="Write a comment..."
                value={text}
                onChange={e => setText(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
                className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground min-w-0"
              />
            </div>
            <Button
              size="icon"
              className="rounded-full w-9 h-9 shrink-0"
              onClick={handleSend}
              disabled={!text.trim() || isSending}
            >
              {isSending
                ? <Loader2 className="w-4 h-4 animate-spin" />
                : <Send className="w-4 h-4" />
              }
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}