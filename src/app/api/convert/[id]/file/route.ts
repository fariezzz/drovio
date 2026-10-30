import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { getConversionResult } from '@/lib/converter/service';

export const dynamic = 'force-dynamic';

interface RouteContext {
  params: {
    id: string;
  };
}

export async function GET(_req: NextRequest, { params }: RouteContext) {
  const { id } = params;
  const result = getConversionResult(id);

  if (!result || !result.filePath || !fs.existsSync(result.filePath)) {
    return NextResponse.json(
      { success: false, error: 'Berkas hasil konversi tidak ditemukan atau telah kedaluwarsa.' },
      { status: 404 }
    );
  }

  try {
    const stats = fs.statSync(result.filePath);
    const filename = result.convertedName || path.basename(result.filePath).replace(/\s*\[cnv_[^\]]+\]/g, '');
    const safeAscii = filename.replace(/[^\x20-\x7E]/g, '_').replace(/"/g, '');
    const encodedFilename = encodeURIComponent(filename);

    const nodeStream = fs.createReadStream(result.filePath);
    const webStream = new ReadableStream({
      start(controller) {
        nodeStream.on('data', (chunk) => controller.enqueue(chunk));
        nodeStream.on('end', () => controller.close());
        nodeStream.on('error', (err) => controller.error(err));
      },
      cancel() {
        nodeStream.destroy();
      },
    });

    return new Response(webStream, {
      status: 200,
      headers: {
        'Content-Type': result.mimeType || 'application/octet-stream',
        'Content-Length': stats.size.toString(),
        'Content-Disposition': `attachment; filename="${safeAscii}"; filename*=UTF-8''${encodedFilename}`,
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      },
    });
  } catch (err: unknown) {
    const error = err as Error;
    return NextResponse.json(
      { success: false, error: `Gagal membaca berkas: ${error.message}` },
      { status: 500 }
    );
  }
}
