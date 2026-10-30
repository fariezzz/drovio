import { NextRequest, NextResponse } from 'next/server';
import { inspectMedia } from '@/lib/media-service';
import { validateAndSanitizeUrl } from '@/lib/security';
import { MediaPreview } from '@/lib/types';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { urls } = body;

    if (!Array.isArray(urls) || urls.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Daftar tautan tidak boleh kosong.' },
        { status: 400 }
      );
    }

    // Batasi maksimal 15 tautan untuk preview batch demi stabilitas
    const validUrls: string[] = [];
    const errors: { url: string; error: string }[] = [];

    for (const raw of urls.slice(0, 15)) {
      if (typeof raw !== 'string' || !raw.trim()) continue;
      const val = validateAndSanitizeUrl(raw);
      if (val.valid && val.url) {
        validUrls.push(val.url);
      } else {
        errors.push({ url: raw, error: val.error || 'URL tidak valid' });
      }
    }

    if (validUrls.length === 0) {
      return NextResponse.json(
        { success: false, error: errors[0]?.error || 'Tidak ada URL valid yang dapat diperiksa.' },
        { status: 400 }
      );
    }

    // Eksekusi inspeksi metadata media secara konkuren (maksimal 5 bersamaan)
    const previews: MediaPreview[] = [];
    const inspectPromises = validUrls.map(async (u) => {
      try {
        const p = await inspectMedia(u);
        return { success: true as const, preview: p };
      } catch (err: unknown) {
        const error = err as Error;
        return { success: false as const, url: u, error: error.message };
      }
    });

    const results = await Promise.allSettled(inspectPromises);

    for (const res of results) {
      if (res.status === 'fulfilled') {
        if (res.value.success) {
          previews.push(res.value.preview);
        } else {
          errors.push({ url: res.value.url, error: res.value.error });
        }
      }
    }

    if (previews.length === 0 && errors.length > 0) {
      return NextResponse.json(
        { success: false, error: errors[0].error, errors },
        { status: 422 }
      );
    }

    return NextResponse.json({
      success: true,
      data: previews,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (err: unknown) {
    const error = err as Error;
    return NextResponse.json(
      { success: false, error: error.message || 'Gagal memeriksa batch tautan.' },
      { status: 500 }
    );
  }
}
