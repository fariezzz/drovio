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
  Sliders,
  Sparkles,
  Zap,
  Share2,
  Check,
} from 'lucide-react';
import {
  FileCategory,
  CompressionLevel,
  CompressionResult,
} from '@/lib/compressor/types';

interface AvailableDownloadFile {
  filename: string;
  category: FileCategory;
  size: number;
  sizeFormatted: string;
  mtime: number;
}

export default function FileCompressorSection() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedLocalFilename, setSelectedLocalFilename] = useState<string | null>(null);
  const [fileCategory, setFileCategory] = useState<FileCategory>('generic');
  const [fileSizeFormatted, setFileSizeFormatted] = useState<string>('');

  // Opsi kompresi
  const [level, setLevel] = useState<CompressionLevel>('medium');
  const [imageFormat, setImageFormat] = useState<'original' | 'webp' | 'jpeg' | 'png'>('original');
  const [imageResize, setImageResize] = useState<number>(100);
  const [stripMetadata, setStripMetadata] = useState<boolean>(true);
  const [videoResolution, setVideoResolution] = useState<'original' | '1080p' | '720p' | '480p'>('original');
  const [audioBitrate, setAudioBitrate] = useState<'192k' | '128k' | '96k' | '64k'>('128k');

  // Status proses & hasil
  const [isCompressing, setIsCompressing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [result, setResult] = useState<CompressionResult | null>(null);
  const [copiedShare, setCopiedShare] = useState(false);

  const handleShareCompressed = async () => {
    if (typeof window === 'undefined' || !result) return;
    const downloadUrl = `${window.location.origin}/api/compress/${result.id}/file`;

    if (navigator.share) {
      try {
        await navigator.share({
          title: result.compressedName,
          text: `Unduh berkas terkompresi: ${result.compressedName}`,
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

  // Daftar berkas dari unduhan sebelumnya
  const [availableDownloads, setAvailableDownloads] = useState<AvailableDownloadFile[]>([]);
  const [showDownloadsPicker, setShowDownloadsPicker] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const dropzoneRef = useRef<HTMLDivElement>(null);

  const fetchAvailableDownloads = useCallback(async () => {
    try {
      const res = await fetch('/api/compress/files', { cache: 'no-store' });
      const data = await res.json();
      if (data.success && Array.isArray(data.data)) {
        setAvailableDownloads(data.data);
      }
    } catch {
      // Abaikan
    }
  }, []);

  useEffect(() => {
    fetchAvailableDownloads();
  }, [fetchAvailableDownloads]);

  const detectCategoryFromName = (filename: string): FileCategory => {
    const ext = filename.toLowerCase().split('.').pop() || '';
    if (['jpg', 'jpeg', 'png', 'webp', 'avif', 'gif', 'tiff', 'bmp'].includes(ext)) return 'image';
    if (ext === 'pdf') return 'pdf';
    if (['mp4', 'mkv', 'mov', 'avi', 'webm', 'flv', 'wmv'].includes(ext)) return 'video';
    if (['mp3', 'wav', 'flac', 'm4a', 'ogg', 'aac'].includes(ext)) return 'audio';
    return 'generic';
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
      setFileCategory(detectCategoryFromName(file.name));
      setFileSizeFormatted(formatBytes(file.size));
      setResult(null);
      setErrorMessage(null);
    }
  };

  const handleSelectLocalFile = (item: AvailableDownloadFile) => {
    setSelectedLocalFilename(item.filename);
    setSelectedFile(null);
    setFileCategory(item.category);
    setFileSizeFormatted(item.sizeFormatted);
    setShowDownloadsPicker(false);
    setResult(null);
    setErrorMessage(null);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) {
      setSelectedFile(file);
      setSelectedLocalFilename(null);
      setFileCategory(detectCategoryFromName(file.name));
      setFileSizeFormatted(formatBytes(file.size));
      setResult(null);
      setErrorMessage(null);
    }
  };

  const handleReset = () => {
    setSelectedFile(null);
    setSelectedLocalFilename(null);
    setResult(null);
    setErrorMessage(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleStartCompression = async () => {
    if (!selectedFile && !selectedLocalFilename) return;

    setIsCompressing(true);
    setErrorMessage(null);

    const optionsPayload = {
      fileCategory,
      image: {
        level,
        format: imageFormat,
        resizePercent: imageResize,
        stripMetadata,
      },
      pdf: {
        level,
        stripMetadata,
        compressImages: true,
      },
      video: {
        level,
        targetResolution: videoResolution,
        audioBitrate: '128k',
      },
      audio: {
        bitrate: audioBitrate,
      },
      generic: {
        archiveFormat: 'gzip',
      },
    };

    try {
      let res: Response;

      if (selectedFile) {
        const formData = new FormData();
        formData.append('file', selectedFile);
        formData.append('options', JSON.stringify(optionsPayload));

        res = await fetch('/api/compress', {
          method: 'POST',
          body: formData,
        });
      } else {
        res = await fetch('/api/compress', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            localFilename: selectedLocalFilename,
            options: optionsPayload,
          }),
        });
      }

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Gagal memproses kompresi berkas.');
      }

      setResult(data.data);
      fetchAvailableDownloads();
    } catch (err: unknown) {
      const error = err as Error;
      setErrorMessage(error.message);
    } finally {
      setIsCompressing(false);
    }
  };

  const getCategoryIcon = () => {
    switch (fileCategory) {
      case 'image':
        return <ImageIcon className="h-5 w-5 text-violet-accent" />;
      case 'pdf':
        return <FileText className="h-5 w-5 text-crimson-accent" />;
      case 'video':
        return <Film className="h-5 w-5 text-indigo-400" />;
      case 'audio':
        return <Music className="h-5 w-5 text-emerald-accent" />;
      default:
        return <FileArchive className="h-5 w-5 text-amber-400" />;
    }
  };

  const getCategoryLabel = () => {
    switch (fileCategory) {
      case 'image':
        return 'Gambar';
      case 'pdf':
        return 'Dokumen PDF';
      case 'video':
        return 'Video';
      case 'audio':
        return 'Audio';
      default:
        return 'Berkas';
    }
  };

  return (
    <div className="rounded-xl border border-obsidian-border bg-obsidian-surface p-5 md:p-6 shadow-xl space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-xl font-semibold tracking-tight text-white md:text-2xl flex items-center gap-2">
          <Zap className="h-5 w-5 text-violet-accent" />
          Kompres Berkas
        </h2>
        <p className="mt-1 text-xs text-obsidian-muted md:text-sm">
          Perkecil ukuran foto, dokumen PDF, video, dan audio Anda dengan mudah tanpa mengurangi kualitas secara drastis.
        </p>
      </div>

      {/* Input Berkas / Dropzone */}
      {!selectedFile && !selectedLocalFilename ? (
        <div className="space-y-3">
          <div
            ref={dropzoneRef}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-obsidian-border bg-obsidian-lowest p-8 text-center cursor-pointer transition-all hover:border-violet-accent hover:bg-obsidian-surface"
          >
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              className="hidden"
            />
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-obsidian-elevated text-violet-accent border border-obsidian-border mb-3">
              <UploadCloud className="h-6 w-6 stroke-[1.5]" />
            </div>
            <p className="text-sm font-semibold text-white">
              Tarik &amp; lepas berkas ke sini atau klik untuk memilih
            </p>
            <p className="mt-1 text-xs text-obsidian-muted">
              Mendukung Foto (JPG, PNG, WebP), Dokumen PDF, Video (MP4), dan Musik (MP3)
            </p>
          </div>

          {/* Opsi Pilih dari Berkas yang Ada */}
          {availableDownloads.length > 0 && (
            <div className="flex items-center justify-between pt-1">
              <button
                type="button"
                onClick={() => setShowDownloadsPicker(!showDownloadsPicker)}
                className="flex items-center gap-1.5 text-xs text-violet-accent hover:text-violet-hover transition-colors"
              >
                <FolderOpen className="h-3.5 w-3.5" />
                <span>
                  {showDownloadsPicker ? 'Sembunyikan Pilihan' : 'Pilih dari berkas yang baru diunduh'}
                </span>
              </button>
            </div>
          )}

          {/* Dropdown Berkas */}
          {showDownloadsPicker && availableDownloads.length > 0 && (
            <div className="rounded-lg border border-obsidian-border bg-obsidian-lowest p-3 space-y-2 max-h-60 overflow-y-auto">
              <span className="text-[11px] font-semibold text-obsidian-faint block">
                Berkas Tersedia:
              </span>
              <div className="divide-y divide-obsidian-border/50">
                {availableDownloads.map((item) => (
                  <div
                    key={item.filename}
                    onClick={() => handleSelectLocalFile(item)}
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
        /* Berkas Terpilih & Pengaturan */
        <div className="space-y-4">
          <div className="flex items-center justify-between rounded-lg border border-obsidian-border bg-obsidian-lowest p-3.5">
            <div className="flex items-center gap-3 min-w-0">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-obsidian-elevated border border-obsidian-border">
                {getCategoryIcon()}
              </div>
              <div className="min-w-0">
                <p className="text-xs font-semibold text-white truncate max-w-md">
                  {selectedFile ? selectedFile.name : selectedLocalFilename}
                </p>
                <div className="flex items-center gap-2 text-xs text-obsidian-muted mt-0.5">
                  <span className="rounded bg-obsidian-elevated px-1.5 py-0.2 text-violet-accent border border-obsidian-border">
                    {getCategoryLabel()}
                  </span>
                  <span>-</span>
                  <span className="text-white font-medium font-mono">{fileSizeFormatted}</span>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={handleReset}
              disabled={isCompressing}
              className="rounded p-1.5 text-obsidian-muted hover:bg-obsidian-elevated hover:text-white"
              title="Ganti Berkas"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Opsi Pengaturan */}
          <div className="rounded-lg border border-obsidian-border bg-obsidian-lowest p-4 space-y-4">
            <div className="flex items-center gap-2 border-b border-obsidian-border pb-2.5">
              <Sliders className="h-4 w-4 text-violet-accent" />
              <h4 className="text-xs font-semibold text-white">
                Pilihan Pengompresan
              </h4>
            </div>

            {/* Tingkat Kompresi */}
            <div>
              <span className="text-xs font-medium text-obsidian-muted block mb-2">
                Tingkat Kompresi:
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {[
                  { id: 'low', label: 'Ringan', desc: 'Kualitas terbaik, pengurangan ukuran sedang' },
                  { id: 'medium', label: 'Seimbang (Rekomendasi)', desc: 'Pengurangan ukuran optimal dengan kualitas tetap jernih' },
                  { id: 'high', label: 'Maksimal', desc: 'Ukuran paling kecil, sangat hemat ruang' },
                ].map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setLevel(item.id as CompressionLevel)}
                    className={`rounded-lg border p-2.5 text-left transition-all ${
                      level === item.id
                        ? 'border-violet-accent bg-obsidian-elevated text-white shadow-sm'
                        : 'border-obsidian-border bg-obsidian-surface text-obsidian-muted hover:border-obsidian-border-strong'
                    }`}
                  >
                    <div className="text-xs font-bold text-white">{item.label}</div>
                    <div className="text-[11px] text-obsidian-muted mt-1">{item.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Opsi Gambar */}
            {fileCategory === 'image' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-obsidian-border">
                <div>
                  <span className="text-xs text-obsidian-muted block mb-1">
                    Format Hasil:
                  </span>
                  <select
                    value={imageFormat}
                    onChange={(e) => setImageFormat(e.target.value as any)}
                    className="w-full rounded border border-obsidian-border bg-obsidian-surface px-3 py-1.5 text-xs text-white focus:border-violet-accent focus:outline-none"
                  >
                    <option value="original">Pertahankan Format Asli</option>
                    <option value="webp">WebP (Paling Hemat Ukuran)</option>
                    <option value="jpeg">JPEG / JPG</option>
                    <option value="png">PNG</option>
                  </select>
                </div>

                <div>
                  <span className="text-xs text-obsidian-muted block mb-1">
                    Ukuran Dimensi:
                  </span>
                  <select
                    value={imageResize}
                    onChange={(e) => setImageResize(Number(e.target.value))}
                    className="w-full rounded border border-obsidian-border bg-obsidian-surface px-3 py-1.5 text-xs text-white focus:border-violet-accent focus:outline-none"
                  >
                    <option value={100}>100% (Ukuran Asli)</option>
                    <option value={75}>75% dari Ukuran Asli</option>
                    <option value={50}>50% dari Ukuran Asli</option>
                  </select>
                </div>

                <div className="col-span-1 sm:col-span-2 flex items-center gap-2 pt-1">
                  <input
                    type="checkbox"
                    id="stripMeta"
                    checked={stripMetadata}
                    onChange={(e) => setStripMetadata(e.target.checked)}
                    className="h-3.5 w-3.5 rounded border-obsidian-border bg-obsidian-surface text-violet-accent focus:ring-0"
                  />
                  <label htmlFor="stripMeta" className="text-xs text-obsidian-muted cursor-pointer">
                    Hapus informasi lokasi dan detail kamera untuk privasi
                  </label>
                </div>
              </div>
            )}

            {/* Opsi PDF */}
            {fileCategory === 'pdf' && (
              <div className="pt-2 border-t border-obsidian-border space-y-2">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="stripPdfMeta"
                    checked={stripMetadata}
                    onChange={(e) => setStripMetadata(e.target.checked)}
                    className="h-3.5 w-3.5 rounded border-obsidian-border bg-obsidian-surface text-violet-accent focus:ring-0"
                  />
                  <label htmlFor="stripPdfMeta" className="text-xs text-obsidian-muted cursor-pointer">
                    Optimalkan struktur dokumen dan gambar di dalam PDF
                  </label>
                </div>
              </div>
            )}

            {/* Opsi Video */}
            {fileCategory === 'video' && (
              <div className="pt-2 border-t border-obsidian-border space-y-1.5">
                <span className="text-xs text-obsidian-muted block">
                  Resolusi Video:
                </span>
                <select
                  value={videoResolution}
                  onChange={(e) => setVideoResolution(e.target.value as any)}
                  className="w-full sm:w-64 rounded border border-obsidian-border bg-obsidian-surface px-3 py-1.5 text-xs text-white focus:border-violet-accent focus:outline-none"
                >
                  <option value="original">Resolusi Asli</option>
                  <option value="1080p">Maksimal 1080p Full HD</option>
                  <option value="720p">Maksimal 720p HD</option>
                  <option value="480p">Maksimal 480p SD</option>
                </select>
              </div>
            )}

            {/* Opsi Audio */}
            {fileCategory === 'audio' && (
              <div className="pt-2 border-t border-obsidian-border space-y-1.5">
                <span className="text-xs text-obsidian-muted block">
                  Kualitas Audio:
                </span>
                <select
                  value={audioBitrate}
                  onChange={(e) => setAudioBitrate(e.target.value as any)}
                  className="w-full sm:w-64 rounded border border-obsidian-border bg-obsidian-surface px-3 py-1.5 text-xs text-white focus:border-violet-accent focus:outline-none"
                >
                  <option value="192k">Kualitas Sangat Jernih (192 kbps)</option>
                  <option value="128k">Kualitas Seimbang (128 kbps)</option>
                  <option value="96k">Hemat Ukuran (96 kbps)</option>
                  <option value="64k">Paling Ringan (64 kbps)</option>
                </select>
              </div>
            )}
          </div>

          {/* Tombol Eksekusi */}
          <div className="flex items-center justify-end gap-2.5 pt-1">
            <button
              type="button"
              onClick={handleReset}
              disabled={isCompressing}
              className="rounded-lg border border-obsidian-border bg-obsidian-lowest px-4 py-2 text-xs text-obsidian-muted hover:text-white"
            >
              Batal
            </button>
            <button
              type="button"
              onClick={handleStartCompression}
              disabled={isCompressing}
              className="flex items-center gap-2 rounded-lg bg-violet-accent px-6 py-2 text-xs font-semibold text-obsidian-canvas shadow-sm transition-all hover:bg-violet-hover disabled:cursor-not-allowed disabled:opacity-40"
            >
              {isCompressing ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin text-obsidian-canvas" />
                  <span>Sedang Mengompres...</span>
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4 stroke-[2.5]" />
                  <span>Mulai Kompres</span>
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
            <span className="font-semibold">Gagal mengompres berkas:</span>{' '}
            <span>{errorMessage}</span>
          </div>
        </div>
      )}

      {/* Hasil Kompresi */}
      {result && (
        <div className="rounded-xl border border-emerald-accent/30 bg-emerald-muted/40 p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-emerald-accent/20 pb-3">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-emerald-accent" />
              <h3 className="text-xs font-semibold text-white">
                Kompresi Berhasil
              </h3>
            </div>
            <span className="inline-flex items-center rounded bg-emerald-accent px-2.5 py-0.5 text-xs font-bold text-obsidian-canvas">
              Hemat {result.savedPercent}%
            </span>
          </div>

          {/* Perbandingan Ukuran */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 rounded-lg border border-obsidian-border bg-obsidian-lowest p-3.5 text-xs">
            <div>
              <span className="text-[11px] text-obsidian-faint block">Ukuran Awal</span>
              <span className="font-medium text-white font-mono">
                {result.originalSizeFormatted}
              </span>
            </div>
            <div>
              <span className="text-[11px] text-obsidian-faint block">Ukuran Setelah Dikompres</span>
              <span className="font-bold text-emerald-accent font-mono">
                {result.compressedSizeFormatted}
              </span>
            </div>
          </div>

          {/* Tombol Unduh Hasil */}
          <div className="flex flex-col sm:flex-row items-center justify-end gap-2.5 pt-1">
            <button
              type="button"
              onClick={handleReset}
              className="w-full sm:w-auto rounded-lg border border-obsidian-border bg-obsidian-surface px-4 py-2 text-xs font-medium text-obsidian-muted hover:text-white"
            >
              Kompres Berkas Lain
            </button>
            <button
              type="button"
              onClick={handleShareCompressed}
              className="flex w-full sm:w-auto items-center justify-center gap-1.5 rounded-lg border border-violet-accent/40 bg-violet-muted px-4 py-2 text-xs font-medium text-violet-accent hover:border-violet-accent hover:bg-violet-accent hover:text-obsidian-canvas transition-colors"
              title="Bagikan tautan berkas"
            >
              {copiedShare ? <Check className="h-4 w-4" /> : <Share2 className="h-4 w-4" />}
              <span>{copiedShare ? 'Tautan Disalin!' : 'Bagikan'}</span>
            </button>
            <a
              href={`/api/compress/${result.id}/file`}
              download={result.compressedName}
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
