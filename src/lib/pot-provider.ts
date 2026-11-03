// PO token provider untuk YouTube (2026-11-02, atas pilihan pengguna).
//
// Fakta yang sudah dibuktikan lewat tes langsung di VM:
// - Cookie saja TIDAK cukup: client web + cookie tetap hanya mengembalikan
//   storyboard, tanpa format media.
// - PO token saja (tanpa cookie) JUGA tidak cukup: tetap bot-check.
// - Cookie + PO token dari server BGUtil lokal BERHASIL: client web
//   mengembalikan format sampai 1080p (video user) dan 2160p (Shorts),
//   dan unduhan Best benar-benar 1920x1080.
// Jadi argumen PO token hanya dipakai bersama cookie, dan hanya untuk
// percobaan web. Percobaan Android sengaja tanpa PO token dan tanpa
// cookie, supaya tetap jadi fallback 360p kalau server token mati atau
// token ditolak.
//
// Server BGUtil (Node, upstream Brainicism/bgutil-ytdlp-pot-provider
// v1.2.2) dan plugin yt-dlp-nya adalah komponen VM-only, seperti bin/:
//   ~/workspace/bgutil-server/  (node build/main.js --port 4416)
//   ~/workspace/bgutil-plugins/ (yt_dlp_plugins/extractor/getpot_*.py)
// Mereka TIDAK masuk git/patch repo Drovio; start-all.sh yang
// menyalakannya kalau ada. Kalau folder plugin tidak ada atau server
// mati, fungsi ini mengembalikan [] dan Drovio jatuh ke jalur lama
// (web tanpa token -> gagal bot-check -> Android 360p), bukan error.
//
// Token PO berumur pendek (server meng-cache ~6 jam secara default)
// dan dibuat per video, jadi tidak ada token yang disimpan di file
// atau di database Drovio — yt-dlp memintanya ke server lokal setiap
// kali dibutuhkan, lewat plugin.
import fs from 'fs';
import { getConfig } from './config';
import { hasValidYoutubeCookies } from './youtube-cookies';

export function getPotArgs(): string[] {
  // Tanpa cookie yang valid, PO token terbukti tidak membantu (tes
  // 2026-11-02: web + PO tanpa cookie tetap bot-check), jadi jangan
  // buang waktu meminta token.
  if (!hasValidYoutubeCookies()) return [];
  const config = getConfig();
  if (!fs.existsSync(config.potPluginDir)) return [];
  // Plugin harus berisi paket yt_dlp_plugins; kalau strukturnya tidak
  // lengkap, yt-dlp akan mengabaikan --plugin-dirs dengan warning, tapi
  // lebih baik tidak mengirim argumennya sama sekali.
  if (!fs.existsSync(`${config.potPluginDir}/yt_dlp_plugins`)) return [];
  return [
    '--plugin-dirs', config.potPluginDir,
    '--extractor-args', `youtubepot-bgutilhttp:base_url=${config.potBaseUrl}`,
  ];
}
