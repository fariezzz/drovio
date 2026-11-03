// Cookie YouTube untuk yt-dlp (2026-11-02, atas pilihan pengguna).
//
// Kenapa ada file ini: client web YouTube dari IP VM ini kena bot-check,
// sementara client Android tanpa login cuma memberi 360p. Cookie dari
// akun YouTube pengguna sendiri membuat client web dipercaya lagi dan
// mengembalikan kualitas HD — tanpa biaya, tanpa YouTube Premium.
//
// ATURAN KEAMANAN — baca sebelum mengubah file ini:
// 1. Cookie adalah token sesi. JANGAN PERNAH mengembalikan isi file ini
//    lewat API, log, error message, atau UI. Route status hanya boleh
//    mengembalikan ada/tidak, jumlah baris, dan tanggal kedaluwarsa.
// 2. File disimpan di <project>/data/youtube-cookies.txt — BUKAN di
//    downloads/ (yang bisa diunduh lewat API file) dan BUKAN di public/.
//    Tidak ada route yang melayani path ini.
// 3. File ini tidak boleh masuk git, patch, atau backup. Lihat .gitignore
//    (/data/ dan youtube-cookies.txt) dan jangan pernah menyertakannya
//    saat membuat patch/backup.
// 4. Saat upload, hanya cookie youtube.com dan google.com yang disimpan;
//    cookie situs lain dari file ekspor browser DIBUANG, supaya kalau
//    file ini bocor, dampaknya tidak melebar ke semua situs pengguna.
// 5. Cookie yang sudah kedaluwarsa dibuang saat upload dan tidak dipakai.
// 6. Izin file 0o600, direktori data 0o700.
// 7. yt-dlp hanya diberi --cookies untuk URL YouTube, tidak pernah untuk
//    platform lain.

import fs from 'fs';
import path from 'path';

export interface YoutubeCookieStatus {
  present: boolean;
  youtubeCount: number;
  googleCount: number;
  earliestExpiry: number | null; // epoch detik, null kalau semua sesi
  expired: boolean; // true kalau file ada tapi semua cookie YouTube kedaluwarsa
  totalLines: number;
}

interface ParsedCookies {
  youtubeLines: string[];
  googleLines: string[];
  droppedExpired: number;
  droppedOtherDomain: number;
}

const MAX_UPLOAD_BYTES = 512 * 1024;

export function getYoutubeCookiesPath(): string {
  return path.join(process.cwd(), 'data', 'youtube-cookies.txt');
}

function isYoutubeDomain(domain: string): boolean {
  const d = domain.replace(/^\./, '').toLowerCase();
  return d === 'youtube.com' || d.endsWith('.youtube.com');
}

function isGoogleDomain(domain: string): boolean {
  const d = domain.replace(/^\./, '').toLowerCase();
  return d === 'google.com' || d.endsWith('.google.com');
}

// Parse format Netscape cookies.txt. Baris: domain, flag, path, secure,
// expiration, name, value — dipisah tab (ekstensi kadang pakai spasi,
// jadi fallback ke whitespace). Baris komentar (#...) dilewati, kecuali
// #HttpOnly_ yang merupakan prefix domain, bukan komentar.
function parseNetscape(text: string): ParsedCookies {
  const youtubeLines: string[] = [];
  const googleLines: string[] = [];
  let droppedExpired = 0;
  let droppedOtherDomain = 0;
  const nowSec = Math.floor(Date.now() / 1000);

  for (const rawLine of text.split(/\r?\n/)) {
    let line = rawLine.trim();
    if (!line) continue;
    if (line.startsWith('#HttpOnly_')) {
      line = line.slice('#HttpOnly_'.length);
    } else if (line.startsWith('#')) {
      continue;
    }
    const parts = line.split(/\t+/).length >= 7 ? line.split(/\t+/) : line.split(/\s+/);
    if (parts.length < 7) continue;
    const domain = parts[0];
    const expiry = parseInt(parts[4], 10);
    if (!Number.isNaN(expiry) && expiry !== 0 && expiry <= nowSec) {
      droppedExpired++;
      continue;
    }
    // Normalisasi ke tab agar yt-dlp selalu bisa membacanya.
    const normalized = parts.slice(0, 7).join('\t');
    if (isYoutubeDomain(domain)) {
      youtubeLines.push(normalized);
    } else if (isGoogleDomain(domain)) {
      googleLines.push(normalized);
    } else {
      droppedOtherDomain++;
    }
  }

  return { youtubeLines, googleLines, droppedExpired, droppedOtherDomain };
}

