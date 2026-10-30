import path from 'path';
import { PlatformType } from './types';

// Validasi URL dan proteksi SSRF / akses jaringan lokal
export function validateAndSanitizeUrl(inputUrl: string): { valid: boolean; url?: string; error?: string } {
  if (!inputUrl || typeof inputUrl !== 'string') {
    return { valid: false, error: 'URL tidak boleh kosong.' };
  }

  const trimmed = inputUrl.trim();
  let parsed: URL;

  try {
    parsed = new URL(trimmed);
  } catch {
    return { valid: false, error: 'Format URL tidak valid. Pastikan menyertakan http:// atau https://.' };
  }

  // Hanya perbolehkan protokol HTTP dan HTTPS
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return { valid: false, error: 'Hanya protokol HTTP dan HTTPS publik yang didukung.' };
  }

  const hostname = parsed.hostname.toLowerCase();

  // Blokir localhost dan domain internal
  if (
    hostname === 'localhost' ||
    hostname.endsWith('.localhost') ||
    hostname.endsWith('.local') ||
    hostname.endsWith('.internal') ||
    hostname === '0.0.0.0' ||
    hostname === '::1'
  ) {
    return { valid: false, error: 'Akses ke alamat internal atau localhost ditolak demi keamanan.' };
  }

  // Cek jika hostname adalah alamat IP privat / loopback / link-local
  // IPv4 regex sederhana
  const ipv4Match = hostname.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (ipv4Match) {
    const [_, o1, o2, o3, o4] = ipv4Match.map(Number);
    if (o1 > 255 || o2 > 255 || o3 > 255 || o4 > 255) {
      return { valid: false, error: 'Format alamat IP tidak valid.' };
    }

    // Loopback 127.0.0.0/8
    if (o1 === 127) {
      return { valid: false, error: 'Akses ke alamat loopback ditolak.' };
    }
    // Private Class A 10.0.0.0/8
    if (o1 === 10) {
      return { valid: false, error: 'Akses ke jaringan privat (10.x.x.x) ditolak.' };
    }
    // Private Class B 172.16.0.0/12
    if (o1 === 172 && o2 >= 16 && o2 <= 31) {
      return { valid: false, error: 'Akses ke jaringan privat (172.16-31.x.x) ditolak.' };
    }
    // Private Class C 192.168.0.0/16
    if (o1 === 192 && o2 === 168) {
      return { valid: false, error: 'Akses ke jaringan privat (192.168.x.x) ditolak.' };
    }
    // Link-local / APIPA 169.254.0.0/16
    if (o1 === 169 && o2 === 254) {
      return { valid: false, error: 'Akses ke jaringan link-local ditolak.' };
    }
    // Zero IP
    if (o1 === 0) {
      return { valid: false, error: 'Alamat IP 0.0.0.0 tidak diizinkan.' };
    }
  }

  // Cek IPv6 loopback / unique local
  if (hostname.startsWith('[fc') || hostname.startsWith('[fd') || hostname.startsWith('[fe80') || hostname.includes('::1')) {
    return { valid: false, error: 'Akses ke alamat IPv6 lokal/privat ditolak.' };
  }

  return { valid: true, url: parsed.toString() };
}

// Identifikasi platform asal berdasarkan hostname URL
export function detectPlatform(urlStr: string): { platform: PlatformType; platformName: string } {
  try {
    const parsed = new URL(urlStr);
    const host = parsed.hostname.toLowerCase();

    if (host.includes('youtube.com') || host.includes('youtu.be')) {
      return { platform: 'youtube', platformName: 'YouTube' };
    }
    if (host.includes('tiktok.com')) {
      return { platform: 'tiktok', platformName: 'TikTok' };
    }
    if (host.includes('instagram.com')) {
      return { platform: 'instagram', platformName: 'Instagram' };
    }
    if (host.includes('twitter.com') || host.includes('x.com')) {
      return { platform: 'twitter', platformName: 'X (Twitter)' };
    }
    if (host.includes('facebook.com') || host.includes('fb.watch') || host.includes('fb.com')) {
      return { platform: 'facebook', platformName: 'Facebook' };
    }
    if (host.includes('reddit.com') || host.includes('redd.it')) {
      return { platform: 'reddit', platformName: 'Reddit' };
    }
    if (host.includes('pinterest.com') || host.includes('pin.it')) {
      return { platform: 'pinterest', platformName: 'Pinterest' };
    }
    if (host.includes('soundcloud.com')) {
      return { platform: 'soundcloud', platformName: 'SoundCloud' };
    }

    return { platform: 'generic', platformName: 'Web Media' };
  } catch {
    return { platform: 'generic', platformName: 'Web Media' };
  }
}

// Potong berdasarkan byte UTF-8 agar aman di Linux, Windows, dan filesystem jaringan.
function truncateUtf8(value: string, maxBytes: number): string {
  let result = '';
  let byteLength = 0;

  for (const character of value) {
    const characterBytes = Buffer.byteLength(character, 'utf8');
    if (byteLength + characterBytes > maxBytes) break;
    result += character;
    byteLength += characterBytes;
  }

  return result;
}

// Sanitasi nama file agar aman di Windows dan sistem operasi lain.
// Batas 120 byte menyisakan ruang untuk suffix job ID, ekstensi, dan .part.
export function sanitizeWindowsFilename(rawName: string, fallback: string = 'media-download'): string {
  if (!rawName || typeof rawName !== 'string') {
    return fallback;
  }

  // 1. Hapus karakter terlarang di Windows: < > : " / \\ | ? * dan karakter kontrol
  let safe = rawName
    // eslint-disable-next-line no-control-regex
    .replace(/[\x00-\x1f\x7f<>:"/\\|?*]/g, '')
    .trim();

  // 2. Hapus titik dan spasi berulang di akhir (Windows melarang nama berakhiran spasi/titik)
  safe = safe.replace(/[. ]+$/, '');

  // 3. Cek nama reserved device Windows: CON, PRN, AUX, NUL, COM1-9, LPT1-9
  const baseName = safe.split('.')[0]?.toUpperCase() || '';
  const reserved = /^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])$/i;
  if (reserved.test(baseName)) {
    safe = `file_${safe}`;
  }

  // 4. Batasi berdasarkan byte, bukan jumlah karakter. Karakter CJK/emoji memakai >1 byte.
  const extensionMatch = safe.match(/\.[A-Za-z0-9]{1,8}$/);
  const ext = extensionMatch?.[0] || '';
  const nameWithoutExt = ext ? safe.slice(0, -ext.length) : safe;
  const extBytes = Buffer.byteLength(ext, 'utf8');
  safe = `${truncateUtf8(nameWithoutExt, Math.max(1, 120 - extBytes))}${ext}`;

  return safe.length > 0 ? safe : fallback;
}

// Verifikasi keamanan path: memastikan target path berada di dalam direktori dasar
export function isPathInside(parentDir: string, targetPath: string): boolean {
  try {
    const normParent = path.resolve(parentDir).toLowerCase();
    const normTarget = path.resolve(targetPath).toLowerCase();
    const relative = path.relative(normParent, normTarget);
    return !relative.startsWith('..') && !path.isAbsolute(relative);
  } catch {
    return false;
  }
}
