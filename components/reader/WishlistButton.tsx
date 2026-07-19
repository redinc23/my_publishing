'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Heart } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils/cn';

interface WishlistButtonProps {
  bookId: string;
  /**
   * Server-known initial state. When omitted the component probes
   * GET /api/wishlist?book_id=… on mount (401 → treated as signed out).
   */
  initialWishlisted?: boolean;
  /** 'full' renders icon + label; 'icon' renders a compact icon button. */
  variant?: 'full' | 'icon';
  className?: string;
}

export function WishlistButton({
  bookId,
  initialWishlisted,
  variant = 'full',
  className,
}: WishlistButtonProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [wishlisted, setWishlisted] = useState<boolean>(initialWishlisted ?? false);
  const [ready, setReady] = useState<boolean>(initialWishlisted !== undefined);
  const [pending, setPending] = useState(false);

  // Probe current state when the server didn't provide it.
  useEffect(() => {
    if (initialWishlisted !== undefined) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/wishlist?book_id=${encodeURIComponent(bookId)}`);
        if (!cancelled && res.ok) {
          const json = (await res.json()) as { wishlisted?: boolean };
          setWishlisted(!!json.wishlisted);
        }
      } catch {
        // Offline/probe failure — render the default (not wishlisted) state.
      } finally {
        if (!cancelled) setReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [bookId, initialWishlisted]);

  const redirectToSignIn = () => {
    const next = pathname && pathname !== '/' ? `?next=${encodeURIComponent(pathname)}` : '';
    router.push(`/login${next}`);
  };

  const toggle = async () => {
    if (pending) return;
    setPending(true);

    const previous = wishlisted;
    const nextState = !previous;
    setWishlisted(nextState); // optimistic

    try {
      const res = await fetch('/api/wishlist', {
        method: nextState ? 'POST' : 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ book_id: bookId }),
      });

      if (res.status === 401) {
        setWishlisted(previous);
        redirectToSignIn();
        return;
      }
      if (res.status === 503) {
        setWishlisted(previous);
        toast.info('Wishlist is coming soon.');
        return;
      }
      if (!res.ok) {
        setWishlisted(previous);
        const json = (await res.json().catch(() => null)) as { error?: string } | null;
        toast.error(json?.error || 'Could not update your wishlist.');
        return;
      }

      toast.success(nextState ? 'Added to your wishlist' : 'Removed from your wishlist');
    } catch {
      setWishlisted(previous);
      toast.error('Could not update your wishlist.');
    } finally {
      setPending(false);
    }
  };

  const label = wishlisted ? 'In Wishlist' : 'Add to Wishlist';

  if (variant === 'icon') {
    return (
      <Button
        type="button"
        variant="outline"
        size="icon"
        onClick={toggle}
        disabled={pending || !ready}
        aria-pressed={wishlisted}
        aria-label={label}
        title={label}
        className={className}
      >
        <Heart
          className={cn(
            'h-4 w-4 transition-colors',
            wishlisted ? 'fill-red-500 text-red-500' : 'text-muted-foreground'
          )}
        />
      </Button>
    );
  }

  return (
    <Button
      type="button"
      variant={wishlisted ? 'secondary' : 'outline'}
      onClick={toggle}
      disabled={pending || !ready}
      aria-pressed={wishlisted}
      className={className}
    >
      <Heart
        className={cn(
          'mr-2 h-4 w-4 transition-colors',
          wishlisted ? 'fill-red-500 text-red-500' : undefined
        )}
      />
      {label}
    </Button>
  );
}
