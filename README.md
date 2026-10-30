# Drovio : All-in-One Media Downloader, File Converter & Compressor

Drovio adalah aplikasi web serbaguna untuk kebutuhan pengunduhan media dari berbagai platform publik, pemotongan durasi video secara visual interaktif, konversi antar format media dan dokumen, serta kompresi berbagai jenis berkas secara mandiri pada lingkungan lokal komputer Windows 11.

---

## 1. Ikhtisar Fitur

### A. Pengunduh Media (Media Downloader)
- **Universal URL Input:** Mendukung tautan publik dari YouTube, TikTok, Instagram, X (Twitter), Facebook, Reddit, Pinterest, SoundCloud, serta tautan berkas media langsung.
- **Mode Satu Tautan & Banyak Tautan (Batch):** 
  - Mode Satu Tautan: Analisis metadata lengkap, estimasi ukuran berkas, pemilihan resolusi, serta pengaturan pemotong durasi dan subtitle.
  - Mode Banyak Tautan (Batch): Memeriksa beberapa tautan sekaligus, menyediakan kontrol global untuk menyamakan resolusi seluruh berkas dalam satu klik, atau mengatur format dan kualitas tiap media secara independen sebelum antrean dimulai.
- **Pilihan Kualitas Video (MP4):** Kualitas Terbaik, 1080p Full HD, 720p HD, 480p SD dilengkapi perkiraan ukuran berkas.
- **Ekstraksi Audio (MP3):** Kualitas Terbaik (~320 kbps), 256 kbps, 192 kbps, 128 kbps melalui FFmpeg.
- **Sematkan Subtitle (Subtitle Embedding):** Opsi deteksi dan penyematan trek subtitle resmi atau otomatis ke dalam wadah video MP4.
- **Pelacakan Kemajuan Real-time:** Menampilkan persentase akurat, ukuran terunduh, kecepatan transfer, dan perkiraan waktu sisa (ETA).

### B. Pemotong Video Visual Interaktif (Interactive Video Trimmer)
- **Pemutar Video Aktual:** Memutar aliran video asli secara langsung di peramban, lengkap dengan kendali putar/jeda, bisukan audio, dan mode pengulangan (*looping*).
- **Pembatasan Rentang Otomatis:** Pemutaran video dibatasi secara ketat di dalam rentang potongan yang dipilih. Video otomatis berhenti atau mengulang saat mencapai batas akhir tanpa bocor ke adegan di luar seleksi.
- **Timeline Filmstrip Presisi:** Dilengkapi jejeran frame video asli, penanda rentang berwarna cyan, handle geser ganda dengan grip 3 titik, penunjuk playhead, serta balon tooltip penunjuk waktu hingga desimal detik (`mm:ss.s`).
- **Sinkronisasi Audio-Video Sempurna:** Menggunakan `--force-keyframes-at-cuts` dan normalisasi timestamp PTS/DTS sekunder pasca-unduh (`resyncAudioVideoIfNecessary`) untuk mencegah pergeseran suara (*audio desync*) dari gambar.
- **Pembersihan Otomatis Berkas Preview:** Berkas aliran pratinjau sementara otomatis dihapus seketika saat pengguna mengklik tombol unduh untuk menghemat ruang disk.

### C. Konverter Format Berkas (File Converter)
- **Konversi Video:** Mengubah format berkas menjadi MP4, WebM, MKV, GIF Animasi, atau mengekstrak audionya menjadi MP3.
- **Konversi Audio:** Konversi antar format MP3, WAV (lossless kualitas CD), M4A (standar Apple), OGG, dan FLAC (lossless studio).
- **Konversi Gambar:** Konversi cepat gambar ke format PNG, JPG, WebP, dan AVIF melalui engine Sharp.
- **Gambar ke Dokumen PDF:** Menggabungkan dan mengonversi berkas gambar langsung menjadi dokumen PDF standar melalui PDF-Lib.

