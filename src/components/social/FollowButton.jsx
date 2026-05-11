import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { Button } from '@/components/ui/button';
import { UserPlus, UserCheck } from 'lucide-react';
import { unlockAchievement } from '@/lib/achievements';

export default function FollowButton({ targetEmail, targetName }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [loading, setLoading] = useState(false);

  const { data: followRecords = [] } = useQuery({
    queryKey: ['follow-check', user?.email, targetEmail],
    queryFn: () => base44.entities.Follow.filter({ follower_email: user.email, following_email: targetEmail }),
    enabled: !!user?.email && !!targetEmail && user?.email !== targetEmail,
  });

  if (!user || user.email === targetEmail) return null;

  const isFollowing = followRecords.length > 0;

  const handleToggle = async () => {
    setLoading(true);
    if (isFollowing) {
      await base44.entities.Follow.delete(followRecords[0].id);
    } else {
      await base44.entities.Follow.create({
        follower_email: user.email,
        follower_name: user.full_name,
        following_email: targetEmail,
        following_name: targetName,
      });
      unlockAchievement(user.email, user.full_name, 'follow_hiker');
    }
    qc.invalidateQueries({ queryKey: ['follow-check', user?.email, targetEmail] });
    qc.invalidateQueries({ queryKey: ['following', user?.email] });
    setLoading(false);
  };

  return (
    <Button
      variant={isFollowing ? 'secondary' : 'outline'}
      size="sm"
      className="rounded-full h-7 text-xs px-3 shrink-0"
      onClick={handleToggle}
      disabled={loading}
    >
      {isFollowing ? <UserCheck className="w-3 h-3 mr-1" /> : <UserPlus className="w-3 h-3 mr-1" />}
      {isFollowing ? 'Following' : 'Follow'}
    </Button>
  );
}