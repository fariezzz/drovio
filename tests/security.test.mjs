import test from 'node:test';
import assert from 'node:assert/strict';

// Logika uji keamanan URL dan filename
function validateAndSanitizeUrl(inputUrl) {
  if (!inputUrl || typeof inputUrl !== 'string') {
    return { valid: false, error: 'URL tidak boleh kosong.' };
  }

  const trimmed = inputUrl.trim();
  let parsed;

  try {
    parsed = new URL(trimmed);
  } catch {
    return { valid: false, error: 'Format URL tidak valid. Pastikan menyertakan http:// atau https://.' };
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return { valid: false, error: 'Hanya protokol HTTP dan HTTPS publik yang didukung.' };
  }

  const hostname = parsed.hostname.toLowerCase();

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

  const ipv4Match = hostname.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (ipv4Match) {
    const [_, o1, o2, o3, o4] = ipv4Match.map(Number);
    if (o1 > 255 || o2 > 255 || o3 > 255 || o4 > 255) {
      return { valid: false, error: 'Format alamat IP tidak valid.' };
    }
    if (o1 === 127) return { valid: false, error: 'Akses ke alamat loopback ditolak.' };
    if (o1 === 10) return { valid: false, error: 'Akses ke jaringan privat (10.x.x.x) ditolak.' };
    if (o1 === 172 && o2 >= 16 && o2 <= 31) return { valid: false, error: 'Akses ke jaringan privat (172.16-31.x.x) ditolak.' };
    if (o1 === 192 && o2 === 168) return { valid: false, error: 'Akses ke jaringan privat (192.168.x.x) ditolak.' };
    if (o1 === 169 && o2 === 254) return { valid: false, error: 'Akses ke jaringan link-local ditolak.' };
    if (o1 === 0) return { valid: false, error: 'Alamat IP 0.0.0.0 tidak diizinkan.' };
  }

  if (hostname.startsWith('[fc') || hostname.startsWith('[fd') || hostname.startsWith('[fe80') || hostname.includes('::1')) {
    return { valid: false, error: 'Akses ke alamat IPv6 lokal/privat ditolak.' };
  }

  return { valid: true, url: parsed.toString() };
}

function detectPlatform(urlStr) {
  try {
    const parsed = new URL(urlStr);
    const host = parsed.hostname.toLowerCase();

    if (host.includes('youtube.com') || host.includes('youtu.be')) return { platform: 'youtube', platformName: 'YouTube' };
    if (host.includes('tiktok.com')) return { platform: 'tiktok', platformName: 'TikTok' };
    if (host.includes('instagram.com')) return { platform: 'instagram', platformName: 'Instagram' };
    if (host.includes('twitter.com') || host.includes('x.com')) return { platform: 'twitter', platformName: 'X (Twitter)' };
    if (host.includes('facebook.com') || host.includes('fb.watch') || host.includes('fb.com')) return { platform: 'facebook', platformName: 'Facebook' };
    if (host.includes('reddit.com') || host.includes('redd.it')) return { platform: 'reddit', platformName: 'Reddit' };
    if (host.includes('pinterest.com') || host.includes('pin.it')) return { platform: 'pinterest', platformName: 'Pinterest' };
    if (host.includes('soundcloud.com')) return { platform: 'soundcloud', platformName: 'SoundCloud' };

    return { platform: 'generic', platformName: 'Web Media' };
  } catch {
    return { platform: 'generic', platformName: 'Web Media' };
  }
}

function truncateUtf8(value, maxBytes) {
  let result = '';
  let size = 0;
  for (const character of value) {
    const characterSize = Buffer.byteLength(character, 'utf8');
    if (size + characterSize > maxBytes) break;
    result += character;
    size += characterSize;
  }
  return result;
}

function sanitizeWindowsFilename(rawName, fallback = 'media-download') {
  if (!rawName || typeof rawName !== 'string') return fallback;

  let safe = rawName
    // eslint-disable-next-line no-control-regex
    .replace(/[\x00-\x1f\x7f<>:"/\\|?*]/g, '')
    .trim();

  safe = safe.replace(/[. ]+$/, '');

  const baseName = safe.split('.')[0]?.toUpperCase() || '';
  const reserved = /^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])$/i;
  if (reserved.test(baseName)) {
    safe = `file_${safe}`;
  }

  const extensionMatch = safe.match(/\.[A-Za-z0-9]{1,8}$/);
  const ext = extensionMatch?.[0] || '';
  const base = ext ? safe.slice(0, -ext.length) : safe;
  safe = `${truncateUtf8(base, Math.max(1, 120 - Buffer.byteLength(ext, 'utf8')))}${ext}`;

  return safe.length > 0 ? safe : fallback;
}

