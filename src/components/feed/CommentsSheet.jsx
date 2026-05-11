import { useState } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Send, Loader2 } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { formatDistanceToNow } from 'date-fns';

export default function CommentsSheet({ post, open, onOpenChange }) {
  const { user } = useAuth();
  const [text, setText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const queryClient = useQueryClient();

  const { data: comments = [], isLoading } = useQuery({
    queryKey: ['comments', post?.id],
    queryFn: () => base44.entities.Comment.filter({ post_id: post.id }, '-created_date'),
    enabled: !!post?.id,
  });

  const handleSend = async () => {
    if (!text.trim()) return;
    setIsSending(true);
    await base44.entities.Comment.create({
      post_id: post.id,
      content: text.trim(),
      author_name: user.full_name,
      author_email: user.email,
    });
    await base44.entities.Post.update(post.id, {
      comment_count: (post.comment_count || 0) + 1,
    });
    setText('');
    setIsSending(false);
    queryClient.invalidateQueries({ queryKey: ['comments', post.id] });
    queryClient.invalidateQueries({ queryKey: ['posts'] });
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="h-[70vh] rounded-t-3xl">
        <SheetHeader>
          <SheetTitle>Comments ({comments.length})</SheetTitle>
        </SheetHeader>
        <div className="flex-1 overflow-auto py-4 space-y-4 max-h-[calc(70vh-140px)]">
          {isLoading && (
            <div className="flex justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          )}
          {comments.map(c => (
            <div key={c.id} className="flex gap-3">
              <Avatar className="w-8 h-8">
                <AvatarFallback className="text-xs bg-primary/10 text-primary">
                  {c.author_name?.[0] || '?'}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <div className="bg-muted rounded-2xl px-3 py-2">
                  <p className="text-xs font-semibold">{c.author_name}</p>
                  <p className="text-sm">{c.content}</p>
                </div>
                <p className="text-[10px] text-muted-foreground mt-1 ml-3">
                  {formatDistanceToNow(new Date(c.created_date), { addSuffix: true })}
                </p>
              </div>
            </div>
          ))}
          {!isLoading && comments.length === 0 && (
            <p className="text-center text-sm text-muted-foreground py-8">No comments yet. Be the first!</p>
          )}
        </div>
        <div className="flex items-center gap-2 pt-2 border-t">
          <Input
            placeholder="Write a comment..."
            value={text}
            onChange={e => setText(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSend()}
            className="rounded-full"
          />
          <Button size="icon" className="rounded-full shrink-0" onClick={handleSend} disabled={!text.trim() || isSending}>
            {isSending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}