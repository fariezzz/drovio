import fs from 'fs';
import path from 'path';
import { getConfig } from '../config';
import { sanitizeWindowsFilename, isPathInside } from '../security';
import { formatBytes } from '../media-service';
import { compressImage } from './image';
import { compressPdf } from './pdf';
import { compressVideo, compressAudio } from './media';
import { compressGeneric } from './generic';
import {
  FileCategory,
  CompressionOptions,
  CompressionResult,
} from './types';

// Singleton di globalThis agar state bertahan antar request dan antar bundle Next.js
declare global {
  // eslint-disable-next-line no-var
  var __compressedResultsInstance: Map<string, CompressionResult> | undefined;
}

function getCompressedMap(): Map<string, CompressionResult> {
  if (!global.__compressedResultsInstance) {
    global.__compressedResultsInstance = new Map<string, CompressionResult>();
  }
  return global.__compressedResultsInstance;
}

// Deteksi kategori file berdasarkan nama atau tipe MIME
export function detectFileCategory(filename: string, mimeType?: string): FileCategory {
  const ext = path.extname(filename).toLowerCase();

  const imageExts = ['.jpg', '.jpeg', '.png', '.webp', '.avif', '.gif', '.tiff', '.tif', '.bmp'];
  if (imageExts.includes(ext) || (mimeType && mimeType.startsWith('image/'))) {
    return 'image';
  }

  if (ext === '.pdf' || mimeType === 'application/pdf') {
    return 'pdf';
  }

  const videoExts = ['.mp4', '.mkv', '.mov', '.avi', '.webm', '.flv', '.wmv', '.m4v', '.3gp'];
  if (videoExts.includes(ext) || (mimeType && mimeType.startsWith('video/'))) {
    return 'video';
  }

  const audioExts = ['.mp3', '.wav', '.flac', '.m4a', '.ogg', '.aac', '.wma', '.opus'];
  if (audioExts.includes(ext) || (mimeType && mimeType.startsWith('audio/'))) {
    return 'audio';
  }

  return 'generic';
}

