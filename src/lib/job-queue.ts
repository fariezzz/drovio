import { spawn, ChildProcess, exec } from 'child_process';
import fs from 'fs';
import path from 'path';
import { getConfig } from './config';
import { sanitizeWindowsFilename } from './security';
import { formatBytes, translateErrorMessage } from './media-service';
import { Job, JobStatus, DownloadRequest, PlatformType } from './types';
import { deletePreviewMedia } from './preview-service';

// Map pekerjaan aktif dalam memori
interface JobRuntime {
  job: Job;
  childProcess?: ChildProcess;
  outputCandidates: Set<string>;
}

class JobManager {
  private jobs: Map<string, JobRuntime> = new Map();
  private isProcessingQueue = false;

  constructor() {
    // Jalankan pengecekan keberadaan file berkala
    if (typeof setInterval !== 'undefined') {
      setInterval(() => this.verifyFilesOnDisk(), 30000);
    }
  }

  // Verifikasi apakah file unduhan masih ada di disk
  private verifyFilesOnDisk() {
    for (const runtime of this.jobs.values()) {
      if (runtime.job.status === 'completed' && runtime.job.outputFilepath) {
        runtime.job.fileExists = fs.existsSync(runtime.job.outputFilepath);
      }
    }
  }

  // Buat pekerjaan baru
  public createJob(
    request: DownloadRequest,
    mediaDetails: {
      title: string;
      ownerSessionId: string;
      platform: PlatformType;
      platformName: string;
      thumbnail?: string;
    }
  ): Job {
    const id = `job_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

    const qualityLabels: Record<string, string> = {
      best: 'Kualitas Terbaik',
      '1080p': '1080p Full HD',
      '720p': '720p HD',
      '480p': '480p SD',
      'mp3-best': 'MP3 Terbaik (~320 kbps)',
      'mp3-256': 'MP3 256 kbps',
      'mp3-192': 'MP3 192 kbps',
      'mp3-128': 'MP3 128 kbps',
    };

    const trimRange =
      request.trimStart && request.trimEnd
        ? `${request.trimStart} - ${request.trimEnd}`
        : request.trimStart
        ? `Mulai ${request.trimStart}`
        : request.trimEnd
        ? `Sampai ${request.trimEnd}`
        : undefined;

    const job: Job = {
      id,
      ownerSessionId: mediaDetails.ownerSessionId,
      url: request.url,
      title: mediaDetails.title,
      platform: mediaDetails.platform,
      platformName: mediaDetails.platformName,
      thumbnail: mediaDetails.thumbnail,
      type: request.type,
      qualityId: request.qualityId,
      qualityLabel: qualityLabels[request.qualityId] || request.qualityId,
      trimStart: request.trimStart,
      trimEnd: request.trimEnd,
      trimRange,
      subtitleLang: request.subtitleLang,
      status: 'pending',
      progress: 0,
      createdAt: Date.now(),
    };

    this.jobs.set(id, {
      job,
      outputCandidates: new Set<string>(),
    });

    // Mulai proses antrean
    this.processQueue();

    return job;
  }

  // Dapatkan pekerjaan berdasarkan ID
  public getJob(id: string): Job | undefined {
    const runtime = this.jobs.get(id);
    if (!runtime) return undefined;

    // Pastikan status file fisik terverifikasi
    if (runtime.job.status === 'completed' && runtime.job.outputFilepath) {
      runtime.job.fileExists = fs.existsSync(runtime.job.outputFilepath);
    }

    return runtime.job;
  }

  // Dapatkan daftar seluruh riwayat pekerjaan
  public listJobs(limit: number = 30): Job[] {
    const list = Array.from(this.jobs.values())
      .map((r) => {
        if (r.job.status === 'completed' && r.job.outputFilepath) {
          r.job.fileExists = fs.existsSync(r.job.outputFilepath);
        }
        return r.job;
      })
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, limit);

    return list;
  }

  // Batalkan pekerjaan
  public cancelJob(id: string): { success: boolean; message: string } {
    const runtime = this.jobs.get(id);
    if (!runtime) {
      return { success: false, message: 'Pekerjaan tidak ditemukan.' };
    }

    if (runtime.job.status === 'completed') {
      return { success: false, message: 'Pekerjaan telah selesai dan tidak dapat dibatalkan.' };
    }

    if (runtime.job.status === 'cancelled') {
      return { success: true, message: 'Pekerjaan sudah dibatalkan sebelumnya.' };
    }

    runtime.job.status = 'cancelled';
    runtime.job.errorMessage = 'Pekerjaan dibatalkan oleh pengguna.';

    // Hentikan proses child
    if (runtime.childProcess && !runtime.childProcess.killed) {
      this.killProcessTree(runtime.childProcess);
    }

    // Bersihkan file parsial / temporer
    this.cleanupPartialFiles(runtime);

    // Lanjutkan antrean berikutnya jika ada
    this.processQueue();

    return { success: true, message: 'Pekerjaan berhasil dibatalkan.' };
  }

  // Hentikan proses secara tuntas di Windows / Unix
  private killProcessTree(child: ChildProcess) {
    if (!child.pid) return;

    if (process.platform === 'win32') {
      try {
        exec(`taskkill /pid ${child.pid} /T /F`);
      } catch {
        try {
          child.kill('SIGKILL');
        } catch {
          // Abaikan
        }
      }
    } else {
      try {
        child.kill('SIGKILL');
      } catch {
        // Abaikan
      }
    }
  }

  // Bersihkan file sementara yang tersisa
  private cleanupPartialFiles(runtime: JobRuntime) {
    const config = getConfig();
    try {
      // 1. Bersihkan file yang tercatat di outputCandidates jika belum komplit
      for (const filepath of runtime.outputCandidates) {
        if (fs.existsSync(filepath)) {
          try {
            fs.unlinkSync(filepath);
          } catch {
            // Abaikan
          }
        }
        // Cek juga file .part atau .ytdl yang berkorelasi
        const partFile = `${filepath}.part`;
        const ytdlFile = `${filepath}.ytdl`;
        if (fs.existsSync(partFile)) {
          try {
            fs.unlinkSync(partFile);
          } catch {
            // Abaikan
          }
        }
        if (fs.existsSync(ytdlFile)) {
          try {
            fs.unlinkSync(ytdlFile);
          } catch {
            // Abaikan
          }
        }
      }

      // 2. Scan direktori unduhan untuk membersihkan file part/ytdl yatim piatu yang dibuat baru-baru ini
      const files = fs.readdirSync(config.downloadDir);
      for (const file of files) {
        if (file.endsWith('.part') || file.endsWith('.ytdl')) {
          const fullPath = path.join(config.downloadDir, file);
          try {
            const stats = fs.statSync(fullPath);
            // Hapus file sementara yang dibuat dalam 30 menit terakhir jika berkorelasi
            if (Date.now() - stats.mtimeMs < 30 * 60 * 1000) {
              fs.unlinkSync(fullPath);
            }
          } catch {
            // Abaikan
          }
        }
      }
    } catch {
      // Abaikan error pembersihan
    }
  }

  // Proses antrean unduhan secara sekuensial berdasarkan batas konkurensi
  private async processQueue() {
    if (this.isProcessingQueue) return;
    this.isProcessingQueue = true;

    try {
      const config = getConfig();

      // Hitung pekerjaan yang sedang aktif
      let activeCount = 0;
      for (const runtime of this.jobs.values()) {
        if (runtime.job.status === 'downloading' || runtime.job.status === 'processing') {
          activeCount++;
        }
      }

      // Cari pekerjaan yang masih pending
      for (const runtime of this.jobs.values()) {
        if (activeCount >= config.maxConcurrentDownloads) {
          break;
        }

        if (runtime.job.status === 'pending') {
          activeCount++;
          this.executeDownload(runtime);
        }
      }
    } finally {
      this.isProcessingQueue = false;
    }
  }

  // Eksekusi proses unduhan dengan yt-dlp & FFmpeg
  private executeDownload(runtime: JobRuntime) {
    const { job } = runtime;
    const config = getConfig();

    job.status = 'downloading';
    job.progress = 0;

    // Siapkan argumen yt-dlp
    const args: string[] = [
      '--newline',
      '--no-playlist',
      '--no-warnings',
      '--progress-template',
      'DOWNLOAD_PROGRESS:%(progress._percent_str)s|%(progress._downloaded_bytes_str)s|%(progress._total_bytes_str)s|%(progress._speed_str)s|%(progress._eta_str)s',
    ];

    // Tentukan lokasi ffmpeg jika terdeteksi
    if (config.ffmpegPath) {
      args.push('--ffmpeg-location', config.ffmpegPath);
    }

    // Tentukan header dan referer khusus platform untuk menghindari blokir 403
    if (job.platform === 'tiktok' || job.url.includes('tiktok.com')) {
      args.push('--add-header', 'Referer:https://www.tiktok.com/');
      args.push(
        '--add-header',
        'User-Agent:Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'
      );
    } else if (job.platform === 'instagram' || job.url.includes('instagram.com')) {
      args.push('--add-header', 'Referer:https://www.instagram.com/');
    } else if (
      job.platform === 'twitter' ||
      job.url.includes('twitter.com') ||
      job.url.includes('x.com')
    ) {
      args.push('--add-header', 'Referer:https://twitter.com/');
    }

    // Tentukan opsi format
    if (job.type === 'video') {
      if (job.platform === 'tiktok' || job.url.includes('tiktok.com')) {
        // TikTok menyediakan video dalam stream tunggal progresif
        args.push('-f', 'bv*+ba/b/best');
      } else if (job.qualityId === '1080p') {
        args.push('-f', 'bv*[height<=1080]+ba/b[height<=1080] / bv*+ba/b / best');
      } else if (job.qualityId === '720p') {
        args.push('-f', 'bv*[height<=720]+ba/b[height<=720] / bv*+ba/b / best');
      } else if (job.qualityId === '480p') {
        args.push('-f', 'bv*[height<=480]+ba/b[height<=480] / bv*+ba/b / best');
      } else {
        // Default best
        args.push('-f', 'bv*+ba/b / best');
      }
      args.push('--merge-output-format', 'mp4');

      // Opsi Sematkan Subtitle jika diminta
      if (job.subtitleLang && job.subtitleLang !== 'none') {
        args.push(
          '--sub-langs',
          job.subtitleLang,
          '--write-subs',
          '--write-auto-subs',
          '--embed-subs',
          '--sub-format',
          'srt/vtt/best',
          '--sleep-subtitles',
          '1',
          '--no-abort-on-error'
        );
      }
    } else {
      // Audio MP3
      args.push('-x', '--audio-format', 'mp3');
      if (job.qualityId === 'mp3-256') {
        args.push('--audio-quality', '256K');
      } else if (job.qualityId === 'mp3-192') {
        args.push('--audio-quality', '192K');
      } else if (job.qualityId === 'mp3-128') {
        args.push('--audio-quality', '128K');
      } else {
        // Default best quality
        args.push('--audio-quality', '0');
      }
    }

    // Opsi Pemotongan Durasi (Trim) dengan Sinkronisasi Frame Presisi
    if (job.trimStart || job.trimEnd) {
      const startSec = job.trimStart || '00:00:00';
      const endSec = job.trimEnd || 'inf';
      args.push('--download-sections', `*${startSec}-${endSec}`);
      args.push('--force-keyframes-at-cuts');
      args.push('--postprocessor-args', 'ffmpeg:-avoid_negative_ts make_zero -async 1');
      args.push('--downloader-args', 'ffmpeg:-avoid_negative_ts make_zero');
    }

    // Sanitasi dan format nama output di disk
    const safeTitle = sanitizeWindowsFilename(job.title, 'media').replace(/%/g, '');
    const outputPattern = path.join(config.downloadDir, `${safeTitle} [${job.id}].%(ext)s`);
    args.push('-o', outputPattern);

    // Tautan sumber media
    args.push(job.url);

    let child: ChildProcess;
    try {
      child = spawn(config.ytdlpPath, args, {
        shell: false,
        stdio: ['ignore', 'pipe', 'pipe'],
      });
      runtime.childProcess = child;
    } catch (err: unknown) {
      const error = err as Error;
      job.status = 'failed';
      job.errorMessage = `Gagal menjalankan yt-dlp: ${error.message}`;
      this.processQueue();
      return;
    }

    let stderrBuffer = '';

    child.stdout?.on('data', (data: Buffer) => {
      const text = data.toString();
      const lines = text.split(/\r?\n/);

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;

        // Tangkap pola progress terstruktur
        if (trimmed.startsWith('DOWNLOAD_PROGRESS:')) {
          const parts = trimmed.substring('DOWNLOAD_PROGRESS:'.length).split('|');
          if (parts.length >= 5) {
            const rawPercent = parts[0].trim().replace('%', '');
            const parsedPercent = parseFloat(rawPercent);
            if (!isNaN(parsedPercent)) {
              job.progress = Math.min(100, Math.max(0, parsedPercent));
            }

            const downloaded = parts[1].trim();
            if (downloaded && downloaded !== 'NA') {
              job.downloadedFormatted = downloaded;
            }

            const total = parts[2].trim();
            if (total && total !== 'NA') {
              job.totalFormatted = total;
            }

            const speed = parts[3].trim();
            if (speed && speed !== 'NA') {
              job.speed = speed;
            }

            const eta = parts[4].trim();
            if (eta && eta !== 'NA') {
              job.eta = eta;
            }
          }
        }

        // Tangkap file tujuan yang dilaporkan yt-dlp / FFmpeg
        const destMatch = trimmed.match(/Destination:\s*(.+)$/i);
        if (destMatch && destMatch[1]) {
          const recorded = destMatch[1].trim().replace(/^["']|["']$/g, '');
          runtime.outputCandidates.add(recorded);
        }

        const mergeMatch = trimmed.match(/Merging formats into\s*["']?([^"']+)["']?/i);
        if (mergeMatch && mergeMatch[1]) {
          const recorded = mergeMatch[1].trim();
          runtime.outputCandidates.add(recorded);
          job.status = 'processing';
        }

        if (trimmed.includes('[ExtractAudio]')) {
          job.status = 'processing';
        }
      }
    });

    child.stderr?.on('data', (data: Buffer) => {
      stderrBuffer += data.toString();
    });

    child.on('close', async (code) => {
      if (job.status === 'cancelled') {
        this.cleanupPartialFiles(runtime);
        this.processQueue();
        return;
      }

      if (code === 0) {
        // Cari file hasil unduhan yang valid di folder download
        let finalFile = this.resolveFinalOutputFile(runtime, safeTitle);

        if (finalFile && fs.existsSync(finalFile)) {
          // Jika tugas merupakan pemotongan (trim), normalisasi sinkronisasi audio-video secara presisi
          if ((job.trimStart || job.trimEnd) && config.ffmpegPath && job.type === 'video') {
            try {
              finalFile = await this.resyncAudioVideoIfNecessary(config.ffmpegPath, finalFile);
            } catch {
              // Jika terjadi kendala pada proses sinkronisasi sekunder, gunakan file asli
            }
          }

          const stats = fs.statSync(finalFile);
          job.status = 'completed';
          job.progress = 100;
          job.completedAt = Date.now();
          job.outputFilepath = finalFile;
          job.outputFilename = path.basename(finalFile);
          job.outputSize = stats.size;
          job.outputSizeFormatted = formatBytes(stats.size);
          job.fileExists = true;
          // Pastikan preview sementara dihapus setelah proses unduh selesai
          deletePreviewMedia(job.url);
        } else {
          job.status = 'failed';
          job.errorMessage = 'Proses selesai tetapi file keluaran tidak ditemukan di direktori unduhan.';
        }
      } else {
        // Jika gagal karena pembatasan subtitle (HTTP 429 atau error timedtext)
        const isSubtitleRateLimit =
          Boolean(job.subtitleLang) &&
          (stderrBuffer.includes('subtitles') ||
            stderrBuffer.includes('429') ||
            stderrBuffer.includes('Too Many Requests') ||
            stderrBuffer.includes('timedtext'));

        if (isSubtitleRateLimit) {
          // Lakukan pengunduhan ulang otomatis tanpa subtitle agar video tetap berhasil diunduh
          job.subtitleLang = undefined;
          this.executeDownload(runtime);
          return;
        }

        job.status = 'failed';
        job.errorMessage = translateErrorMessage(stderrBuffer || `Proses unduhan keluar dengan kode error ${code}.`);
        this.cleanupPartialFiles(runtime);
      }

      // Lanjutkan antrean
      this.processQueue();
    });

    child.on('error', (err) => {
      if (job.status !== 'cancelled') {
        job.status = 'failed';
        job.errorMessage = `Kesalahan sistem proses: ${err.message}`;
        this.cleanupPartialFiles(runtime);
        this.processQueue();
      }
    });
  }

  // Temukan file output final berdasarkan candidate dan scan direktori
  private resolveFinalOutputFile(runtime: JobRuntime, safeTitle: string): string | null {
    const config = getConfig();
    const { job } = runtime;

    const isSubtitleOrAux = (filePath: string) => {
      const ext = path.extname(filePath).toLowerCase();
      return ['.vtt', '.srt', '.ass', '.lrc', '.sub', '.sbv', '.json', '.xml', '.jpg', '.png', '.webp', '.part', '.ytdl'].includes(ext);
    };

    const isTargetMedia = (filePath: string, type: 'video' | 'audio') => {
      const ext = path.extname(filePath).toLowerCase();
      if (type === 'video') {
        return ['.mp4', '.mkv', '.webm', '.avi', '.mov', '.ts'].includes(ext);
      }
      return ['.mp3', '.m4a', '.wav', '.ogg', '.flac', '.opus', '.aac'].includes(ext);
    };

    const candidatesList = Array.from(runtime.outputCandidates);

    // 1. Cek dari output candidates: utamakan yang cocok dengan target media (video/audio)
    for (const cand of candidatesList.slice().reverse()) {
      if (fs.existsSync(cand) && isTargetMedia(cand, job.type)) {
        try {
          const stats = fs.statSync(cand);
          if (stats.size > 0) {
            return cand;
          }
        } catch {
          // Abaikan
        }
      }
    }

    // 2. Scan direktori untuk file dengan nama yang memuat ID pekerjaan & cocok dengan media
    try {
      const files = fs.readdirSync(config.downloadDir);
      for (const file of files) {
        if (file.includes(runtime.job.id) && isTargetMedia(file, job.type)) {
          const full = path.join(config.downloadDir, file);
          const stats = fs.statSync(full);
          if (stats.size > 0) {
            return full;
          }
        }
      }

      // 3. Scan file yang memuat safeTitle jika ID tidak disematkan
      for (const file of files) {
        if (
          file.startsWith(safeTitle.slice(0, 30)) &&
          isTargetMedia(file, job.type) &&
          !isSubtitleOrAux(file)
        ) {
          const full = path.join(config.downloadDir, file);
          const stats = fs.statSync(full);
          if (stats.size > 0 && stats.mtimeMs > runtime.job.createdAt - 5000) {
            return full;
          }
        }
      }

      // 4. Fallback ke kandidat non-subtitle apapun yang ukurannya valid
      for (const cand of candidatesList.slice().reverse()) {
        if (fs.existsSync(cand) && !isSubtitleOrAux(cand)) {
          const stats = fs.statSync(cand);
          if (stats.size > 0) {
            return cand;
          }
        }
      }
    } catch {
      // Abaikan
    }

    return null;
  }

  // Verifikasi dan sinkronisasi audio-video jika terdapat pergeseran timestamp PTS akibat pemotongan
  private async resyncAudioVideoIfNecessary(ffmpegPath: string, filePath: string): Promise<string> {
    return new Promise((resolve) => {
      const ext = path.extname(filePath);
      const dir = path.dirname(filePath);
      const base = path.basename(filePath, ext);
      const syncedPath = path.join(dir, `${base}_synced${ext}`);

      // Jalankan ffmpeg dengan normalisasi timestamp awal nol dan filter resample audio
      // -map 0:v:0 -map 0:a? menangani video dengan atau tanpa audio tanpa error
      const ffmpegArgs = [
        '-y',
        '-i', filePath,
        '-map', '0:v:0',
        '-map', '0:a?',
        '-c:v', 'copy',
        '-c:a', 'aac',
        '-b:a', '192k',
        '-af', 'aresample=async=1000',
        '-avoid_negative_ts', 'make_zero',
        syncedPath,
      ];

      const proc = spawn(ffmpegPath, ffmpegArgs, { shell: false });
      proc.on('close', (procCode) => {
        if (procCode === 0 && fs.existsSync(syncedPath)) {
          try {
            const stats = fs.statSync(syncedPath);
            if (stats.size > 0) {
              fs.unlinkSync(filePath);
              fs.renameSync(syncedPath, filePath);
              return resolve(filePath);
            }
          } catch {}
        }
        if (fs.existsSync(syncedPath)) {
          try { fs.unlinkSync(syncedPath); } catch {}
        }
        resolve(filePath);
      });

      proc.on('error', () => {
        resolve(filePath);
      });
    });
  }
}

// Singleton global agar state pekerjaan terjaga antar request API Next.js
declare global {
  // eslint-disable-next-line no-var
  var __jobManagerInstance: JobManager | undefined;
}

export function getJobManager(): JobManager {
  if (!global.__jobManagerInstance) {
    global.__jobManagerInstance = new JobManager();
  }
  return global.__jobManagerInstance;
}
