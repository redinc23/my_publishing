/* eslint-disable */
'use client';

import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { ProgressBar } from '@/components/shared/ProgressBar';

interface AudioPlayerProps {
  src: string;
  title?: string;
  className?: string;
}

export function AudioPlayer({ src, title, className }: AudioPlayerProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const audioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const updateTime = () => setCurrentTime(audio.currentTime);
    const updateDuration = () => setDuration(audio.duration);

    audio.addEventListener('timeupdate', updateTime);
    audio.addEventListener('loadedmetadata', updateDuration);

    return () => {
      audio.removeEventListener('timeupdate', updateTime);
      audio.removeEventListener('loadedmetadata', updateDuration);
    };
  }, []);

  const togglePlay = () => {
    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying) {
      audio.pause();
    } else {
      audio.play();
    }
    setIsPlaying(!isPlaying);
  };

  const handleProgressChange = (value: number) => {
    const audio = audioRef.current;
    if (!audio) return;

    audio.currentTime = (value / 100) * duration;
    setCurrentTime(audio.currentTime);
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div className={className}>
      <audio ref={audioRef} src={src} />
      {title && <h3 className="mb-4 font-semibold">{title}</h3>}
      <div className="space-y-4">
        <ProgressBar value={progress} showLabel={false} />
        <div className="flex items-center justify-between">
          <span className="text-sm text-secondary">{formatTime(currentTime)}</span>
          <Button onClick={togglePlay} variant="default" size="icon">
            {isPlaying ? '⏸' : '▶'}
          </Button>
          <span className="text-sm text-secondary">{formatTime(duration)}</span>
        </div>
      </div>
    </div>
  );
}
