'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Cookie, Upload, Trash2, CheckCircle2, AlertTriangle, Loader2 } from 'lucide-react';

interface CookieStatus {
  present: boolean;
  youtubeCount: number;
  googleCount: number;
  earliestExpiry: number | null;
  expired: boolean;
}

export default function YoutubeCookiesSettings() {
  const [status, setStatus] = useState<CookieStatus | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/settings/youtube-cookies', { cache: 'no-store' });
      const data = await res.json();
      if (data.success) setStatus(data.data);
    } catch {}
  }, []);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  const handleUpload = async () => {
    const file = fileRef.current?.files?.[0];
    if (!file) {
      setError('Pilih dulu file cookies.txt yang sudah kamu ekspor.');
      return;
    }
    setUploading(true);
    setError(null);
    setMessage(null);
    try {
      const form = new FormData();
      form.append('file', file);
      const res = await fetch('/api/settings/youtube-cookies', { method: 'POST', body: form });
      const data = await res.json();
      if (!data.success) {
        setError(data.error || 'Gagal menyimpan cookie.');
      } else {
        setStatus(data.data);
        let msg = `Cookie tersimpan: ${data.data.youtubeCount} cookie YouTube`;
        if (data.data.googleCount > 0) msg += ` + ${data.data.googleCount} cookie Google`;
        msg += '.';
        if (data.data.droppedOtherDomain > 0) {
          msg += ` ${data.data.droppedOtherDomain} cookie situs lain dibuang otomatis.`;
        }
        if (data.data.droppedExpired > 0) {
          msg += ` ${data.data.droppedExpired} cookie kedaluwarsa dibuang.`;
        }
        msg += ' Coba preview video YouTube lagi — pilihan HD seharusnya muncul.';
        setMessage(msg);
        if (fileRef.current) fileRef.current.value = '';
      }
    } catch {
      setError('Gagal mengupload. Coba lagi.');
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    setError(null);
    setMessage(null);
    try {
      await fetch('/api/settings/youtube-cookies', { method: 'DELETE' });
      setStatus({ present: false, youtubeCount: 0, googleCount: 0, earliestExpiry: null, expired: false });
      setMessage('Cookie YouTube dihapus. Drovio kembali ke jalur Android 360p untuk YouTube.');
    } catch {
      setError('Gagal menghapus cookie.');
    } finally {
      setDeleting(false);
    }
  };

  const expiryText = status?.earliestExpiry
    ? new Date(status.earliestExpiry * 1000).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })
    : 'sesi (tidak ada tanggal kedaluwarsa)';

  return (
    <div className="rounded-lg border border-obsidian-border bg-obsidian-lowest p-3 sm:p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Cookie className="h-4 w-4 text-amber-400" />
        <h3 className="text-xs font-medium text-white">Cookie YouTube (untuk kualitas HD)</h3>
        {status?.present && !status.expired && (
          <span className="flex items-center gap-1 text-[11px] text-emerald-400">
            <CheckCircle2 className="h-3.5 w-3.5" /> Aktif
          </span>
        )}
        {status?.present && status.expired && (
          <span className="flex items-center gap-1 text-[11px] text-amber-400">
            <AlertTriangle className="h-3.5 w-3.5" /> Kedaluwarsa
          </span>
        )}
        {status && !status.present && (
          <span className="text-[11px] text-obsidian-muted">Belum ada — YouTube dibatasi 360p</span>
        )}
      </div>

      {status?.present && !status.expired && (
        <p className="text-xs text-obsidian-muted">
          Tersimpan {status.youtubeCount} cookie YouTube
          {status.googleCount > 0 ? ` + ${status.googleCount} cookie Google` : ''}
          . Cookie paling cepat kedaluwarsa: {expiryText}. Kalau sudah lewat tanggal itu, ekspor ulang dan upload lagi.
        </p>
      )}
      {status?.present && status.expired && (
        <p className="text-xs text-amber-300">
          Cookie yang tersimpan sudah kedaluwarsa. Ekspor ulang dari browser dan upload lagi, atau hapus supaya Drovio kembali ke jalur Android 360p.
        </p>
      )}

      <ol className="list-decimal list-inside space-y-1 text-xs text-obsidian-muted">
        <li>Login YouTube di browser PC kamu dengan akun kamu sendiri.</li>
        <li>Pasang ekstensi <span className="text-white">“Get cookies.txt LOCALLY”</span> — ekstensi ini mengekspor cookie secara lokal, tidak mengirimnya ke server lain.</li>
        <li>Buka youtube.com, klik ekstensi itu, lalu Export dan simpan file cookies.txt.</li>
        <li>Pilih file itu di bawah, lalu Upload. Hanya cookie youtube.com dan google.com yang disimpan; cookie situs lain dibuang otomatis.</li>
      </ol>

      <p className="rounded-lg border border-amber-400/30 bg-amber-400/10 p-2.5 text-[11px] text-amber-200">
        Cookie itu kunci sesi akun. Jangan pernah kirim isinya lewat chat, dan jangan pakai cookie orang lain.
        File yang kamu upload tidak bisa diunduh kembali lewat Drovio, dan tidak pernah masuk ke git, patch, atau backup.
        Catatan: dashboard Drovio ini tanpa login, jadi siapa pun yang punya linknya bisa mengganti atau menghapus cookie ini
        (tapi tidak bisa melihat isinya). Kalau khawatir, pakai akun YouTube sekunder untuk cookie ini.
      </p>

      <div className="flex flex-wrap items-center gap-2">
        <input
          ref={fileRef}
          type="file"
          accept=".txt,text/plain"
          className="text-xs text-obsidian-muted file:mr-2 file:rounded file:border file:border-obsidian-border file:bg-obsidian-surface file:px-2 file:py-1 file:text-xs file:text-white"
        />
        <button
          type="button"
          onClick={handleUpload}
          disabled={uploading}
          className="flex items-center gap-1.5 rounded bg-amber-400 px-3 py-1.5 text-xs font-semibold text-slate-950 hover:brightness-110 disabled:opacity-50"
        >
          {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
          {uploading ? 'Mengupload…' : 'Upload Cookie'}
        </button>
        {status?.present && (
          <button
            type="button"
            onClick={handleDelete}
            disabled={deleting}
            className="flex items-center gap-1.5 rounded border border-obsidian-border px-3 py-1.5 text-xs text-white hover:text-rose-400 disabled:opacity-50"
          >
            <Trash2 className="h-3.5 w-3.5" />
            {deleting ? 'Menghapus…' : 'Hapus Cookie'}
          </button>
        )}
      </div>

      {message && <p className="text-xs text-emerald-400">{message}</p>}
      {error && <p className="text-xs text-rose-400">{error}</p>}
    </div>
  );
}
