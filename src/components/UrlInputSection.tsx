'use client';

import React, { useState } from 'react';
import {
  Search,
  Clipboard,
  X,
  Loader2,
  AlertCircle,
  Sparkles,
  Link2,
  Layers,
  Film,
  Music,
  Download,
  Sliders,
  Check,
  ChevronDown,
} from 'lucide-react';
import { MediaPreview } from '@/lib/types';

export interface ConfiguredBatchItem {
  url: string;
  type: 'video' | 'audio';
  qualityId: string;
  title: string;
  thumbnail?: string;
  preview: MediaPreview;
}

interface UrlInputSectionProps {
  url: string;
  setUrl: (url: string) => void;
  isLoading: boolean;
  onAnalyze: () => void;
  onBatchDownload?: (
    items: Array<{ url: string; type: 'video' | 'audio'; qualityId: string; title: string; thumbnail?: string }>
  ) => void;
  isBatchDownloading?: boolean;
  errorMessage?: string;
  onClearError: () => void;
}

export default function UrlInputSection({
  url,
  setUrl,
  isLoading,
  onAnalyze,
  onBatchDownload,
  isBatchDownloading,
  errorMessage,
  onClearError,
}: UrlInputSectionProps) {
  const [mode, setMode] = useState<'single' | 'batch'>('single');
  const [pasteNotice, setPasteNotice] = useState(false);

  // State untuk Batch Mode
  const [batchText, setBatchText] = useState('');
  const [isAnalyzingBatch, setIsAnalyzingBatch] = useState(false);
  const [batchItems, setBatchItems] = useState<ConfiguredBatchItem[]>([]);
  const [batchError, setBatchError] = useState<string | null>(null);

  // Master controller resolusi semua
  const [masterQuality, setMasterQuality] = useState<string>('best');
  const [masterType, setMasterType] = useState<'video' | 'audio'>('video');

  const batchUrls = batchText
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && (l.startsWith('http://') || l.startsWith('https://')));

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        if (mode === 'single') {
          setUrl(text.trim());
        } else {
          setBatchText((prev) => (prev ? `${prev}\n${text.trim()}` : text.trim()));
        }
        onClearError();
        setPasteNotice(true);
        setTimeout(() => setPasteNotice(false), 2000);
      }
    } catch {}
  };

  const handleClear = () => {
    if (mode === 'single') {
      setUrl('');
    } else {
      setBatchText('');
      setBatchItems([]);
      setBatchError(null);
    }
    onClearError();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && url.trim() && !isLoading) {
      onAnalyze();
    }
  };

  // Periksa semua tautan batch untuk mengambil metadata & pilihan kualitas masing-masing
  const handleAnalyzeBatch = async () => {
    if (batchUrls.length === 0) return;

    setIsAnalyzingBatch(true);
    setBatchError(null);
    onClearError();

    try {
      const res = await fetch('/api/jobs/batch/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ urls: batchUrls }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Gagal memeriksa daftar tautan batch.');
      }

      if (Array.isArray(data.data) && data.data.length > 0) {
        const configured: ConfiguredBatchItem[] = data.data.map((p: MediaPreview) => ({
          url: p.url,
          type: 'video',
          qualityId: 'best',
          title: p.title,
          thumbnail: p.thumbnail,
          preview: p,
        }));
        setBatchItems(configured);
      } else {
        throw new Error('Tidak ada media yang berhasil dianalisis dari daftar tautan.');
      }
    } catch (err: unknown) {
      const error = err as Error;
      setBatchError(error.message);
    } finally {
      setIsAnalyzingBatch(false);
    }
  };

  // Terapkan tipe atau resolusi yang sama ke SEMUA media dalam batch
  const handleApplyMasterQuality = (targetQ: string, targetT: 'video' | 'audio' = masterType) => {
    setMasterQuality(targetQ);
    setMasterType(targetT);
    setBatchItems((prev) =>
      prev.map((item) => ({
        ...item,
        type: targetT,
        qualityId: targetQ,
      }))
    );
  };

  // Ubah tipe (video / audio) untuk item tertentu
  const handleItemTypeChange = (index: number, newType: 'video' | 'audio') => {
    setBatchItems((prev) =>
      prev.map((item, i) =>
        i === index
          ? {
              ...item,
              type: newType,
              qualityId: newType === 'video' ? 'best' : 'mp3-best',
            }
          : item
      )
    );
  };

  // Ubah resolusi untuk item tertentu
  const handleItemQualityChange = (index: number, newQ: string) => {
    setBatchItems((prev) =>
      prev.map((item, i) => (i === index ? { ...item, qualityId: newQ } : item))
    );
  };

  // Hapus satu item dari daftar batch
  const handleRemoveBatchItem = (index: number) => {
    setBatchItems((prev) => prev.filter((_, i) => i !== index));
  };

  // Mulai unduhan batch
  const handleStartBatchDownload = () => {
    if (batchItems.length === 0 || !onBatchDownload) return;
    const payload = batchItems.map((it) => ({
      url: it.url,
      type: it.type,
      qualityId: it.qualityId,
      title: it.title,
      thumbnail: it.thumbnail,
    }));
    onBatchDownload(payload);
    // Bersihkan batch items setelah disubmit
    setBatchItems([]);
    setBatchText('');
  };

  return (
    <div className="rounded-xl border border-obsidian-border bg-obsidian-surface p-5 md:p-6 shadow-lg space-y-4">
      {/* Header Bar dengan Mode Switcher */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold tracking-tight text-white md:text-2xl">
            Unduh Media
          </h2>
          <p className="mt-0.5 text-xs text-obsidian-muted md:text-sm">
            {mode === 'single'
              ? 'Tempel tautan video atau audio untuk mengunduhnya secara instan.'
              : 'Tempelkan beberapa tautan sekaligus, atur resolusinya, dan unduh bersamaan.'}
          </p>
        </div>

        {/* Mode Switcher */}
        <div className="grid grid-cols-2 sm:flex rounded-lg border border-obsidian-border bg-obsidian-lowest p-1 w-full sm:w-auto">
          <button
            type="button"
            onClick={() => {
              setMode('single');
              onClearError();
            }}
            className={`flex items-center justify-center gap-1.5 rounded px-3 py-1.5 sm:py-1 text-xs transition-all ${
              mode === 'single'
                ? 'bg-obsidian-elevated text-violet-accent border border-obsidian-border font-semibold shadow-sm'
                : 'text-obsidian-muted hover:text-white'
            }`}
          >
            <Link2 className="h-3.5 w-3.5" />
            <span>Satu Tautan</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setMode('batch');
              onClearError();
            }}
            className={`flex items-center justify-center gap-1.5 rounded px-3 py-1.5 sm:py-1 text-xs transition-all ${
              mode === 'batch'
                ? 'bg-obsidian-elevated text-violet-accent border border-obsidian-border font-semibold shadow-sm'
                : 'text-obsidian-muted hover:text-white'
            }`}
          >
            <Layers className="h-3.5 w-3.5" />
            <span>Banyak Tautan (Batch)</span>
          </button>
        </div>
      </div>

      {/* Mode 1: Satu Tautan */}
      {mode === 'single' && (
        <div className="flex flex-col sm:flex-row items-center gap-2.5">
          <div className="relative w-full">
            <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-obsidian-faint">
              <Link2 className="h-4 w-4" />
            </div>

            <input
              type="text"
              value={url}
              onChange={(e) => {
                setUrl(e.target.value);
                if (errorMessage) onClearError();
              }}
              onKeyDown={handleKeyDown}
              placeholder="Tempel tautan video/audio..."
              className="w-full rounded-lg border border-obsidian-border bg-obsidian-lowest py-3 pl-10 pr-20 sm:pr-24 text-xs font-mono text-white placeholder:text-obsidian-faint focus:border-violet-accent focus:outline-none transition-colors"
              disabled={isLoading}
            />

            <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
              {url && !isLoading && (
                <button
                  type="button"
                  onClick={handleClear}
                  className="rounded p-1 text-obsidian-muted hover:bg-obsidian-elevated hover:text-white"
                  title="Bersihkan input"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
              <button
                type="button"
                onClick={handlePaste}
                disabled={isLoading}
                className="flex items-center gap-1 rounded border border-obsidian-border bg-obsidian-elevated px-2 py-1 font-mono text-[11px] text-obsidian-muted hover:border-obsidian-border-strong hover:text-white disabled:opacity-50 transition-colors"
                title="Tempel dari Papan Klip"
              >
                <Clipboard className="h-3 w-3" />
                <span>Tempel</span>
              </button>
            </div>
          </div>

          <button
            type="button"
            onClick={onAnalyze}
            disabled={!url.trim() || isLoading}
            className="flex h-11 w-full sm:w-auto shrink-0 items-center justify-center gap-2 rounded-lg bg-violet-accent px-6 text-xs font-semibold text-obsidian-canvas shadow-sm transition-all hover:bg-violet-hover disabled:bg-obsidian-elevated disabled:text-obsidian-faint disabled:border disabled:border-obsidian-border disabled:shadow-none disabled:cursor-not-allowed"
          >
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin text-obsidian-canvas" />
                <span>Memeriksa...</span>
              </>
            ) : (
              <>
                <Search className="h-4 w-4 stroke-[2.5]" />
                <span>Periksa Media</span>
              </>
            )}
          </button>
        </div>
      )}

      {/* Mode 2: Banyak Tautan (Batch) */}
      {mode === 'batch' && (
        <div className="space-y-4">
          {/* Tampilan 2A: Textarea Input (Sebelum Diperiksa) */}
          {batchItems.length === 0 && (
            <div className="space-y-3">
              <div className="relative">
                <textarea
                  rows={4}
                  value={batchText}
                  onChange={(e) => {
                    setBatchText(e.target.value);
                    if (errorMessage) onClearError();
                    if (batchError) setBatchError(null);
                  }}
                  placeholder={`Tempelkan tautan satu per baris:\nhttps://www.youtube.com/watch?v=...\nhttps://www.tiktok.com/@...\nhttps://www.instagram.com/reel/...`}
                  className="w-full rounded-lg border border-obsidian-border bg-obsidian-lowest p-3 text-xs font-mono text-white placeholder:text-obsidian-faint focus:border-violet-accent focus:outline-none transition-colors resize-y min-h-[90px]"
                  disabled={isAnalyzingBatch || isBatchDownloading}
                />

                <div className="absolute right-2.5 top-2.5 flex items-center gap-1.5">
                  {batchText && !isAnalyzingBatch && (
                    <button
                      type="button"
                      onClick={handleClear}
                      className="rounded p-1 text-obsidian-muted hover:bg-obsidian-elevated hover:text-white"
                      title="Bersihkan teks"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={handlePaste}
                    disabled={isAnalyzingBatch || isBatchDownloading}
                    className="flex items-center gap-1 rounded border border-obsidian-border bg-obsidian-elevated px-2 py-1 font-mono text-[11px] text-obsidian-muted hover:border-obsidian-border-strong hover:text-white disabled:opacity-50 transition-colors"
                    title="Tempel tautan dari Clipboard"
                  >
                    <Clipboard className="h-3 w-3" />
                    <span>Tempel</span>
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between pt-1">
                <span className="text-xs text-obsidian-muted">
                  {batchUrls.length > 0 ? `${batchUrls.length} tautan siap diperiksa` : 'Belum ada tautan'}
                </span>

                <button
                  type="button"
                  onClick={handleAnalyzeBatch}
                  disabled={batchUrls.length === 0 || isAnalyzingBatch}
                  className="flex h-10 items-center justify-center gap-2 rounded-lg bg-violet-accent px-5 text-xs font-semibold text-obsidian-canvas shadow-sm transition-all hover:bg-violet-hover disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {isAnalyzingBatch ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin text-obsidian-canvas" />
                      <span>Memeriksa {batchUrls.length} Media...</span>
                    </>
                  ) : (
                    <>
                      <Search className="h-4 w-4 stroke-[2.5]" />
                      <span>
                        {batchUrls.length > 0
                          ? `Periksa Pilihan Resolusi (${batchUrls.length} Media)`
                          : 'Periksa Media'}
                      </span>
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* Tampilan 2B: Panel Konfigurasi Resolusi Batch (Setelah Diperiksa) */}
          {batchItems.length > 0 && (
            <div className="space-y-4">
              {/* Bilah Kontrol Global (Samakan Semua) */}
              <div className="rounded-lg border border-obsidian-border bg-obsidian-lowest p-3.5 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-obsidian-border pb-2.5">
                  <div className="flex items-center gap-2 text-white">
                    <Sliders className="h-4 w-4 text-violet-accent" />
                    <span className="text-xs font-semibold">Samakan Semua Resolusi Media:</span>
                  </div>
                  <span className="text-[11px] text-obsidian-muted font-mono">
                    {batchItems.length} media terpilih
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[11px] text-obsidian-muted">Pilih format &amp; resolusi:</span>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => handleApplyMasterQuality('best', 'video')}
                      className={`rounded px-2.5 py-1 text-xs font-medium transition-all ${
                        masterType === 'video' && masterQuality === 'best'
                          ? 'bg-violet-accent text-obsidian-canvas font-semibold'
                          : 'border border-obsidian-border bg-obsidian-surface text-obsidian-muted hover:text-white'
                      }`}
                    >
                      Kualitas Terbaik
                    </button>
                    <button
                      type="button"
                      onClick={() => handleApplyMasterQuality('1080p', 'video')}
                      className={`rounded px-2.5 py-1 text-xs font-medium transition-all ${
                        masterType === 'video' && masterQuality === '1080p'
                          ? 'bg-violet-accent text-obsidian-canvas font-semibold'
                          : 'border border-obsidian-border bg-obsidian-surface text-obsidian-muted hover:text-white'
                      }`}
                    >
                      1080p Full HD
                    </button>
                    <button
                      type="button"
                      onClick={() => handleApplyMasterQuality('720p', 'video')}
                      className={`rounded px-2.5 py-1 text-xs font-medium transition-all ${
                        masterType === 'video' && masterQuality === '720p'
                          ? 'bg-violet-accent text-obsidian-canvas font-semibold'
                          : 'border border-obsidian-border bg-obsidian-surface text-obsidian-muted hover:text-white'
                      }`}
                    >
                      720p HD
                    </button>
                    <button
                      type="button"
                      onClick={() => handleApplyMasterQuality('480p', 'video')}
                      className={`rounded px-2.5 py-1 text-xs font-medium transition-all ${
                        masterType === 'video' && masterQuality === '480p'
                          ? 'bg-violet-accent text-obsidian-canvas font-semibold'
                          : 'border border-obsidian-border bg-obsidian-surface text-obsidian-muted hover:text-white'
                      }`}
                    >
                      480p SD
                    </button>
                    <button
                      type="button"
                      onClick={() => handleApplyMasterQuality('mp3-best', 'audio')}
                      className={`rounded px-2.5 py-1 text-xs font-medium transition-all ${
                        masterType === 'audio'
                          ? 'bg-violet-accent text-obsidian-canvas font-semibold'
                          : 'border border-obsidian-border bg-obsidian-surface text-obsidian-muted hover:text-white'
                      }`}
                    >
                      Semua Audio MP3
                    </button>
                  </div>
                </div>
              </div>

              {/* Daftar Media Per-Item dengan Pilihan Resolusi Independen */}
              <div className="space-y-2">
                <span className="text-xs font-medium text-obsidian-muted block">
                  Atur Resolusi Tiap Media Secara Terpisah:
                </span>

                <div className="divide-y divide-obsidian-border/50 rounded-lg border border-obsidian-border bg-obsidian-lowest overflow-hidden">
                  {batchItems.map((item, idx) => {
                    const preview = item.preview;
                    const availableOpts =
                      item.type === 'video' ? preview.videoQualities : preview.audioQualities;
                    const selectedOpt = availableOpts.find((o) => o.id === item.qualityId);

                    return (
                      <div key={item.url + idx} className="p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-obsidian-surface/40 transition-colors">
                        {/* Kolom Kiri: Thumbnail & Judul */}
                        <div className="flex items-start gap-2.5 min-w-0 flex-1">
                          <div className="relative aspect-video w-16 h-10 shrink-0 overflow-hidden rounded border border-obsidian-border bg-obsidian-canvas">
                            {item.thumbnail ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={item.thumbnail}
                                alt={item.title}
                                className="h-full w-full object-cover"
                              />
                            ) : (
                              <div className="flex h-full w-full items-center justify-center text-obsidian-faint">
                                <Film className="h-4 w-4" />
                              </div>
                            )}
                          </div>

                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-semibold text-white truncate max-w-sm">
                              {item.title}
                            </p>
                            <div className="mt-0.5 flex items-center gap-1.5 text-[11px] text-obsidian-muted">
                              <span>{preview.platformName}</span>
                              {preview.durationFormatted && (
                                <>
                                  <span>-</span>
                                  <span className="font-mono">{preview.durationFormatted}</span>
                                </>
                              )}
                              {selectedOpt?.sizeFormatted && (
                                <>
                                  <span>-</span>
                                  <span className="font-mono text-violet-accent">{selectedOpt.sizeFormatted}</span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Kolom Kanan: Pilihan Format & Resolusi Per Item */}
                        <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
                          {/* Toggle Tipe: Video vs Audio */}
                          <div className="inline-flex rounded border border-obsidian-border bg-obsidian-surface p-0.5">
                            <button
                              type="button"
                              onClick={() => handleItemTypeChange(idx, 'video')}
                              className={`rounded px-2 py-0.5 text-[11px] transition-all ${
                                item.type === 'video'
                                  ? 'bg-obsidian-elevated text-violet-accent font-semibold'
                                  : 'text-obsidian-muted hover:text-white'
                              }`}
                            >
                              Video
                            </button>
                            <button
                              type="button"
                              onClick={() => handleItemTypeChange(idx, 'audio')}
                              className={`rounded px-2 py-0.5 text-[11px] transition-all ${
                                item.type === 'audio'
                                  ? 'bg-obsidian-elevated text-violet-accent font-semibold'
                                  : 'text-obsidian-muted hover:text-white'
                              }`}
                            >
                              Audio
                            </button>
                          </div>

                          {/* Dropdown Resolusi Per-Item */}
                          <div className="relative">
                            <select
                              value={item.qualityId}
                              onChange={(e) => handleItemQualityChange(idx, e.target.value)}
                              className="rounded border border-obsidian-border bg-obsidian-surface py-1 pl-2.5 pr-7 text-xs text-white focus:border-violet-accent focus:outline-none appearance-none cursor-pointer max-w-[160px] truncate"
                            >
                              {availableOpts.map((opt) => (
                                <option key={opt.id} value={opt.id}>
                                  {opt.label} {opt.sizeFormatted ? `(${opt.sizeFormatted})` : ''}
                                </option>
                              ))}
                            </select>
                            <ChevronDown className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-obsidian-faint" />
                          </div>

                          {/* Tombol Hapus Baris */}
                          <button
                            type="button"
                            onClick={() => handleRemoveBatchItem(idx)}
                            className="rounded p-1 text-obsidian-faint hover:text-crimson-accent transition-colors"
                            title="Hapus dari batch"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Tombol Aksi Bawah */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-2 border-t border-obsidian-border">
                <button
                  type="button"
                  onClick={() => setBatchItems([])}
                  className="rounded-lg border border-obsidian-border bg-obsidian-lowest px-4 py-2 text-xs font-medium text-obsidian-muted hover:text-white"
                >
                  Ubah / Input Ulang Tautan
                </button>

                <button
                  type="button"
                  onClick={handleStartBatchDownload}
                  disabled={batchItems.length === 0 || isBatchDownloading}
                  className="flex h-11 items-center justify-center gap-2 rounded-lg bg-violet-accent px-7 text-xs font-semibold text-obsidian-canvas shadow-sm transition-all hover:bg-violet-hover disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {isBatchDownloading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin text-obsidian-canvas" />
                      <span>Memulai Antrean...</span>
                    </>
                  ) : (
                    <>
                      <Download className="h-4 w-4 stroke-[2.5]" />
                      <span>Mulai Unduh Semua ({batchItems.length} Media)</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Notifikasi singkat tempel */}
      {pasteNotice && (
        <div className="text-[11px] font-mono text-violet-accent flex items-center gap-1.5">
          <Sparkles className="h-3.5 w-3.5" /> Tautan berhasil ditempel dari papan klip.
        </div>
      )}

      {/* Pesan Error */}
      {(errorMessage || batchError) && (
        <div className="flex items-start gap-2.5 rounded-lg border border-crimson-accent/30 bg-crimson-muted p-3.5 text-xs text-crimson-accent">
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
          <div className="flex-1">
            <span className="font-semibold">Perhatian:</span>{' '}
            <span>{errorMessage || batchError}</span>
          </div>
          <button
            type="button"
            onClick={() => {
              onClearError();
              setBatchError(null);
            }}
            className="text-crimson-accent hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Platform Didukung (Mobile Scrollable) */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar sm:flex-wrap text-[11px] -mx-1 px-1">
        <span className="text-obsidian-faint text-xs shrink-0">Mendukung:</span>
        {['YouTube', 'TikTok', 'Instagram', 'X (Twitter)', 'Facebook', 'Reddit', 'Pinterest', 'SoundCloud'].map((platform) => (
          <span
            key={platform}
            className="rounded border border-obsidian-border bg-obsidian-lowest px-2 py-0.5 text-xs text-obsidian-muted shrink-0"
          >
            {platform}
          </span>
        ))}
      </div>
    </div>
  );
}
