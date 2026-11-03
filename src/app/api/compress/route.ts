import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs';
import { executeCompression, detectFileCategory } from '@/lib/compressor/service';
import { CompressionOptions } from '@/lib/compressor/types';
import { getConfig } from '@/lib/config';
import { isPathInside } from '@/lib/security';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const contentType = req.headers.get('content-type') || '';

    // Kasus 1: Upload file via multipart/form-data
    if (contentType.includes('multipart/form-data')) {
      const formData = await req.formData();
      const file = formData.get('file') as File | null;
      const optionsRaw = formData.get('options') as string | null;

      if (!file) {
        return NextResponse.json(
          { success: false, error: 'Berkas file tidak ditemukan dalam form upload.' },
          { status: 400 }
        );
      }

      const originalName = file.name || 'file-upload';
      const arrayBuffer = await file.arrayBuffer();
      // P3: batas upload 1 GB. Sebelumnya tidak ada batas sama sekali dan
      // file dimuat penuh ke memori (Buffer + Sharp/gzip), jadi file raksasa
      // bisa menghabiskan memori server. 1 GB masih longgar untuk video
      // pada umumnya, tapi mencegah upload tanpa batas. Catatan: ini
      // pengecekan setelah formData dimuat (keterbatasan Next.js route),
      // bukan streaming parser — tetap lebih aman daripada tanpa batas.
      if (arrayBuffer.byteLength > 1024 * 1024 * 1024) {
        return NextResponse.json(
          { success: false, error: 'Ukuran file melebihi batas 1 GB.' },
          { status: 413 }
        );
      }
      const buffer = Buffer.from(arrayBuffer);

      let options: CompressionOptions;
      try {
        options = optionsRaw ? JSON.parse(optionsRaw) : { fileCategory: detectFileCategory(originalName, file.type) };
      } catch {
        options = { fileCategory: detectFileCategory(originalName, file.type) };
      }

      if (!options.fileCategory) {
        options.fileCategory = detectFileCategory(originalName, file.type);
      }

      const result = await executeCompression(originalName, { buffer }, options);

      return NextResponse.json({
        success: true,
        data: result,
      });
    }

    // Kasus 2: Kompres file yang sudah ada di folder downloads/ via JSON
    const body = await req.json().catch(() => ({}));
    const { localFilename, options: jsonOptions } = body;

    if (!localFilename || typeof localFilename !== 'string') {
      return NextResponse.json(
        { success: false, error: 'Nama file lokal atau upload file diperlukan.' },
        { status: 400 }
      );
    }

    const config = getConfig();
    const candidatePath = path.join(config.downloadDir, path.basename(localFilename));

    if (!isPathInside(config.downloadDir, candidatePath) || !fs.existsSync(candidatePath)) {
      return NextResponse.json(
        { success: false, error: 'File lokal tidak ditemukan di folder unduhan.' },
        { status: 404 }
      );
    }

    const options: CompressionOptions = jsonOptions || {
      fileCategory: detectFileCategory(localFilename),
    };

    const result = await executeCompression(
      localFilename,
      { localFilePath: candidatePath },
      options
    );

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (err: unknown) {
    const error = err as Error;
    return NextResponse.json(
      { success: false, error: error.message || 'Gagal memproses kompresi file.' },
      { status: 500 }
    );
  }
}
