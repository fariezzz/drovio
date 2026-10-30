'use client';

import React, { useState } from 'react';
import {
  Download,
  CheckCircle2,
  AlertCircle,
  XCircle,
  Loader2,
  RefreshCw,
  FileCheck,
  Share2,
  Check,
  X,
  Layers,
  Film,
  Music,
} from 'lucide-react';
import { Job } from '@/lib/types';

interface BatchActiveJobsCardProps {
  jobs: Job[];
  onCancelJob: (id: string) => void;
  onDismissJob: (id: string) => void;
  onDismissAll: () => void;
}

export default function BatchActiveJobsCard({
  jobs,
  onCancelJob,
  onDismissJob,
  onDismissAll,
}: BatchActiveJobsCardProps) {
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const completedCount = jobs.filter((j) => j.status === 'completed').length;
  const inProgressCount = jobs.filter(
    (j) => j.status === 'pending' || j.status === 'downloading' || j.status === 'processing'
  ).length;

  const handleShare = async (job: Job) => {
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
      } catch {}
    }

    try {
      await navigator.clipboard.writeText(downloadUrl);
      setCopiedId(job.id);
      setTimeout(() => setCopiedId(null), 2500);
    } catch {}
  };

  return (
    <div className="rounded-xl border border-obsidian-border bg-obsidian-surface p-5 md:p-6 shadow-xl space-y-4">
      {/* Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-obsidian-border pb-3.5">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-obsidian-lowest border border-obsidian-border text-violet-accent">
            <Layers className="h-4 w-4" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white tracking-tight">
              Antrean Unduhan (Batch)
            </h3>
            <p className="text-xs text-obsidian-muted">
              {inProgressCount > 0
                ? `Sedang memproses ${inProgressCount} berkas berurutan di latar belakang`
                : 'Semua proses dalam antrean ini telah selesai'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="rounded bg-obsidian-lowest px-2.5 py-1 text-xs font-mono font-medium text-violet-accent border border-obsidian-border">
            Selesai: {completedCount} / {jobs.length}
          </span>
          <button
            type="button"
            onClick={onDismissAll}
            className="rounded border border-obsidian-border bg-obsidian-lowest px-2.5 py-1 text-xs text-obsidian-muted hover:border-obsidian-border-strong hover:text-white transition-colors"
          >
            Tutup Semua
          </button>
        </div>
      </div>

      {/* Daftar Item Unduhan Batch */}
      <div className="divide-y divide-obsidian-border/50 space-y-3 pt-1">
        {jobs.map((job) => {
          const isCompleted = job.status === 'completed';
          const isFailed = job.status === 'failed';
          const isCancelled = job.status === 'cancelled';
          const isActive =
            job.status === 'pending' || job.status === 'downloading' || job.status === 'processing';

          const cleanFilename = job.outputFilename
            ? job.outputFilename.replace(/\s*\[job_[^\]]+\]/g, '')
            : job.title;

          return (
            <div key={job.id} className="pt-3 first:pt-0 space-y-2.5">
              {/* Header Baris Item */}
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-2.5 min-w-0 flex-1">
                  <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded bg-obsidian-lowest text-obsidian-muted border border-obsidian-border">
                    {job.type === 'video' ? (
                      <Film className="h-3.5 w-3.5 text-violet-accent" />
                    ) : (
                      <Music className="h-3.5 w-3.5 text-emerald-accent" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold text-white truncate">
                      {isCompleted ? cleanFilename : job.title}
                    </p>
                    <div className="mt-0.5 flex flex-wrap items-center gap-2 text-[11px] text-obsidian-muted">
                      <span>{job.platformName}</span>
                      <span>-</span>
                      <span className="text-violet-accent">{job.qualityLabel}</span>
                      {job.outputSizeFormatted && (
                        <>
                          <span>-</span>
                          <span className="text-white font-mono">{job.outputSizeFormatted}</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {/* Status Badge & Dismiss Button */}
                <div className="flex items-center gap-1.5 shrink-0">
                  {job.status === 'pending' && (
                    <span className="inline-flex items-center gap-1 rounded bg-amber-500/10 px-2 py-0.5 text-[10px] text-amber-400 border border-amber-500/30">
                      <span className="h-1.5 w-1.5 rounded-full bg-amber-400 animate-pulse" />
                      Menunggu
                    </span>
                  )}
                  {job.status === 'downloading' && (
                    <span className="inline-flex items-center gap-1 rounded bg-violet-muted px-2 py-0.5 text-[10px] text-violet-accent border border-violet-accent/30">
                      <Loader2 className="h-3 w-3 animate-spin" />
                      Mengunduh
                    </span>
                  )}
                  {job.status === 'processing' && (
                    <span className="inline-flex items-center gap-1 rounded bg-violet-muted px-2 py-0.5 text-[10px] text-violet-hover border border-violet-accent/30">
                      <RefreshCw className="h-3 w-3 animate-spin" />
                      Memproses
                    </span>
                  )}
                  {isCompleted && (
                    <span className="inline-flex items-center gap-1 rounded bg-emerald-muted px-2 py-0.5 text-[10px] text-emerald-accent border border-emerald-accent/30">
                      <CheckCircle2 className="h-3 w-3" />
                      Selesai
                    </span>
                  )}
                  {isFailed && (
                    <span className="inline-flex items-center gap-1 rounded bg-crimson-muted px-2 py-0.5 text-[10px] text-crimson-accent border border-crimson-accent/30">
                      <AlertCircle className="h-3 w-3" />
                      Gagal
                    </span>
                  )}
                  {isCancelled && (
                    <span className="inline-flex items-center gap-1 rounded bg-obsidian-lowest px-2 py-0.5 text-[10px] text-obsidian-muted border border-obsidian-border">
                      <XCircle className="h-3 w-3" />
                      Dibatalkan
                    </span>
                  )}

                  <button
                    type="button"
                    onClick={() => onDismissJob(job.id)}
                    className="rounded p-1 text-obsidian-faint hover:text-white transition-colors"
                    title="Tutup dari daftar"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>

              {/* Progress Bar jika sedang aktif */}
              {isActive && (
                <div className="space-y-1.5">
                  <div className="flex justify-between text-[11px] font-mono">
                    <span className="text-obsidian-faint">
                      {job.speed ? `${job.speed} · ` : ''}
                      {job.downloadedFormatted ? `${job.downloadedFormatted} / ${job.totalFormatted || ''}` : ''}
                    </span>
                    <span className="font-semibold text-violet-accent">{job.progress.toFixed(0)}%</span>
                  </div>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-obsidian-lowest border border-obsidian-border">
                    <div
                      className="h-full bg-violet-accent transition-all duration-300"
                      style={{ width: `${Math.max(2, job.progress)}%` }}
                    />
                  </div>
                </div>
              )}

              {/* Error message jika gagal */}
              {isFailed && job.errorMessage && (
                <p className="text-[11px] text-crimson-accent bg-crimson-muted/30 p-2 rounded border border-crimson-accent/20">
                  {job.errorMessage}
                </p>
              )}

              {/* Aksi Baris Item */}
              <div className="flex items-center justify-end gap-2 pt-0.5">
                {isActive && (
                  <button
                    type="button"
                    onClick={() => onCancelJob(job.id)}
                    className="flex items-center gap-1 rounded border border-crimson-accent/30 bg-crimson-muted px-2.5 py-1 text-[11px] font-medium text-crimson-accent hover:bg-crimson-accent hover:text-white transition-colors"
                  >
                    <XCircle className="h-3 w-3" />
                    <span>Batalkan</span>
                  </button>
                )}

                {isCompleted && (
                  <>
                    <button
                      type="button"
                      onClick={() => handleShare(job)}
                      className="flex items-center gap-1 rounded border border-violet-accent/40 bg-violet-muted px-2.5 py-1 text-[11px] font-medium text-violet-accent hover:border-violet-accent hover:bg-violet-accent hover:text-obsidian-canvas transition-colors"
                      title="Bagikan tautan"
                    >
                      {copiedId === job.id ? <Check className="h-3 w-3" /> : <Share2 className="h-3 w-3" />}
                      <span>{copiedId === job.id ? 'Disalin' : 'Bagikan'}</span>
                    </button>

                    <a
                      href={`/api/jobs/${job.id}/file`}
                      download={job.outputFilename || true}
                      className="flex items-center gap-1.5 rounded-lg bg-emerald-accent px-3 py-1 text-xs font-semibold text-obsidian-canvas shadow-sm hover:brightness-110 transition-all"
                    >
                      <Download className="h-3.5 w-3.5 stroke-[2.5]" />
                      <span>Simpan Berkas</span>
                    </a>
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
