import { NextRequest, NextResponse } from 'next/server';
import { getJobManager } from '@/lib/job-queue';
import { validateAndSanitizeUrl, detectPlatform } from '@/lib/security';
import { DownloadRequest } from '@/lib/types';
import { deletePreviewMedia } from '@/lib/preview-service';

export const dynamic = 'force-dynamic';

export async function GET() {
  const manager = getJobManager();
  const jobs = manager.listJobs();
  return NextResponse.json({
    success: true,
    data: jobs,
  });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { url, type, qualityId, title, thumbnail, trimStart, trimEnd, subtitleLang } = body;

    if (!url || typeof url !== 'string') {
      return NextResponse.json(
        { success: false, error: 'URL media diperlukan.' },
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

    if (type !== 'video' && type !== 'audio') {
      return NextResponse.json(
        { success: false, error: 'Tipe media harus berupa "video" atau "audio".' },
        { status: 400 }
      );
    }

    if (!qualityId || typeof qualityId !== 'string') {
      return NextResponse.json(
        { success: false, error: 'Pilihan format / kualitas harus ditentukan.' },
        { status: 400 }
      );
    }

    const platformInfo = detectPlatform(validation.url);
    const downloadReq: DownloadRequest = {
      url: validation.url,
      type,
      qualityId,
      trimStart: typeof trimStart === 'string' && trimStart.trim() ? trimStart.trim() : undefined,
      trimEnd: typeof trimEnd === 'string' && trimEnd.trim() ? trimEnd.trim() : undefined,
      subtitleLang: typeof subtitleLang === 'string' && subtitleLang.trim() ? subtitleLang.trim() : undefined,
    };

    const manager = getJobManager();
    const job = manager.createJob(downloadReq, {
      title: (title && typeof title === 'string') ? title.slice(0, 200) : 'Media Unduhan',
      platform: platformInfo.platform,
      platformName: platformInfo.platformName,
      thumbnail: typeof thumbnail === 'string' ? thumbnail : undefined,
    });

    // Otomatis hapus berkas cache preview setelah pengguna mengklik unduh untuk menghemat ruang disk
    deletePreviewMedia(validation.url);

    return NextResponse.json(
      { success: true, data: job },
      { status: 201 }
    );
  } catch (err: unknown) {
    const error = err as Error;
    return NextResponse.json(
      { success: false, error: error.message || 'Gagal membuat tugas unduhan.' },
      { status: 500 }
    );
  }
}
