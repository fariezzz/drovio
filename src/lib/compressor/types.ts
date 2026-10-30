// Tipe data untuk modul kompresi berbagai jenis file

export type FileCategory = 'image' | 'pdf' | 'video' | 'audio' | 'generic';

export type CompressionLevel = 'low' | 'medium' | 'high';

export interface ImageCompressionOptions {
  level: CompressionLevel;
  format?: 'original' | 'webp' | 'jpeg' | 'png';
  resizePercent?: number; // 100, 75, 50
  stripMetadata?: boolean;
}

export interface PdfCompressionOptions {
  level: CompressionLevel;
  stripMetadata?: boolean;
  compressImages?: boolean;
}

export interface VideoCompressionOptions {
  level: CompressionLevel;
  targetResolution?: 'original' | '1080p' | '720p' | '480p';
  audioBitrate?: '128k' | '96k' | '64k';
}

export interface AudioCompressionOptions {
  bitrate: '192k' | '128k' | '96k' | '64k';
}

export interface GenericCompressionOptions {
  archiveFormat: 'zip' | 'gzip';
}

export interface CompressionOptions {
  fileCategory: FileCategory;
  image?: ImageCompressionOptions;
  pdf?: PdfCompressionOptions;
  video?: VideoCompressionOptions;
  audio?: AudioCompressionOptions;
  generic?: GenericCompressionOptions;
}

export interface CompressionResult {
  id: string;
  originalName: string;
  compressedName: string;
  fileCategory: FileCategory;
  originalSize: number;
  originalSizeFormatted: string;
  compressedSize: number;
  compressedSizeFormatted: string;
  savedBytes: number;
  savedPercent: number; // persentase penghematan (misal 45.2)
  filePath: string;
  mimeType: string;
  processingTimeMs: number;
}
