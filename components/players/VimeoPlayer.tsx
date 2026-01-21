/* eslint-disable */
'use client';

import { useEffect, useRef } from 'react';

interface VimeoPlayerProps {
  videoId: string;
  autoplay?: boolean;
  loop?: boolean;
  muted?: boolean;
  className?: string;
}

export function VimeoPlayer({
  videoId,
  autoplay = false,
  loop = false,
  muted = false,
  className,
}: VimeoPlayerProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    // Load Vimeo Player API
    const script = document.createElement('script');
    script.src = 'https://player.vimeo.com/api/player.js';
    script.async = true;
    document.body.appendChild(script);

    script.onload = () => {
      // @ts-ignore - Vimeo Player API
      const Player = window.Vimeo?.Player;
      if (Player && containerRef.current) {
        const player = new Player(containerRef.current, {
          id: videoId,
          autoplay,
          loop,
          muted,
          background: true,
        });
      }
    };

    return () => {
      if (script.parentNode) {
        script.parentNode.removeChild(script);
      }
    };
  }, [videoId, autoplay, loop, muted]);

  return (
    <div
      ref={containerRef}
      className={className}
      data-vimeo-id={videoId}
      data-vimeo-autoplay={autoplay}
      data-vimeo-loop={loop}
      data-vimeo-muted={muted}
    />
  );
}
