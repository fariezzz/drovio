import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { spawn } from 'child_process';
import { getConfig } from './config';
import { validateAndSanitizeUrl } from './security';

interface PreviewTask {
  promise: Promise<string>;
  startTime: number;
}

const activePreviewTasks = new Map<string, PreviewTask>();

export function getPreviewDir(): string {
  const config = getConfig();
  const dir = path.join(config.downloadDir, 'previews');
  if (!fs.existsSync(dir)) {
    try {
      fs.mkdirSync(dir, { recursive: true });
    } catch {}
  }
  return dir;
}

export function getPreviewFilePath(url: string): string {
  const hash = crypto.createHash('md5').update(url).digest('hex');
  return path.join(getPreviewDir(), `${hash}.mp4`);
}

export async function ensurePreviewMedia(
  url: string
): Promise<{ ready: boolean; filePath?: string; streamUrl: string; error?: string }> {
  const validation = validateAndSanitizeUrl(url);
  if (!validation.valid || !validation.url) {
    return {
      ready: false,
      streamUrl: '',
      error: validation.error || 'URL tidak valid',
    };
  }

  const safeUrl = validation.url;
  const filePath = getPreviewFilePath(safeUrl);
  const streamUrl = `/api/media/stream?url=${encodeURIComponent(safeUrl)}`;

  // 1. Periksa apakah berkas cache preview sudah ada dan ukurannya valid
  if (fs.existsSync(filePath)) {
    try {
      const stats = fs.statSync(filePath);
      if (stats.size > 1024) {
        return { ready: true, filePath, streamUrl };
      }
    } catch {}
  }

  // 2. Jika tugas pembuatan sedang berjalan di latar belakang, tunggu tugas tersebut
  const existingTask = activePreviewTasks.get(safeUrl);
  if (existingTask) {
    try {
      await existingTask.promise;
      if (fs.existsSync(filePath)) {
        return { ready: true, filePath, streamUrl };
      }
    } catch (err: unknown) {
      const error = err as Error;
      return { ready: false, streamUrl, error: error.message };
    }
  }

  // 3. Mulai proses pembuatan preview media aktual di latar belakang menggunakan yt-dlp
  const config = getConfig();
  const taskPromise = new Promise<string>((resolve, reject) => {
    // Gunakan format resolusi cepat (360p / 480p) agar preview video aktual segera siap
    const args: string[] = [
      '--newline',
      '--no-playlist',
      '--no-warnings',
      '-f',
      '18/bv*[height<=360]+ba/b[height<=360] / b[height<=360] / best',
      '--merge-output-format',
      'mp4',
      '-o',
      filePath,
    ];

    // Hanya bila YTDLP_NO_CHECK_CERTIFICATES=true (lihat config.ts).
    if (config.ytdlpNoCheckCertificates) {
      args.push('--no-check-certificates');
    }

    if (config.ffmpegPath) {
      args.push('--ffmpeg-location', config.ffmpegPath);
    }

    args.push(safeUrl);

    let child;
    try {
      child = spawn(config.ytdlpPath, args, {
        shell: false,
        stdio: ['ignore', 'pipe', 'pipe'],
      });
    } catch (err: unknown) {
      const error = err as Error;
      activePreviewTasks.delete(safeUrl);
      return reject(new Error(`Gagal memulai pemrosesan preview: ${error.message}`));
    }

    let stderr = '';
    child.stderr?.on('data', (d) => {
      stderr += d.toString();
    });

    child.on('close', (code) => {
      activePreviewTasks.delete(safeUrl);
      if (code === 0 && fs.existsSync(filePath)) {
        try {
          const stats = fs.statSync(filePath);
          if (stats.size > 0) {
            return resolve(filePath);
          }
        } catch {}
      }
      reject(new Error(stderr.slice(-200) || `Pembuatan preview gagal dengan kode ${code}`));
    });

    child.on('error', (err) => {
      activePreviewTasks.delete(safeUrl);
      reject(err);
    });
  });

  activePreviewTasks.set(safeUrl, { promise: taskPromise, startTime: Date.now() });

  try {
    await taskPromise;
    return { ready: true, filePath, streamUrl };
  } catch (err: unknown) {
    const error = err as Error;
    return { ready: false, streamUrl, error: error.message };
  }
}

// Hapus berkas preview media dari disk setelah pengguna mengklik unduh atau tidak membutuhkannya lagi
export function deletePreviewMedia(url: string): boolean {
  try {
    const filePath = getPreviewFilePath(url);
    activePreviewTasks.delete(url);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      return true;
    }
  } catch {}
  return false;
}

