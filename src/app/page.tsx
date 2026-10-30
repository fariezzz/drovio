'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import Navbar from '@/components/Navbar';
import UrlInputSection from '@/components/UrlInputSection';
import MediaPreviewCard from '@/components/MediaPreviewCard';
import ActiveJobCard from '@/components/ActiveJobCard';
import BatchActiveJobsCard from '@/components/BatchActiveJobsCard';
import RecentDownloadsList from '@/components/RecentDownloadsList';
import FileCompressorSection from '@/components/FileCompressorSection';
import FileConverterSection from '@/components/FileConverterSection';
import { MediaPreview, Job } from '@/lib/types';
import { ShieldCheck, Zap } from 'lucide-react';

export default function HomePage() {
  const [activeTab, setActiveTab] = useState<'downloader' | 'compressor' | 'converter'>('downloader');

  const [url, setUrl] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analyzeError, setAnalyzeError] = useState<string | undefined>(undefined);
  const [preview, setPreview] = useState<MediaPreview | null>(null);

  // Daftar pekerjaan yang sedang aktif (mendukung 1 atau banyak dari batch)
  const [activeJobs, setActiveJobs] = useState<Job[]>([]);
  const [recentJobs, setRecentJobs] = useState<Job[]>([]);
  const [isLoadingJobs, setIsLoadingJobs] = useState(false);
  const [isBatchDownloading, setIsBatchDownloading] = useState(false);

  // Ambil daftar riwayat unduhan
  const fetchRecentJobs = useCallback(async () => {
    setIsLoadingJobs(true);
    try {
      const res = await fetch('/api/jobs', { cache: 'no-store' });
      const data = await res.json();
      if (data.success && Array.isArray(data.data)) {
        setRecentJobs(data.data);
      }
    } catch {
      // Abaikan error fetch
    } finally {
      setIsLoadingJobs(false);
    }
  }, []);

  useEffect(() => {
    fetchRecentJobs();
  }, [fetchRecentJobs]);

  // Polling status untuk semua pekerjaan yang sedang aktif setiap 800ms
  const activeJobsRef = useRef<Job[]>([]);
  activeJobsRef.current = activeJobs;

  useEffect(() => {
    const hasPendingOrDownloading = activeJobs.some(
      (j) => j.status === 'pending' || j.status === 'downloading' || j.status === 'processing'
    );

    if (!hasPendingOrDownloading) return;

    const interval = setInterval(async () => {
      try {
        const res = await fetch('/api/jobs', { cache: 'no-store' });
        const data = await res.json();
        if (data.success && Array.isArray(data.data)) {
          const map = new Map<string, Job>(data.data.map((j: Job) => [j.id, j]));

          // Perbarui semua pekerjaan yang sedang aktif dengan data terkini dari backend
          setActiveJobs((prev) =>
            prev.map((oldJob) => map.get(oldJob.id) || oldJob)
          );

          setRecentJobs(data.data);
        }
      } catch {
        // Abaikan
      }
    }, 800);

    return () => clearInterval(interval);
  }, [activeJobs]);

  // Aksi Analisis URL
  const handleAnalyze = async () => {
    if (!url.trim()) return;

    setIsAnalyzing(true);
    setAnalyzeError(undefined);
    setPreview(null);

    try {
      const res = await fetch('/api/jobs/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: url.trim() }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Gagal memeriksa tautan media.');
      }

      setPreview(data.data);
    } catch (err: unknown) {
      const error = err as Error;
      setAnalyzeError(error.message);
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Mulai Proses Unduhan Tunggal
  const [isStartingDownload, setIsStartingDownload] = useState(false);
  const handleStartDownload = async (
    type: 'video' | 'audio',
    qualityId: string,
    options?: { trimStart?: string; trimEnd?: string; subtitleLang?: string }
  ) => {
    if (!preview) return;

    setIsStartingDownload(true);
    try {
      const res = await fetch('/api/jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: preview.url,
          type,
          qualityId,
          title: preview.title,
          thumbnail: preview.thumbnail,
          trimStart: options?.trimStart,
          trimEnd: options?.trimEnd,
          subtitleLang: options?.subtitleLang,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Gagal memulai unduhan.');
      }

      // Masukkan pekerjaan tunggal ke daftar aktif
      setActiveJobs([data.data]);
      setPreview(null);
      fetchRecentJobs();
    } catch (err: unknown) {
      const error = err as Error;
      setAnalyzeError(error.message);
    } finally {
      setIsStartingDownload(false);
    }
  };

  // Unduhan Batch (Banyak Tautan dengan Kustomisasi Resolusi)
  const handleBatchDownload = async (
    items: Array<{ url: string; type: 'video' | 'audio'; qualityId: string; title: string; thumbnail?: string }>
  ) => {
    if (items.length === 0) return;

    setIsBatchDownloading(true);
    setAnalyzeError(undefined);

    try {
      const res = await fetch('/api/jobs/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Gagal menambahkan antrean unduhan batch.');
      }

      // Tampilkan SEMUA pekerjaan dari batch ini di antrean aktif
      if (Array.isArray(data.data) && data.data.length > 0) {
        setActiveJobs(data.data);
      }

      fetchRecentJobs();
    } catch (err: unknown) {
      const error = err as Error;
      setAnalyzeError(error.message);
    } finally {
      setIsBatchDownloading(false);
    }
  };

  // Batalkan Unduhan
  const handleCancelJob = async (jobId: string) => {
    try {
      const res = await fetch(`/api/jobs/${jobId}/cancel`, {
        method: 'POST',
      });
      const data = await res.json();
      if (data.success && data.data) {
        setActiveJobs((prev) =>
          prev.map((j) => (j.id === jobId ? data.data : j))
        );
        fetchRecentJobs();
      }
    } catch {
      // Abaikan
    }
  };

  const handleDismissSingleJob = (jobId: string) => {
    setActiveJobs((prev) => prev.filter((j) => j.id !== jobId));
  };

  const handleDismissAllJobs = () => {
    setActiveJobs([]);
  };

  const handleScrollToHistory = () => {
    setActiveTab('downloader');
    setTimeout(() => {
      const el = document.getElementById('recent-downloads');
      if (el) {
        el.scrollIntoView({ behavior: 'smooth' });
      }
    }, 100);
  };

  const handleCompressFromHistory = (_filename: string) => {
    setActiveTab('compressor');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="min-h-screen bg-obsidian-canvas text-white flex flex-col justify-between">
      <div>
        {/* Navbar */}
        <Navbar
          activeTab={activeTab}
          onSelectTab={setActiveTab}
          onScrollToHistory={handleScrollToHistory}
        />

        {/* Container Utama */}
        <main className="mx-auto max-w-[1100px] px-4 py-8 space-y-6">
          {/* Tab Content 1: Pengunduh Media */}
          {activeTab === 'downloader' && (
            <div className="space-y-6">
              {/* Bagian Input URL (Tunggal & Batch) */}
              <UrlInputSection
                url={url}
                setUrl={setUrl}
                isLoading={isAnalyzing}
                onAnalyze={handleAnalyze}
                onBatchDownload={handleBatchDownload}
                isBatchDownloading={isBatchDownloading}
                errorMessage={analyzeError}
                onClearError={() => setAnalyzeError(undefined)}
              />

              {/* Tampilan Pekerjaan Aktif: Tunggal vs Batch Multi-Link */}
              {activeJobs.length === 1 && (
                <ActiveJobCard
                  job={activeJobs[0]}
                  onCancelJob={handleCancelJob}
                  onDismiss={() => handleDismissSingleJob(activeJobs[0].id)}
                />
              )}

              {activeJobs.length > 1 && (
                <BatchActiveJobsCard
                  jobs={activeJobs}
                  onCancelJob={handleCancelJob}
                  onDismissJob={handleDismissSingleJob}
                  onDismissAll={handleDismissAllJobs}
                />
              )}

              {/* Kartu Pratinjau Media (Hanya muncul jika tidak ada unduhan aktif yang menumpuk) */}
              {preview && activeJobs.length === 0 && (
                <MediaPreviewCard
                  preview={preview}
                  onStartDownload={handleStartDownload}
                  isStarting={isStartingDownload}
                />
              )}

              {/* Daftar Riwayat Unduhan */}
              <RecentDownloadsList
                jobs={recentJobs}
                onRefresh={fetchRecentJobs}
                isLoading={isLoadingJobs}
                onCompressFile={handleCompressFromHistory}
              />
            </div>
          )}

          {/* Tab Content 2: Kompresor Berkas */}
          {activeTab === 'compressor' && (
            <div className="space-y-6">
              <FileCompressorSection />
            </div>
          )}

          {/* Tab Content 3: Konversi Format Berkas */}
          {activeTab === 'converter' && (
            <div className="space-y-6">
              <FileConverterSection />
            </div>
          )}
        </main>
      </div>

      {/* Footer Publik Bersih */}
      <footer className="border-t border-obsidian-border bg-obsidian-lowest py-6 text-center text-xs text-obsidian-faint">
        <div className="mx-auto max-w-[1100px] px-4 flex flex-col sm:flex-row items-center justify-between gap-3">
          <span>&copy; 2026 Drovio. Unduh media, kompres, dan konversi berkas dengan mudah dan aman.</span>
          <div className="flex items-center gap-4 text-obsidian-muted">
            <span className="flex items-center gap-1.5">
              <ShieldCheck className="h-4 w-4 text-violet-accent" /> Privasi Terjamin
            </span>
            <span className="flex items-center gap-1.5">
              <Zap className="h-4 w-4 text-emerald-accent" /> Cepat &amp; Ringan
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
}
