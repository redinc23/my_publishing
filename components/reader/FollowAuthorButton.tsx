'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { UserPlus, UserCheck } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils/cn';

interface FollowAuthorButtonProps {
  authorId: string;
  /** Server-known initial state; omit to probe GET /api/follows?author_id=… */
  initialFollowing?: boolean;
  initialFollowers?: number | null;
  showCount?: boolean;
  className?: string;
}

export function FollowAuthorButton({
  authorId,
  initialFollowing,
  initialFollowers = null,
  showCount = true,
  className,
}: FollowAuthorButtonProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [following, setFollowing] = useState<boolean>(initialFollowing ?? false);
  const [followers, setFollowers] = useState<number | null>(initialFollowers);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (initialFollowing !== undefined) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/follows?author_id=${encodeURIComponent(authorId)}`);
        if (!cancelled && res.ok) {
          const json = (await res.json()) as { following?: boolean; followers?: number | null };
          setFollowing(!!json.following);
          if (typeof json.followers === 'number') setFollowers(json.followers);
        }
      } catch {
        // Probe failure — render default state.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [authorId, initialFollowing]);

  const redirectToSignIn = () => {
    const next = pathname && pathname !== '/' ? `?next=${encodeURIComponent(pathname)}` : '';
    router.push(`/login${next}`);
  };

  const toggle = async () => {
    if (pending) return;
    setPending(true);

    const previousFollowing = following;
    const previousFollowers = followers;
    const nextState = !previousFollowing;

    setFollowing(nextState); // optimistic
    setFollowers((current) =>
      typeof current === 'number' ? Math.max(0, current + (nextState ? 1 : -1)) : current
    );

    try {
      const res = await fetch('/api/follows', {
        method: nextState ? 'POST' : 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ author_id: authorId }),
      });

      if (res.status === 401) {
        setFollowing(previousFollowing);
        setFollowers(previousFollowers);
        redirectToSignIn();
        return;
      }
      if (res.status === 503) {
        setFollowing(previousFollowing);
        setFollowers(previousFollowers);
        toast.info('Author follows are coming soon.');
        return;
      }
      if (!res.ok) {
        setFollowing(previousFollowing);
        setFollowers(previousFollowers);
        const json = (await res.json().catch(() => null)) as { error?: string } | null;
        toast.error(json?.error || 'Could not update follow.');
        return;
      }

      const json = (await res.json().catch(() => null)) as { followers?: number | null } | null;
      if (json && typeof json.followers === 'number') setFollowers(json.followers);
      toast.success(nextState ? 'Following author' : 'Unfollowed author');
    } catch {
      setFollowing(previousFollowing);
      setFollowers(previousFollowers);
      toast.error('Could not update follow.');
    } finally {
      setPending(false);
    }
  };

  return (
    <span className={cn('inline-flex items-center gap-2', className)}>
      <Button
        type="button"
        variant={following ? 'secondary' : 'default'}
        onClick={toggle}
        disabled={pending}
        aria-pressed={following}
      >
        {following ? (
          <>
            <UserCheck className="mr-2 h-4 w-4" />
            Following
          </>
        ) : (
          <>
            <UserPlus className="mr-2 h-4 w-4" />
            Follow
          </>
        )}
      </Button>
      {showCount && typeof followers === 'number' && (
        <span className="text-sm text-muted-foreground">
          {followers.toLocaleString()} {followers === 1 ? 'follower' : 'followers'}
        </span>
      )}
    </span>
  );
}
