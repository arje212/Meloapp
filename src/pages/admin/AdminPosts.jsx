import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Eye, EyeOff, Trash2, Loader2 } from 'lucide-react';
import { format } from 'date-fns';

const statusColors = {
  active: 'bg-green-100 text-green-700',
  reported: 'bg-yellow-100 text-yellow-700',
  hidden: 'bg-muted text-muted-foreground',
  deleted: 'bg-red-100 text-red-700',
};

export default function AdminPosts() {
  const queryClient = useQueryClient();
  const { data: posts = [], isLoading } = useQuery({
    queryKey: ['admin-posts'],
    queryFn: () => base44.entities.Post.list('-created_date', 200),
  });

  const handleStatus = async (id, status) => {
    await base44.entities.Post.update(id, { status });
    queryClient.invalidateQueries({ queryKey: ['admin-posts'] });
  };

  if (isLoading) return <div className="flex justify-center py-16"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;

  return (
    <div>
      <h2 className="font-display text-2xl font-bold mb-6">Posts ({posts.length})</h2>
      <div className="bg-card border rounded-xl overflow-hidden overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Content</TableHead>
              <TableHead>Author</TableHead>
              <TableHead>Likes</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {posts.map(p => (
              <TableRow key={p.id}>
                <TableCell className="max-w-xs truncate text-sm">{p.content}</TableCell>
                <TableCell className="text-sm">{p.author_name}</TableCell>
                <TableCell>{p.like_count || 0}</TableCell>
                <TableCell><Badge className={statusColors[p.status] || ''}>{p.status}</Badge></TableCell>
                <TableCell className="text-sm">{format(new Date(p.created_date), 'MMM d')}</TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    {p.status === 'active' && (
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleStatus(p.id, 'hidden')}>
                        <EyeOff className="w-3.5 h-3.5" />
                      </Button>
                    )}
                    {p.status === 'hidden' && (
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleStatus(p.id, 'active')}>
                        <Eye className="w-3.5 h-3.5" />
                      </Button>
                    )}
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => handleStatus(p.id, 'deleted')}>
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}