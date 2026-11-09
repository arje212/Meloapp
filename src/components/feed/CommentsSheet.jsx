import { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
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
import { searchProfiles } from '@/lib/profileLookup';
import { ListSkeleton } from '@/components/Skeletons';

const escapeRegExp = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Text with @mentions highlighted. Known mentions (saved with the comment) are tappable. */
export function CommentText({ text, mentions, onOpenProfile }) {
  const known = (Array.isArray(mentions) ? mentions : []).filter((m) => m?.name);
  const names = known.map((m) => m.name).sort((a, b) => b.length - a.length);
  const pattern = names.length
    ? new RegExp(`(@(?:${names.map(escapeRegExp).join('|')})|@[\\p{L}\\p{N}_.]+)`, 'gu')
    : /(@[\p{L}\p{N}_.]+)/gu;
  const parts = String(text || '').split(pattern);
  return (
    <p className="text-sm leading-relaxed break-words whitespace-pre-wrap">
      {parts.map((part, i) => {
        if (!part.startsWith('@')) return part;
        const hit = known.find((m) => `@${m.name}` === part);
        return hit?.id ? (
          <button key={i} type="button" onClick={() => onOpenProfile(hit.id)} className="text-primary font-semibold hover:underline">{part}</button>
        ) : (
          <span key={i} className="text-primary font-semibold">{part}</span>
        );
      })}
    </p>
  );
}

// ── Comment Item ──────────────────────────────────────────────────────────────
function CommentItem({ c, onReply, onToggleLike, onOpenProfile }) {
  const avatarUrl = c.profiles?.avatar_url || null;
  const initials = c.author_name?.[0]?.toUpperCase() || '?';
  const liked = !!c.likedByMe;
  const likeCount = c.likeCount || 0;

  return (
    <div className="flex gap-3">
      <Avatar className="w-8 h-8 shrink-0 mt-0.5">
        {avatarUrl
          ? <img src={avatarUrl} alt="" className="w-full h-full object-cover rounded-full" />
          : <AvatarFallback className="text-xs bg-primary/10 text-primary font-bold">{initials}</AvatarFallback>}
      </Avatar>
      <div className="flex-1 min-w-0">
        <div className="bg-muted rounded-2xl rounded-tl-sm px-3 py-2 inline-block max-w-full">
          <p className="text-xs font-bold text-foreground mb-0.5">{c.author_name}</p>
          <CommentText text={c.content} mentions={c.mentions} onOpenProfile={onOpenProfile} />
        </div>
        <div className="flex items-center gap-3 mt-1 ml-1">
          <span className="text-[10px] text-muted-foreground">
            {(c.created_at || c.created_date)
              ? formatDistanceToNow(new Date(c.created_at || c.created_date), { addSuffix: true })
              : 'just now'}
          </span>
          <button
            type="button"
            onClick={() => onToggleLike(c)}
            aria-pressed={liked}
            className={`text-[11px] font-semibold transition-colors flex items-center gap-1 ${liked ? 'text-red-500' : 'text-muted-foreground hover:text-foreground'}`}
          >
            <Heart className={`w-3.5 h-3.5 ${liked ? 'fill-red-500' : ''}`} />
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
  const navigate = useNavigate();
  const [text, setText] = useState('');
  const [mentions, setMentions] = useState([]);           // people picked from the @ list
  const [mentionQuery, setMentionQuery] = useState(null); // text typed after "@" (null = not mentioning)
  const [suggestions, setSuggestions] = useState([]);
  const [isSending, setIsSending] = useState(false);
  const [sendError, setSendError] = useState('');
  const [replyTo, setReplyTo] = useState(null);          // { rootId, authorId, name }
  const [openThreads, setOpenThreads] = useState(() => new Set());
  const bottomRef = useRef(null);
  const inputRef = useRef(null);
  const queryClient = useQueryClient();
  const likesSupported = useRef(true); // flips to false if the comment_likes table does not exist yet

  const { data: comments = [], isLoading, isError, error: loadError, refetch } = useQuery({
    queryKey: ['comments', post?.id],
    retry: 1,
    queryFn: async () => {
      // `select *` and no table join: any column mismatch used to make the whole list fail silently.
      const { data, error } = await supabase.from('comments').select('*').eq('post_id', post.id);
      if (error) throw error;
      const rows = data || [];

      const userIds = [...new Set(rows.map((r) => r.user_id).filter(Boolean))];
      const avatars = {};
      if (userIds.length) {
        const { data: profs } = await supabase.from('profiles').select('id, avatar_url').in('id', userIds);
        (profs || []).forEach((pr) => { avatars[pr.id] = pr.avatar_url; });
      }

      // Likes are saved in comment_likes (so they survive closing the sheet / reloading)
      const likeCounts = {};
      const mine = new Set();
      if (rows.length && likesSupported.current) {
        const { data: likes, error: likeErr } = await supabase
          .from('comment_likes').select('comment_id, user_id').in('comment_id', rows.map((r) => r.id));
        if (likeErr) {
          likesSupported.current = false;
          console.warn('[comments] comment_likes unavailable - run the SQL migration:', likeErr.message);
        } else {
          (likes || []).forEach((l) => {
            likeCounts[l.comment_id] = (likeCounts[l.comment_id] || 0) + 1;
            if (l.user_id === user?.id) mine.add(l.comment_id);
          });
        }
      }

      const when = (r) => String(r.created_at || r.created_date || '');
      return rows
        .map((r) => ({
          ...r,
          profiles: { avatar_url: avatars[r.user_id] || null },
          likeCount: likeCounts[r.id] || 0,
          likedByMe: mine.has(r.id),
        }))
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
      setText(''); setMentions([]); setMentionQuery(null); setSuggestions([]); setSendError(''); setReplyTo(null);
    }
  }, [open]);

  // ── @mention suggestions ───────────────────────────────────────────────────
  useEffect(() => {
    if (mentionQuery === null) { setSuggestions([]); return undefined; }
    let cancelled = false;
    const timer = setTimeout(async () => {
      const q = mentionQuery.trim();
      let data = [];
      try {
        data = q
          ? await searchProfiles(q, { limit: 8, excludeId: user?.id })
          : (await supabase.from('profiles').select('id, full_name, email, avatar_url').order('full_name', { ascending: true }).limit(8)).data || [];
      } catch { /* keep empty */ }
      if (cancelled) return;
      setSuggestions((data || []).filter((p) => p.full_name && p.id !== user?.id).slice(0, 6));
    }, 180);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [mentionQuery, user?.id]);

  const detectMention = useCallback((value, caret) => {
    const before = value.slice(0, caret);
    const m = before.match(/(?:^|\s)@([^\s@]{0,30})$/u);
    setMentionQuery(m ? m[1] : null);
  }, []);

  const handleChange = (e) => {
    setText(e.target.value);
    detectMention(e.target.value, e.target.selectionStart ?? e.target.value.length);
  };

  const pickMention = (person) => {
    const el = inputRef.current;
    const caret = el?.selectionStart ?? text.length;
    const before = text.slice(0, caret);
    const atIndex = before.lastIndexOf('@');
    const next = `${text.slice(0, atIndex)}@${person.full_name} ${text.slice(caret)}`;
    setText(next);
    setMentions((prev) => (prev.some((m) => m.id === person.id) ? prev : [...prev, { id: person.id, name: person.full_name, email: person.email }]));
    setMentionQuery(null); setSuggestions([]);
    const pos = atIndex + person.full_name.length + 2;
    setTimeout(() => { el?.focus(); el?.setSelectionRange(pos, pos); }, 0);
  };

  // Reply: attaches to the top-level comment (one level of threading, like Instagram) and starts with @name
  const handleReply = (c) => {
    const name = c.author_name || '';
    if (!name) return;
    setReplyTo({ rootId: c.parent_id || c.id, authorId: c.user_id, name, commentId: c.id });
    setText(`@${name} `);
    setMentions(c.user_id && c.user_id !== user?.id ? [{ id: c.user_id, name }] : []);
    setTimeout(() => inputRef.current?.focus(), 50);
  };
  const cancelReply = () => { setReplyTo(null); setText(''); setMentions([]); };
  const toggleThread = (id) => setOpenThreads((prev) => {
    const next = new Set(prev);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });

  const openProfile = (id) => {
    onOpenChange?.(false);
    navigate(id === user?.id ? '/profile' : `/profile/${id}`);
  };

  // ── Like a comment (saved) ─────────────────────────────────────────────────
  const handleToggleLike = async (c) => {
    if (!user?.id) return;
    const wasLiked = !!c.likedByMe;
    const patch = (liked) => queryClient.setQueryData(['comments', post.id], (old = []) =>
      old.map((x) => (x.id === c.id ? { ...x, likedByMe: liked, likeCount: Math.max(0, (x.likeCount || 0) + (liked ? 1 : -1)) } : x)));
    patch(!wasLiked); // instant feedback
    setSendError('');
    try {
      let res;
      if (wasLiked) {
        res = await supabase.from('comment_likes').delete().eq('comment_id', c.id).eq('user_id', user.id);
      } else {
        res = await supabase.from('comment_likes').insert({ comment_id: c.id, user_id: user.id });
        if (res.error?.code === '23505') res = { error: null }; // already liked
      }
      if (res.error) throw res.error;
      if (!wasLiked) {
        const target = (comments.find((x) => x.id === c.id));
        if (target?.user_id && target.user_id !== user.id) {
          const { data: owner } = await supabase.from('profiles').select('email').eq('id', target.user_id).maybeSingle();
          notifyUser({
            toEmail: owner?.email,
            fromEmail: user.email,
            title: 'Someone liked your comment',
            message: `${user.full_name || user.email} liked your comment: ${String(target.content || '').slice(0, 60)}`,
            type: 'comment',
            link: `/post/${post.id}?comments=1`,
            icon: '\u2764\uFE0F',
          });
        }
      }
    } catch (err) {
      console.error('Comment like failed:', err);
      patch(wasLiked); // put it back
      setSendError('Could not save your like. Please try again.');
    }
  };

  const handleSend = async () => {
    const trimmed = text.trim();
    if (!trimmed || !post?.id || !user?.id || isSending) return;

    setIsSending(true);
    setSendError('');

    try {
      // Keep only people whose @name is still in the text
      const finalMentions = mentions.filter((m) => trimmed.includes(`@${m.name}`));
      const base = {
        post_id: post.id,
        content: trimmed,
        author_name: user.full_name || user.email,
        user_id: user.id,
      };
      const mentionsPayload = finalMentions.map(({ id, name }) => ({ id, name }));
      const attempts = [
        { ...base, mentions: mentionsPayload, ...(replyTo ? { parent_id: replyTo.rootId } : {}) },
        // columns not created yet (migration not run): still save the comment itself
        { ...base, mentions: mentionsPayload },
        base,
      ];
      let commentError = null;
      for (let i = 0; i < attempts.length; i += 1) {
        ({ error: commentError } = await supabase.from('comments').insert(attempts[i]));
        if (!commentError || !/parent_id|mentions|column/i.test(`${commentError.message} ${commentError.details || ''}`)) break;
      }
      if (commentError) throw commentError;

      const freshCount = await syncCommentsCount(post.id);

      // Work out who gets which notification (each person gets only one)
      const postLink = `/post/${post.id}?comments=1`;
      const me = user.full_name || user.email;
      const toNotify = new Map(); // email -> { title, message }
      const ids = [...new Set([...finalMentions.map((m) => m.id), replyTo?.authorId].filter(Boolean))];
      const emailById = {};
      if (ids.length) {
        const { data: people } = await supabase.from('profiles').select('id, email').in('id', ids);
        (people || []).forEach((p) => { if (p.email) emailById[p.id] = p.email; });
      }
      finalMentions.forEach((m) => {
        const email = emailById[m.id];
        if (email && email !== user.email) toNotify.set(email, { title: `${me} mentioned you`, message: trimmed.slice(0, 100) });
      });
      const replyEmail = replyTo?.authorId ? emailById[replyTo.authorId] : null;
      if (replyEmail && replyEmail !== user.email) {
        toNotify.set(replyEmail, { title: `${me} replied to your comment`, message: trimmed.slice(0, 100) });
      }
      const authorEmail = post.profiles?.email;
      if (authorEmail && authorEmail !== user.email && !toNotify.has(authorEmail)) {
        toNotify.set(authorEmail, { title: 'New comment on your post', message: `${me}: ${trimmed.slice(0, 80)}` });
      }
      toNotify.forEach(({ title, message }, toEmail) => {
        notifyUser({ toEmail, fromEmail: user.email, title, message, type: 'comment', link: postLink, icon: '\uD83D\uDCAC' });
      });

      if (replyTo) setOpenThreads((prev) => new Set(prev).add(replyTo.rootId)); // show the new reply
      setReplyTo(null);
      setText(''); setMentions([]); setMentionQuery(null);
      queryClient.invalidateQueries({ queryKey: ['comments', post.id] });
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
          {isLoading && <ListSkeleton rows={3} />}
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
          {comments.filter(c => !c.parent_id).map(root => {
            const replies = comments.filter(c => c.parent_id === root.id);
            const open = openThreads.has(root.id);
            return (
              <div key={root.id} className="space-y-3">
                <CommentItem c={root} onReply={handleReply} onToggleLike={handleToggleLike} onOpenProfile={openProfile} />
                {replies.length > 0 && (
                  <div className="ml-11 space-y-3 border-l-2 border-muted pl-3">
                    <button type="button" onClick={() => toggleThread(root.id)} className="text-xs font-semibold text-muted-foreground hover:text-foreground">
                      {open ? 'Hide replies' : `View ${replies.length} ${replies.length === 1 ? 'reply' : 'replies'}`}
                    </button>
                    {open && replies.map(r => (
                      <CommentItem key={r.id} c={r} onReply={handleReply} onToggleLike={handleToggleLike} onOpenProfile={openProfile} />
                    ))}
                  </div>
                )}
              </div>
            );
          })}
          {/* replies whose parent was deleted still show */}
          {comments.filter(c => c.parent_id && !comments.some(p => p.id === c.parent_id)).map(c => (
            <CommentItem key={c.id} c={c} onReply={handleReply} onToggleLike={handleToggleLike} onOpenProfile={openProfile} />
          ))}
          <div ref={bottomRef} />
        </div>

        <div className="relative px-4 py-3 border-t bg-card shrink-0">
          {/* @mention suggestions */}
          {mentionQuery !== null && suggestions.length > 0 && (
            <div className="absolute bottom-full left-4 right-4 mb-1 bg-popover border rounded-2xl shadow-lg overflow-hidden z-10">
              {suggestions.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => pickMention(p)}
                  className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-muted text-left"
                >
                  <Avatar className="w-8 h-8">
                    {p.avatar_url
                      ? <img src={p.avatar_url} alt="" className="w-full h-full object-cover rounded-full" />
                      : <AvatarFallback className="text-xs bg-primary/10 text-primary font-bold">{p.full_name[0]?.toUpperCase()}</AvatarFallback>}
                  </Avatar>
                  <span className="text-sm font-medium truncate">{p.full_name}</span>
                </button>
              ))}
            </div>
          )}
          {replyTo && (
            <div className="flex items-center justify-between gap-2 mb-2 px-3 py-1.5 rounded-full bg-muted text-xs text-muted-foreground">
              <span className="truncate">Replying to <span className="font-semibold text-foreground">{replyTo.name}</span></span>
              <button type="button" onClick={cancelReply} aria-label="Cancel reply" className="shrink-0 font-bold px-1">✕</button>
            </div>
          )}
          {sendError && (
            <p className="text-xs text-destructive mb-2 px-1">{sendError}</p>
          )}
          <div className="flex items-center gap-2">
            <Avatar className="w-9 h-9 shrink-0">
              {user?.avatar_url
                ? <img src={user.avatar_url} alt="" className="w-full h-full object-cover rounded-full" />
                : <AvatarFallback className="bg-primary/10 text-primary font-bold text-xs">{userInitials}</AvatarFallback>}
            </Avatar>
            <div className="flex-1 flex items-center bg-muted rounded-full px-4 py-2.5">
              <input
                ref={inputRef}
                type="text"
                placeholder="Write a comment... (type @ to mention)"
                value={text}
                onChange={handleChange}
                onClick={(e) => detectMention(e.target.value, e.target.selectionStart ?? 0)}
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
              {isSending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
