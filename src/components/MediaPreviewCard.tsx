'use client';

import React, { useState } from 'react';
import {
  Film,
  Music,
  Download,
  Clock,
  User,
  Check,
  Scissors,
  Subtitles,
} from 'lucide-react';
import { MediaPreview, QualityOption } from '@/lib/types';
import InteractiveVideoTrimmer, {
  formatTimeStandard,
} from './InteractiveVideoTrimmer';

interface MediaPreviewCardProps {
  preview: MediaPreview;
  onStartDownload: (
    type: 'video' | 'audio',
    qualityId: string,
    options?: { trimStart?: string; trimEnd?: string; subtitleLang?: string }
  ) => void;
  isStarting: boolean;
}

export default function MediaPreviewCard({
  preview,
  onStartDownload,
  isStarting,
}: MediaPreviewCardProps) {
  const [selectedType, setSelectedType] = useState<'video' | 'audio'>('video');
  const [selectedQuality, setSelectedQuality] = useState<string>('best');

  // Fitur Pemotong Durasi Visual Interaktif
  const totalDuration = preview.duration && preview.duration > 0 ? preview.duration : 180;
  const [isTrimEnabled, setIsTrimEnabled] = useState(false);
  const [startSec, setStartSec] = useState(0);
  const [endSec, setEndSec] = useState(totalDuration);

  // Fitur Subtitle
  const [selectedSubtitle, setSelectedSubtitle] = useState('none');

  const handleTypeChange = (type: 'video' | 'audio') => {
    setSelectedType(type);
    setSelectedQuality(type === 'video' ? 'best' : 'mp3-best');
  };

  const currentOptions: QualityOption[] =
    selectedType === 'video' ? preview.videoQualities : preview.audioQualities;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const trimOptions =
      isTrimEnabled && (startSec > 0 || endSec < totalDuration)
        ? {
            trimStart: formatTimeStandard(startSec),
            trimEnd: formatTimeStandard(endSec),
          }
        : {};

    onStartDownload(selectedType, selectedQuality, {
      ...trimOptions,
      subtitleLang:
        selectedType === 'video' && selectedSubtitle !== 'none'
          ? selectedSubtitle
          : undefined,
    });
  };

  return (
    <div className="rounded-xl border border-obsidian-border bg-obsidian-surface overflow-hidden shadow-xl p-4 sm:p-5 md:p-6 space-y-5">
      <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Kolom Kiri: Visual Pratinjau Media */}
        <div className="lg:col-span-5 flex flex-col gap-3.5">
          <div className="relative aspect-video w-full overflow-hidden rounded-lg border border-obsidian-border bg-obsidian-lowest group">
            {preview.thumbnail ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={preview.thumbnail}
                alt={preview.title}
                className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                loading="lazy"
                onError={(e) => {
                  (e.target as HTMLElement).style.display = 'none';
                }}
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-obsidian-faint">
                <Film className="h-10 w-10 stroke-[1.5]" />
              </div>
            )}

            {/* Platform Tag */}
            <div className="absolute top-2 left-2 pointer-events-none">
              <span className="rounded bg-obsidian-lowest/90 px-2 py-0.5 text-[11px] font-medium text-white backdrop-blur-md border border-obsidian-border">
                {preview.platformName}
              </span>
            </div>

            {/* Durasi Total Badge */}
            {preview.durationFormatted && preview.durationFormatted !== '00:00' && (
              <div className="absolute bottom-2 right-2 rounded bg-obsidian-lowest/95 px-2 py-0.5 font-mono text-xs font-medium text-white backdrop-blur-md border border-obsidian-border flex items-center gap-1 pointer-events-none">
                <Clock className="h-3 w-3 text-obsidian-muted" />
                <span>{preview.durationFormatted}</span>
              </div>
            )}
          </div>

          {/* Judul & Pengunggah */}
          <div className="space-y-1.5">
            <h3 className="text-sm font-semibold text-white leading-snug line-clamp-2">
              {preview.title}
            </h3>

            {preview.uploader && (
              <div className="flex items-center gap-1.5 text-xs text-obsidian-muted">
                <User className="h-3.5 w-3.5 text-violet-accent" />
                <span className="truncate">{preview.uploader}</span>
              </div>
            )}
          </div>
        </div>

        {/* Kolom Kanan: Format, Kualitas & Trimmer Interaktif */}
        <div className="lg:col-span-7 flex flex-col gap-4">
          {/* Format Switcher */}
          <div className="flex items-center justify-between border-b border-obsidian-border pb-3">
            <div>
              <span className="text-xs font-semibold text-white block">Pilih Format Media</span>
              <span className="text-[11px] text-obsidian-muted">
                Simpan sebagai video utuh atau ambil audionya saja
              </span>
            </div>

            <div className="inline-flex rounded-lg border border-obsidian-border bg-obsidian-lowest p-0.5">
              <button
                type="button"
                onClick={() => handleTypeChange('video')}
                className={`flex items-center gap-1.5 rounded px-3 py-1 text-xs transition-all ${
                  selectedType === 'video'
                    ? 'bg-obsidian-elevated text-violet-accent border border-obsidian-border font-semibold shadow-sm'
                    : 'text-obsidian-muted hover:text-white'
                }`}
              >
                <Film className="h-3.5 w-3.5" />
                <span>Video (MP4)</span>
              </button>
              <button
                type="button"
                onClick={() => handleTypeChange('audio')}
                className={`flex items-center gap-1.5 rounded px-3 py-1 text-xs transition-all ${
                  selectedType === 'audio'
                    ? 'bg-obsidian-elevated text-violet-accent border border-obsidian-border font-semibold shadow-sm'
                    : 'text-obsidian-muted hover:text-white'
                }`}
              >
                <Music className="h-3.5 w-3.5" />
                <span>Audio (MP3)</span>
              </button>
            </div>
          </div>

          {/* Daftar Kualitas */}
          <div className="space-y-2">
            <span className="text-xs font-medium text-obsidian-muted block">
              Pilihan Kualitas:
            </span>

            <div className="space-y-1.5">
              {currentOptions.map((opt) => {
                const isSelected = selectedQuality === opt.id;
                return (
                  <div
                    key={opt.id}
                    onClick={() => setSelectedQuality(opt.id)}
                    className={`cursor-pointer rounded-lg border p-2.5 sm:p-3 flex items-center justify-between transition-all ${
                      isSelected
                        ? 'border-violet-accent/60 bg-obsidian-elevated text-white shadow-sm'
                        : 'border-obsidian-border bg-obsidian-lowest text-obsidian-muted hover:border-obsidian-border-strong hover:bg-obsidian-surface'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border ${
                          isSelected
                            ? 'border-violet-accent bg-violet-accent text-obsidian-canvas'
                            : 'border-obsidian-border-strong bg-transparent'
                        }`}
                      >
                        {isSelected && <Check className="h-2.5 w-2.5 stroke-[3]" />}
                      </div>

                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-semibold text-white">
                            {opt.label}
                          </span>
                          {opt.resolution && (
                            <span className="rounded bg-obsidian-overlay px-1.5 py-0.2 font-mono text-[10px] text-violet-accent border border-obsidian-border">
                              {opt.resolution}
                            </span>
                          )}
                        </div>
                        {opt.description && (
                          <p className="mt-0.5 text-[11px] text-obsidian-muted truncate">
                            {opt.description}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Ukuran Berkas */}
                    {opt.sizeFormatted && (
                      <div className="shrink-0 text-right ml-2 font-mono">
                        <span
                          className={`inline-block rounded px-2 py-0.5 text-xs font-semibold ${
                            isSelected
                              ? 'bg-violet-muted text-violet-accent border border-violet-accent/30'
                              : 'bg-obsidian-surface text-obsidian-muted border border-obsidian-border'
                          }`}
                        >
                          {opt.sizeFormatted}
                        </span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Fitur Pemotong Durasi Video Visual Interaktif */}
          <div className="rounded-lg border border-obsidian-border bg-obsidian-lowest p-3 sm:p-4 space-y-3">
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 text-xs font-medium text-white cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={isTrimEnabled}
                  onChange={(e) => setIsTrimEnabled(e.target.checked)}
                  className="h-3.5 w-3.5 rounded border-obsidian-border bg-obsidian-surface text-cyan-400 focus:ring-0"
                />
                <span className="flex items-center gap-1.5">
                  <Scissors className="h-3.5 w-3.5 text-cyan-400" />
                  Potong Durasi Video (Visual Interaktif)
                </span>
              </label>
              {preview.durationFormatted && (
                <span className="text-[11px] text-obsidian-faint font-mono">
                  Total: {preview.durationFormatted}
                </span>
              )}
            </div>

            {/* Komponen Pemotong Video Interaktif dengan Pemutar Video Asli */}
            {isTrimEnabled && (
              <InteractiveVideoTrimmer
                totalDurationSec={totalDuration}
                startSec={startSec}
                endSec={endSec}
                mediaUrl={preview.url}
                thumbnailUrl={preview.thumbnail}
                onChange={(s, e) => {
                  setStartSec(s);
                  setEndSec(e);
                }}
              />
            )}
          </div>

          {/* Opsi Subtitle (Khusus Video) */}
          {selectedType === 'video' && preview.subtitles && preview.subtitles.length > 0 && (
            <div className="rounded-lg border border-obsidian-border bg-obsidian-lowest p-3 flex items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2 text-white shrink-0">
                <Subtitles className="h-4 w-4 text-violet-accent" />
                <span>Sertakan Subtitle:</span>
              </div>
              <select
                value={selectedSubtitle}
                onChange={(e) => setSelectedSubtitle(e.target.value)}
                className="rounded border border-obsidian-border bg-obsidian-surface px-2.5 py-1 text-xs text-white focus:border-violet-accent focus:outline-none max-w-[200px] truncate"
              >
                <option value="none">Tanpa Subtitle</option>
                {preview.subtitles.map((sub) => (
                  <option key={sub.code} value={sub.code}>
                    {sub.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Tombol Mulai Unduh */}
          <div className="flex items-center justify-end pt-2 border-t border-obsidian-border">
            <button
              type="submit"
              disabled={isStarting}
              className="flex h-11 w-full sm:w-auto items-center justify-center gap-2 rounded-lg bg-violet-accent px-7 text-xs font-semibold text-obsidian-canvas shadow-sm transition-all hover:bg-violet-hover disabled:bg-obsidian-elevated disabled:text-obsidian-faint disabled:border disabled:border-obsidian-border disabled:shadow-none disabled:cursor-not-allowed"
            >
              <Download className="h-4 w-4 stroke-[2.5]" />
              <span>{isStarting ? 'Menyiapkan Unduhan...' : 'Unduh Sekarang'}</span>
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