### D. Kompresor Berkas (File Compressor)
- **Kompresi Gambar:** Mengoptimalkan ukuran berkas JPEG, PNG, WebP, AVIF, dan TIFF dengan pengaturan level kompresi serta opsi resolusi maksimal.
- **Kompresi Dokumen PDF:** Pemadatan tabel objek (Object Streams FlateDecode), pembersihan metadata, dan re-kompresi gambar tertanam.
- **Kompresi Media:** Transcoding video adaptif CRF H.264 dan audio MP3 via FFmpeg.
- **Kompresi Berkas Generik:** Pengemasan berkas ke dalam arsip GZIP (.gz).

### E. Mesin Pembersihan Otomatis (Auto-Cleanup Engine)
- **Pekerja Latar Belakang Berkala:** Memindai direktori `downloads/`, `downloads/compressed/`, `downloads/converted/`, dan `downloads/previews/` secara berkala.
- **Pilihan Retensi Fleksibel:** Pengaturan batas usia simpan berkas dapat diubah langsung dari antarmuka (15 Menit, 30 Menit, 1 Jam [Bawaan], 3 Jam, 6 Jam, 24 Jam, atau Simpan Selamanya).
- **Pembersihan Manual Instan:** Tombol *Bersihkan Sekarang* untuk membebaskan ruang disk seketika.
- **Proteksi Berkas Aktif:** Berkas yang sedang dalam proses pengunduhan (`.part`, `.ytdl`) dilindungi dari penghapusan.

### F. Antarmuka Pengguna & Kemudahan Berbagi
- **Tema Gelap & Terang:** Tersedia tombol pengganti tema dengan palet Obsidian yang nyaman di mata, tersimpan di penyimpanan lokal tanpa efek kedip (*anti-flicker*).
- **Bilah Navigasi Cepat Mobile:** Tata letak khusus layar HP dengan 4 tab cepat: `[Unduh]`, `[Kompres]`, `[Konversi]`, dan `[Riwayat]`.
- **Dukungan Web Share API:** Tombol bagikan langsung memicu menu share bawaan ponsel pintar (WhatsApp, Telegram, dsb.) atau menyalin tautan unduhan ke papan klip di desktop.

---

## 2. Prasyarat Sistem

1. **Node.js** (v18.17.0 ke atas) & **npm**
2. **yt-dlp** (Mesin ekstraksi media)
3. **FFmpeg & FFprobe** (Mesin pemrosesan stream dan transcoding)

### Pemasangan Dependensi di Windows 11

Buka **PowerShell** atau **Windows Terminal**, lalu pasang dependensi sistem melalui WinGet:

```powershell
# Pasang yt-dlp
winget install yt-dlp

# Pasang FFmpeg
winget install Gyan.FFmpeg
```

Drovio memiliki pemindai otomatis bawaan yang mendeteksi biner WinGet di `%LOCALAPPDATA%\Microsoft\WinGet\Packages` tanpa perlu mengatur ulang variabel `PATH` Windows secara manual.

---

## 3. Instalasi & Menjalankan Aplikasi

1. Pasang dependensi proyek:
   ```bash
   npm install
   ```

2. Bangun aplikasi untuk produksi:
   ```bash
   npm run build
   ```

3. Jalankan server aplikasi:
   - **Melalui Terminal:**
     ```bash
     npm run start
     ```
   - **Melalui Skrip Windows 1-Klik:**
     Jalankan berkas `start-drovio.bat` untuk memulai server dan membuka peramban secara otomatis pada alamat `http://127.0.0.1:48888`.
     Untuk menghentikan server, jalankan `stop-drovio.bat`.

---

## 4. Konfigurasi Lingkungan (`.env.local`)

Salin berkas `.env.example` menjadi `.env.local` dan sesuaikan parameter berikut jika diperlukan:

