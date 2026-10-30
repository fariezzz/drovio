import path from 'path';
import fs from 'fs';
import { execSync } from 'child_process';

export interface AppConfig {
  ytdlpPath: string;
  // Opsional, default false: hanya aktifkan di lingkungan yang akses
  // internetnya lewat proxy MITM dengan CA yang tidak dipercaya bundle
  // sertifikat bawaan yt-dlp (mis. VM ini). Di PC/lokal biasa biarkan
  // false agar verifikasi sertifikat TLS yt-dlp tetap aktif.
  ytdlpNoCheckCertificates: boolean;
  ffmpegPath: string;
  downloadDir: string;
  maxConcurrentDownloads: number;
  maxDurationMinutes: number;
  autoCleanupMinutes: number;
  port: number;
  host: string;
}

// Cache hasil pencarian binary agar tidak berulang kali memindai disk
const binaryPathCache = new Map<string, string>();
let cachedConfigInstance: AppConfig | null = null;

// Cari executable di sistem secara fleksibel (Windows & Linux/WSL)
export function findExecutable(binaryName: string, envPath?: string): string {
  // Cek cache in-memory terlebih dahulu
  const cacheKey = `${binaryName}_${envPath || ''}`;
  if (binaryPathCache.has(cacheKey)) {
    return binaryPathCache.get(cacheKey)!;
  }

  // 1. Jika pengguna menentukan via env variable, utamakan itu
  if (envPath && envPath.trim() !== '') {
    const resolved = path.resolve(envPath.trim());
    if (fs.existsSync(resolved)) {
      binaryPathCache.set(cacheKey, resolved);
      return resolved;
    }
  }

  const isWindows = process.platform === 'win32';
  const execNames = isWindows
    ? [`${binaryName}.exe`, binaryName]
    : [binaryName, `${binaryName}.exe`];

  // 2. Cek apakah ada di direktori eksekusi lokal atau proyek
  const localDirs = [
    path.join(process.cwd(), 'bin'),
    path.join(process.cwd(), 'node_modules', '.bin'),
  ];

  if (isWindows) {
    const localAppData = process.env.LOCALAPPDATA || path.join(process.env.USERPROFILE || 'C:\\Users\\ASUS', 'AppData', 'Local');
    const wingetPackages = path.join(localAppData, 'Microsoft', 'WinGet', 'Packages');
    const wingetLinks = path.join(localAppData, 'Microsoft', 'WinGet', 'Links');
    localDirs.push(wingetLinks);

    // Cari di dalam folder paket WinGet
    if (fs.existsSync(wingetPackages)) {
      try {
        const pkgDirs = fs.readdirSync(wingetPackages);
        for (const pkg of pkgDirs) {
          const pkgPath = path.join(wingetPackages, pkg);
          localDirs.push(pkgPath);
          localDirs.push(path.join(pkgPath, 'bin'));

          // Cari 1 tingkat subdirektori (misal ffmpeg-x.x-full_build/bin)
          try {
            const subEntries = fs.readdirSync(pkgPath, { withFileTypes: true });
            for (const sub of subEntries) {
              if (sub.isDirectory()) {
                localDirs.push(path.join(pkgPath, sub.name));
                localDirs.push(path.join(pkgPath, sub.name, 'bin'));
              }
            }
          } catch {
            // Abaikan
          }
        }
      } catch {
        // Abaikan
      }
    }
  } else {
    const homeDir = process.env.HOME || '/home/kiraya';
    localDirs.push(path.join(homeDir, '.local', 'bin'));
    localDirs.push('/usr/local/bin');
    localDirs.push('/usr/bin');
  }

  for (const dir of localDirs) {
    for (const name of execNames) {
      const full = path.join(dir, name);
      if (fs.existsSync(full)) {
        binaryPathCache.set(cacheKey, full);
        return full;
      }
    }
  }

  // 3. Cek via `where` di Windows atau `which` di Unix
  try {
    const checkCmd = isWindows ? `where ${binaryName}` : `which ${binaryName}`;
    const result = execSync(checkCmd, { stdio: ['pipe', 'pipe', 'ignore'], encoding: 'utf-8' });
    const firstLine = result.split(/\r?\n/)[0]?.trim();
    if (firstLine && fs.existsSync(firstLine)) {
      binaryPathCache.set(cacheKey, firstLine);
      return firstLine;
    }
  } catch {
    // Abaikan jika tidak ditemukan via CLI
  }

  // Fallback ke nama biner bawaan
  const fallback = isWindows ? `${binaryName}.exe` : binaryName;
  binaryPathCache.set(cacheKey, fallback);
  return fallback;
}

export function getConfig(): AppConfig {
  if (cachedConfigInstance) {
    return cachedConfigInstance;
  }

  const downloadDirEnv = process.env.DOWNLOAD_DIR || './downloads';
  const resolvedDownloadDir = path.isAbsolute(downloadDirEnv)
    ? downloadDirEnv
    : path.join(process.cwd(), downloadDirEnv);

  // Pastikan folder unduhan ada
  if (!fs.existsSync(resolvedDownloadDir)) {
    try {
      fs.mkdirSync(resolvedDownloadDir, { recursive: true });
    } catch {
      // Abaikan jika gagal membuat saat inisialisasi
    }
  }

  const ytdlp = findExecutable('yt-dlp', process.env.YTDLP_PATH);
  const ffmpeg = findExecutable('ffmpeg', process.env.FFMPEG_PATH);

  cachedConfigInstance = {
    ytdlpPath: ytdlp,
    ytdlpNoCheckCertificates:
      process.env.YTDLP_NO_CHECK_CERTIFICATES === 'true' ||
      process.env.YTDLP_NO_CHECK_CERTIFICATES === '1',
    ffmpegPath: ffmpeg,
    downloadDir: resolvedDownloadDir,
    maxConcurrentDownloads: Math.max(1, parseInt(process.env.MAX_CONCURRENT_DOWNLOADS || '1', 10) || 1),
    maxDurationMinutes: Math.max(0, parseInt(process.env.MAX_DURATION_MINUTES || '180', 10) || 180),
    autoCleanupMinutes: Math.max(0, parseInt(process.env.AUTO_CLEANUP_MINUTES || '60', 10) || 60),
    port: parseInt(process.env.PORT || '48888', 10) || 48888,
    host: process.env.HOST || '0.0.0.0',
  };

  return cachedConfigInstance;
}
