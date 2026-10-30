import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import sharp from 'sharp';
import { PDFDocument } from 'pdf-lib';
import { getConfig } from '../config';
import { sanitizeWindowsFilename, isPathInside } from '../security';
import { formatBytes } from '../media-service';
import { ConversionCategory, ConversionOptions, ConversionResult } from './types';

// Singleton di globalThis agar state bertahan antar request dan antar bundle Next.js
declare global {
  // eslint-disable-next-line no-var
  var __convertedResultsInstance: Map<string, ConversionResult> | undefined;
}

function getConvertedMap(): Map<string, ConversionResult> {
  if (!global.__convertedResultsInstance) {
    global.__convertedResultsInstance = new Map<string, ConversionResult>();
  }
  return global.__convertedResultsInstance;
}

export function detectConversionCategory(filename: string, mimeType?: string): ConversionCategory {
  const ext = path.extname(filename).toLowerCase();
  const imgExts = ['.jpg', '.jpeg', '.png', '.webp', '.avif', '.gif', '.tiff', '.tif', '.bmp', '.ico'];
  if (imgExts.includes(ext) || mimeType?.startsWith('image/')) return 'image';

  const vidExts = ['.mp4', '.mkv', '.mov', '.avi', '.webm', '.flv', '.wmv', '.m4v', '.3gp'];
  if (vidExts.includes(ext) || mimeType?.startsWith('video/')) return 'video';

  const audExts = ['.mp3', '.wav', '.flac', '.m4a', '.ogg', '.aac', '.wma', '.opus'];
  if (audExts.includes(ext) || mimeType?.startsWith('audio/')) return 'audio';

  if (ext === '.pdf' || mimeType === 'application/pdf') return 'document';

  return 'other';
}

