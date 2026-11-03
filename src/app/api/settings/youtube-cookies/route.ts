import { NextRequest, NextResponse } from 'next/server';
import {
  getYoutubeCookieStatus,
  saveYoutubeCookies,
  deleteYoutubeCookies,
} from '@/lib/youtube-cookies';

export const dynamic = 'force-dynamic';

// GET: status saja. JANGAN PERNAH mengembalikan isi cookie.
export async function GET() {
  const status = getYoutubeCookieStatus();
  return NextResponse.json({
    success: true,
    data: {
      present: status.present,
      youtubeCount: status.youtubeCount,
      googleCount: status.googleCount,
      earliestExpiry: status.earliestExpiry,
      expired: status.expired,
    },
  }, {
    headers: { 'Cache-Control': 'no-store' },
  });
}

// POST: upload file cookies.txt (multipart, field 'file').
// Isi file TIDAK PERNAH dikembalikan di respons, juga tidak di-log.
export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData().catch(() => null);
    if (!formData) {
      return NextResponse.json(
        { success: false, error: 'Kirim file cookies.txt lewat form upload.' },
        { status: 400 }
      );
    }
    const file = formData.get('file');
    if (!file || typeof file === 'string') {
      return NextResponse.json(
        { success: false, error: 'File cookies.txt tidak ditemukan di form.' },
        { status: 400 }
      );
    }
    const text = await file.text();
    if (!text.trim()) {
      return NextResponse.json(
        { success: false, error: 'File cookie kosong.' },
        { status: 400 }
      );
    }
    const result = saveYoutubeCookies(text);
    return NextResponse.json({
      success: true,
      data: {
        present: result.status.present,
        youtubeCount: result.status.youtubeCount,
        googleCount: result.status.googleCount,
        earliestExpiry: result.status.earliestExpiry,
        expired: result.status.expired,
        droppedExpired: result.droppedExpired,
        droppedOtherDomain: result.droppedOtherDomain,
      },
    });
  } catch (err: unknown) {
    const error = err as Error;
    return NextResponse.json(
      { success: false, error: error.message || 'Gagal menyimpan cookie.' },
      { status: 400 }
    );
  }
}

// DELETE: hapus cookie yang tersimpan.
export async function DELETE() {
  const deleted = deleteYoutubeCookies();
  return NextResponse.json({ success: true, data: { deleted } });
}
