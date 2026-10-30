import test from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import { PDFDocument } from 'pdf-lib';
import zlib from 'zlib';

// Helper deteksi kategori
function detectFileCategory(filename) {
  const ext = filename.toLowerCase().split('.').pop() || '';
  if (['jpg', 'jpeg', 'png', 'webp', 'avif', 'gif', 'tiff', 'bmp'].includes(ext)) return 'image';
  if (ext === 'pdf') return 'pdf';
  if (['mp4', 'mkv', 'mov', 'avi', 'webm', 'flv', 'wmv'].includes(ext)) return 'video';
  if (['mp3', 'wav', 'flac', 'm4a', 'ogg', 'aac'].includes(ext)) return 'audio';
  return 'generic';
}

test('Deteksi Kategori File', () => {
  assert.equal(detectFileCategory('foto-liburan.jpg'), 'image');
  assert.equal(detectFileCategory('screenshot.png'), 'image');
  assert.equal(detectFileCategory('banner.webp'), 'image');
  assert.equal(detectFileCategory('laporan-tugas.pdf'), 'pdf');
  assert.equal(detectFileCategory('video_belajar.mp4'), 'video');
  assert.equal(detectFileCategory('rekaman_suara.mp3'), 'audio');
  assert.equal(detectFileCategory('data_keuangan.csv'), 'generic');
  assert.equal(detectFileCategory('dokumen.txt'), 'generic');
});

test('Kompresi Gambar (Sharp MozJPEG & WebP)', async () => {
  // Buat sample buffer gambar PNG 800x600
  const samplePng = await sharp({
    create: {
      width: 800,
      height: 600,
      channels: 4,
      background: { r: 50, g: 120, b: 220, alpha: 1 },
    },
  }).png().toBuffer();

  assert.ok(samplePng.length > 0, 'Buffer PNG asli berhasil dibuat');

  // Kompresi ke WebP
  const compressedWebp = await sharp(samplePng)
    .webp({ quality: 60 })
    .toBuffer();

  assert.ok(compressedWebp.length < samplePng.length, 'Ukuran WebP harus lebih kecil dari PNG mentah');
  assert.ok(compressedWebp.length > 0, 'Buffer WebP valid');

  // Kompresi ke JPEG
  const compressedJpeg = await sharp(samplePng)
    .jpeg({ quality: 65, mozjpeg: true })
    .toBuffer();

  assert.ok(compressedJpeg.length < samplePng.length, 'Ukuran JPEG harus lebih kecil dari PNG mentah');
  assert.equal(compressedJpeg[0], 0xff, 'Header JPEG valid byte 1');
  assert.equal(compressedJpeg[1], 0xd8, 'Header JPEG valid byte 2');
});

test('Kompresi & Optimasi Dokumen PDF (PDF-Lib)', async () => {
  // Buat sample PDF dengan teks dan halaman
  const doc = await PDFDocument.create();
  doc.setTitle('Dokumen Uji Kompresi');
  doc.setAuthor('Penguji Sistem');

  for (let i = 0; i < 3; i++) {
    const page = doc.addPage([600, 800]);
    page.drawText(`Halaman Uji Nomor ${i + 1}`, { x: 50, y: 700 });
  }

  const unoptimizedBytes = await doc.save();
  assert.ok(unoptimizedBytes.length > 0, 'PDF asli berhasil dibuat');

  // Muat dan optimasi
  const loaded = await PDFDocument.load(unoptimizedBytes);
  loaded.setTitle('');
  loaded.setAuthor('');

  const optimizedBytes = await loaded.save({ useObjectStreams: true });

  assert.ok(optimizedBytes.length > 0, 'PDF teroptimasi berhasil disimpan');
  // Periksa header PDF %PDF
  const header = Buffer.from(optimizedBytes.slice(0, 5)).toString('utf-8');
  assert.equal(header, '%PDF-', 'Header PDF harus tetap valid');
});

test('Kompresi File Generik (GZIP Zlib)', () => {
  const originalText = 'Ini adalah teks berulang untuk menguji kompresi file generik. '.repeat(50);
  const originalBuffer = Buffer.from(originalText, 'utf-8');

  const compressed = zlib.gzipSync(originalBuffer, { level: 9 });

  assert.ok(compressed.length < originalBuffer.length, 'Ukuran GZIP harus lebih kecil dari teks asli');
  // Magic bytes GZIP: 0x1f, 0x8b
  assert.equal(compressed[0], 0x1f);
  assert.equal(compressed[1], 0x8b);
});
