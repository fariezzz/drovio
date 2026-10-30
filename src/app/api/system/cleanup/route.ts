import { NextRequest, NextResponse } from 'next/server';
import { getCleanupService } from '@/lib/cleanup-service';

export const dynamic = 'force-dynamic';

export async function GET() {
  const cleanup = getCleanupService();
  return NextResponse.json({
    success: true,
    data: cleanup.getStatus(),
  });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { action, retentionMinutes } = body;
    const cleanup = getCleanupService();

    if (action === 'update_retention') {
      if (typeof retentionMinutes !== 'number' || retentionMinutes < 0) {
        return NextResponse.json(
          { success: false, error: 'Nilai durasi retensi harus berupa angka positif (menit).' },
          { status: 400 }
        );
      }

      cleanup.setRetentionMinutes(retentionMinutes);

      return NextResponse.json({
        success: true,
        message:
          retentionMinutes > 0
            ? `Pembersihan otomatis diatur setiap ${retentionMinutes} menit.`
            : 'Pembersihan otomatis dinonaktifkan.',
        data: cleanup.getStatus(),
      });
    }

    if (action === 'clean_now') {
      const result = cleanup.cleanNow(retentionMinutes);

      return NextResponse.json({
        success: true,
        message: result.message,
        data: {
          ...cleanup.getStatus(),
          lastDeletedFiles: result.deletedFiles,
          lastDeletedBytes: result.deletedBytes,
        },
      });
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
