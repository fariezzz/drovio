import { spawn, execSync } from 'child_process';
import fs from 'fs';
import { getConfig } from './config';
import { validateAndSanitizeUrl, detectPlatform, checkHostResolvesPublic } from './security';
import { MediaPreview, QualityOption, SystemHealth } from './types';
import { getYoutubeCookiesArgs } from './youtube-cookies';
import { getPotArgs } from './pot-provider';

// Format detik menjadi jam:menit:detik atau menit:detik
export function formatDuration(seconds?: number): string {
  if (!seconds || isNaN(seconds) || seconds <= 0) {
    return '00:00';
  }
  const s = Math.floor(seconds);
  const hrs = Math.floor(s / 3600);
  const mins = Math.floor((s % 3600) / 60);
  const secs = s % 60;

  if (hrs > 0) {
    return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

// Format bytes ke ukuran yang mudah dibaca (KB, MB, GB)
export function formatBytes(bytes?: number): string {
  if (!bytes || isNaN(bytes) || bytes <= 0) {
    return '0 B';
  }
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(2)} ${units[i]}`;
}

// Terjemahkan pesan error yt-dlp ke pesan bahasa Indonesia yang ramah pengguna
export function translateErrorMessage(rawError: string): string {
  const lower = rawError.toLowerCase();

  if (lower.includes('private video') || lower.includes('this video is private')) {
    return 'Media ini bersifat pribadi (private) dan tidak dapat diakses tanpa otentikasi.';
  }
  if (lower.includes('login required') || lower.includes('sign in to confirm')) {
    return 'Konten memerlukan login atau verifikasi usia dari platform sumber.';
  }
  if (lower.includes('video unavailable') || lower.includes('not available')) {
    return 'Media tidak tersedia atau telah dihapus oleh pengunggah.';
  }
  if (lower.includes('unsupported url') || lower.includes('no suitable extractor')) {
    return 'Tautan URL tidak didukung oleh mesin ekstraksi atau formatnya tidak dikenali.';
  }
  if (lower.includes('requested format is not available') || lower.includes('format is not available')) {
    return 'Tidak ada format video di bawah batas resolusi yang dipilih untuk media ini. Coba pilih "Kualitas Terbaik" atau resolusi yang lebih tinggi.';
  }
  if (lower.includes('timed out') || lower.includes('timeout')) {
    return 'Koneksi ke situs sumber melebihi batas waktu (timeout). Coba beberapa saat lagi.';
  }
  if (lower.includes('403: forbidden') || lower.includes('http error 403')) {
    return 'Akses ditolak (HTTP 403) oleh platform sumber. Video mungkin dibatasi privasi (friends-only), dibatasi wilayah, atau CDN platform membatasi akses unduhan langsung.';
  }
  if (lower.includes('404: not found') || lower.includes('http error 404')) {
    return 'Halaman media tidak ditemukan (HTTP 404). Periksa kembali tautan yang dimasukkan.';
  }
  if (lower.includes('drm') || lower.includes('encrypted')) {
    return 'Konten dilindungi oleh DRM atau enkripsi digital dan tidak dapat diunduh.';
  }

  // Jika ringkas, gunakan langsung; jika terlalu panjang bersihkan baris log teknis
  const lines = rawError.split('\n').filter(l => l.trim().startsWith('ERROR:'));
  if (lines.length > 0) {
    return lines[0].replace(/^ERROR:\s*/, '').trim();
  }

  return 'Gagal memproses media. Pastikan tautan masih aktif dan dapat diakses publik.';
}

// Cache hasil pengecekan kesehatan sistem agar tidak berulang kali memanggil process CLI
let cachedHealthResult: { data: SystemHealth; timestamp: number } | null = null;

// Dapatkan informasi kesehatan sistem dan dependensi
export function checkSystemHealth(forceRefresh: boolean = false): SystemHealth {
  const now = Date.now();
  if (!forceRefresh && cachedHealthResult && now - cachedHealthResult.timestamp < 120000) {
    return cachedHealthResult.data;
  }

  const config = getConfig();
  const health: SystemHealth = {
    ytdlp: {
      available: false,
      path: config.ytdlpPath,
    },
    ffmpeg: {
      available: false,
      path: config.ffmpegPath,
    },
    downloadDir: {
      path: config.downloadDir,
      writable: false,
    },
    operatingSystem: process.platform === 'win32' ? 'Windows' : `${process.platform} (WSL/Linux)`,
  };

  // Cek yt-dlp
  try {
    const ytdlpVersion = execSync(`"${config.ytdlpPath}" --version`, {
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'ignore'],
      timeout: 5000,
    }).trim();
    health.ytdlp.available = true;
    health.ytdlp.version = ytdlpVersion;
  } catch (err: unknown) {
    const error = err as Error;
    health.ytdlp.error = error.message;
  }

  // Cek ffmpeg
  try {
    const ffmpegVersion = execSync(`"${config.ffmpegPath}" -version`, {
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'ignore'],
      timeout: 5000,
    }).trim();
    const firstLine = ffmpegVersion.split('\n')[0] || '';
    health.ffmpeg.available = true;
    health.ffmpeg.version = firstLine.replace(/^ffmpeg version\s*/i, '').trim();
  } catch (err: unknown) {
    const error = err as Error;
    health.ffmpeg.error = error.message;
  }

  // Cek direktori unduhan
  try {
    if (!fs.existsSync(config.downloadDir)) {
      fs.mkdirSync(config.downloadDir, { recursive: true });
    }
    const testFile = `${config.downloadDir}/.write-test-${Date.now()}`;
    fs.writeFileSync(testFile, 'ok');
    fs.unlinkSync(testFile);
    health.downloadDir.writable = true;
  } catch {
    health.downloadDir.writable = false;
  }

  cachedHealthResult = { data: health, timestamp: now };
  return health;
}

// Perkirakan ukuran berkas untuk setiap pilihan kualitas
function estimateOptionSize(
  optionId: string,
  type: 'video' | 'audio',
  info: any
): string | undefined {
  const formats: any[] = Array.isArray(info?.formats) ? info.formats : [];
  const duration: number | undefined =
    typeof info?.duration === 'number' && info.duration > 0 ? info.duration : undefined;

  // 1. Cari ukuran audio terbaik
  let bestAudioBytes = 0;
  for (const f of formats) {
    if (f.acodec && f.acodec !== 'none' && (!f.vcodec || f.vcodec === 'none')) {
      const size = f.filesize || f.filesize_approx;
      if (typeof size === 'number' && size > bestAudioBytes) {
        bestAudioBytes = size;
      } else if (!bestAudioBytes && typeof f.abr === 'number' && duration) {
        bestAudioBytes = Math.round(((f.abr * 1000) / 8) * duration);
      }
    }
  }

  // Jika tipe AUDIO (MP3)
  if (type === 'audio') {
    const bitrateMap: Record<string, number> = {
      'mp3-best': 320,
      'mp3-256': 256,
      'mp3-192': 192,
      'mp3-128': 128,
    };
    const kbps = bitrateMap[optionId] || 192;
    if (duration) {
      const estimatedBytes = Math.round(((kbps * 1000) / 8) * duration);
      return `~${formatBytes(estimatedBytes)}`;
    }
    if (bestAudioBytes > 0) {
      return `~${formatBytes(bestAudioBytes)}`;
    }
    return undefined;
  }

  // Jika tipe VIDEO (MP4)
  const targetHeights: Record<string, number | null> = {
    best: null,
    '1080p': 1080,
    '720p': 720,
    '480p': 480,
  };
  const targetH = targetHeights[optionId];

  let candidateVideo: any = null;
  const videoStreams = formats.filter((f) => f.vcodec && f.vcodec !== 'none');

  if (targetH === null) {
    if (videoStreams.length > 0) {
      candidateVideo = videoStreams.reduce((prev, curr) =>
        (curr.height || 0) > (prev.height || 0) ? curr : prev
      );
    }
  } else {
    const matchingStreams = videoStreams.filter((f) => (f.height || 0) <= targetH);
    if (matchingStreams.length > 0) {
      candidateVideo = matchingStreams.reduce((prev, curr) =>
        (curr.height || 0) > (prev.height || 0) ? curr : prev
      );
    } else if (videoStreams.length > 0) {
      candidateVideo = videoStreams.reduce((prev, curr) =>
        (curr.height || 0) < (prev.height || 0) ? curr : prev
      );
    }
  }

  if (candidateVideo) {
    let videoBytes = candidateVideo.filesize || candidateVideo.filesize_approx;
    if (!videoBytes && (candidateVideo.vbr || candidateVideo.tbr) && duration) {
      const br = candidateVideo.vbr || candidateVideo.tbr;
      videoBytes = Math.round(((br * 1000) / 8) * duration);
    }

    if (videoBytes && videoBytes > 0) {
      const hasAudio = candidateVideo.acodec && candidateVideo.acodec !== 'none';
      const totalEstimated = hasAudio
        ? videoBytes
        : videoBytes + (bestAudioBytes || (duration ? Math.round(((128 * 1000) / 8) * duration) : 0));
      return `~${formatBytes(totalEstimated)}`;
    }
  }

  // Fallback jika file tunggal direct
  const singleFileSize = info?.filesize || info?.filesize_approx;
  if (typeof singleFileSize === 'number' && singleFileSize > 0) {
    if (optionId === 'best' || optionId === '1080p') {
      return formatBytes(singleFileSize);
    }
    // P3: HAPUS pengali mentah 0,65x (720p) dan 0,35x (480p) dari sebelumnya.
    // Angka itu tebakan yang disajikan seolah hasil ukur. Untuk 720p/480p
    // pada file tunggal, biarkan jatuh ke estimasi berbasis durasi di
    // bawah (tetap diberi tanda ~), bukan pengali file asli.
  }

  // Estimasi durasi standar jika bitrate stream spesifik tidak ada
  if (duration) {
    const defaultBitrateMap: Record<string, number> = {
      best: 4500,
      '1080p': 3800,
      '720p': 2000,
      '480p': 850,
    };
    const kbps = defaultBitrateMap[optionId] || 2500;
    const est = Math.round((((kbps + 128) * 1000) / 8) * duration);
    return `~${formatBytes(est)}`;
  }

  return undefined;
}

// Ekstraksi metadata media tanpa mengunduh file
export async function inspectMedia(rawUrl: string): Promise<MediaPreview> {
  return inspectMediaAttempt(rawUrl, false);
}

// Apakah info yt-dlp punya format media yang bisa diunduh (bukan hanya
// storyboard)? Client web yang kena bot-check mengembalikan JSON tanpa
// format media sama sekali, atau gagal dengan 'Requested format is not
// available' — keduanya harus memicu fallback Android, bukan sukses palsu.
function hasMediaFormat(info: any): boolean {
  const formats: any[] = Array.isArray(info?.formats) ? info.formats : [];
  return formats.some((f) =>
    f &&
    typeof f.url === 'string' &&
    f.url.startsWith('http') &&
    ((f.vcodec && f.vcodec !== 'none') || (f.acodec && f.acodec !== 'none')) &&
    !String(f.format_id || '').startsWith('sb')
  );
}

function isYoutubeBotError(stderrData: string): boolean {
  const lower = (stderrData || '').toLowerCase();
  return lower.includes('sign in to confirm') ||
    lower.includes('login required') ||
    lower.includes('requested format is not available') ||
    lower.includes('this video is unavailable') ||
    lower.includes('does not look like a netscape') ||
    lower.includes('cookies');
}

async function inspectMediaAttempt(rawUrl: string, useAndroid: boolean): Promise<MediaPreview> {
  const config = getConfig();

  // Validasi keamanan URL
  const valResult = validateAndSanitizeUrl(rawUrl);
  if (!valResult.valid || !valResult.url) {
    throw new Error(valResult.error || 'URL tidak valid.');
  }

  const safeUrl = valResult.url;
  const platformInfo = detectPlatform(safeUrl);

  // P2: cek resolusi DNS sebelum yt-dlp dipanggil (SSRF via DNS).
  const dnsCheck = await checkHostResolvesPublic(new URL(safeUrl).hostname);
  if (!dnsCheck.ok) {
    throw new Error(dnsCheck.error || 'Domain ditolak demi keamanan.');
  }

  return new Promise((resolve, reject) => {
    const args = [
      '-J',
      '--no-warnings',
      '--no-playlist',
      '--skip-download',
      '--socket-timeout', '20',
    ];

    // YouTube fallback (2026-11-02): client web dari IP VM ini kena
    // bot-check YouTube — player API web mengembalikan tanpa format media
    // sama sekali. Client Android masih mengembalikan format 18 (360p),
    // jadi itu satu-satunya jalur tanpa login/cookies saat ini. Hanya
    // dipakai sebagai percobaan kedua untuk YouTube, bukan untuk platform
    // lain dan bukan sebagai client utama (supaya video yang masih bisa
    // HD lewat web tidak ikut terkap ke 360p).
    if (useAndroid) {
      args.push('--extractor-args', 'youtube:player_client=android');
    }
    // Cookie YouTube (2026-11-02): kalau pengguna sudah mengupload
    // cookie akunnya sendiri, client web dicoba dengan cookie itu dulu
    // — dengan cookie, web biasanya lolos bot-check dan memberi HD,
    // sehingga fallback Android tidak terpicu. Hanya untuk YouTube, dan
    // hanya untuk percobaan web: Android adalah jalur tanpa login, jadi
    // percobaan Android sengaja TANPA cookie supaya cookie yang rusak
    // atau kedaluwarsa tidak ikut merusak fallback 360p.
    if (platformInfo.platform === 'youtube' && !useAndroid) {
      args.push(...getYoutubeCookiesArgs());
      // PO token: hanya bersama cookie, hanya untuk web. Tanpa cookie,
      // getPotArgs() kosong; tanpa server/plugin, juga kosong.
      args.push(...getPotArgs());
    }
    args.push(safeUrl);

    // Hanya bila YTDLP_NO_CHECK_CERTIFICATES=true (lihat config.ts):
    // lingkungan dengan egress proxy MITM yang CA-nya tidak dipercaya
    // bundle sertifikat bawaan yt-dlp, yang kalau tidak diaktifkan bisa
    // gagal CERTIFICATE_VERIFY_FAILED dan berujung timeout di UI.
    if (config.ytdlpNoCheckCertificates) {
      args.push('--no-check-certificates');
    }

    const child = spawn(config.ytdlpPath, args, {
      shell: false,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let stdoutData = '';
    let stderrData = '';

    child.stdout.on('data', (chunk) => {
      stdoutData += chunk.toString();
    });

    child.stderr.on('data', (chunk) => {
      stderrData += chunk.toString();
    });

    const timeout = setTimeout(() => {
      try {
        child.kill('SIGKILL');
      } catch {
        // Abaikan
      }
      reject(new Error('Waktu inspeksi metadata habis (timeout). Platform sumber mungkin lambat merespons.'));
    }, 45000);

    child.on('close', (code) => {
      clearTimeout(timeout);

      if (code !== 0 || !stdoutData.trim()) {
        // Percobaan kedua lewat Android, hanya untuk YouTube dan hanya
        // untuk error bot/format. Kalau Android juga gagal, kembalikan
        // error ASLI dari web (pesan login) — bukan error Android yang
        // lebih membingungkan ('format not available').
        if (!useAndroid && platformInfo.platform === 'youtube' && isYoutubeBotError(stderrData)) {
          inspectMediaAttempt(rawUrl, true).then(resolve).catch(() => {
            const errorMsg = translateErrorMessage(stderrData || 'Gagal mengambil metadata media.');
            reject(new Error(errorMsg));
          });
          return;
        }
        const errorMsg = translateErrorMessage(stderrData || 'Gagal mengambil metadata media.');
        return reject(new Error(errorMsg));
      }

      try {
        const info = JSON.parse(stdoutData);

        // Web sukses JSON tapi tanpa format media = bot-check terselubung.
        if (!useAndroid && platformInfo.platform === 'youtube' && !hasMediaFormat(info)) {
          inspectMediaAttempt(rawUrl, true).then(resolve).catch(() => {
            reject(new Error('Konten memerlukan login atau verifikasi usia dari platform sumber.'));
          });
          return;
        }

        const duration = typeof info.duration === 'number' ? info.duration : undefined;

        // Cek batas durasi jika dikonfigurasi
        if (config.maxDurationMinutes > 0 && duration && duration > config.maxDurationMinutes * 60) {
          return reject(
            new Error(
              `Durasi media (${Math.round(duration / 60)} menit) melampaui batas maksimal konfigurasi (${config.maxDurationMinutes} menit).`
            )
          );
        }

        // Tentukan kualitas video yang didukung
        const videoQualities: QualityOption[] = [
          {
            id: 'best',
            label: 'Kualitas Terbaik (Otomatis)',
            format: 'mp4',
            type: 'video',
            description: 'Menggabungkan resolusi video tertinggi dan audio terbaik yang tersedia.',
            sizeFormatted: estimateOptionSize('best', 'video', info),
          },
          {
            id: '1080p',
            label: '1080p Full HD',
            resolution: '1920x1080',
            format: 'mp4',
            type: 'video',
            description: 'Kualitas Full HD sangat jernih dan tajam.',
            sizeFormatted: estimateOptionSize('1080p', 'video', info),
          },
          {
            id: '720p',
            label: '720p HD',
            resolution: '1280x720',
            format: 'mp4',
            type: 'video',
            description: 'Ukuran berkas seimbang dengan kualitas HD jernih.',
            sizeFormatted: estimateOptionSize('720p', 'video', info),
          },
          {
            id: '480p',
            label: '480p SD',
            resolution: '854x480',
            format: 'mp4',
            type: 'video',
            description: 'Ukuran paling ringkas dan hemat kuota.',
            sizeFormatted: estimateOptionSize('480p', 'video', info),
          },
        ];

        // Opsi audio MP3
        const audioQualities: QualityOption[] = [
          {
            id: 'mp3-best',
            label: 'MP3 Terbaik (~320 kbps)',
            format: 'mp3',
            type: 'audio',
            description: 'Kualitas suara paling jernih dan detail.',
            sizeFormatted: estimateOptionSize('mp3-best', 'audio', info),
          },
          {
            id: 'mp3-256',
            label: 'MP3 256 kbps',
            format: 'mp3',
            type: 'audio',
            description: 'Kualitas audio sangat jernih standar studio.',
            sizeFormatted: estimateOptionSize('mp3-256', 'audio', info),
          },
          {
            id: 'mp3-192',
            label: 'MP3 192 kbps',
            format: 'mp3',
            type: 'audio',
            description: 'Kualitas audio seimbang dan cepat disimpan.',
            sizeFormatted: estimateOptionSize('mp3-192', 'audio', info),
          },
          {
            id: 'mp3-128',
            label: 'MP3 128 kbps',
            format: 'mp3',
            type: 'audio',
            description: 'Ukuran paling ringan dan hemat ruang.',
            sizeFormatted: estimateOptionSize('mp3-128', 'audio', info),
          },
        ];

        // Cari thumbnail terbaik
        let thumbnail = info.thumbnail;
        if (!thumbnail && Array.isArray(info.thumbnails) && info.thumbnails.length > 0) {
          thumbnail = info.thumbnails[info.thumbnails.length - 1].url;
        }

        // Ekstrak opsi subtitle yang tersedia
        const subtitles: { code: string; name: string }[] = [];
        if (info.subtitles && typeof info.subtitles === 'object') {
          for (const [code, val] of Object.entries(info.subtitles)) {
            const arr = val as any[];
            const name = arr?.[0]?.name || code;
            subtitles.push({ code, name: `${name}` });
          }
        }
        if (info.automatic_captions && typeof info.automatic_captions === 'object') {
          for (const [code, val] of Object.entries(info.automatic_captions)) {
            if (!subtitles.some((s) => s.code === code)) {
              const arr = val as any[];
              const name = arr?.[0]?.name || code;
              subtitles.push({ code, name: `${name} (Otomatis)` });
            }
          }
        }
        subtitles.sort((a, b) => {
          if (a.code.startsWith('id')) return -1;
          if (b.code.startsWith('id')) return 1;
          if (a.code.startsWith('en')) return -1;
          if (b.code.startsWith('en')) return 1;
          return a.name.localeCompare(b.name);
        });

        let directStreamUrl: string | undefined =
          typeof info.url === 'string' && info.url.startsWith('http') ? info.url : undefined;
        if (!directStreamUrl && Array.isArray(info.formats)) {
          const progressive = info.formats
            .filter(
              (f: any) =>
                typeof f.url === 'string' &&
                f.url.startsWith('http') &&
                f.vcodec !== 'none' &&
                f.acodec !== 'none'
            )
            .pop();
          if (progressive) {
            directStreamUrl = progressive.url;
          }
        }
        if (!directStreamUrl && /\.(mp4|webm|mkv|mov)(\?.*)?$/i.test(safeUrl)) {
          directStreamUrl = safeUrl;
        }

        // Kalau fallback Android, jangan tawarkan 1080p/720p/480p yang
        // sebenarnya tidak ada — Android hanya memberi format 18 (360p),
        // dan pilihan lain akan diam-diam jatuh ke 360p juga. Satu opsi
        // 360p saja. Labelnya sengaja netral (2026-11-02, permintaan
        // pemilik: situs publik "tinggal pakai", tanpa penjelasan soal
        // IP/bot-check/login di UI).
        const effectiveVideoQualities = useAndroid
          ? [{
              id: 'best',
              label: '360p',
              resolution: '640x360',
              format: 'mp4' as const,
              type: 'video' as const,
              description: 'Kualitas standar, ukuran ringkas.',
              sizeFormatted: estimateOptionSize('best', 'video', info),
            }]
          : videoQualities;

        const preview: MediaPreview = {
          id: info.id || `media-${Date.now()}`,
          url: safeUrl,
          directStreamUrl,
          title: info.title || 'Media Tanpa Judul',
          platform: platformInfo.platform,
          platformName: platformInfo.platformName,
          uploader: info.uploader || info.channel || info.creator,
          duration,
          durationFormatted: formatDuration(duration),
          thumbnail,
          description: info.description ? info.description.slice(0, 200) : undefined,
          videoQualities: effectiveVideoQualities,
          audioQualities,
          subtitles: subtitles.slice(0, 20),
          youtubeFallback: useAndroid || undefined,
        };

        resolve(preview);
      } catch (err: unknown) {
        const error = err as Error;
        reject(new Error(`Gagal memproses data metadata JSON: ${error.message}`));
      }
    });

    child.on('error', (err) => {
      clearTimeout(timeout);
      reject(new Error(`Gagal menjalankan executable yt-dlp: ${err.message}`));
    });
  });
}
