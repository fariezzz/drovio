import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs';
import { executeConversion, detectConversionCategory, isValidConversionTarget } from '@/lib/converter/service';
import { ConversionOptions } from '@/lib/converter/types';
import { getConfig } from '@/lib/config';
import { isPathInside } from '@/lib/security';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const contentType = req.headers.get('content-type') || '';

    // Kasus 1: Upload via FormData
    if (contentType.includes('multipart/form-data')) {
      const formData = await req.formData();
      const file = formData.get('file') as File | null;
      const optionsRaw = formData.get('options') as string | null;

      if (!file) {
        return NextResponse.json(
          { success: false, error: 'Berkas tidak ditemukan dalam form upload.' },
          { status: 400 }
        );
      }

      const originalName = file.name || 'berkas-input';
      const arrayBuffer = await file.arrayBuffer();
      // P3: batas upload 1 GB, alasan sama seperti route compress.
      if (arrayBuffer.byteLength > 1024 * 1024 * 1024) {
        return NextResponse.json(
          { success: false, error: 'Ukuran file melebihi batas 1 GB.' },
          { status: 413 }
        );
      }
      const buffer = Buffer.from(arrayBuffer);

      let options: ConversionOptions;
      try {
        options = optionsRaw
          ? JSON.parse(optionsRaw)
          : { category: detectConversionCategory(originalName, file.type), targetFormat: 'mp4' };
      } catch {
        options = { category: detectConversionCategory(originalName, file.type), targetFormat: 'mp4' };
      }

      if (!options.targetFormat) {
        return NextResponse.json(
          { success: false, error: 'Format target konversi belum dipilih.' },
          { status: 400 }
        );
      }

      const cat1 = options.category || detectConversionCategory(originalName, file.type);
      if (!isValidConversionTarget(cat1, options.targetFormat)) {
        return NextResponse.json(
          { success: false, error: `Konversi ${cat1} ke "${options.targetFormat}" tidak didukung.` },
          { status: 400 }
        );
      }

      const result = await executeConversion(originalName, { buffer }, options);
      return NextResponse.json({ success: true, data: result });
    }

    // Kasus 2: Berkas dari folder downloads
    const body = await req.json().catch(() => ({}));
    const { localFilename, options } = body;

    if (!localFilename || typeof localFilename !== 'string') {
      return NextResponse.json(
        { success: false, error: 'Nama berkas lokal diperlukan.' },
        { status: 400 }
      );
    }

    const config = getConfig();
    const candidatePath = path.join(config.downloadDir, path.basename(localFilename));

    if (!isPathInside(config.downloadDir, candidatePath) || !fs.existsSync(candidatePath)) {
      return NextResponse.json(
        { success: false, error: 'Berkas lokal tidak ditemukan.' },
        { status: 404 }
      );
    }

    const convOptions: ConversionOptions = options || {
      category: detectConversionCategory(localFilename),
      targetFormat: 'mp4',
    };

    const cat2 = convOptions.category || detectConversionCategory(localFilename);
    if (!convOptions.targetFormat || !isValidConversionTarget(cat2, convOptions.targetFormat)) {
      return NextResponse.json(
        { success: false, error: `Konversi ${cat2} ke "${convOptions.targetFormat}" tidak didukung.` },
        { status: 400 }
      );
    }

    const result = await executeConversion(
      localFilename,
      { localFilePath: candidatePath },
      convOptions
    );

    return NextResponse.json({ success: true, data: result });
  } catch (err: unknown) {
    const error = err as Error;
    return NextResponse.json(
      { success: false, error: error.message || 'Gagal mengonversi berkas.' },
      { status: 500 }
    );
  }
}
