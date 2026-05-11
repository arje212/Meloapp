import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Ban, CheckCircle, Loader2 } from 'lucide-react';
import { format } from 'date-fns';

export default function AdminUsers() {
  const queryClient = useQueryClient();
  const { data: users = [], isLoading } = useQuery({
    queryKey: ['admin-users'],
    queryFn: () => base44.entities.User.list('-created_date'),
  });

  const handleBlock = async (user) => {
    await base44.entities.User.update(user.id, { is_blocked: !user.is_blocked });
    queryClient.invalidateQueries({ queryKey: ['admin-users'] });
  };

  const handleRoleChange = async (userId, role) => {
    await base44.entities.User.update(userId, { role });
    queryClient.invalidateQueries({ queryKey: ['admin-users'] });
  };

  if (isLoading) return <div className="flex justify-center py-16"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;

  return (
    <div>
      <h2 className="font-display text-2xl font-bold mb-6">Manage Users ({users.length})</h2>
      <div className="bg-card border rounded-xl overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Joined</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map(u => (
              <TableRow key={u.id}>
                <TableCell className="font-medium">{u.full_name || '-'}</TableCell>
                <TableCell className="text-sm">{u.email}</TableCell>
                <TableCell>
                  <Select value={u.role || 'user'} onValueChange={v => handleRoleChange(u.id, v)}>
                    <SelectTrigger className="w-28 h-8">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="admin">Admin</SelectItem>
                      <SelectItem value="user">User</SelectItem>
                      <SelectItem value="agency">Agency</SelectItem>
                    </SelectContent>
                  </Select>
                </TableCell>
                <TableCell>
                  <Badge variant="outline" className={u.is_blocked ? 'text-red-600 border-red-200' : 'text-green-600 border-green-200'}>
                    {u.is_blocked ? 'Blocked' : 'Active'}
                  </Badge>
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {u.created_date ? format(new Date(u.created_date), 'MMM d, yyyy') : '-'}
                </TableCell>
                <TableCell>
                  <Button
                    variant={u.is_blocked ? 'outline' : 'destructive'}
                    size="sm"
                    onClick={() => handleBlock(u)}
                    className="h-7 text-xs"
                  >
                    {u.is_blocked ? <><CheckCircle className="w-3 h-3 mr-1" /> Unblock</> : <><Ban className="w-3 h-3 mr-1" /> Block</>}
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}