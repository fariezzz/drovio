export type ConversionCategory = 'image' | 'video' | 'audio' | 'document' | 'other';

export interface ConversionOptions {
  category: ConversionCategory;
  targetFormat: string; // e.g. 'mp4', 'mp3', 'gif', 'png', 'webp', 'pdf'
}

export interface ConversionResult {
  id: string;
  originalName: string;
  convertedName: string;
  category: ConversionCategory;
  targetFormat: string;
  originalSize: number;
  originalSizeFormatted: string;
  convertedSize: number;
  convertedSizeFormatted: string;
  filePath: string;
  mimeType: string;
  processingTimeMs: number;
}
