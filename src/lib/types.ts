// Tipe data untuk sistem Drovio

export type PlatformType =
  | 'youtube'
  | 'tiktok'
  | 'instagram'
  | 'twitter'
  | 'facebook'
  | 'reddit'
  | 'pinterest'
  | 'soundcloud'
  | 'generic';

export interface QualityOption {
  id: string;
  label: string;
  resolution?: string;
  format: 'mp4' | 'mp3';
  type: 'video' | 'audio';
  description?: string;
  sizeFormatted?: string;
}

export interface SubtitleOption {
  code: string;
  name: string;
}

export interface MediaPreview {
  id: string;
  url: string;
  directStreamUrl?: string;
  title: string;
  platform: PlatformType;
  platformName: string;
  uploader?: string;
  duration?: number; // detik
  durationFormatted?: string;
  thumbnail?: string;
  description?: string;
  videoQualities: QualityOption[];
  audioQualities: QualityOption[];
  subtitles?: SubtitleOption[];
}

export type JobStatus =
  | 'pending'
  | 'downloading'
  | 'processing'
  | 'completed'
  | 'failed'
  | 'cancelled';

export interface DownloadRequest {
  url: string;
  type: 'video' | 'audio';
  qualityId: string;
  trimStart?: string; // misal "00:01:15"
  trimEnd?: string; // misal "00:03:45"
  subtitleLang?: string; // misal "id", "en", "none"
}

export interface Job {
  id: string;
  url: string;
  title: string;
  platform: PlatformType;
  platformName: string;
  thumbnail?: string;
  type: 'video' | 'audio';
  qualityId: string;
  qualityLabel: string;
  trimStart?: string;
  trimEnd?: string;
  trimRange?: string;
  subtitleLang?: string;
  status: JobStatus;
  progress: number; // 0 - 100
  downloadedBytes?: number;
  totalBytes?: number;
  downloadedFormatted?: string;
  totalFormatted?: string;
  speed?: string;
  eta?: string;
  outputFilename?: string;
  outputFilepath?: string;
  outputSize?: number;
  outputSizeFormatted?: string;
  errorMessage?: string;
  createdAt: number;
  completedAt?: number;
  fileExists?: boolean;
}

export interface SystemHealth {
  ytdlp: {
    available: boolean;
    path: string;
    version?: string;
    error?: string;
  };
  ffmpeg: {
    available: boolean;
    path: string;
    version?: string;
    error?: string;
  };
  downloadDir: {
    path: string;
    writable: boolean;
  };
  operatingSystem: string;
}
