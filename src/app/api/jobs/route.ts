import { NextRequest, NextResponse } from 'next/server';
import { getJobManager } from '@/lib/job-queue';
import { validateAndSanitizeUrl, detectPlatform, checkHostResolvesPublic } from '@/lib/security';
import { DownloadRequest } from '@/lib/types';
import { deletePreviewMedia } from '@/lib/preview-service';
import {
  getOrCreateSessionId,
  setPrivateSessionCookie,
} from '@/lib/private-history';
import { toPublicJob, toPublicJobs } from '@/lib/job-access';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const manager = getJobManager();
  const { sessionId, isNew } = getOrCreateSessionId(req);
  const jobs = manager.listJobs().filter((job) => job.ownerSessionId === sessionId);
  const response = NextResponse.json(
    {
      success: true,
      data: toPublicJobs(jobs),
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
    const { url, type, qualityId, title, thumbnail, trimStart, trimEnd, subtitleLang, youtubeClient } = body;

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

    // P2: cek resolusi DNS sebelum job dibuat (SSRF via DNS).
    const dnsCheck = await checkHostResolvesPublic(new URL(validation.url).hostname);
    if (!dnsCheck.ok) {
      return NextResponse.json(
        { success: false, error: dnsCheck.error || 'Domain ditolak demi keamanan.' },
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
      // Hanya 'android' yang diizinkan; nilai lain diabaikan.
      youtubeClient: youtubeClient === 'android' ? 'android' : undefined,
    };

    const manager = getJobManager();
    const job = manager.createJob(downloadReq, {
      title: (title && typeof title === 'string') ? title.slice(0, 200) : 'Media Unduhan',
      ownerSessionId: sessionId,
      platform: platformInfo.platform,
      platformName: platformInfo.platformName,
      thumbnail: typeof thumbnail === 'string' ? thumbnail : undefined,
    });

    // Otomatis hapus berkas cache preview setelah pengguna mengklik unduh untuk menghemat ruang disk
    deletePreviewMedia(validation.url);

    const response = NextResponse.json(
      { success: true, data: toPublicJob(job) },
      {
        status: 201,
        headers: {
          'Cache-Control': 'private, no-store',
          Vary: 'Cookie',
        },
      }
    );
    if (isNew) setPrivateSessionCookie(response, sessionId, req.nextUrl.protocol === 'https:');
    return response;
  } catch (err: unknown) {
    const error = err as Error;
    return NextResponse.json(
      { success: false, error: error.message || 'Gagal membuat tugas unduhan.' },
      { status: 500 }
    );
  }
}