// Eksekusi kompresi file
export async function executeCompression(
  originalFilename: string,
  inputData: { buffer?: Buffer; localFilePath?: string },
  options: CompressionOptions
): Promise<CompressionResult> {
  const startTime = Date.now();
  const config = getConfig();

  const compressedDir = path.join(config.downloadDir, 'compressed');
  if (!fs.existsSync(compressedDir)) {
    fs.mkdirSync(compressedDir, { recursive: true });
  }

  const id = `cmp_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
  const safeOriginalName = sanitizeWindowsFilename(originalFilename, 'file-input');
  const baseName = path.basename(safeOriginalName, path.extname(safeOriginalName));
  const category = options.fileCategory || detectFileCategory(safeOriginalName);

  let originalSize = 0;
  let finalBuffer: Buffer | null = null;
  let finalPath = '';
  let finalFilename = '';
  let finalMimeType = 'application/octet-stream';

  if (inputData.buffer) {
    originalSize = inputData.buffer.length;
  } else if (inputData.localFilePath && fs.existsSync(inputData.localFilePath)) {
    const stats = fs.statSync(inputData.localFilePath);
    originalSize = stats.size;
  } else {
    throw new Error('Data input file tidak ditemukan atau kosong.');
  }

  // Route ke kompresor yang sesuai
  if (category === 'image') {
    const buf = inputData.buffer || fs.readFileSync(inputData.localFilePath!);
    const res = await compressImage(buf, safeOriginalName, options.image || { level: 'medium' });
    finalBuffer = res.buffer;
    const ext = path.extname(res.outputFilename);
    finalFilename = `${baseName} [${id}]${ext}`;
    finalMimeType = res.mimeType;
  } else if (category === 'pdf') {
    const buf = inputData.buffer || fs.readFileSync(inputData.localFilePath!);
    const res = await compressPdf(buf, safeOriginalName, options.pdf || { level: 'medium' });
    finalBuffer = res.buffer;
    finalFilename = `${baseName} [${id}].pdf`;
    finalMimeType = res.mimeType;
  } else if (category === 'video') {
    let sourcePath = inputData.localFilePath;
    let tempSourceCreated = false;

    if (!sourcePath) {
      sourcePath = path.join(compressedDir, `temp_${Date.now()}_${safeOriginalName}`);
      fs.writeFileSync(sourcePath, inputData.buffer!);
      tempSourceCreated = true;
    }

    try {
      const res = await compressVideo(sourcePath, compressedDir, options.video || { level: 'medium' });
      finalPath = res.outputPath;
      finalFilename = path.basename(finalPath);
      finalMimeType = res.mimeType;
    } finally {
      if (tempSourceCreated && fs.existsSync(sourcePath)) {
        try {
          fs.unlinkSync(sourcePath);
        } catch {}
      }
    }
  } else if (category === 'audio') {
    let sourcePath = inputData.localFilePath;
    let tempSourceCreated = false;

    if (!sourcePath) {
      sourcePath = path.join(compressedDir, `temp_${Date.now()}_${safeOriginalName}`);
      fs.writeFileSync(sourcePath, inputData.buffer!);
      tempSourceCreated = true;
    }

    try {
      const res = await compressAudio(sourcePath, compressedDir, options.audio || { bitrate: '128k' });
      finalPath = res.outputPath;
      finalFilename = path.basename(finalPath);
      finalMimeType = res.mimeType;
    } finally {
      if (tempSourceCreated && fs.existsSync(sourcePath)) {
        try {
          fs.unlinkSync(sourcePath);
        } catch {}
      }
    }
  } else {
    const buf = inputData.buffer || fs.readFileSync(inputData.localFilePath!);
    const res = compressGeneric(buf, safeOriginalName, options.generic);
    finalBuffer = res.buffer;
    finalFilename = `${safeOriginalName} [${id}].gz`;
    finalMimeType = res.mimeType;
  }

  // Jika berupa buffer, tulis ke direktori compressed
  if (finalBuffer) {
    finalPath = path.join(compressedDir, finalFilename);
    fs.writeFileSync(finalPath, finalBuffer);
  }

  const finalStats = fs.statSync(finalPath);
  const compressedSize = finalStats.size;

  const savedBytes = Math.max(0, originalSize - compressedSize);
  const savedPercent = originalSize > 0
    ? Math.max(0, Number(((savedBytes / originalSize) * 100).toFixed(1)))
    : 0;

  const userFacingName = finalFilename.replace(/\s*\[cmp_[^\]]+\]/g, '');

  const result: CompressionResult = {
    id,
    originalName: safeOriginalName,
    compressedName: userFacingName,
    fileCategory: category,
    originalSize,
    originalSizeFormatted: formatBytes(originalSize),
    compressedSize,
    compressedSizeFormatted: formatBytes(compressedSize),
    savedBytes,
    savedPercent,
    filePath: finalPath,
    mimeType: finalMimeType,
    processingTimeMs: Date.now() - startTime,
  };

  const map = getCompressedMap();
  map.set(id, result);
  return result;
}

// Ambil hasil kompresi berdasarkan ID dengan verifikasi keamanan & fallback disk
export function getCompressionResult(id: string): CompressionResult | undefined {
  const map = getCompressedMap();
  let result = map.get(id);
  const config = getConfig();
  const compressedDir = path.join(config.downloadDir, 'compressed');

  // Fallback scan disk jika state hilang antar worker Next.js
  if (!result && fs.existsSync(compressedDir)) {
    try {
      const files = fs.readdirSync(compressedDir);
      for (const file of files) {
        if (file.includes(id)) {
          const fullPath = path.join(compressedDir, file);
          const stats = fs.statSync(fullPath);
          const ext = path.extname(file).replace('.', '').toLowerCase();
          const cleanName = file.replace(/\s*\[cmp_[^\]]+\]/g, '');

          const mimeTypes: Record<string, string> = {
            pdf: 'application/pdf',
            png: 'image/png',
            jpg: 'image/jpeg',
            jpeg: 'image/jpeg',
            webp: 'image/webp',
            mp4: 'video/mp4',
            webm: 'video/webm',
            mp3: 'audio/mpeg',
            wav: 'audio/wav',
            m4a: 'audio/mp4',
            gz: 'application/gzip',
          };

          result = {
            id,
            originalName: cleanName,
            compressedName: cleanName,
            fileCategory: detectFileCategory(file),
            originalSize: stats.size,
            originalSizeFormatted: formatBytes(stats.size),
            compressedSize: stats.size,
            compressedSizeFormatted: formatBytes(stats.size),
            savedBytes: 0,
            savedPercent: 0,
            filePath: fullPath,
            mimeType: mimeTypes[ext] || 'application/octet-stream',
            processingTimeMs: 0,
          };
          map.set(id, result);
          break;
        }
      }
    } catch {}
  }

  if (!result) return undefined;
  if (!isPathInside(config.downloadDir, result.filePath)) return undefined;
  if (!fs.existsSync(result.filePath)) return undefined;

  return result;
}