```env
# Direktori penyimpanan berkas hasil unduhan
DOWNLOAD_DIR=./downloads

# Batas maksimal unduhan aktif bersamaan (default: 1)
MAX_CONCURRENT_DOWNLOADS=1

# Batas durasi maksimal media dalam menit (0 = tanpa batas)
MAX_DURATION_MINUTES=180

# Retensi pembersihan otomatis dalam menit (default: 60)
AUTO_CLEANUP_MINUTES=60

# Port dan Host Server
PORT=48888
HOST=0.0.0.0

# Path kustom biner eksekusi (opsional jika tidak di direktori standar)
# YTDLP_PATH=C:\path\ke\yt-dlp.exe
# FFMPEG_PATH=C:\path\ke\ffmpeg.exe
```

---

## 5. Keamanan & Privasi

- **Proteksi Anti-SSRF:** Memvalidasi seluruh URL masukan dan secara tegas menolak alamat loopback (`127.0.0.1`, `localhost`), alamat jaringan privat (RFC 1918: `10.x.x.x`, `172.16-31.x.x`, `192.168.x.x`), alamat tautan lokal, dan skema protokol di luar HTTP/HTTPS.
- **Sanitasi Nama Berkas Windows:** Membersihkan karakter terlarang (`\ / : * ? " < > |`) serta nama perangkat yang dilindungi sistem Windows (`CON, PRN, AUX, NUL, COM1-9, LPT1-9`).
- **Pencegahan Directory Traversal:** Setiap akses berkas diverifikasi secara ketat agar tidak keluar dari direktori penyimpanan yang diizinkan.
- **Eksekusi Aman Child Process:** Menggunakan `spawn` dengan parameter array eksplisit dan `shell: false` untuk mencegah injeksi perintah shell.
- **Tanpa Penyimpanan Kredensial:** Aplikasi tidak meminta, memproses, atau menyimpan kata sandi akun sosial, token otentikasi, maupun kuki peramban pengguna.

---

## 6. Pengujian Otomatis

Jalankan seluruh rangkaian pengujian terintegrasi untuk memverifikasi fungsionalitas dan keamanan:

```bash
# Menjalankan rangkaian unit test
npm test

# Memeriksa integritas tipe TypeScript
npx tsc -b
```

---

## 7. Struktur Direktori Proyek

```text
├── downloads/              # Direktori penyimpanan lokal berkas unduhan
│   ├── compressed/         # Berkas hasil kompresi
│   ├── converted/          # Berkas hasil konversi
│   └── previews/           # Berkas cache pemutar video pratinjau (auto-cleanup)
├── src/
│   ├── app/
│   │   ├── api/            # Route handler API Next.js (jobs, compress, convert, stream)
│   │   ├── globals.css     # Styling global & token warna tema
│   │   ├── layout.tsx      # Root layout & script tema anti-flicker
│   │   └── page.tsx        # Halaman utama aplikasi terpadu
│   ├── components/         # Komponen antarmuka pengguna React
│   │   ├── ActiveJobCard.tsx
│   │   ├── BatchActiveJobsCard.tsx
│   │   ├── FileCompressorSection.tsx
│   │   ├── FileConverterSection.tsx
│   │   ├── InteractiveVideoTrimmer.tsx
│   │   ├── MediaPreviewCard.tsx
│   │   ├── Navbar.tsx
│   │   ├── RecentDownloadsList.tsx
│   │   └── UrlInputSection.tsx
│   └── lib/                # Layanan logika bisnis inti
│       ├── cleanup-service.ts
│       ├── config.ts
│       ├── job-queue.ts
│       ├── media-service.ts
│       ├── preview-service.ts
│       ├── security.ts
│       ├── types.ts
│       ├── compressor/     # Layanan kompresi (gambar, pdf, media, generik)
│       └── converter/      # Layanan konversi format berkas
├── tests/                  # Rangkaian pengujian otomatis
├── start-drovio.bat        # Skrip peluncuran Windows 1-klik
├── stop-drovio.bat         # Skrip penghentian server Windows
└── package.json
```

---

## 8. Lisensi & Catatan Penggunaan

Aplikasi ini ditujukan untuk penggunaan utilitas personal pada perangkat pribadi. Hormati hak cipta dan ketentuan layanan dari masing-masing platform sumber saat mengunduh konten media publik.