export async function executeConversion(
  originalFilename: string,
  inputData: { buffer?: Buffer; localFilePath?: string },
  options: ConversionOptions
): Promise<ConversionResult> {
  const startTime = Date.now();
  const config = getConfig();

  const convertedDir = path.join(config.downloadDir, 'converted');
  if (!fs.existsSync(convertedDir)) {
    fs.mkdirSync(convertedDir, { recursive: true });
  }

  const id = `cnv_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
  const safeOriginal = sanitizeWindowsFilename(originalFilename, 'input-file');
  const baseName = path.basename(safeOriginal, path.extname(safeOriginal));
  const category = options.category || detectConversionCategory(safeOriginal);
  const targetFormat = options.targetFormat.toLowerCase().replace('.', '');

  let originalSize = 0;
  if (inputData.buffer) {
    originalSize = inputData.buffer.length;
  } else if (inputData.localFilePath && fs.existsSync(inputData.localFilePath)) {
    originalSize = fs.statSync(inputData.localFilePath).size;
  } else {
    throw new Error('Data berkas sumber tidak ditemukan.');
  }

  let finalBuffer: Buffer | null = null;
  let finalPath = '';
  // Berkas fisik menyematkan [id] agar selalu dapat diverifikasi dari disk
  const onDiskFilename = `${baseName} [${id}].${targetFormat}`;
  const userFacingFilename = `${baseName}.${targetFormat}`;
  let finalMime = 'application/octet-stream';

  // 1. Konversi GAMBAR
  if (category === 'image') {
    const buf = inputData.buffer || fs.readFileSync(inputData.localFilePath!);

    if (targetFormat === 'pdf') {
      const doc = await PDFDocument.create();
      const meta = await sharp(buf).metadata();
      const width = meta.width || 600;
      const height = meta.height || 800;

      const page = doc.addPage([width, height]);
      const pngBuf = await sharp(buf).png().toBuffer();
      const embedded = await doc.embedPng(pngBuf);
      page.drawImage(embedded, { x: 0, y: 0, width, height });

      const pdfBytes = await doc.save();
      finalBuffer = Buffer.from(pdfBytes);
      finalMime = 'application/pdf';
    } else {
      let pipeline = sharp(buf);
      switch (targetFormat) {
        case 'png':
          pipeline = pipeline.png({ compressionLevel: 8 });
          finalMime = 'image/png';
          break;
        case 'webp':
          pipeline = pipeline.webp({ quality: 85 });
          finalMime = 'image/webp';
          break;
        case 'avif':
          pipeline = pipeline.avif({ quality: 80 });
          finalMime = 'image/avif';
          break;
        case 'jpg':
        case 'jpeg':
        default:
          pipeline = pipeline.jpeg({ quality: 85, mozjpeg: true });
          finalMime = 'image/jpeg';
          break;
      }
      finalBuffer = await pipeline.toBuffer();
    }
  }

  // 2. Konversi VIDEO & AUDIO
  else if (category === 'video' || category === 'audio') {
    let sourcePath = inputData.localFilePath;
    let tempSourceCreated = false;

    if (!sourcePath) {
      sourcePath = path.join(convertedDir, `temp_src_${Date.now()}_${safeOriginal}`);
      fs.writeFileSync(sourcePath, inputData.buffer!);
      tempSourceCreated = true;
    }

    finalPath = path.join(convertedDir, onDiskFilename);
    const args: string[] = ['-y', '-i', sourcePath];

    if (targetFormat === 'mp4') {
      args.push('-c:v', 'libx264', '-preset', 'fast', '-crf', '22', '-c:a', 'aac', '-b:a', '192k', '-movflags', '+faststart');
      finalMime = 'video/mp4';
    } else if (targetFormat === 'webm') {
      args.push('-c:v', 'libvpx-vp9', '-crf', '30', '-b:v', '0', '-c:a', 'libopus', '-b:a', '128k');
      finalMime = 'video/webm';
    } else if (targetFormat === 'mkv') {
      args.push('-c', 'copy');
      finalMime = 'video/x-matroska';
    } else if (targetFormat === 'gif') {
      args.push('-vf', 'fps=12,scale=480:-1:flags=lanczos');
      finalMime = 'image/gif';
    } else if (targetFormat === 'mp3') {
      args.push('-vn', '-c:a', 'libmp3lame', '-b:a', '192k');
      finalMime = 'audio/mpeg';
    } else if (targetFormat === 'wav') {
      args.push('-vn', '-c:a', 'pcm_s16le');
      finalMime = 'audio/wav';
    } else if (targetFormat === 'm4a') {
      args.push('-vn', '-c:a', 'aac', '-b:a', '192k');
      finalMime = 'audio/mp4';
    } else if (targetFormat === 'ogg') {
      args.push('-vn', '-c:a', 'libvorbis', '-q:a', '5');
      finalMime = 'audio/ogg';
    } else if (targetFormat === 'flac') {
      args.push('-vn', '-c:a', 'flac');
      finalMime = 'audio/flac';
    } else {
      args.push('-c', 'copy');
    }

    args.push(finalPath);

    try {
      await new Promise<void>((resolve, reject) => {
        const child = spawn(config.ffmpegPath, args, {
          shell: false,
          stdio: ['ignore', 'pipe', 'pipe'],
        });

        let stderr = '';
        child.stderr.on('data', (c) => (stderr += c.toString()));

        child.on('close', (code) => {
          if (code === 0 && fs.existsSync(finalPath)) {
            resolve();
          } else {
            reject(new Error(`Konversi gagal (FFmpeg kode ${code}): ${stderr.slice(-250)}`));
          }
        });

        child.on('error', (err) => {
          reject(new Error(`Gagal menjalankan FFmpeg: ${err.message}`));
        });
      });
    } finally {
      if (tempSourceCreated && fs.existsSync(sourcePath)) {
        try {
          fs.unlinkSync(sourcePath);
        } catch {}
      }
    }
  } else {
    throw new Error(`Kategori berkas "${category}" belum didukung untuk konversi langsung.`);
  }

  // Tulis buffer jika ada
  if (finalBuffer) {
    finalPath = path.join(convertedDir, onDiskFilename);
    fs.writeFileSync(finalPath, finalBuffer);
  }

  const finalStats = fs.statSync(finalPath);
  const convertedSize = finalStats.size;

  const result: ConversionResult = {
    id,
    originalName: safeOriginal,
    convertedName: userFacingFilename,
    category,
    targetFormat,
    originalSize,
    originalSizeFormatted: formatBytes(originalSize),
    convertedSize,
    convertedSizeFormatted: formatBytes(convertedSize),
    filePath: finalPath,
    mimeType: finalMime,
    processingTimeMs: Date.now() - startTime,
  };

  const map = getConvertedMap();
  map.set(id, result);
  return result;
}

export function getConversionResult(id: string): ConversionResult | undefined {
  const map = getConvertedMap();
  let res = map.get(id);
  const config = getConfig();
  const convertedDir = path.join(config.downloadDir, 'converted');

  // Fallback: cari di disk jika state memori hilang antar request Next.js
  if (!res && fs.existsSync(convertedDir)) {
    try {
      const files = fs.readdirSync(convertedDir);
      for (const file of files) {
        if (file.includes(id)) {
          const fullPath = path.join(convertedDir, file);
          const stats = fs.statSync(fullPath);
          const ext = path.extname(file).replace('.', '').toLowerCase();
          const cleanName = file.replace(/\s*\[cnv_[^\]]+\]/g, '');

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
            gif: 'image/gif',
          };

          res = {
            id,
            originalName: cleanName,
            convertedName: cleanName,
            category: detectConversionCategory(file),
            targetFormat: ext,
            originalSize: stats.size,
            originalSizeFormatted: formatBytes(stats.size),
            convertedSize: stats.size,
            convertedSizeFormatted: formatBytes(stats.size),
            filePath: fullPath,
            mimeType: mimeTypes[ext] || 'application/octet-stream',
            processingTimeMs: 0,
          };
          map.set(id, res);
          break;
        }
      }
    } catch {}
  }

  if (!res) return undefined;
  if (!isPathInside(config.downloadDir, res.filePath)) return undefined;
  if (!fs.existsSync(res.filePath)) return undefined;

  return res;
}
