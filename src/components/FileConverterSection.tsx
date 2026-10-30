'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  UploadCloud,
  FileText,
  Image as ImageIcon,
  Film,
  Music,
  FileArchive,
  Download,
  CheckCircle2,
  AlertCircle,
  Loader2,
  FolderOpen,
  X,
  Sparkles,
  RefreshCw,
  Share2,
  Check,
} from 'lucide-react';
import { ConversionCategory, ConversionResult } from '@/lib/converter/types';

interface AvailableFile {
  filename: string;
  category: string;
  size: number;
  sizeFormatted: string;
  mtime: number;
}

export default function FileConverterSection() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedLocalFilename, setSelectedLocalFilename] = useState<string | null>(null);
  const [category, setCategory] = useState<ConversionCategory>('image');
  const [fileSizeFormatted, setFileSizeFormatted] = useState<string>('');

  const [targetFormat, setTargetFormat] = useState<string>('mp4');
  const [isConverting, setIsConverting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [result, setResult] = useState<ConversionResult | null>(null);
  const [copiedShare, setCopiedShare] = useState(false);

  const [availableDownloads, setAvailableDownloads] = useState<AvailableFile[]>([]);
  const [showPicker, setShowPicker] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const dropzoneRef = useRef<HTMLDivElement>(null);

  const fetchAvailableDownloads = useCallback(async () => {
    try {
      const res = await fetch('/api/compress/files', { cache: 'no-store' });
      const data = await res.json();
      if (data.success && Array.isArray(data.data)) {
        setAvailableDownloads(data.data);
      }
    } catch {}
  }, []);

  useEffect(() => {
    fetchAvailableDownloads();
  }, [fetchAvailableDownloads]);

  const detectCategory = (filename: string): ConversionCategory => {
    const ext = filename.toLowerCase().split('.').pop() || '';
    if (['jpg', 'jpeg', 'png', 'webp', 'avif', 'gif', 'tiff', 'bmp'].includes(ext)) return 'image';
    if (['mp4', 'mkv', 'mov', 'avi', 'webm', 'flv', 'wmv'].includes(ext)) return 'video';
    if (['mp3', 'wav', 'flac', 'm4a', 'ogg', 'aac'].includes(ext)) return 'audio';
    return 'image';
  };

  const getDefaultFormat = (cat: ConversionCategory) => {
    switch (cat) {
      case 'image':
        return 'png';
      case 'video':
        return 'mp4';
      case 'audio':
        return 'mp3';
      default:
        return 'mp4';
    }
  };

  const formatBytes = (bytes: number): string => {
    if (bytes <= 0) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${(bytes / Math.pow(1024, i)).toFixed(2)} ${units[i]}`;
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setSelectedLocalFilename(null);
      const cat = detectCategory(file.name);
      setCategory(cat);
      setTargetFormat(getDefaultFormat(cat));
      setFileSizeFormatted(formatBytes(file.size));
      setResult(null);
      setErrorMessage(null);
    }
  };

  const handleSelectLocal = (item: AvailableFile) => {
    setSelectedLocalFilename(item.filename);
    setSelectedFile(null);
    const cat = detectCategory(item.filename);
    setCategory(cat);
    setTargetFormat(getDefaultFormat(cat));
    setFileSizeFormatted(item.sizeFormatted);
    setShowPicker(false);
    setResult(null);
    setErrorMessage(null);
  };

  const handleReset = () => {
    setSelectedFile(null);
    setSelectedLocalFilename(null);
    setResult(null);
    setErrorMessage(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleConvert = async () => {
    if (!selectedFile && !selectedLocalFilename) return;

    setIsConverting(true);
    setErrorMessage(null);

    try {
      let res: Response;
      const options = { category, targetFormat };

      if (selectedFile) {
        const formData = new FormData();
        formData.append('file', selectedFile);
        formData.append('options', JSON.stringify(options));
        res = await fetch('/api/convert', { method: 'POST', body: formData });
      } else {
        res = await fetch('/api/convert', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ localFilename: selectedLocalFilename, options }),
        });
      }

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Gagal mengonversi berkas.');
      }

      setResult(data.data);
      fetchAvailableDownloads();
    } catch (err: unknown) {
      const error = err as Error;
      setErrorMessage(error.message);
    } finally {
      setIsConverting(false);
    }
  };

  const handleShare = async () => {
    if (typeof window === 'undefined' || !result) return;
    const downloadUrl = `${window.location.origin}/api/convert/${result.id}/file`;

    if (navigator.share) {
      try {
        await navigator.share({
          title: result.convertedName,
          text: `Unduh berkas hasil konversi: ${result.convertedName}`,
          url: downloadUrl,
        });
        return;
      } catch {}
    }

    try {
      await navigator.clipboard.writeText(downloadUrl);
      setCopiedShare(true);
      setTimeout(() => setCopiedShare(false), 2500);
    } catch {}
  };

  // Format options by category
  const formatOptions: Record<ConversionCategory, { id: string; label: string; desc: string }[]> = {
    image: [
      { id: 'png', label: 'PNG', desc: 'Format gambar jernih mendukung latar transparan' },
      { id: 'jpg', label: 'JPG / JPEG', desc: 'Format foto standar universal paling kompatibel' },
      { id: 'webp', label: 'WebP', desc: 'Format modern ultra-ringan untuk web dan pesan' },
      { id: 'avif', label: 'AVIF', desc: 'Kompresi generasi terbaru kualitas ultra tajam' },
      { id: 'pdf', label: 'Dokumen PDF', desc: 'Ubah foto/gambar ini langsung menjadi dokumen PDF' },
    ],
    video: [
      { id: 'mp4', label: 'MP4', desc: 'Standar video paling kompatibel di semua perangkat & HP' },
      { id: 'webm', label: 'WebM', desc: 'Format terbuka efisien untuk web browser' },
      { id: 'mkv', label: 'MKV', desc: 'Wadah multimedia serbaguna multi-stream' },
      { id: 'gif', label: 'GIF Animasi', desc: 'Jadikan cuplikan animasi stiker tanpa audio' },
      { id: 'mp3', label: 'MP3 (Ekstrak Audio)', desc: 'Ambil dan simpan suara/musik dari videonya saja' },
    ],
    audio: [
      { id: 'mp3', label: 'MP3', desc: 'Format musik standar universal di semua pemutar lagu' },
      { id: 'wav', label: 'WAV', desc: 'Kualitas audio murni tanpa kompresi kualitas CD' },
      { id: 'm4a', label: 'M4A (AAC)', desc: 'Format audio standar perangkat Apple / iOS' },
      { id: 'ogg', label: 'OGG', desc: 'Format audio kompresi terbuka efisien' },
      { id: 'flac', label: 'FLAC', desc: 'Audio lossless kualitas studio rekaman' },
    ],
    document: [
      { id: 'pdf', label: 'PDF', desc: 'Optimasi standar PDF' },
    ],
    other: [
      { id: 'mp4', label: 'MP4', desc: 'Format video standar' },
    ],
  };

  const currentFormatList = formatOptions[category] || formatOptions.image;

  return (
    <div className="rounded-xl border border-obsidian-border bg-obsidian-surface p-5 md:p-6 shadow-xl space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-xl font-semibold tracking-tight text-white md:text-2xl flex items-center gap-2">
          <RefreshCw className="h-5 w-5 text-violet-accent" />
          Konversi Format Berkas
        </h2>
        <p className="mt-1 text-xs text-obsidian-muted md:text-sm">
          Ubah format video (MP4/WebM/GIF), musik (MP3/WAV/M4A), dan foto (JPG/PNG/WebP/PDF) dengan cepat.
        </p>
      </div>

      {/* Input / Dropzone */}
      {!selectedFile && !selectedLocalFilename ? (
        <div className="space-y-3">
          <div
            ref={dropzoneRef}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              const f = e.dataTransfer.files?.[0];
              if (f) {
                setSelectedFile(f);
                setSelectedLocalFilename(null);
                const cat = detectCategory(f.name);
                setCategory(cat);
                setTargetFormat(getDefaultFormat(cat));
                setFileSizeFormatted(formatBytes(f.size));
                setResult(null);
                setErrorMessage(null);
              }
            }}
            onClick={() => fileInputRef.current?.click()}
            className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-obsidian-border bg-obsidian-lowest p-8 text-center cursor-pointer transition-all hover:border-violet-accent hover:bg-obsidian-surface"
          >
            <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" />
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-obsidian-elevated text-violet-accent border border-obsidian-border mb-3">
              <UploadCloud className="h-6 w-6 stroke-[1.5]" />
            </div>
            <p className="text-sm font-semibold text-white">
              Tarik &amp; lepas berkas ke sini atau klik untuk memilih
            </p>
            <p className="mt-1 text-xs text-obsidian-muted">
              Mendukung Video (MP4, MOV, MKV, WebM), Audio (MP3, WAV, M4A), dan Foto (JPG, PNG, WebP)
            </p>
          </div>

          {availableDownloads.length > 0 && (
            <div className="flex items-center justify-between pt-1">
              <button
                type="button"
                onClick={() => setShowPicker(!showPicker)}
                className="flex items-center gap-1.5 text-xs text-violet-accent hover:text-violet-hover transition-colors"
              >
                <FolderOpen className="h-3.5 w-3.5" />
                <span>{showPicker ? 'Sembunyikan Pilihan' : 'Pilih dari berkas unduhan lokal'}</span>
              </button>
            </div>
          )}

          {showPicker && availableDownloads.length > 0 && (
            <div className="rounded-lg border border-obsidian-border bg-obsidian-lowest p-3 space-y-2 max-h-60 overflow-y-auto">
              <span className="text-[11px] font-semibold text-obsidian-faint block">
                Berkas Tersedia:
              </span>
              <div className="divide-y divide-obsidian-border/50">
                {availableDownloads.map((item) => (
                  <div
                    key={item.filename}
                    onClick={() => handleSelectLocal(item)}
                    className="flex items-center justify-between py-2 px-2 rounded cursor-pointer hover:bg-obsidian-elevated text-xs transition-colors"
                  >
                    <span className="font-medium text-white truncate max-w-[70%]">
                      {item.filename}
                    </span>
                    <span className="text-obsidian-muted font-mono">{item.sizeFormatted}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        /* Berkas Terpilih & Pilihan Target */
        <div className="space-y-4">
          <div className="flex items-center justify-between rounded-lg border border-obsidian-border bg-obsidian-lowest p-3.5">
            <div className="flex items-center gap-3 min-w-0">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-obsidian-elevated border border-obsidian-border text-violet-accent">
                {category === 'video' ? <Film className="h-5 w-5" /> : category === 'audio' ? <Music className="h-5 w-5" /> : <ImageIcon className="h-5 w-5" />}
              </div>
              <div className="min-w-0">
                <p className="text-xs font-semibold text-white truncate max-w-md">
                  {selectedFile ? selectedFile.name : selectedLocalFilename}
                </p>
                <div className="flex items-center gap-2 text-xs text-obsidian-muted mt-0.5">
                  <span className="rounded bg-obsidian-elevated px-1.5 py-0.2 text-violet-accent border border-obsidian-border capitalize">
                    {category}
                  </span>
                  <span>-</span>
                  <span className="text-white font-medium font-mono">{fileSizeFormatted}</span>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={handleReset}
              disabled={isConverting}
              className="rounded p-1.5 text-obsidian-muted hover:bg-obsidian-elevated hover:text-white"
              title="Ganti Berkas"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Pilihan Target Format */}
          <div className="rounded-lg border border-obsidian-border bg-obsidian-lowest p-4 space-y-3">
            <span className="text-xs font-semibold text-white block">
              Pilih Format Tujuan:
            </span>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {currentFormatList.map((f) => {
                const isSelected = targetFormat === f.id;
                return (
                  <div
                    key={f.id}
                    onClick={() => setTargetFormat(f.id)}
                    className={`cursor-pointer rounded-lg border p-3 flex items-start gap-3 transition-all ${
                      isSelected
                        ? 'border-violet-accent/60 bg-obsidian-elevated text-white shadow-sm'
                        : 'border-obsidian-border bg-obsidian-surface text-obsidian-muted hover:border-obsidian-border-strong'
                    }`}
                  >
                    <div
                      className={`flex h-4 w-4 shrink-0 mt-0.5 items-center justify-center rounded-full border ${
                        isSelected
                          ? 'border-violet-accent bg-violet-accent text-obsidian-canvas'
                          : 'border-obsidian-border-strong bg-transparent'
                      }`}
                    >
                      {isSelected && <Check className="h-2.5 w-2.5 stroke-[3]" />}
                    </div>

                    <div className="min-w-0 flex-1">
                      <span className="text-xs font-bold text-white block">{f.label}</span>
                      <span className="text-[11px] text-obsidian-muted block mt-0.5">{f.desc}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Tombol Aksi */}
          <div className="flex items-center justify-end gap-2.5 pt-1">
            <button
              type="button"
              onClick={handleReset}
              disabled={isConverting}
              className="rounded-lg border border-obsidian-border bg-obsidian-lowest px-4 py-2 text-xs text-obsidian-muted hover:text-white"
            >
              Batal
            </button>
            <button
              type="button"
              onClick={handleConvert}
              disabled={isConverting}
              className="flex items-center gap-2 rounded-lg bg-violet-accent px-6 py-2 text-xs font-semibold text-obsidian-canvas shadow-sm transition-all hover:bg-violet-hover disabled:cursor-not-allowed disabled:opacity-40"
            >
              {isConverting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin text-obsidian-canvas" />
                  <span>Sedang Mengonversi...</span>
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4 stroke-[2.5]" />
                  <span>Konversi Sekarang</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Pesan Kesalahan */}
      {errorMessage && (
        <div className="flex items-start gap-2.5 rounded-lg border border-crimson-accent/30 bg-crimson-muted p-3.5 text-xs text-crimson-accent">
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
          <div className="flex-1">
            <span className="font-semibold">Gagal mengonversi:</span> <span>{errorMessage}</span>
          </div>
        </div>
      )}

      {/* Kartu Hasil Konversi */}
      {result && (
        <div className="rounded-xl border border-emerald-accent/30 bg-emerald-muted/40 p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-emerald-accent/20 pb-3">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-emerald-accent" />
              <h3 className="text-xs font-semibold text-white">Konversi Berhasil</h3>
            </div>
            <span className="rounded bg-emerald-accent px-2.5 py-0.5 text-xs font-bold text-obsidian-canvas font-mono uppercase">
              {result.targetFormat}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 rounded-lg border border-obsidian-border bg-obsidian-lowest p-3.5 text-xs">
            <div>
              <span className="text-[11px] text-obsidian-faint block">Nama Berkas Baru</span>
              <span className="font-semibold text-white break-all">{result.convertedName}</span>
            </div>
            <div>
              <span className="text-[11px] text-obsidian-faint block">Ukuran Akhir</span>
              <span className="font-bold text-emerald-accent font-mono">{result.convertedSizeFormatted}</span>
            </div>
          </div>

          {/* Tombol Unduh & Bagikan */}
          <div className="flex flex-col sm:flex-row items-center justify-end gap-2.5 pt-1">
            <button
              type="button"
              onClick={handleReset}
              className="w-full sm:w-auto rounded-lg border border-obsidian-border bg-obsidian-surface px-4 py-2 text-xs font-medium text-obsidian-muted hover:text-white"
            >
              Konversi Berkas Lain
            </button>
            <button
              type="button"
              onClick={handleShare}
              className="flex w-full sm:w-auto items-center justify-center gap-1.5 rounded-lg border border-violet-accent/40 bg-violet-muted px-4 py-2 text-xs font-medium text-violet-accent hover:border-violet-accent hover:bg-violet-accent hover:text-obsidian-canvas transition-colors"
            >
              {copiedShare ? <Check className="h-4 w-4" /> : <Share2 className="h-4 w-4" />}
              <span>{copiedShare ? 'Tautan Disalin!' : 'Bagikan'}</span>
            </button>
            <a
              href={`/api/convert/${result.id}/file`}
              download={result.convertedName}
              className="flex w-full sm:w-auto items-center justify-center gap-2 rounded-lg bg-emerald-accent px-6 py-2 text-xs font-semibold text-obsidian-canvas shadow-sm transition-all hover:brightness-110"
            >
              <Download className="h-4 w-4 stroke-[2.5]" />
              <span>Unduh Berkas</span>
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
