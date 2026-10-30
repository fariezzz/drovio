import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';

test('Logika Pembersihan Berkas Kedaluwarsa (Auto-Cleanup)', () => {
  const testDir = path.join(process.cwd(), 'downloads', '.test-cleanup');
  if (!fs.existsSync(testDir)) {
    fs.mkdirSync(testDir, { recursive: true });
  }

  const now = Date.now();

  // Buat berkas lama (dibuat 3 jam yang lalu)
  const oldFile = path.join(testDir, 'old_media.mp4');
  fs.writeFileSync(oldFile, 'sample data video lama');
  const threeHoursAgo = (now - 3 * 60 * 60 * 1000) / 1000;
  fs.utimesSync(oldFile, threeHoursAgo, threeHoursAgo);

  // Buat berkas baru (dibuat 5 menit yang lalu)
  const newFile = path.join(testDir, 'new_media.mp4');
  fs.writeFileSync(newFile, 'sample data video baru');

  // Simulasi pembersihan berkas > 60 menit
  const retentionMinutes = 60;
  const cutoffTime = now - retentionMinutes * 60 * 1000;

  const files = fs.readdirSync(testDir);
  let cleanedCount = 0;

  for (const file of files) {
    const full = path.join(testDir, file);
    const stats = fs.statSync(full);
    if (stats.mtimeMs < cutoffTime) {
      fs.unlinkSync(full);
      cleanedCount++;
    }
  }

  assert.equal(cleanedCount, 1, 'Hanya 1 berkas lama yang harus terhapus');
  assert.equal(fs.existsSync(oldFile), false, 'Berkas lama harus sudah terhapus');
  assert.equal(fs.existsSync(newFile), true, 'Berkas baru harus tetap ada');

  // Bersihkan folder tes
  fs.rmSync(testDir, { recursive: true, force: true });
});
