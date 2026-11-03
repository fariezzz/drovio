'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Play,
  Pause,
  RotateCcw,
  Volume2,
  VolumeX,
  Repeat,
  Scissors,
  Clock,
  Loader2,
  AlertCircle,
} from 'lucide-react';

interface InteractiveVideoTrimmerProps {
  totalDurationSec: number;
  startSec: number;
  endSec: number;
  mediaUrl: string; // URL sumber media (YouTube, link web, atau object URL lokal)
  thumbnailUrl?: string;
  onChange: (start: number, end: number) => void;
}

// Format waktu menjadi mm:ss.s (seperti 00:09.8 atau 01:24.3)
export function formatTimeWithSubseconds(sec: number): string {
  if (isNaN(sec) || sec < 0) return '00:00.0';
  const mins = Math.floor(sec / 60);
  const remainingSec = sec % 60;
  const secs = Math.floor(remainingSec);
  const tenths = Math.floor((remainingSec - secs) * 10);

  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${pad(mins)}:${pad(secs)}.${tenths}`;
}

export function formatTimeStandard(sec: number): string {
  if (isNaN(sec) || sec < 0) return '00:00';
  const total = Math.floor(sec);
  const mins = Math.floor(total / 60);
  const secs = total % 60;
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${pad(mins)}:${pad(secs)}`;
}

