export interface UploadProgressEvent {
  loaded: number;
  total: number;
  progress: number;
  speed: number; // bytes per second
  timeRemaining: number; // seconds
  stage: 'uploading' | 'processing' | 'completed' | 'error';
}

export interface UploadResult {
  filePath: string;
  publicUrl: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  hash: string; // For deduplication
  dimensions?: {
    width: number;
    height: number;
  };
  duration?: number; // For audio/video
  thumbnailUrl?: string; // Generated thumbnail
  metadata: Record<string, any>;
}

export interface FileValidationError {
  code: string;
  message: string;
  field?: string;
}

export interface FileUploadConfig {
  accept: Record<string, string[]>;
  maxSize: number;
  maxFiles?: number;
  bucket: 'book-covers' | 'manuscripts' | 'published-epubs' | 'audiobooks';
  autoProcess?: boolean;
  generateThumbnails?: boolean;
  virusScan?: boolean;
  compression?: {
    enabled: boolean;
    quality?: number;
    maxWidth?: number;
    maxHeight?: number;
  };
}

export interface UploadOptions {
  onProgress?: (event: UploadProgressEvent) => void;
  onError?: (error: Error) => void;
  onSuccess?: (result: UploadResult) => void;
  metadata?: Record<string, any>;
  overwrite?: boolean;
  chunkSize?: number; // For resumable uploads
}

export const UPLOAD_CONFIGS: Record<string, FileUploadConfig> = {
  cover: {
    accept: {
      'image/*': ['.png', '.jpg', '.jpeg', '.webp', '.gif', '.avif']
    },
    maxSize: 10 * 1024 * 1024, // 10MB
    maxFiles: 1,
    bucket: 'book-covers',
    autoProcess: true,
    generateThumbnails: true,
    compression: {
      enabled: true,
      quality: 85,
      maxWidth: 2000,
      maxHeight: 2000
    }
  },
  manuscript: {
    accept: {
      'application/*': ['.pdf', '.doc', '.docx', '.txt', '.rtf', '.odt', '.md']
    },
    maxSize: 100 * 1024 * 1024, // 100MB
    bucket: 'manuscripts',
    virusScan: true,
    autoProcess: false
  },
  epub: {
    accept: {
      'application/epub+zip': ['.epub'],
      'application/x-fictionbook+xml': ['.fb2']
    },
    maxSize: 50 * 1024 * 1024, // 50MB
    maxFiles: 1,
    bucket: 'published-epubs',
    virusScan: true,
    autoProcess: true
  },
  audio: {
    accept: {
      'audio/*': ['.mp3', '.m4a', '.wav', '.ogg', '.flac']
    },
    maxSize: 200 * 1024 * 1024, // 200MB
    bucket: 'audiobooks',
    compression: {
      enabled: true,
      quality: 90
    }
  }
} as const;

// Upload validation functions
export const validateFile = (
  file: File, 
  config: FileUploadConfig
): FileValidationError | null => {
  if (file.size > config.maxSize) {
    return {
      code: 'FILE_TOO_LARGE',
      message: `File exceeds maximum size of ${config.maxSize / 1024 / 1024}MB`
    };
  }

  const extension = '.' + file.name.split('.').pop()?.toLowerCase();
  const mimeType = file.type;

  // Check MIME type
  let isValid = false;
  for (const [acceptedMime, acceptedExtensions] of Object.entries(config.accept)) {
    if (acceptedMime.endsWith('/*')) {
      const baseMime = acceptedMime.split('/')[0];
      if (mimeType.startsWith(baseMime + '/')) {
        isValid = true;
        break;
      }
    } else if (acceptedMime === mimeType) {
      isValid = true;
      break;
    }
  }

  if (!isValid) {
    return {
      code: 'INVALID_FILE_TYPE',
      message: `File type not supported. Accepted types: ${Object.values(config.accept).flat().join(', ')}`
    };
  }

  return null;
};

// Upload manager interface
export interface UploadManager {
  upload: (file: File, options?: UploadOptions) => Promise<UploadResult>;
  cancel: (uploadId: string) => void;
  resume: (uploadId: string) => Promise<UploadResult>;
  getProgress: (uploadId: string) => UploadProgressEvent | null;
}
