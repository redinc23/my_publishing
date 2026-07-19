/* eslint-disable */
'use client';

import { useCallback, useId, useRef, useState } from 'react';
import { useDropzone, type FileRejection } from 'react-dropzone';
import { BookOpen, FileUp, Loader2, RefreshCw, UploadCloud, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils/cn';
import { UPLOAD_CONFIGS } from '@/types/upload';

export interface UploadedAsset {
  url: string;
  filePath: string;
  hash: string;
  deduplicated?: boolean;
}

type AssetKind = 'cover' | 'epub';

interface FileUploadProps {
  /** Legacy mode: caller performs the upload and resolves with the file URL. */
  onUpload?: (file: File) => Promise<string>;
  /** Asset mode: POSTs to /api/upload/book-assets with real upload progress. */
  asset?: AssetKind;
  /** Asset mode: called with the stored asset once the upload succeeds. */
  onUploaded?: (result: UploadedAsset) => void;
  /** Called when the user removes the current/existing file. */
  onRemove?: () => void;
  /** Existing persisted URL (edit forms) shown as the current value. */
  value?: string | null;
  /** Display label for the existing file chip when only a URL is known. */
  valueLabel?: string;
  accept?: Record<string, string[]>;
  maxSize?: number;
  className?: string;
  /** Dev-sandbox hook: replaces the network upload entirely (no requests made). */
  mockUpload?: (file: File, onProgress: (percent: number) => void) => Promise<UploadedAsset>;
}

type UploadState = 'idle' | 'uploading' | 'success' | 'error';

interface CurrentFile {
  url: string;
  name: string;
  size?: number;
  isImage: boolean;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatMb(bytes: number): string {
  return (bytes / (1024 * 1024)).toFixed(1).replace(/\.0$/, '');
}

/** Human-readable accepted-type label, e.g. "JPG, JPEG, PNG, WEBP". */
function describeAccept(accept?: Record<string, string[]>): string {
  const extensions = accept ? Object.values(accept).flat() : [];
  if (!extensions.length) return 'Supported files';
  return extensions.map((ext) => ext.replace(/^\./, '').toUpperCase()).join(', ');
}

export function FileUpload({
  onUpload,
  asset,
  onUploaded,
  onRemove,
  value,
  valueLabel,
  accept,
  maxSize,
  className,
  mockUpload,
}: FileUploadProps) {
  const config = asset ? UPLOAD_CONFIGS[asset] : undefined;
  const effectiveAccept = accept ?? config?.accept;
  const effectiveMaxSize = maxSize ?? config?.maxSize ?? 50 * 1024 * 1024;
  const typeLabel =
    asset === 'cover'
      ? 'JPG, PNG, WebP or GIF'
      : asset === 'epub'
        ? 'EPUB (.epub)'
        : describeAccept(effectiveAccept);
  const noun = asset === 'cover' ? 'cover image' : asset === 'epub' ? 'EPUB file' : 'file';

  const [state, setState] = useState<UploadState>('idle');
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [current, setCurrent] = useState<CurrentFile | null>(null);
  const [lastFile, setLastFile] = useState<File | null>(null);
  // Lets "Remove" hide an existing `value` even if the parent keeps passing it.
  const [clearedValue, setClearedValue] = useState<string | null>(null);

  const xhrRef = useRef<XMLHttpRequest | null>(null);
  const mockCancelledRef = useRef(false);
  const hintId = useId();

  const finishSuccess = useCallback(
    (file: File, url: string, assetResult?: UploadedAsset) => {
      setProgress(100);
      setCurrent({
        url,
        name: file.name,
        size: file.size,
        isImage: asset === 'cover' || file.type.startsWith('image/'),
      });
      setState('success');
      setError(null);
      if (assetResult) onUploaded?.(assetResult);
    },
    [asset, onUploaded]
  );

  const failUpload = useCallback((message: string) => {
    setState('error');
    setError(message);
    setProgress(0);
  }, []);

  const startUpload = useCallback(
    (file: File) => {
      setLastFile(file);
      setState('uploading');
      setProgress(0);
      setError(null);

      // Dev sandbox: simulated upload, no network involved.
      if (mockUpload) {
        mockCancelledRef.current = false;
        mockUpload(file, (percent) => {
          if (!mockCancelledRef.current) setProgress(percent);
        })
          .then((result) => {
            if (mockCancelledRef.current) return;
            finishSuccess(file, result.url, result);
          })
          .catch((err: unknown) => {
            if (mockCancelledRef.current) return;
            failUpload(err instanceof Error ? err.message : 'Upload failed — please try again');
          });
        return;
      }

      // Asset mode: real multipart upload with XHR progress events.
      if (asset) {
        const formData = new FormData();
        formData.append('asset', asset);
        formData.append('file', file);

        const xhr = new XMLHttpRequest();
        xhrRef.current = xhr;
        xhr.open('POST', '/api/upload/book-assets');
        xhr.responseType = 'json';

        xhr.upload.onprogress = (event) => {
          if (event.lengthComputable) {
            // Cap at 99% — the bar only completes once the server confirms.
            setProgress(Math.min(99, Math.round((event.loaded / event.total) * 100)));
          }
        };
        xhr.onload = () => {
          xhrRef.current = null;
          const body = xhr.response as (Partial<UploadedAsset> & { error?: string }) | null;
          if (xhr.status >= 200 && xhr.status < 300 && body?.url && body.filePath && body.hash) {
            finishSuccess(file, body.url, {
              url: body.url,
              filePath: body.filePath,
              hash: body.hash,
              deduplicated: body.deduplicated,
            });
          } else {
            failUpload(body?.error || 'Upload failed — please try again');
          }
        };
        xhr.onerror = () => {
          xhrRef.current = null;
          failUpload('Network error — check your connection and try again');
        };
        xhr.onabort = () => {
          xhrRef.current = null;
          setState('idle');
          setProgress(0);
        };
        xhr.send(formData);
        return;
      }

      // Legacy mode: the caller owns the upload; no fake percentage.
      if (onUpload) {
        onUpload(file)
          .then((url) => finishSuccess(file, url))
          .catch((err: unknown) =>
            failUpload(err instanceof Error ? err.message : 'Upload failed — please try again')
          );
        return;
      }

      failUpload('Upload is not configured');
    },
    [asset, mockUpload, onUpload, finishSuccess, failUpload]
  );

  const onDropAccepted = useCallback(
    (acceptedFiles: File[]) => {
      const file = acceptedFiles[0];
      if (file) startUpload(file);
    },
    [startUpload]
  );

  const onDropRejected = useCallback(
    (rejections: FileRejection[]) => {
      const rejection = rejections[0];
      if (!rejection) return;
      const issue = rejection.errors[0];
      if (issue?.code === 'file-too-large') {
        setError(
          `Max ${formatMb(effectiveMaxSize)}MB — your file is ${formatMb(rejection.file.size)}MB`
        );
      } else if (issue?.code === 'file-invalid-type') {
        setError(`${typeLabel} only`);
      } else if (issue?.code === 'too-many-files') {
        setError('One file at a time, please');
      } else {
        setError(issue?.message || 'That file cannot be uploaded');
      }
      setState('error');
    },
    [effectiveMaxSize, typeLabel]
  );

  const uploading = state === 'uploading';

  const { getRootProps, getInputProps, isDragActive, isDragReject, open } = useDropzone({
    onDropAccepted,
    onDropRejected,
    accept: effectiveAccept,
    maxSize: effectiveMaxSize,
    multiple: false,
    maxFiles: 1,
    disabled: uploading,
    noClick: uploading,
    noKeyboard: uploading,
  });

  const cancelUpload = () => {
    mockCancelledRef.current = true;
    xhrRef.current?.abort();
    xhrRef.current = null;
    setState('idle');
    setProgress(0);
  };

  const handleRemove = () => {
    if (!current && value) setClearedValue(value);
    setCurrent(null);
    setState('idle');
    setProgress(0);
    setError(null);
    onRemove?.();
  };

  const retry = () => {
    if (lastFile) startUpload(lastFile);
  };

  const showExisting = !current && !!value && value !== clearedValue && !uploading;
  const existingIsImage = asset ? asset === 'cover' : true;

  return (
    <div className={cn('space-y-3', className)}>
      {error && (
        <div
          role="alert"
          className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-red-500 bg-red-500/10 p-3 text-sm text-red-500"
        >
          <span>{error}</span>
          {lastFile && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={retry}
              className="border-red-500/50 text-red-500 hover:bg-red-500/10"
            >
              <RefreshCw className="mr-2 h-3.5 w-3.5" aria-hidden="true" />
              Try again
            </Button>
          )}
        </div>
      )}

      {uploading ? (
        <div className="space-y-2 rounded-lg border border-border p-4">
          <div className="flex items-center justify-between gap-2">
            <p className="flex min-w-0 items-center gap-2 text-sm text-foreground/80">
              <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden="true" />
              <span className="truncate">
                Uploading {lastFile?.name ?? noun}
                {!asset && !mockUpload ? '…' : ''}
              </span>
            </p>
            <Button type="button" variant="ghost" size="sm" onClick={cancelUpload}>
              <X className="mr-1 h-4 w-4" aria-hidden="true" />
              Cancel
            </Button>
          </div>
          {asset || mockUpload ? (
            <>
              <Progress value={progress} aria-label={`Upload progress: ${progress}%`} />
              <p className="text-center text-sm text-foreground/80">{progress}%</p>
            </>
          ) : (
            <p className="text-xs text-muted-foreground">
              This can take a moment for large files — please keep this page open.
            </p>
          )}
        </div>
      ) : current || showExisting ? (
        <div className="flex items-start gap-4 rounded-lg border border-border p-4">
          {(current?.isImage ?? existingIsImage) ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={current?.url ?? value ?? ''}
              alt={`${noun} preview`}
              className="aspect-[2/3] max-h-40 w-auto rounded-md border border-border object-cover"
            />
          ) : (
            <div className="flex min-w-0 items-center gap-3 rounded-md border border-border bg-secondary/40 px-3 py-2">
              <BookOpen className="h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">
                  {current?.name ?? valueLabel ?? 'Current EPUB file'}
                </p>
                {typeof current?.size === 'number' && (
                  <p className="text-xs text-muted-foreground">{formatBytes(current.size)}</p>
                )}
              </div>
            </div>
          )}
          <div className="min-w-0 flex-1 space-y-2">
            {(current?.isImage ?? existingIsImage) && (
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">
                  {current?.name ?? valueLabel ?? 'Current cover image'}
                </p>
                {typeof current?.size === 'number' && (
                  <p className="text-xs text-muted-foreground">{formatBytes(current.size)}</p>
                )}
              </div>
            )}
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" size="sm" onClick={() => open()}>
                <FileUp className="mr-2 h-3.5 w-3.5" aria-hidden="true" />
                Replace
              </Button>
              <Button type="button" variant="ghost" size="sm" onClick={handleRemove}>
                <X className="mr-1 h-3.5 w-3.5" aria-hidden="true" />
                Remove
              </Button>
            </div>
          </div>
          {/* Hidden input kept mounted so Replace can open the picker via open(). */}
          <input {...getInputProps()} aria-hidden="true" />
        </div>
      ) : (
        <div
          {...getRootProps({
            role: 'button',
            tabIndex: 0,
            'aria-label': `Upload ${noun} — drag and drop, or press Enter to browse`,
            'aria-describedby': hintId,
            className: cn(
              'cursor-pointer rounded-lg border-2 border-dashed p-8 text-center transition-colors',
              'border-border hover:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
              isDragActive && !isDragReject && 'border-primary bg-primary/5',
              isDragReject && 'border-red-500 bg-red-500/5'
            ),
          })}
        >
          <input {...getInputProps()} />
          <div className="space-y-2">
            <UploadCloud
              className={cn(
                'mx-auto h-8 w-8 transition-colors',
                isDragActive ? 'text-primary' : 'text-muted-foreground'
              )}
              aria-hidden="true"
            />
            <p className="text-sm text-foreground/80">
              {isDragActive
                ? `Drop your ${noun} here`
                : `Drag & drop your ${noun} here, or click to browse`}
            </p>
            <p id={hintId} className="text-xs text-muted-foreground">
              {typeLabel} · Max {formatMb(effectiveMaxSize)}MB
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
