'use client';

import { VimeoPlayer } from './VimeoPlayer';

interface VideoHeroProps {
  vimeoId: string | null;
  fallbackImage?: string;
  title?: string;
}

export function VideoHero({ vimeoId, fallbackImage, title }: VideoHeroProps) {
  if (vimeoId) {
    return (
      <div className="absolute inset-0 z-0">
        <VimeoPlayer videoId={vimeoId} autoplay loop muted />
      </div>
    );
  }

  return (
    <div className="absolute inset-0 z-0 bg-gradient-to-b from-background via-muted to-background">
      {fallbackImage && (
        <div
          className="absolute inset-0 bg-cover bg-center opacity-20"
          style={{ backgroundImage: `url(${fallbackImage})` }}
        />
      )}
      {title && (
        <div className="absolute inset-0 flex items-center justify-center">
          <h1 className="text-5xl font-bold text-center px-4">{title}</h1>
        </div>
      )}
    </div>
  );
}