export function getYoutubeCookieStatus(): YoutubeCookieStatus {
  const filePath = getYoutubeCookiesPath();
  const empty: YoutubeCookieStatus = {
    present: false, youtubeCount: 0, googleCount: 0,
    earliestExpiry: null, expired: false, totalLines: 0,
  };
  if (!fs.existsSync(filePath)) return empty;
  let content: string;
  try {
    content = fs.readFileSync(filePath, 'utf-8');
  } catch {
    return empty;
  }
  const parsed = parseNetscape(content);
  const total = parsed.youtubeLines.length + parsed.googleLines.length;
  if (total === 0) {
    // File ada tapi tidak ada cookie YouTube yang masih berlaku.
    return { ...empty, present: true, expired: true, totalLines: 0 };
  }
  let earliest: number | null = null;
  for (const line of [...parsed.youtubeLines, ...parsed.googleLines]) {
    const expiry = parseInt(line.split('\t')[4], 10);
    if (!Number.isNaN(expiry) && expiry !== 0) {
      earliest = earliest === null ? expiry : Math.min(earliest, expiry);
    }
  }
  return {
    present: true,
    youtubeCount: parsed.youtubeLines.length,
    googleCount: parsed.googleLines.length,
    earliestExpiry: earliest,
    expired: false,
    totalLines: total,
  };
}

// true hanya kalau ada cookie YouTube yang masih berlaku.
export function hasValidYoutubeCookies(): boolean {
  const status = getYoutubeCookieStatus();
  return status.present && !status.expired && status.youtubeCount > 0;
}

// Argumen yt-dlp untuk URL YouTube saja. Panggil hanya setelah memastikan
// URL-nya YouTube; pemanggil yang bertanggung jawab atas pengecekan itu.
export function getYoutubeCookiesArgs(): string[] {
  if (!hasValidYoutubeCookies()) return [];
  return ['--cookies', getYoutubeCookiesPath()];
}

export function saveYoutubeCookies(
  rawText: string
): { status: YoutubeCookieStatus; droppedExpired: number; droppedOtherDomain: number } {
  if (Buffer.byteLength(rawText, 'utf-8') > MAX_UPLOAD_BYTES) {
    throw new Error('File cookie terlalu besar (maksimal 512 KB). Ekspor ulang hanya untuk youtube.com.');
  }
  const parsed = parseNetscape(rawText);
  if (parsed.youtubeLines.length === 0) {
    throw new Error(
      'Tidak ditemukan cookie youtube.com yang masih berlaku di file ini. ' +
      'Pastikan kamu login YouTube di browser, lalu ekspor dari youtube.com (bukan dari situs lain).'
    );
  }
  const dir = path.dirname(getYoutubeCookiesPath());
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  }
  try {
    fs.chmodSync(dir, 0o700);
  } catch {}
  // Header Netscape WAJIB: yt-dlp menolak file tanpa baris ini dengan
  // "does not look like a Netscape format cookies file" — bug ini sempat
  // lolos karena parser kami membuang semua baris # saat menyimpan.
  const content = '# Netscape HTTP Cookie File\n' +
    [...parsed.youtubeLines, ...parsed.googleLines].join('\n') + '\n';
  // Tulis ke file sementara lalu rename, supaya tidak ada momen di mana
  // file cookie setengah tertulis dibaca yt-dlp.
  const tmpPath = getYoutubeCookiesPath() + '.tmp';
  fs.writeFileSync(tmpPath, content, { mode: 0o600 });
  try {
    fs.chmodSync(tmpPath, 0o600);
  } catch {}
  fs.renameSync(tmpPath, getYoutubeCookiesPath());
  return {
    status: getYoutubeCookieStatus(),
    droppedExpired: parsed.droppedExpired,
    droppedOtherDomain: parsed.droppedOtherDomain,
  };
}

export function deleteYoutubeCookies(): boolean {
  const filePath = getYoutubeCookiesPath();
  if (!fs.existsSync(filePath)) return false;
  try {
    fs.unlinkSync(filePath);
    return true;
  } catch {
    return false;
  }
}