export default function InteractiveVideoTrimmer({
  totalDurationSec,
  startSec,
  endSec,
  mediaUrl,
  thumbnailUrl,
  onChange,
}: InteractiveVideoTrimmerProps) {
  const duration = Math.max(totalDurationSec || 60, 5);
  const safeStart = Math.min(Math.max(0, startSec), duration - 0.5);
  const safeEnd = Math.max(safeStart + 0.5, Math.min(endSec || duration, duration));

  // State Pemutaran Video Aktual
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(safeStart);
  const [isMuted, setIsMuted] = useState(false);
  const [isLoop, setIsLoop] = useState(true);

  // State Sumber Media Aktual
  const [streamSrc, setStreamSrc] = useState<string | null>(null);
  const [isLoadingStream, setIsLoadingStream] = useState(true);
  const [streamError, setStreamError] = useState<string | null>(null);

  // Elemen Referensi
  const videoRef = useRef<HTMLVideoElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);

  // State Dragging Timeline
  const [activeHandle, setActiveHandle] = useState<'left' | 'right' | 'middle' | null>(null);
  const [dragStartX, setDragStartX] = useState(0);
  const [dragInitialStart, setDragInitialStart] = useState(safeStart);
  const [dragInitialEnd, setDragInitialEnd] = useState(safeEnd);

  // Array frame filmstrip
  const [frameImages, setFrameImages] = useState<string[]>([]);

  // 1. Dapatkan sumber video aktual dari backend untuk elemen HTML5 <video>
  useEffect(() => {
    let isCancelled = false;

    // Jika mediaUrl adalah Object URL (unggah lokal file) atau file lokal yang langsung didukung browser
    if (mediaUrl.startsWith('blob:') || mediaUrl.startsWith('data:')) {
      setStreamSrc(mediaUrl);
      setIsLoadingStream(false);
      return;
    }

    // Untuk URL publik (YouTube, direct MP4, dsb.), gunakan backend stream endpoint
    setIsLoadingStream(true);
    setStreamError(null);

    const checkAndLoadStream = async () => {
      try {
        const streamEndpoint = `/api/media/stream?url=${encodeURIComponent(mediaUrl)}`;

        // Periksa status kesiapan preview aktual
        const statusRes = await fetch(
          `/api/media/preview-status?url=${encodeURIComponent(mediaUrl)}`
        );
        const statusData = await statusRes.json().catch(() => ({}));

        if (isCancelled) return;

        if (statusData.ready) {
          setStreamSrc(streamEndpoint);
          setIsLoadingStream(false);
        } else {
          // Jika backend sedang menyiapkan video aktual, poll berkala hingga siap
          const pollInterval = setInterval(async () => {
            if (isCancelled) {
              clearInterval(pollInterval);
              return;
            }
            try {
              const checkRes = await fetch(
                `/api/media/preview-status?url=${encodeURIComponent(mediaUrl)}`
              );
              const checkData = await checkRes.json().catch(() => ({}));
              if (checkData.ready) {
                clearInterval(pollInterval);
                if (!isCancelled) {
                  setStreamSrc(streamEndpoint);
                  setIsLoadingStream(false);
                }
              }
            } catch {}
          }, 1500);

          // Batasi polling maksimal 30 detik
          setTimeout(() => {
            clearInterval(pollInterval);
            if (!isCancelled && isLoadingStream) {
              // Jika timeout, gunakan streamEndpoint langsung
              setStreamSrc(streamEndpoint);
              setIsLoadingStream(false);
            }
          }, 30000);
        }
      } catch (err: unknown) {
        if (!isCancelled) {
          const error = err as Error;
          setStreamError(error.message);
          setIsLoadingStream(false);
        }
      }
    };

    checkAndLoadStream();

    return () => {
      isCancelled = true;
    };
  }, [mediaUrl]);

  // Siapkan thumbnail strip
  useEffect(() => {
    if (thumbnailUrl) {
      setFrameImages(Array(10).fill(thumbnailUrl));
    }
  }, [thumbnailUrl]);

  // Fungsi Seeking Sinkron ke Pemutar Video
  const seekVideoTo = useCallback(
    (targetSec: number) => {
      const clamped = Math.max(safeStart, Math.min(targetSec, safeEnd));
      setCurrentTime(clamped);

      if (videoRef.current) {
        videoRef.current.currentTime = clamped;
      }
    },
    [safeStart, safeEnd]
  );

  // Fungsi Toggle Play / Pause
  const handleTogglePlay = useCallback(() => {
    if (!videoRef.current) return;

    if (isPlaying) {
      videoRef.current.pause();
      setIsPlaying(false);
    } else {
      // Jika posisi playhead sudah di akhir atau di luar batas, reset ke titik awal potongan
      let startFrom = currentTime;
      if (currentTime >= safeEnd - 0.2 || currentTime < safeStart) {
        startFrom = safeStart;
        videoRef.current.currentTime = safeStart;
        setCurrentTime(safeStart);
      }

      videoRef.current
        .play()
        .then(() => setIsPlaying(true))
        .catch(() => setIsPlaying(false));
    }
  }, [isPlaying, currentTime, safeStart, safeEnd]);

  // Penjagaan Rentang Waktu Pemutaran (Hentikan atau Ulang saat Mencapai Titik Akhir)
  // BUG 2026-11-02: effect ini dulu dependensinya hanya
  // [isLoop, safeStart, safeEnd]. Saat pertama render, streamSrc masih
  // null sehingga elemen <video> belum ada (videoRef.current === null)
  // dan effect langsung return tanpa memasang listener. Ketika streamSrc
  // kemudian terisi dan <video> muncul, effect TIDAK jalan ulang karena
  // dependensinya tidak berubah — jadi 'timeupdate' tidak pernah
  // terpasang, currentTime tidak pernah naik dari 00:00.0, dan playhead
  // tidak pernah bergerak, meski videonya sendiri sebenarnya diputar
  // (tombolnya sudah berubah jadi pause). streamSrc ditambahkan ke
  // dependensi supaya listener dipasang tepat setelah <video> muncul.
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleTimeUpdate = () => {
      const time = video.currentTime;
      setCurrentTime(time);

      // Ketika pemutaran mencapai titik akhir pilihan, hentikan atau loop
      if (time >= safeEnd) {
        if (isLoop) {
          video.currentTime = safeStart;
          video.play().catch(() => {});
          setCurrentTime(safeStart);
        } else {
          video.pause();
          video.currentTime = safeStart;
          setCurrentTime(safeStart);
          setIsPlaying(false);
        }
      }
    };

    const handleEnded = () => {
      if (isLoop) {
        video.currentTime = safeStart;
        video.play().catch(() => {});
        setCurrentTime(safeStart);
      } else {
        video.currentTime = safeStart;
        setCurrentTime(safeStart);
        setIsPlaying(false);
      }
    };

    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);

    video.addEventListener('timeupdate', handleTimeUpdate);
    video.addEventListener('ended', handleEnded);
    video.addEventListener('play', handlePlay);
    video.addEventListener('pause', handlePause);

    return () => {
      video.removeEventListener('timeupdate', handleTimeUpdate);
      video.removeEventListener('ended', handleEnded);
      video.removeEventListener('play', handlePlay);
      video.removeEventListener('pause', handlePause);
    };
  }, [streamSrc, isLoop, safeStart, safeEnd]);

  // Pastikan posisi playhead selalu berada di dalam batas potongan saat handle digeser
  useEffect(() => {
    if (currentTime < safeStart || currentTime > safeEnd) {
      seekVideoTo(safeStart);
    }
  }, [safeStart, safeEnd, currentTime, seekVideoTo]);

  // Penanganan Drag Handle Timeline
  const handlePointerDown = (
    e: React.PointerEvent<HTMLDivElement>,
    handle: 'left' | 'right' | 'middle'
  ) => {
    e.preventDefault();
    e.stopPropagation();
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);

    // Jeda pemutaran video saat menggeser handle agar pengguna dapat melihat frame dengan tepat
    if (isPlaying && videoRef.current) {
      videoRef.current.pause();
      setIsPlaying(false);
    }

    setActiveHandle(handle);
    setDragStartX(e.clientX);
    setDragInitialStart(safeStart);
    setDragInitialEnd(safeEnd);
  };

  const handlePointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!activeHandle || !trackRef.current) return;
      const rect = trackRef.current.getBoundingClientRect();
      const deltaX = e.clientX - dragStartX;
      const deltaSec = (deltaX / rect.width) * duration;

      if (activeHandle === 'left') {
        const newStart = Math.min(
          Math.max(0, dragInitialStart + deltaSec),
          safeEnd - 0.5
        );
        const rounded = Number(newStart.toFixed(1));
        onChange(rounded, safeEnd);
        seekVideoTo(rounded);
      } else if (activeHandle === 'right') {
        const newEnd = Math.max(
          Math.min(duration, dragInitialEnd + deltaSec),
          safeStart + 0.5
        );
        const rounded = Number(newEnd.toFixed(1));
        onChange(safeStart, rounded);
        seekVideoTo(rounded);
      } else if (activeHandle === 'middle') {
        const clipLength = dragInitialEnd - dragInitialStart;
        let newStart = dragInitialStart + deltaSec;
        let newEnd = dragInitialEnd + deltaSec;

        if (newStart < 0) {
          newStart = 0;
          newEnd = clipLength;
        } else if (newEnd > duration) {
          newEnd = duration;
          newStart = duration - clipLength;
        }

        const roundStart = Number(newStart.toFixed(1));
        const roundEnd = Number(newEnd.toFixed(1));
        onChange(roundStart, roundEnd);
        seekVideoTo(roundStart);
      }
    },
    [activeHandle, dragStartX, dragInitialStart, dragInitialEnd, duration, safeStart, safeEnd, onChange, seekVideoTo]
  );

  const handlePointerUp = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (activeHandle) {
        try {
          (e.target as HTMLElement).releasePointerCapture?.(e.pointerId);
        } catch {}
        setActiveHandle(null);
      }
    },
    [activeHandle]
  );

  // Klik langsung di timeline untuk melompat ke titik tertentu
  const handleTrackClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!trackRef.current || activeHandle) return;
    const rect = trackRef.current.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const ratio = Math.max(0, Math.min(clickX / rect.width, 1));
    const targetSec = ratio * duration;

    // Jika diklik di dalam batas potongan, pindahkan playhead ke sana
    if (targetSec >= safeStart && targetSec <= safeEnd) {
      seekVideoTo(targetSec);
    }
  };

  const startPercent = (safeStart / duration) * 100;
  const endPercent = (safeEnd / duration) * 100;
  const currentPercent = ((currentTime - safeStart) / Math.max(safeEnd - safeStart, 0.1)) * 100;

  const tooltipPercent =
    activeHandle === 'left'
      ? startPercent
      : activeHandle === 'right'
      ? endPercent
      : (startPercent + endPercent) / 2;

  const tooltipText =
    activeHandle === 'left'
      ? formatTimeWithSubseconds(safeStart)
      : activeHandle === 'right'
      ? formatTimeWithSubseconds(safeEnd)
      : formatTimeWithSubseconds(currentTime);

  return (
    <div className="w-full space-y-3.5 select-none">
      {/* 1. Layar Video Player Preview Aktual (Menggunakan Berkas Video Nyata) */}
      <div className="relative aspect-video w-full rounded-xl overflow-hidden bg-slate-950 border border-obsidian-border group shadow-2xl">
        {isLoadingStream ? (
          <div className="flex flex-col items-center justify-center h-full w-full gap-2 text-obsidian-muted p-4 text-center">
            <Loader2 className="h-8 w-8 animate-spin text-cyan-400" />
            <p className="text-xs font-medium text-white">Menyiapkan pratinjau video aktual...</p>
            <p className="text-[11px] text-obsidian-faint">
              Sistem sedang memproses aliran video asli untuk pratinjau interaktif.
            </p>
          </div>
        ) : streamError ? (
          <div className="flex flex-col items-center justify-center h-full w-full gap-2 text-crimson-accent p-4 text-center">
            <AlertCircle className="h-8 w-8" />
            <p className="text-xs font-semibold">Gagal memuat aliran video aktual.</p>
            <p className="text-[11px] text-obsidian-muted">{streamError}</p>
          </div>
        ) : streamSrc ? (
          <video
            ref={videoRef}
            src={streamSrc}
            playsInline
            muted={isMuted}
            className="w-full h-full object-contain cursor-pointer"
            onClick={handleTogglePlay}
          />
        ) : null}

        {/* Tombol Play Mengambang di Tengah saat Video Dijeda */}
        {!isPlaying && !isLoadingStream && !streamError && (
          <div
            onClick={handleTogglePlay}
            className="absolute inset-0 m-auto flex h-14 w-14 items-center justify-center rounded-full bg-cyan-400/90 text-slate-950 shadow-2xl backdrop-blur-sm cursor-pointer transition-transform hover:scale-110 active:scale-95 z-20"
            title="Putar segmen yang dipilih"
          >
            <Play className="h-6 w-6 fill-current ml-0.5" />
          </div>
        )}

        {/* Floating Bar Kontrol Video di Bawah Layar */}
        {!isLoadingStream && !streamError && (
          <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between gap-2 px-3 py-1.5 rounded-lg bg-black/60 backdrop-blur-md border border-white/10 text-xs font-mono text-white z-20">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleTogglePlay}
                className="p-1 rounded hover:bg-white/10 text-cyan-400 hover:text-white transition-colors"
                title={isPlaying ? 'Jeda' : 'Putar'}
              >
                {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4 fill-current" />}
              </button>

              {/* Waktu Berjalan / Selesai Potongan */}
              <span className="text-[11px] font-semibold">
                <span className="text-cyan-400">{formatTimeWithSubseconds(currentTime)}</span>
                <span className="text-white/40 mx-1">/</span>
                <span className="text-white/80">{formatTimeWithSubseconds(safeEnd)}</span>
              </span>
            </div>

            <div className="flex items-center gap-1.5">
              {/* Toggle Mode Loop (Ulang Otomatis) */}
              <button
                type="button"
                onClick={() => setIsLoop(!isLoop)}
                className={`p-1 rounded transition-colors ${
                  isLoop ? 'text-cyan-400 bg-cyan-400/10' : 'text-white/60 hover:text-white'
                }`}
                title={isLoop ? 'Ulang otomatis: Aktif' : 'Ulang otomatis: Mati'}
              >
                <Repeat className="h-3.5 w-3.5" />
              </button>

              {/* Toggle Mute */}
              <button
                type="button"
                onClick={() => setIsMuted(!isMuted)}
                className="p-1 rounded hover:bg-white/10 text-white/80 hover:text-white transition-colors"
                title={isMuted ? 'Bunyikan audio' : 'Bisukan audio'}
              >
                {isMuted ? <VolumeX className="h-3.5 w-3.5 text-rose-400" /> : <Volume2 className="h-3.5 w-3.5" />}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 2. Timeline Filmstrip Trimmer Bar */}
      <div className="space-y-1.5">
        <div
          ref={trackRef}
          onClick={handleTrackClick}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          className="relative h-16 w-full rounded-lg overflow-visible bg-black/80 touch-none cursor-pointer border border-cyan-500/30"
        >
          {/* Reel Frame Video */}
          <div className="absolute inset-0 flex h-full w-full overflow-hidden rounded-lg pointer-events-none">
            {frameImages.map((src, idx) => (
              <div
                key={idx}
                className="relative h-full flex-1 border-r border-black/40 overflow-hidden bg-black"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={src}
                  alt={`Frame ${idx}`}
                  className="h-full w-full object-cover opacity-90"
                  loading="eager"
                />
              </div>
            ))}
          </div>

          {/* Sisi Kiri Redup (Di Luar Seleksi) */}
          <div
            className="absolute top-0 bottom-0 left-0 bg-black/75 backdrop-blur-[1px] pointer-events-none rounded-l-lg transition-all duration-75"
            style={{ width: `${startPercent}%` }}
          />

          {/* Sisi Kanan Redup (Di Luar Seleksi) */}
          <div
            className="absolute top-0 bottom-0 right-0 bg-black/75 backdrop-blur-[1px] pointer-events-none rounded-r-lg transition-all duration-75"
            style={{ width: `${100 - endPercent}%` }}
          />

          {/* Kotak Seleksi Aktif Cyan */}
          <div
            className="absolute top-0 bottom-0 cursor-grab active:cursor-grabbing border-y-[3px] border-cyan-400 z-10 transition-all duration-75"
            style={{
              left: `${startPercent}%`,
              width: `${Math.max(endPercent - startPercent, 0.5)}%`,
            }}
            onPointerDown={(e) => handlePointerDown(e, 'middle')}
          />

          {/* Jarum Playhead Putih Bergerak — dipindah ke level track, bukan
              di dalam kotak seleksi. Sebelumnya playhead di 0% tepat
              menumpuk di bawah handle kiri (handle z-30, playhead z-20)
              sehingga di posisi awal garisnya tidak kelihatan sama
              sekali; dan karena currentTime stuck di 0, garis itu tidak
              pernah bergerak dari sana. Sekarang posisinya absolut
              terhadap track penuh dan z-40 (di atas handle), jadi garis
              tetap terlihat di bibir kiri/kanan trim, dan
              pointer-events-none supaya drag handle tetap bisa diklik. */}
          <div
            className="absolute top-0 bottom-0 w-[3px] -ml-[1px] bg-white shadow-[0_0_8px_rgba(255,255,255,0.9)] pointer-events-none z-40"
            style={{
              left: `${Math.max(
                0,
                Math.min(
                  startPercent +
                    (Math.max(0, Math.min(currentPercent, 100)) / 100) *
                      (endPercent - startPercent),
                  100
                )
              )}%`,
            }}
          />

          {/* Handle Kiri (Titik Mulai) dengan 3 Titik Vertikal */}
          <div
            onPointerDown={(e) => handlePointerDown(e, 'left')}
            className="absolute top-0 bottom-0 w-4 sm:w-5 -ml-2 sm:-ml-2.5 bg-cyan-400 rounded-l-md cursor-ew-resize z-30 flex items-center justify-center shadow-lg hover:brightness-110 active:brightness-125 transition-transform"
            style={{ left: `${startPercent}%` }}
            title="Geser untuk mengatur titik awal potongan"
          >
            <div className="flex flex-col gap-0.5 pointer-events-none">
              <span className="h-1 w-1 rounded-full bg-slate-900" />
              <span className="h-1 w-1 rounded-full bg-slate-900" />
              <span className="h-1 w-1 rounded-full bg-slate-900" />
            </div>
          </div>

          {/* Handle Kanan (Titik Selesai) dengan 3 Titik Vertikal */}
          <div
            onPointerDown={(e) => handlePointerDown(e, 'right')}
            className="absolute top-0 bottom-0 w-4 sm:w-5 -mr-2 sm:-mr-2.5 bg-cyan-400 rounded-r-md cursor-ew-resize z-30 flex items-center justify-center shadow-lg hover:brightness-110 active:brightness-125 transition-transform"
            style={{ left: `${endPercent}%` }}
            title="Geser untuk mengatur titik akhir potongan"
          >
            <div className="flex flex-col gap-0.5 pointer-events-none">
              <span className="h-1 w-1 rounded-full bg-slate-900" />
              <span className="h-1 w-1 rounded-full bg-slate-900" />
              <span className="h-1 w-1 rounded-full bg-slate-900" />
            </div>
          </div>

          {/* Tooltip Timestamp Mengambang dengan Panah Bawah */}
          {activeHandle && (
            <div
              className="absolute -top-9 -translate-x-1/2 z-40 pointer-events-none transition-all duration-75"
              style={{ left: `${Math.max(5, Math.min(tooltipPercent, 95))}%` }}
            >
              <div className="relative bg-white text-slate-900 font-mono text-xs font-bold px-2 py-0.5 rounded shadow-lg border border-slate-200">
                {tooltipText}
                <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-white" />
              </div>
            </div>
          )}
        </div>

        {/* 3 Timestamp Indikator (Mulai - Playhead - Selesai) Berwarna Cyan */}
        <div className="relative flex items-center justify-between font-mono text-xs text-cyan-400 px-0.5 font-semibold">
          <span>{formatTimeWithSubseconds(safeStart)}</span>
          <span className="text-cyan-200/80 text-[11px] font-medium">
            {formatTimeWithSubseconds(currentTime)}
          </span>
          <span>{formatTimeWithSubseconds(safeEnd)}</span>
        </div>
      </div>

      {/* 3. Panel Ringkasan Klip & Preset Cepat */}
      <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-obsidian-border/50 text-xs text-obsidian-muted">
        <div className="flex items-center gap-1.5 font-mono">
          <Clock className="h-3.5 w-3.5 text-cyan-400" />
          <span>Durasi Potongan:</span>
          <span className="font-semibold text-cyan-400">
            {formatTimeWithSubseconds(safeEnd - safeStart)}
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => {
              onChange(0, Math.min(30, duration));
              seekVideoTo(0);
            }}
            className="rounded border border-obsidian-border bg-obsidian-lowest px-2 py-1 text-[11px] hover:text-white hover:border-obsidian-border-strong transition-colors"
          >
            30s Pertama
          </button>
          <button
            type="button"
            onClick={() => {
              onChange(0, Math.min(60, duration));
              seekVideoTo(0);
            }}
            className="rounded border border-obsidian-border bg-obsidian-lowest px-2 py-1 text-[11px] hover:text-white hover:border-obsidian-border-strong transition-colors"
          >
            60s Pertama
          </button>
          <button
            type="button"
            onClick={() => {
              onChange(0, duration);
              seekVideoTo(0);
            }}
            className="flex items-center gap-1 rounded border border-obsidian-border bg-obsidian-lowest px-2 py-1 text-[11px] text-cyan-400 hover:text-white transition-colors"
          >
            <RotateCcw className="h-3 w-3" />
            <span>Reset</span>
          </button>
        </div>
      </div>
    </div>
  );
}
