'use client';

import React, { useState } from 'react';
import {
  Download,
  AlertCircle,
  CheckCircle2,
  XCircle,
  RefreshCw,
  FileCheck,
  AlertTriangle,
  Share2,
  Scissors,
  Subtitles,
  Check,
} from 'lucide-react';
import { Job } from '@/lib/types';

interface ActiveJobCardProps {
  job: Job;
  onCancelJob: (id: string) => void;
  onDismiss: () => void;
}

export default function ActiveJobCard({
  job,
  onCancelJob,
  onDismiss,
}: ActiveJobCardProps) {
  const [showConfirmCancel, setShowConfirmCancel] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [copiedShare, setCopiedShare] = useState(false);

  const handleShare = async () => {
    if (typeof window === 'undefined') return;
    const downloadUrl = `${window.location.origin}/api/jobs/${job.id}/file`;

    if (navigator.share) {
      try {
        await navigator.share({
          title: job.title,
          text: `Unduh berkas: ${job.title}`,
          url: downloadUrl,
        });
        return;
      } catch {
        // Abaikan jika dibatalkan pengguna
      }
    }

    try {
      await navigator.clipboard.writeText(downloadUrl);
      setCopiedShare(true);
      setTimeout(() => setCopiedShare(false), 2500);
    } catch {}
  };

  const handleConfirmCancel = () => {
    setIsCancelling(true);
    onCancelJob(job.id);
    setShowConfirmCancel(false);
  };

  const isCompleted = job.status === 'completed';
  const isFailed = job.status === 'failed';
  const isCancelled = job.status === 'cancelled';
  const isActive = job.status === 'pending' || job.status === 'downloading' || job.status === 'processing';

  // Badge Status yang ramah publik
  const getStatusBadge = () => {
    switch (job.status) {
      case 'pending':
        return (
          <span className="inline-flex items-center gap-1.5 rounded bg-amber-500/10 px-2.5 py-0.5 text-xs font-medium text-amber-400 border border-amber-500/30">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-400 animate-pulse" />
            Menyiapkan
          </span>
        );
      case 'downloading':
        return (
          <span className="inline-flex items-center gap-1.5 rounded bg-violet-muted px-2.5 py-0.5 text-xs font-medium text-violet-accent border border-violet-accent/30">
            <span className="h-1.5 w-1.5 rounded-full bg-violet-accent animate-pulse" />
            Sedang Mengunduh
          </span>
        );
      case 'processing':
        return (
          <span className="inline-flex items-center gap-1.5 rounded bg-violet-muted px-2.5 py-0.5 text-xs font-medium text-violet-hover border border-violet-accent/30">
            <RefreshCw className="h-3 w-3 animate-spin text-violet-accent" />
            Memproses Berkas
          </span>
        );
      case 'completed':
        return (
          <span className="inline-flex items-center gap-1.5 rounded bg-emerald-muted px-2.5 py-0.5 text-xs font-medium text-emerald-accent border border-emerald-accent/30">
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-accent" />
            Selesai
          </span>
        );
      case 'failed':
        return (
          <span className="inline-flex items-center gap-1.5 rounded bg-crimson-muted px-2.5 py-0.5 text-xs font-medium text-crimson-accent border border-crimson-accent/30">
            <AlertCircle className="h-3.5 w-3.5 text-crimson-accent" />
            Gagal
          </span>
        );
      case 'cancelled':
        return (
          <span className="inline-flex items-center gap-1.5 rounded bg-obsidian-lowest px-2.5 py-0.5 text-xs font-medium text-obsidian-muted border border-obsidian-border">
            <XCircle className="h-3.5 w-3.5 text-obsidian-faint" />
            Dibatalkan
          </span>
        );
    }
  };

  // Bersihkan nama file dari token internal jika ada
  const cleanFilename = job.outputFilename
    ? job.outputFilename.replace(/\s*\[job_[^\]]+\]/g, '')
    : job.title;

  return (
    <div className="rounded-xl border border-obsidian-border bg-obsidian-surface p-5 md:p-6 shadow-xl space-y-4">
      {/* Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-obsidian-border pb-3">
        <span className="text-xs font-semibold uppercase tracking-wider text-obsidian-muted">
          Status Unduhan
        </span>
        <div>{getStatusBadge()}</div>
      </div>

        {/* Informasi Judul */}
      <div>
        <h4 className="text-sm font-semibold text-white line-clamp-1">{job.title}</h4>
        <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-obsidian-muted">
          <span className="text-white font-medium">{job.platformName}</span>
          <span>-</span>
          <span className="rounded bg-obsidian-lowest px-1.5 py-0.5 text-violet-accent border border-obsidian-border">
            {job.qualityLabel}
          </span>
          {job.trimRange && (
            <span className="flex items-center gap-1 rounded bg-obsidian-lowest px-1.5 py-0.5 text-violet-accent border border-obsidian-border font-mono text-[11px]">
              <Scissors className="h-3 w-3" />
              <span>{job.trimRange}</span>
            </span>
          )}
          {job.subtitleLang && (
            <span className="flex items-center gap-1 rounded bg-obsidian-lowest px-1.5 py-0.5 text-emerald-accent border border-obsidian-border font-mono text-[11px]">
              <Subtitles className="h-3 w-3" />
              <span>Sub: {job.subtitleLang}</span>
            </span>
          )}
        </div>
      </div>

      {/* Status: Sedang Aktif */}
      {isActive && (
        <div className="space-y-3 pt-1">
          {/* Progress Bar Container */}
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs">
              <span className="text-obsidian-muted">Kemajuan:</span>
              <span className="font-semibold text-violet-accent">{job.progress.toFixed(0)}%</span>
            </div>

            <div className="h-2 w-full overflow-hidden rounded-full bg-obsidian-lowest border border-obsidian-border">
              <div
                className="h-full bg-violet-accent transition-all duration-300 ease-out"
                style={{ width: `${Math.max(2, job.progress)}%` }}
              />
            </div>
          </div>

          {/* Metrik Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 rounded-lg border border-obsidian-border bg-obsidian-lowest p-3 text-xs">
            <div>
              <span className="text-[11px] text-obsidian-faint block">Ukuran</span>
              <span className="font-medium text-white font-mono">
                {job.downloadedFormatted || '0 B'} {job.totalFormatted ? `/ ${job.totalFormatted}` : ''}
              </span>
            </div>
            <div>
              <span className="text-[11px] text-obsidian-faint block">Kecepatan</span>
              <span className="font-medium text-violet-accent font-mono">
                {job.speed || 'Menghitung...'}
              </span>
            </div>
            <div className="col-span-2 sm:col-span-1">
              <span className="text-[11px] text-obsidian-faint block">Sisa Waktu</span>
              <span className="font-medium text-white font-mono">
                {job.eta || 'Menghitung...'}
              </span>
            </div>
          </div>

          {/* Tombol Batalkan */}
          <div className="flex justify-end pt-1">
            <button
              type="button"
              onClick={() => setShowConfirmCancel(true)}
              disabled={isCancelling}
              className="flex items-center gap-1.5 rounded border border-crimson-accent/30 bg-crimson-muted px-3 py-1.5 text-xs font-medium text-crimson-accent transition-colors hover:bg-crimson-accent hover:text-white disabled:opacity-40"
            >
              <XCircle className="h-3.5 w-3.5" />
              <span>Batalkan</span>
            </button>
          </div>
        </div>
      )}

      {/* Status: Selesai */}
      {isCompleted && (
        <div className="space-y-4 pt-1">
          <div className="rounded-lg border border-emerald-accent/30 bg-emerald-muted p-4">
            <div className="flex items-start gap-3">
              <FileCheck className="h-5 w-5 text-emerald-accent shrink-0 mt-0.5" />
              <div className="flex-1 space-y-1">
                <p className="text-xs font-semibold text-emerald-accent">
                  Berkas siap diunduh ke perangkat Anda:
                </p>
                <p className="text-xs text-white break-all font-medium">
                  {cleanFilename}
                </p>
                {job.outputSizeFormatted && (
                  <p className="text-[11px] text-obsidian-muted">
                    Ukuran:{' '}
                    <span className="font-semibold text-emerald-accent font-mono">
                      {job.outputSizeFormatted}
                    </span>
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Tombol Aksi Selesai */}
          <div className="flex flex-col sm:flex-row items-center justify-end gap-2.5 pt-1">
            <button
              type="button"
              onClick={onDismiss}
              className="w-full sm:w-auto rounded-lg border border-obsidian-border bg-obsidian-surface px-4 py-2 text-xs font-medium text-obsidian-muted hover:border-obsidian-border-strong hover:text-white"
            >
              Unduh Media Lain
            </button>

            <button
              type="button"
              onClick={handleShare}
              className="flex w-full sm:w-auto items-center justify-center gap-1.5 rounded-lg border border-violet-accent/40 bg-violet-muted px-4 py-2 text-xs font-medium text-violet-accent hover:border-violet-accent hover:bg-violet-accent hover:text-obsidian-canvas transition-colors"
              title="Bagikan tautan berkas"
            >
              {copiedShare ? <Check className="h-4 w-4" /> : <Share2 className="h-4 w-4" />}
              <span>{copiedShare ? 'Tautan Disalin!' : 'Bagikan'}</span>
            </button>

            <a
              href={`/api/jobs/${job.id}/file`}
              download={job.outputFilename || true}
              className="flex w-full sm:w-auto items-center justify-center gap-2 rounded-lg bg-emerald-accent px-6 py-2 text-xs font-semibold text-obsidian-canvas shadow-sm transition-all hover:brightness-110"
            >
              <Download className="h-4 w-4 stroke-[2.5]" />
              <span>Simpan Berkas</span>
            </a>
          </div>
        </div>
      )}

      {/* Status: Gagal */}
      {isFailed && (
        <div className="space-y-4 pt-1">
          <div className="rounded-lg border border-crimson-accent/30 bg-crimson-muted p-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-crimson-accent shrink-0 mt-0.5" />
              <div className="flex-1 space-y-1">
                <p className="text-xs font-semibold text-crimson-accent">Tidak dapat mengunduh media:</p>
                <p className="text-xs text-obsidian-muted">{job.errorMessage || 'Proses unduhan gagal. Pastikan tautan masih aktif.'}</p>
              </div>
            </div>
          </div>

          <div className="flex justify-end pt-1">
            <button
              type="button"
              onClick={onDismiss}
              className="rounded-lg border border-obsidian-border bg-obsidian-surface px-4 py-2 text-xs font-medium text-obsidian-muted hover:text-white"
            >
              Tutup
            </button>
          </div>
        </div>
      )}

      {/* Status: Dibatalkan */}
      {isCancelled && (
        <div className="flex items-center justify-between rounded-lg border border-obsidian-border bg-obsidian-lowest p-3 text-xs">
          <span className="text-obsidian-muted">Unduhan telah dibatalkan.</span>
          <button
            type="button"
            onClick={onDismiss}
            className="rounded border border-obsidian-border bg-obsidian-surface px-3 py-1 text-obsidian-muted hover:text-white"
          >
            Tutup
          </button>
        </div>
      )}

      {/* Modal Konfirmasi Pembatalan */}
      {showConfirmCancel && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-xl border border-obsidian-border bg-obsidian-surface p-5 shadow-2xl space-y-4">
            <div className="flex items-center gap-2 text-crimson-accent">
              <AlertTriangle className="h-5 w-5" />
              <h4 className="text-sm font-semibold text-white">Konfirmasi Pembatalan</h4>
            </div>
            <p className="text-xs text-obsidian-muted">
              Apakah Anda yakin ingin membatalkan proses unduhan ini?
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowConfirmCancel(false)}
                className="rounded border border-obsidian-border bg-obsidian-lowest px-3 py-1.5 text-xs text-obsidian-muted hover:text-white"
              >
                Kembali
              </button>
              <button
                type="button"
                onClick={handleConfirmCancel}
                className="rounded bg-crimson-accent px-3.5 py-1.5 text-xs font-semibold text-white hover:brightness-110"
              >
                Ya, Batalkan
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
