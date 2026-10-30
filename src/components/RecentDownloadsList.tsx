'use client';

import React, { useState } from 'react';
import {
  Film,
  Music,
  Download,
  CheckCircle2,
  AlertCircle,
  XCircle,
  FileX,
  HardDrive,
  Clock,
  RotateCw,
  Trash2,
  Sparkles,
  Zap,
  Share2,
  Check,
} from 'lucide-react';
import { Job } from '@/lib/types';

interface CleanupStatus {
  retentionMinutes: number;
  totalTrackedJobs: number;
  filesDeletedInLastRun: number;
  lastRunTimestamp: number | null;
  downloadDir: string;
}

interface RecentDownloadsListProps {
  jobs: Job[];
  onRefresh: () => void;
  isLoading: boolean;
  onCompressFile?: (filename: string) => void;
}

export default function RecentDownloadsList({
  jobs,
  onRefresh,
  isLoading,
  onCompressFile,
}: RecentDownloadsListProps) {
  const [cleanupStatus, setCleanupStatus] = useState<CleanupStatus | null>(null);
  const [isCleaning, setIsCleaning] = useState(false);
  const [cleanupMessage, setCleanupMessage] = useState<string | null>(null);
  const [sharedJobId, setSharedJobId] = useState<string | null>(null);

  React.useEffect(() => {
    fetch('/api/system/cleanup', { cache: 'no-store' })
      .then((res) => res.json())
      .then((data) => {
        if (data.success && data.status) {
          setCleanupStatus(data.status);
        }
      })
      .catch(() => {});
  }, []);

  const handleRetentionChange = async (minutes: number) => {
    try {
      const res = await fetch('/api/system/cleanup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'update_retention', retentionMinutes: minutes }),
      });
      const data = await res.json();
      if (data.success && data.status) {
        setCleanupStatus(data.status);
        setCleanupMessage(data.message);
        setTimeout(() => setCleanupMessage(null), 3000);
      }
    } catch {}
  };

  const handleCleanNow = async () => {
    setIsCleaning(true);
    setCleanupMessage(null);
    try {
      const res = await fetch('/api/system/cleanup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'clean_now' }),
      });
      const data = await res.json();
      if (data.success) {
        setCleanupMessage(data.message);
        onRefresh();
        setTimeout(() => setCleanupMessage(null), 3000);
      }
    } catch {
      setCleanupMessage('Gagal membersihkan berkas.');
    } finally {
      setIsCleaning(false);
    }
  };

  const handleShareJob = async (job: Job) => {
    const fileUrl = `${window.location.origin}/api/jobs/${job.id}/file`;
    if (navigator.share) {
      try {
        await navigator.share({
          title: job.title,
          text: `Unduh berkas: ${job.title}`,
          url: fileUrl,
        });
        return;
      } catch {}
    }

    try {
      await navigator.clipboard.writeText(fileUrl);
      setSharedJobId(job.id);
      setTimeout(() => setSharedJobId(null), 2000);
    } catch {}
  };

  const formatDate = (ts: number) => {
    try {
      return new Date(ts).toLocaleTimeString('id-ID', {
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return '';
    }
  };

  return (
    <div className="rounded-xl border border-obsidian-border bg-obsidian-surface p-4 sm:p-5 md:p-6 shadow-lg space-y-4">
      {/* Header Bar */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-obsidian-lowest text-obsidian-muted border border-obsidian-border">
            <HardDrive className="h-4 w-4 text-violet-accent" />
          </div>
          <div>
            <h3 className="text-sm sm:text-base font-semibold tracking-tight text-white">
              Riwayat Unduhan
            </h3>
            <p className="text-[11px] sm:text-xs text-obsidian-muted">
              Daftar berkas yang baru saja Anda unduh pada sesi ini.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={onRefresh}
          disabled={isLoading}
          className="flex h-8 w-8 items-center justify-center rounded-lg border border-obsidian-border bg-obsidian-lowest text-obsidian-muted hover:border-obsidian-border-strong hover:text-white transition-colors"
          title="Segarkan riwayat"
        >
          <RotateCw className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin text-violet-accent' : ''}`} />
        </button>
      </div>

      {/* Pengaturan Retensi Pembersihan Otomatis (Mobile-Optimized) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 rounded-lg border border-obsidian-border bg-obsidian-lowest p-2.5 sm:p-3">
        <div className="flex flex-col sm:flex-row sm:items-center gap-2 flex-1 min-w-0">
          <div className="flex items-center gap-1.5 text-xs text-obsidian-muted shrink-0">
            <Clock className="h-3.5 w-3.5 text-violet-accent" />
            <span className="font-medium">Penyimpanan Sementara:</span>
          </div>

          <select
            value={cleanupStatus?.retentionMinutes ?? 60}
            onChange={(e) => handleRetentionChange(Number(e.target.value))}
            className="w-full sm:w-auto rounded border border-obsidian-border bg-obsidian-surface px-2.5 py-1.5 sm:py-1 text-xs text-white focus:border-violet-accent focus:outline-none"
          >
            <option value={15}>Hapus otomatis 15 Menit</option>
            <option value={30}>Hapus otomatis 30 Menit</option>
            <option value={60}>Hapus otomatis 1 Jam (Bawaan)</option>
            <option value={180}>Hapus otomatis 3 Jam</option>
            <option value={360}>Hapus otomatis 6 Jam</option>
            <option value={1440}>Hapus otomatis 24 Jam</option>
            <option value={0}>Simpan Selamanya</option>
          </select>
        </div>

        <button
          type="button"
          onClick={handleCleanNow}
          disabled={isCleaning}
          className="self-end sm:self-auto flex items-center justify-center gap-1.5 rounded border border-obsidian-border bg-obsidian-elevated px-2.5 py-1.5 sm:py-1 text-xs text-obsidian-muted hover:border-obsidian-border-strong hover:text-white disabled:opacity-40 transition-colors shrink-0"
          title="Bersihkan berkas sekarang"
        >
          <Trash2 className="h-3.5 w-3.5 text-crimson-accent" />
          <span>{isCleaning ? 'Membersihkan...' : 'Bersihkan Sekarang'}</span>
        </button>
      </div>

      {/* Pesan Notifikasi */}
      {cleanupMessage && (
        <div className="rounded border border-emerald-accent/30 bg-emerald-muted px-3 py-1.5 text-xs text-emerald-accent flex items-center gap-1.5">
          <Sparkles className="h-3.5 w-3.5" />
          <span>{cleanupMessage}</span>
        </div>
      )}

      {/* Daftar Berkas */}
      {jobs.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-10 text-center text-obsidian-faint">
          <HardDrive className="h-8 w-8 stroke-[1.5] mb-2 opacity-50" />
          <p className="text-xs font-medium text-obsidian-muted">Belum ada riwayat unduhan.</p>
          <p className="mt-0.5 text-xs text-obsidian-faint">
            Tempelkan tautan video atau audio di atas untuk memulai unduhan pertama Anda.
          </p>
        </div>
      ) : (
        <div className="divide-y divide-obsidian-border/50">
          {jobs.map((job) => {
            const isCompleted = job.status === 'completed';
            const isFailed = job.status === 'failed';
            const isCancelled = job.status === 'cancelled';
            const fileAvailable = isCompleted && job.fileExists !== false;

            return (
              <div
                key={job.id}
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 py-3 transition-colors hover:bg-obsidian-elevated/40 px-1.5 sm:px-2 rounded-lg"
              >
                {/* Kolom Kiri: Ikon & Detail */}
                <div className="flex items-start gap-2.5 sm:gap-3 min-w-0 flex-1">
                  <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-obsidian-lowest text-obsidian-muted border border-obsidian-border">
                    {job.type === 'video' ? (
                      <Film className="h-4 w-4 text-violet-accent" />
                    ) : (
                      <Music className="h-4 w-4 text-emerald-accent" />
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold text-white line-clamp-2 sm:truncate leading-snug">
                      {job.title}
                    </p>

                    <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px] text-obsidian-muted">
                      <span className="text-white font-medium">{job.platformName}</span>
                      <span className="text-obsidian-faint">·</span>
                      <span className="text-violet-accent">{job.qualityLabel}</span>
                      {job.outputSizeFormatted && (
                        <>
                          <span className="text-obsidian-faint">·</span>
                          <span className="text-white font-medium font-mono">{job.outputSizeFormatted}</span>
                        </>
                      )}
                      <span className="text-obsidian-faint">·</span>
                      <span className="flex items-center gap-1 text-obsidian-faint font-mono">
                        <Clock className="h-3 w-3" />
                        <span>{formatDate(job.createdAt)}</span>
                      </span>
                    </div>
                  </div>
                </div>

                {/* Kolom Kanan / Bawah: Baris Aksi yang Rapi di Mobile */}
                <div className="flex items-center justify-between sm:justify-end gap-2 w-full sm:w-auto pt-2 sm:pt-0 border-t border-obsidian-border/30 sm:border-t-0 shrink-0">
                  {/* Status Badge */}
                  <div>
                    {isCompleted && fileAvailable && (
                      <span className="inline-flex items-center gap-1 rounded bg-emerald-muted px-2 py-0.5 text-[11px] font-medium text-emerald-accent border border-emerald-accent/30">
                        <CheckCircle2 className="h-3 w-3" /> Siap Diunduh
                      </span>
                    )}

                    {isCompleted && !fileAvailable && (
                      <span
                        className="inline-flex items-center gap-1 rounded bg-obsidian-lowest px-2 py-0.5 text-[11px] font-medium text-obsidian-muted border border-obsidian-border"
                        title="Berkas telah kedaluwarsa dan dihapus otomatis dari server"
                      >
                        <FileX className="h-3 w-3 text-obsidian-faint" /> Kedaluwarsa
                      </span>
                    )}

                    {isFailed && (
                      <span
                        className="inline-flex items-center gap-1 rounded bg-crimson-muted px-2 py-0.5 text-[11px] font-medium text-crimson-accent border border-crimson-accent/30"
                        title={job.errorMessage}
                      >
                        <AlertCircle className="h-3 w-3" /> Gagal
                      </span>
                    )}

                    {isCancelled && (
                      <span className="inline-flex items-center gap-1 rounded bg-obsidian-lowest px-2 py-0.5 text-[11px] font-medium text-obsidian-muted border border-obsidian-border">
                        <XCircle className="h-3 w-3 text-obsidian-faint" /> Dibatalkan
                      </span>
                    )}
                  </div>

                  {/* Tombol Aksi */}
                  <div className="flex items-center gap-1.5">
                    {/* Tombol Kompres Berkas */}
                    {isCompleted && fileAvailable && job.outputFilename && onCompressFile && (
                      <button
                        type="button"
                        onClick={() => onCompressFile(job.outputFilename!)}
                        className="flex items-center gap-1 rounded border border-violet-accent/40 bg-violet-muted px-2.5 py-1 text-xs font-medium text-violet-accent transition-colors hover:border-violet-accent hover:bg-violet-accent hover:text-obsidian-canvas"
                        title="Perkecil ukuran berkas ini"
                      >
                        <Zap className="h-3 w-3" />
                        <span>Kompres</span>
                      </button>
                    )}

                    {/* Tombol Bagikan */}
                    {isCompleted && fileAvailable && (
                      <button
                        type="button"
                        onClick={() => handleShareJob(job)}
                        className="flex items-center justify-center h-7 w-7 rounded border border-obsidian-border bg-obsidian-lowest text-obsidian-muted hover:border-obsidian-border-strong hover:text-white transition-colors"
                        title="Bagikan berkas"
                      >
                        {sharedJobId === job.id ? <Check className="h-3.5 w-3.5 text-emerald-accent" /> : <Share2 className="h-3.5 w-3.5" />}
                      </button>
                    )}

                    {/* Tombol Unduh Utama */}
                    {isCompleted && fileAvailable && (
                      <a
                        href={`/api/jobs/${job.id}/file`}
                        download={job.outputFilename || true}
                        className="flex items-center gap-1 rounded bg-violet-accent hover:bg-violet-hover px-2.5 py-1 text-xs font-semibold text-obsidian-canvas transition-colors shadow-sm"
                        title="Unduh berkas ke perangkat"
                      >
                        <Download className="h-3.5 w-3.5 stroke-[2.5]" />
                        <span>Unduh</span>
                      </a>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
