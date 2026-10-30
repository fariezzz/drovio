import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import { validateAndSanitizeUrl } from '@/lib/security';
import { ensurePreviewMedia, getPreviewFilePath } from '@/lib/preview-service';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const rawUrl = searchParams.get('url');

    if (!rawUrl) {
      return NextResponse.json(
        { success: false, error: 'URL parameter tidak ditemukan.' },
        { status: 400 }
      );
    }

    const validation = validateAndSanitizeUrl(rawUrl);
    if (!validation.valid || !validation.url) {
      return NextResponse.json(
        { success: false, error: validation.error || 'URL tidak valid.' },
        { status: 400 }
      );
    }

    const safeUrl = validation.url;
    const filePath = getPreviewFilePath(safeUrl);
    const streamUrl = `/api/media/stream?url=${encodeURIComponent(safeUrl)}`;

    if (fs.existsSync(filePath)) {
      try {
        const stats = fs.statSync(filePath);
        if (stats.size > 1024) {
          return NextResponse.json({
            success: true,
            ready: true,
            streamUrl,
          });
        }
      } catch {}
    }

    // Picu proses pembuatan di latar belakang jika belum ada
    ensurePreviewMedia(safeUrl).catch(() => {});

    return NextResponse.json({
      success: true,
      ready: false,
      streamUrl,
      message: 'Sedang menyiapkan pratinjau video aktual...',
    });
  } catch (err: unknown) {
    const error = err as Error;
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
