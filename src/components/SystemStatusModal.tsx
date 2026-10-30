'use client';

import React from 'react';
import { X, CheckCircle2, AlertTriangle, Terminal, FolderCheck, FolderX } from 'lucide-react';
import { SystemHealth } from '@/lib/types';

interface SystemStatusModalProps {
  isOpen: boolean;
  onClose: () => void;
  health: SystemHealth | null;
  onRefresh: () => void;
}

export default function SystemStatusModal({
  isOpen,
  onClose,
  health,
  onRefresh,
}: SystemStatusModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-xl border border-obsidian-border bg-obsidian-surface p-6 shadow-2xl space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-obsidian-border pb-3.5">
          <div className="flex items-center gap-2">
            <Terminal className="h-5 w-5 text-violet-accent" />
            <h3 className="text-sm font-semibold text-white tracking-tight">Status Dependensi Mesin Lokal</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 text-obsidian-muted hover:bg-obsidian-elevated hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Content */}
        <div className="space-y-3">
          {/* OS Info */}
          <div className="rounded-lg border border-obsidian-border bg-obsidian-lowest p-2.5 font-mono text-xs text-obsidian-muted">
            <span className="text-obsidian-faint">Sistem Operasi:</span>{' '}
            <span className="text-white font-medium">{health?.operatingSystem || 'Mendeteksi...'}</span>
          </div>

          {/* yt-dlp */}
          <div className="rounded-lg border border-obsidian-border bg-obsidian-lowest p-3.5 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-white">yt-dlp (Media Extractor Engine)</span>
              {health?.ytdlp.available ? (
                <span className="inline-flex items-center gap-1 rounded bg-emerald-muted px-2 py-0.5 font-mono text-[10px] font-semibold text-emerald-accent border border-emerald-accent/30">
                  <CheckCircle2 className="h-3 w-3" /> Terpasang
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 rounded bg-crimson-muted px-2 py-0.5 font-mono text-[10px] font-semibold text-crimson-accent border border-crimson-accent/30">
                  <AlertTriangle className="h-3 w-3" /> Tidak Ditemukan
                </span>
              )}
            </div>
            <div className="space-y-0.5 font-mono text-[11px] text-obsidian-muted">
              <p className="truncate text-obsidian-faint">
                Path: <span className="text-obsidian-muted">{health?.ytdlp.path || 'Belum terdeteksi'}</span>
              </p>
              {health?.ytdlp.version && (
                <p>
                  Versi: <span className="text-white">{health.ytdlp.version}</span>
                </p>
              )}
              {health?.ytdlp.error && (
                <p className="text-crimson-accent">Pesan: {health.ytdlp.error}</p>
              )}
            </div>
          </div>

          {/* ffmpeg */}
          <div className="rounded-lg border border-obsidian-border bg-obsidian-lowest p-3.5 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-white">FFmpeg (Stream Muxer &amp; Converter)</span>
              {health?.ffmpeg.available ? (
                <span className="inline-flex items-center gap-1 rounded bg-emerald-muted px-2 py-0.5 font-mono text-[10px] font-semibold text-emerald-accent border border-emerald-accent/30">
                  <CheckCircle2 className="h-3 w-3" /> Terpasang
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 rounded bg-crimson-muted px-2 py-0.5 font-mono text-[10px] font-semibold text-crimson-accent border border-crimson-accent/30">
                  <AlertTriangle className="h-3 w-3" /> Tidak Ditemukan
                </span>
              )}
            </div>
            <div className="space-y-0.5 font-mono text-[11px] text-obsidian-muted">
              <p className="truncate text-obsidian-faint">
                Path: <span className="text-obsidian-muted">{health?.ffmpeg.path || 'Belum terdeteksi'}</span>
              </p>
              {health?.ffmpeg.version && (
                <p>
                  Versi: <span className="text-white">{health.ffmpeg.version}</span>
                </p>
              )}
              {health?.ffmpeg.error && (
                <p className="text-crimson-accent">Pesan: {health.ffmpeg.error}</p>
              )}
            </div>
          </div>

          {/* Direktori Unduhan */}
          <div className="rounded-lg border border-obsidian-border bg-obsidian-lowest p-3.5 space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-white">Direktori Penyimpanan Lokal</span>
              {health?.downloadDir.writable ? (
                <span className="inline-flex items-center gap-1 rounded bg-emerald-muted px-2 py-0.5 font-mono text-[10px] font-semibold text-emerald-accent border border-emerald-accent/30">
                  <FolderCheck className="h-3 w-3" /> Siap Menulis
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 rounded bg-crimson-muted px-2 py-0.5 font-mono text-[10px] font-semibold text-crimson-accent border border-crimson-accent/30">
                  <FolderX className="h-3 w-3" /> Tidak Dapat Ditulis
                </span>
              )}
            </div>
            <p className="font-mono text-[11px] text-obsidian-faint truncate">
              {health?.downloadDir.path || '-'}
            </p>
          </div>

          {/* Panduan Instalasi jika belum ada */}
          {(!health?.ytdlp.available || !health?.ffmpeg.available) && (
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3.5 font-mono text-xs text-amber-200 space-y-2">
              <p className="font-semibold text-amber-300">Pemasangan di Windows 11:</p>
              <div className="space-y-1 font-mono text-[11px]">
                {!health?.ytdlp.available && (
                  <div className="rounded bg-obsidian-lowest p-2 border border-obsidian-border">winget install yt-dlp</div>
                )}
                {!health?.ffmpeg.available && (
                  <div className="rounded bg-obsidian-lowest p-2 border border-obsidian-border">winget install Gyan.FFmpeg</div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-end gap-2.5 border-t border-obsidian-border pt-3.5">
          <button
            type="button"
            onClick={onRefresh}
            className="rounded border border-obsidian-border bg-obsidian-lowest px-4 py-2 font-mono text-xs text-obsidian-muted hover:text-white"
          >
            Pindai Ulang
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded bg-violet-accent px-5 py-2 font-mono text-xs font-semibold text-obsidian-canvas hover:bg-violet-hover"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
}
