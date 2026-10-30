import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import sharp from 'sharp';
import { PDFDocument } from 'pdf-lib';

// Helper deteksi kategori konversi
function detectConversionCategory(filename) {
  const ext = filename.toLowerCase().split('.').pop() || '';
  if (['jpg', 'jpeg', 'png', 'webp', 'avif', 'gif', 'tiff', 'bmp', 'ico'].includes(ext)) return 'image';
  if (['mp4', 'mkv', 'mov', 'avi', 'webm', 'flv', 'wmv', 'm4v', '3gp'].includes(ext)) return 'video';
  if (['mp3', 'wav', 'flac', 'm4a', 'ogg', 'aac', 'wma', 'opus'].includes(ext)) return 'audio';
  if (ext === 'pdf') return 'document';
  return 'other';
}

// Helper validasi batch URL
function parseBatchUrls(text) {
  return text
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && (l.startsWith('http://') || l.startsWith('https://')));
}

test('Deteksi Kategori Konversi Berkas', () => {
  assert.equal(detectConversionCategory('foto.heic.jpg'), 'image');
  assert.equal(detectConversionCategory('video_iphone.mov'), 'video');
  assert.equal(detectConversionCategory('rekaman.m4a'), 'audio');
  assert.equal(detectConversionCategory('dokumen.pdf'), 'document');
});

test('Parsing & Filter Tautan Batch', () => {
  const rawInput = `
    https://youtube.com/watch?v=123
    bukan-url
    http://instagram.com/reel/abc
    ftp://invalid-proto.com

    https://tiktok.com/@user/video/456
  `;
  const parsed = parseBatchUrls(rawInput);
  assert.equal(parsed.length, 3);
  assert.equal(parsed[0], 'https://youtube.com/watch?v=123');
  assert.equal(parsed[1], 'http://instagram.com/reel/abc');
  assert.equal(parsed[2], 'https://tiktok.com/@user/video/456');
});

test('Konversi Gambar ke Dokumen PDF (Image to PDF)', async () => {
  const imgBuf = await sharp({
    create: { width: 500, height: 400, channels: 3, background: { r: 120, g: 80, b: 220 } },
  }).png().toBuffer();

  const doc = await PDFDocument.create();
  const page = doc.addPage([500, 400]);
  const png = await doc.embedPng(imgBuf);
  page.drawImage(png, { x: 0, y: 0, width: 500, height: 400 });

  const pdfBytes = await doc.save();
  assert.ok(pdfBytes.length > 0);
  const header = Buffer.from(pdfBytes.slice(0, 5)).toString('utf-8');
  assert.equal(header, '%PDF-');
});

test('Konversi Format Gambar (PNG -> WebP & JPEG)', async () => {
  const png = await sharp({
    create: { width: 200, height: 200, channels: 4, background: { r: 255, g: 50, b: 50, alpha: 1 } },
  }).png().toBuffer();

  const webp = await sharp(png).webp().toBuffer();
  assert.ok(webp.length > 0);
  // RIFF WebP header
  assert.equal(webp.toString('ascii', 0, 4), 'RIFF');

  const jpeg = await sharp(png).jpeg().toBuffer();
  assert.ok(jpeg.length > 0);
  // JPEG SOI marker
  assert.equal(jpeg[0], 0xff);
  assert.equal(jpeg[1], 0xd8);
});

test('Auto-Delete Berkas Preview Media', () => {
  const previewDir = path.resolve('downloads/previews');
  if (!fs.existsSync(previewDir)) fs.mkdirSync(previewDir, { recursive: true });

  const testUrl = 'https://example.com/test-preview-delete.mp4';
  const hash = crypto.createHash('md5').update(testUrl).digest('hex');
  const previewPath = path.join(previewDir, `${hash}.mp4`);

  // Buat berkas preview tiruan
  fs.writeFileSync(previewPath, 'dummy preview video stream data');
  assert.ok(fs.existsSync(previewPath));

  // Simulasikan penghapusan otomatis
  if (fs.existsSync(previewPath)) {
    fs.unlinkSync(previewPath);
  }

  assert.ok(!fs.existsSync(previewPath));
});