test('Validasi URL Publik', () => {
  const result = validateAndSanitizeUrl('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
  assert.equal(result.valid, true);
  assert.equal(result.url, 'https://www.youtube.com/watch?v=dQw4w9WgXcQ');
});

test('Tolak URL Non-HTTP/HTTPS (file://, javascript:)', () => {
  const res1 = validateAndSanitizeUrl('file:///etc/passwd');
  assert.equal(res1.valid, false);

  const res2 = validateAndSanitizeUrl('javascript:alert(1)');
  assert.equal(res2.valid, false);
});

test('Tolak Localhost & Loopback (SSRF Prevention)', () => {
  const res1 = validateAndSanitizeUrl('http://localhost:3000/secret');
  assert.equal(res1.valid, false);

  const res2 = validateAndSanitizeUrl('http://127.0.0.1:8080');
  assert.equal(res2.valid, false);

  const res3 = validateAndSanitizeUrl('http://127.1.2.3');
  assert.equal(res3.valid, false);
});

test('Tolak Jaringan Privat RFC 1918 & Link-Local', () => {
  const res1 = validateAndSanitizeUrl('http://192.168.1.1/admin');
  assert.equal(res1.valid, false);

  const res2 = validateAndSanitizeUrl('http://10.0.0.5/api');
  assert.equal(res2.valid, false);

  const res3 = validateAndSanitizeUrl('http://172.20.0.1');
  assert.equal(res3.valid, false);

  const res4 = validateAndSanitizeUrl('http://169.254.169.254/latest/meta-data');
  assert.equal(res4.valid, false);
});

test('Deteksi Platform Asal URL', () => {
  assert.equal(detectPlatform('https://youtu.be/xyz').platform, 'youtube');
  assert.equal(detectPlatform('https://www.tiktok.com/@user/video/123').platform, 'tiktok');
  assert.equal(detectPlatform('https://instagram.com/reel/abc').platform, 'instagram');
  assert.equal(detectPlatform('https://x.com/user/status/123').platform, 'twitter');
  assert.equal(detectPlatform('https://www.facebook.com/reel/123').platform, 'facebook');
  assert.equal(detectPlatform('https://www.reddit.com/r/videos/comments/xyz').platform, 'reddit');
  assert.equal(detectPlatform('https://soundcloud.com/artist/track').platform, 'soundcloud');
  assert.equal(detectPlatform('https://example.com/video.mp4').platform, 'generic');
});

test('Sanitasi Nama File Windows (Karakter Terlarang & Reserved Names)', () => {
  const sanitizedChars = sanitizeWindowsFilename('Video <Keren> : "Part 1" / 2 | ? *');
  assert.equal(sanitizedChars.includes('<'), false);
  assert.equal(sanitizedChars.includes('>'), false);
  assert.equal(sanitizedChars.includes(':'), false);
  assert.equal(sanitizedChars.includes('"'), false);
  assert.equal(sanitizedChars.includes('/'), false);
  assert.equal(sanitizedChars.includes('|'), false);
  assert.equal(sanitizedChars.includes('?'), false);
  assert.equal(sanitizedChars.includes('*'), false);

  // Reserved Windows device names
  const reservedCon = sanitizeWindowsFilename('CON.mp4');
  assert.equal(reservedCon.startsWith('file_'), true);

  const reservedNul = sanitizeWindowsFilename('NUL.mp3');
  assert.equal(reservedNul.startsWith('file_'), true);

  const reservedPrn = sanitizeWindowsFilename('prn.mp4');
  assert.equal(reservedPrn.startsWith('file_'), true);

  const longUnicodeTitle = sanitizeWindowsFilename(
    '6.5K views · 513 reactions Talulah and Ch’en🥰 Bgm Photograph by Ed Sheeran 歌詞翻譯來源：【本文原創於：Music-Cool 音樂庫 (music-cool.tw)】 原文連結：httpswww.htmlm=1 #arkn'
  );
  assert.ok(Buffer.byteLength(longUnicodeTitle, 'utf8') <= 120);
  assert.equal(longUnicodeTitle.includes('�'), false);
});
