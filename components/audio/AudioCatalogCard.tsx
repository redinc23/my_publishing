'use client';

/**
 * AudioCatalogCard — audiobook tile for the /audio rail.
 *
 * Cover art with hover play overlay (streams instantly via the shared engine
 * or the preview singleton), title/author, and audiobook meta (duration,
 * narrator) when available.
 */

import Link from 'next/link';
import Image from 'next/image';
import { Clock, Headphones, Mic } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { SamplePlayButton } from './SamplePlayButton';
import { formatDurationLong } from './format';

export interface AudioCatalogCardProps {
  id: string;
  title: string;
  author: string;
  coverUrl?: string;
  audioUrl: string;
  narrator?: string;
  durationSec?: number;
}

export function AudioCatalogCard({
  id,
  title,
  author,
  coverUrl,
  audioUrl,
  narrator,
  durationSec,
}: AudioCatalogCardProps) {
  const durationLabel = durationSec ? formatDurationLong(durationSec) : '';

  return (
    <Card className="group overflow-hidden transition-all duration-300 hover:shadow-xl hover:shadow-primary/5">
      <div className="relative aspect-[2/3] overflow-hidden bg-muted">
        <Link href={`/audio/${id}`} aria-label={`Open ${title} player`} tabIndex={-1}>
          {coverUrl ? (
            <Image
              src={coverUrl}
              alt={`Cover of ${title}`}
              fill
              className="object-cover transition-transform duration-300 group-hover:scale-105"
              sizes="(max-width: 768px) 50vw, (max-width: 1200px) 33vw, 16vw"
            />
          ) : (
            <div className="flex h-full items-center justify-center">
              <Headphones className="h-12 w-12 text-muted-foreground" />
            </div>
          )}
        </Link>
        <div className="absolute inset-x-0 bottom-0 flex justify-center bg-gradient-to-t from-black/70 to-transparent p-3 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
          <SamplePlayButton
            src={audioUrl}
            title={title}
            author={author}
            narrator={narrator}
            coverUrl={coverUrl}
            bookId={id}
          />
        </div>
      </div>
      <CardContent className="p-4">
        <h3 className="mb-1 line-clamp-1 font-semibold">
          <Link href={`/audio/${id}`} className="transition-colors hover:text-primary">
            {title}
          </Link>
        </h3>
        <p className="mb-2 line-clamp-1 text-sm text-muted-foreground">{author}</p>
        {(durationLabel || narrator) && (
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-secondary">
            {durationLabel && (
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {durationLabel}
              </span>
            )}
            {narrator && (
              <span className="flex min-w-0 items-center gap-1">
                <Mic className="h-3 w-3 shrink-0" />
                <span className="truncate">{narrator}</span>
              </span>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
