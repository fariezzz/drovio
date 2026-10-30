import fs from 'fs';
import path from 'path';
import { getConfig } from './config';
import { getJobManager } from './job-queue';
import { formatBytes } from './media-service';

export interface CleanupStatus {
  enabled: boolean;
  retentionMinutes: number; // 0 = nonaktif
  lastRunTime?: number;
  lastRunFormatted?: string;
  totalDeletedFiles: number;
  totalDeletedBytes: number;
  totalDeletedFormatted: string;
}

class CleanupService {
  private retentionMinutes: number;
  private intervalTimer?: NodeJS.Timeout;
  private lastRunTime?: number;
  private totalDeletedFiles = 0;
  private totalDeletedBytes = 0;

  constructor() {
    const config = getConfig();
    const envVal = parseInt(process.env.AUTO_CLEANUP_MINUTES || '60', 10);
    this.retentionMinutes = isNaN(envVal) ? 60 : envVal;

    // Mulai background worker pembersihan setiap 60 detik
    if (typeof setInterval !== 'undefined') {
      this.intervalTimer = setInterval(() => {
        this.runScheduledCleanup();
      }, 60 * 1000);
    }
  }

  // Dapatkan konfigurasi dan statistik saat ini
  public getStatus(): CleanupStatus {
    return {
      enabled: this.retentionMinutes > 0,
      retentionMinutes: this.retentionMinutes,
      lastRunTime: this.lastRunTime,
      lastRunFormatted: this.lastRunTime
        ? new Date(this.lastRunTime).toLocaleTimeString('id-ID', {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
          })
        : undefined,
      totalDeletedFiles: this.totalDeletedFiles,
      totalDeletedBytes: this.totalDeletedBytes,
      totalDeletedFormatted: formatBytes(this.totalDeletedBytes),
    };
  }

  // Perbarui durasi retensi (menit)
  public setRetentionMinutes(minutes: number) {
    this.retentionMinutes = Math.max(0, Math.floor(minutes));
  }

  // Jalankan pembersihan berkala
  public runScheduledCleanup(): { deletedFiles: number; deletedBytes: number } {
    if (this.retentionMinutes <= 0) {
      return { deletedFiles: 0, deletedBytes: 0 };
    }

    return this.cleanFilesOlderThan(this.retentionMinutes);
  }

  // Bersihkan hasil unduhan milik sesi browser yang sedang meminta.
  // File milik sesi lain tidak pernah disentuh.
  public cleanNow(sessionId: string): { deletedFiles: number; deletedBytes: number; message: string } {
    const result = this.cleanOwnedFiles(sessionId);

    const message =
      result.deletedFiles > 0
        ? `Berhasil membersihkan ${result.deletedFiles} berkas (${formatBytes(result.deletedBytes)} ruang dibebaskan).`
        : 'Tidak ada berkas milik sesi ini yang dapat dibersihkan.';

    return {
      deletedFiles: result.deletedFiles,
      deletedBytes: result.deletedBytes,
      message,
    };
  }

  private cleanOwnedFiles(sessionId: string): { deletedFiles: number; deletedBytes: number } {
    const filesToDelete = new Set<string>();

    try {
      const jobManager = getJobManager();
      for (const job of jobManager.listJobs(100)) {
        const isActive =
          job.status === 'pending' ||
          job.status === 'downloading' ||
          job.status === 'processing';
        if (!isActive && job.ownerSessionId === sessionId && job.outputFilepath) {
          filesToDelete.add(path.resolve(job.outputFilepath));
        }
      }
    } catch {
      // Jika status pekerjaan tidak dapat dibaca, jangan hapus file apa pun.
    }

    let deletedFiles = 0;
    let deletedBytes = 0;
    for (const fullPath of filesToDelete) {
      try {
        if (!fs.existsSync(fullPath)) continue;
        const stats = fs.statSync(fullPath);
        fs.unlinkSync(fullPath);
        deletedFiles++;
        deletedBytes += stats.size;
        this.totalDeletedFiles++;
        this.totalDeletedBytes += stats.size;
      } catch {
        // Abaikan file yang terkunci atau tidak dapat dihapus.
      }
    }

    this.lastRunTime = Date.now();
    return { deletedFiles, deletedBytes };
  }

  // Hapus berkas yang lebih lama dari N menit
  private cleanFilesOlderThan(minutes: number): { deletedFiles: number; deletedBytes: number } {
    const config = getConfig();
    const now = Date.now();
    const cutoffTime = now - minutes * 60 * 1000;

    let deletedFiles = 0;
    let deletedBytes = 0;

    const directoriesToScan = [
      config.downloadDir,
      path.join(config.downloadDir, 'compressed'),
      path.join(config.downloadDir, 'converted'),
      path.join(config.downloadDir, 'previews'),
    ];

    for (const dir of directoriesToScan) {
      if (!fs.existsSync(dir)) continue;

      try {
        const entries = fs.readdirSync(dir, { withFileTypes: true });

        for (const entry of entries) {
          if (!entry.isFile()) continue;

          // Jangan sentuh file konfigurasi atau file sementara yang sedang diunduh
          if (
            entry.name.startsWith('.') ||
            entry.name.endsWith('.part') ||
            entry.name.endsWith('.ytdl')
          ) {
            continue;
          }

          const fullPath = path.join(dir, entry.name);

          try {
            const stats = fs.statSync(fullPath);

            // Jika file lebih lama dari batas waktu retensi
            if (stats.mtimeMs < cutoffTime) {
              const size = stats.size;
              fs.unlinkSync(fullPath);
              deletedFiles++;
              deletedBytes += size;
              this.totalDeletedFiles++;
              this.totalDeletedBytes += size;
            }
          } catch {
            // Abaikan jika file terkunci atau gagal diakses
          }
        }
      } catch {
        // Abaikan error pembacaan folder
      }
    }

    this.lastRunTime = now;

    // Sinkronkan status ketersediaan file pada riwayat pekerjaan aktif
    try {
      const jobManager = getJobManager();
      for (const job of jobManager.listJobs(100)) {
        if (job.status === 'completed' && job.outputFilepath) {
          job.fileExists = fs.existsSync(job.outputFilepath);
        }
      }
    } catch {
      // Abaikan
    }

    return { deletedFiles, deletedBytes };
  }
}

// Global singleton instance
declare global {
  // eslint-disable-next-line no-var
  var __cleanupServiceInstance: CleanupService | undefined;
}

export function getCleanupService(): CleanupService {
  if (!global.__cleanupServiceInstance) {
    global.__cleanupServiceInstance = new CleanupService();
  }
  return global.__cleanupServiceInstance;
}
