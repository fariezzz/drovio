import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { spawn } from 'child_process';
import { getConfig } from './config';
import { validateAndSanitizeUrl, checkHostResolvesPublic } from './security';
import { getYoutubeCookiesArgs } from './youtube-cookies';

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

  // P2: cek resolusi DNS sebelum yt-dlp dipanggil (SSRF via DNS).
  const dnsCheck = await checkHostResolvesPublic(new URL(safeUrl).hostname);
  if (!dnsCheck.ok) {
    return { ready: false, streamUrl: '', error: dnsCheck.error || 'Domain ditolak demi keamanan.' };
  }

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
  const isYoutube = safeUrl.includes('youtube.com') || safeUrl.includes('youtu.be');
  const isBotError = (msg: string): boolean => {
    const l = (msg || '').toLowerCase();
    return l.includes('sign in') || l.includes('not a bot') || l.includes('cookies') ||
      l.includes('login required') || l.includes('requested format is not available') ||
      l.includes('video is unavailable');
  };
  // Satu percobaan yt-dlp. Sengaja TIDAK menyentuh activePreviewTasks di
  // sini: wrapper di bawah yang mengatur map, supaya percobaan kedua
  // (Android) tidak kehilangan jejak tugas yang sedang ditunggu pemanggil
  // lain. Bug sebelumnya: handler close percobaan pertama menghapus map,
  // dan pesan error dipotong jadi 200 karakter terakhir — ekor pesan
  // bot-check YouTube itu cuma URL FAQ cookies, frasa 'Sign in to
  // confirm' di awal pesan hilang, jadi pengecekan retry tidak pernah
  // terpicu dan preview selalu 404. Sekarang pesan lengkap dipakai.
  const runPreviewAttempt = (useAndroid: boolean) => new Promise<string>((resolve, reject) => {
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

    // YouTube fallback: sama seperti inspectMedia, client Android kalau
    // web kena bot-check. Format preview sudah 360p/18 duluan, jadi
    // Android cocok tanpa perubahan format.
    if (useAndroid) {
      args.push('--extractor-args', 'youtube:player_client=android');
    }
    // Cookie YouTube (2026-11-02): hanya untuk YouTube dan hanya untuk
    // percobaan web; percobaan Android sengaja TANPA cookie supaya
    // cookie yang rusak tidak merusak fallback 360p.
    if (isYoutube && !useAndroid) {
      args.push(...getYoutubeCookiesArgs());
    }

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
      return reject(new Error(`Gagal memulai pemrosesan preview: ${error.message}`));
    }

    let stderr = '';
    child.stderr?.on('data', (d) => {
      stderr += d.toString();
    });

    child.on('close', (code) => {
      if (code === 0 && fs.existsSync(filePath)) {
        try {
          const stats = fs.statSync(filePath);
          if (stats.size > 0) {
            return resolve(filePath);
          }
        } catch {}
      }
      // Pakai pesan lengkap (dibatasi 2000 karakter dari awal, bukan
      // 200 karakter terakhir) supaya frasa bot-check tetap terdeteksi.
      reject(new Error(stderr.slice(0, 2000) || `Pembuatan preview gagal dengan kode ${code}`));
    });

    child.on('error', (err) => {
      reject(err);
    });
  });

  // Wrapper: coba web dulu, kalau bot-check coba sekali lewat Android.
  // Semua pemanggil yang menunggu tugas yang sama (preview-status,
  // stream, trimmer) mendapat hasil wrapper ini, bukan cuma pemanggil
  // pertama — perbaikan dari bug sebelumnya di mana pemanggil kedua
  // yang menunggu tugas lama langsung gagal tanpa retry.
  const taskPromise = (async () => {
    try {
      return await runPreviewAttempt(false);
    } catch (err: unknown) {
      const error = err as Error;
      if (isYoutube && isBotError(error.message)) {
        return await runPreviewAttempt(true);
      }
      throw err;
    }
  })();
  activePreviewTasks.set(safeUrl, { promise: taskPromise, startTime: Date.now() });

  try {
    await taskPromise;
    return { ready: true, filePath, streamUrl };
  } catch (err: unknown) {
    const error = err as Error;
    return { ready: false, streamUrl, error: error.message };
  } finally {
    // Bersihkan map hanya kalau masih menunjuk tugas ini.
    if (activePreviewTasks.get(safeUrl)?.promise === taskPromise) {
      activePreviewTasks.delete(safeUrl);
    }
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

