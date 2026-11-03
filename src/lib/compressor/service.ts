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
      sourcePath = path.join(compressedDir, `temp_${id}_${safeOriginalName}`);
      fs.writeFileSync(sourcePath, inputData.buffer!);
      tempSourceCreated = true;
    }

    try {
      const res = await compressVideo(sourcePath, compressedDir, options.video || { level: 'medium' }, id);
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
      sourcePath = path.join(compressedDir, `temp_${id}_${safeOriginalName}`);
      fs.writeFileSync(sourcePath, inputData.buffer!);
      tempSourceCreated = true;
    }

    try {
      const res = await compressAudio(sourcePath, compressedDir, options.audio || { bitrate: '128k' }, id);
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

  let finalStats = fs.statSync(finalPath);
  let compressedSize = finalStats.size;

  // P1: jangan pernah mengembalikan file yang LEBIH BESAR dari aslinya
  // dengan label "terkompresi". Kalau kompresi gagal mengecilkan, kembalikan
  // file asli (dengan nama & ekstensi aslinya) dan tandai originalKept.
  // Sebelumnya savedPercent hanya di-clamp ke 0, tapi file yang membesar
  // tetap dikembalikan.
  let originalKept = false;
  if (compressedSize >= originalSize && originalSize > 0) {
    const originalExt = path.extname(safeOriginalName).toLowerCase();
    const keptFilename = `${baseName} [${id}]${originalExt}`;
    const keptPath = path.join(compressedDir, keptFilename);
    const mimeByExt: Record<string, string> = {
      '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png',
      '.webp': 'image/webp', '.gif': 'image/gif', '.avif': 'image/avif',
      '.bmp': 'image/bmp', '.tiff': 'image/tiff', '.tif': 'image/tiff',
      '.pdf': 'application/pdf', '.mp4': 'video/mp4', '.webm': 'video/webm',
      '.mkv': 'video/x-matroska', '.mov': 'video/quicktime',
      '.avi': 'video/x-msvideo', '.flv': 'video/x-flv', '.wmv': 'video/x-ms-wmv',
      '.m4v': 'video/x-m4v', '.3gp': 'video/3gpp',
      '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.flac': 'audio/flac',
      '.m4a': 'audio/mp4', '.ogg': 'audio/ogg', '.opus': 'audio/opus',
      '.aac': 'audio/aac', '.wma': 'audio/x-ms-wma',
      '.txt': 'text/plain', '.zip': 'application/zip',
    };
    try {
      if (inputData.buffer) {
        fs.writeFileSync(keptPath, inputData.buffer);
      } else if (inputData.localFilePath && fs.existsSync(inputData.localFilePath)) {
        fs.copyFileSync(inputData.localFilePath, keptPath);
      }
      if (fs.existsSync(keptPath) && path.resolve(keptPath) !== path.resolve(finalPath)) {
        try { fs.unlinkSync(finalPath); } catch {}
      }
      finalPath = keptPath;
      finalFilename = keptFilename;
      // Fallback octet-stream, BUKAN mime hasil kompresi lama: file yang
      // dikembalikan adalah file asli, jadi mis. .bin tidak boleh
      // dilabeli application/gzip hanya karena tadinya dikompresi generic.
      finalMimeType = mimeByExt[originalExt] || 'application/octet-stream';
      finalStats = fs.statSync(finalPath);
      compressedSize = finalStats.size;
      originalKept = true;
    } catch {
      // Kalau penggantian gagal, biarkan hasil kompresi apa adanya;
      // savedPercent di bawah tetap di-clamp ke 0 seperti sebelumnya.
      finalStats = fs.statSync(finalPath);
      compressedSize = finalStats.size;
    }
  }

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
    originalKept,
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
