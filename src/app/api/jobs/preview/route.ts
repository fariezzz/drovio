import { NextRequest, NextResponse } from 'next/server';
import { inspectMedia } from '@/lib/media-service';
import { validateAndSanitizeUrl } from '@/lib/security';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { url } = body;

    if (!url || typeof url !== 'string') {
      return NextResponse.json(
        { success: false, error: 'Tautan URL tidak boleh kosong.' },
        { status: 400 }
      );
    }

    const validation = validateAndSanitizeUrl(url);
    if (!validation.valid || !validation.url) {
      return NextResponse.json(
        { success: false, error: validation.error || 'URL tidak valid.' },
        { status: 400 }
      );
    }

    const preview = await inspectMedia(validation.url);

    return NextResponse.json({
      success: true,
      data: preview,
    });
  } catch (err: unknown) {
    const error = err as Error;
    return NextResponse.json(
      { success: false, error: error.message || 'Terjadi kesalahan saat memeriksa media.' },
      { status: 422 }
    );
  }
}
