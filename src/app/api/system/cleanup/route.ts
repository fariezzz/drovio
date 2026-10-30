import { NextRequest, NextResponse } from 'next/server';
import { getCleanupService } from '@/lib/cleanup-service';
import { getOrCreateSessionId, setPrivateSessionCookie } from '@/lib/private-history';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const cleanup = getCleanupService();
  const { sessionId, isNew } = getOrCreateSessionId(req);
  const response = NextResponse.json(
    {
      success: true,
      data: cleanup.getStatus(),
    },
    {
      headers: {
        'Cache-Control': 'private, no-store',
        Vary: 'Cookie',
      },
    }
  );

  if (isNew) setPrivateSessionCookie(response, sessionId, req.nextUrl.protocol === 'https:');
  return response;
}

export async function POST(req: NextRequest) {
  try {
    const { sessionId, isNew } = getOrCreateSessionId(req);
    const body = await req.json().catch(() => ({}));
    const { action, retentionMinutes } = body;
    const cleanup = getCleanupService();

    if (action === 'update_retention') {
      if (typeof retentionMinutes !== 'number' || !Number.isFinite(retentionMinutes) || retentionMinutes < 0) {
        return NextResponse.json(
          { success: false, error: 'Nilai durasi retensi harus berupa angka positif (menit).' },
          { status: 400 }
        );
      }

      cleanup.setRetentionMinutes(retentionMinutes);
      const response = NextResponse.json({
        success: true,
        message:
          retentionMinutes > 0
            ? `Pembersihan otomatis diatur setiap ${retentionMinutes} menit.`
            : 'Pembersihan otomatis dinonaktifkan.',
        data: cleanup.getStatus(),
      });
      if (isNew) setPrivateSessionCookie(response, sessionId, req.nextUrl.protocol === 'https:');
      return response;
    }

    if (action === 'clean_now') {
      const result = cleanup.cleanNow(sessionId);
      const response = NextResponse.json({
        success: true,
        message: result.message,
        data: {
          ...cleanup.getStatus(),
          lastDeletedFiles: result.deletedFiles,
          lastDeletedBytes: result.deletedBytes,
        },
      });
      if (isNew) setPrivateSessionCookie(response, sessionId, req.nextUrl.protocol === 'https:');
      return response;
    }

    return NextResponse.json(
      { success: false, error: 'Aksi tidak valid. Gunakan "update_retention" atau "clean_now".' },
      { status: 400 }
    );
  } catch (err: unknown) {
    const error = err as Error;
    return NextResponse.json(
      { success: false, error: error.message || 'Gagal memproses pembersihan.' },
      { status: 500 }
    );
  }
}
