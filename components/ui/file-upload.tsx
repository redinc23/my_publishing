/* eslint-disable */
'use client';

import { useCallback, useState } from 'react';
// Note: react-dropzone needs to be installed
// For now, using a simple file input
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils/cn';

interface FileUploadProps {
  onUpload: (file: File) => Promise<string>;
  accept?: Record<string, string[]>;
  maxSize?: number;
  className?: string;
}

export function FileUpload({ onUpload, accept, maxSize = 50 * 1024 * 1024, className }: FileUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const onDrop = useCallback(
    async (acceptedFiles: File[]) => {
      const file = acceptedFiles[0];
      if (!file) return;

      if (file.size > maxSize) {
        setError(`File size exceeds ${maxSize / 1024 / 1024}MB limit`);
        return;
      }

      setUploading(true);
      setProgress(0);
      setError(null);

      try {
        // Simulate progress
        const interval = setInterval(() => {
          setProgress((prev) => {
            if (prev >= 90) {
              clearInterval(interval);
              return 90;
            }
            return prev + 10;
          });
        }, 200);

        await onUpload(file);
        setProgress(100);
        clearInterval(interval);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Upload failed');
        setProgress(0);
      } finally {
        setUploading(false);
      }
    },
    [onUpload, maxSize]
  );

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onDrop([file]);
    }
  };

  return (
    <div className={cn('space-y-4', className)}>
      <div
        className={cn(
          'border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors',
          'border-border hover:border-primary',
          uploading && 'opacity-50 cursor-not-allowed'
        )}
      >
        <input
          type="file"
          onChange={handleFileSelect}
          accept={accept ? Object.keys(accept).join(',') : undefined}
          disabled={uploading}
          className="hidden"
          id="file-upload"
        />
        <label htmlFor="file-upload" className="cursor-pointer">
          <div className="space-y-2">
            <p className="text-sm text-secondary">
              Drag & drop file here, or click to select
            </p>
            <p className="text-xs text-muted-foreground">
              Max size: {maxSize / 1024 / 1024}MB
            </p>
          </div>
        </label>
      </div>

      {uploading && (
        <div className="space-y-2">
          <Progress value={progress} />
          <p className="text-sm text-secondary text-center">{progress}%</p>
        </div>
      )}

      {error && (
        <div className="rounded-md bg-red-500/10 border border-red-500 p-3 text-sm text-red-500">
          {error}
        </div>
      )}
    </div>
  );
}
