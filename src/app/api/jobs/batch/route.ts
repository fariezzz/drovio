import { NextRequest, NextResponse } from 'next/server';
import { getJobManager } from '@/lib/job-queue';
import { validateAndSanitizeUrl, detectPlatform, checkHostResolvesPublic } from '@/lib/security';
import { DownloadRequest, Job } from '@/lib/types';
import { deletePreviewMedia } from '@/lib/preview-service';
import { getOrCreateSessionId, setPrivateSessionCookie } from '@/lib/private-history';
import { toPublicJobs } from '@/lib/job-access';

export const dynamic = 'force-dynamic';

interface BatchItemPayload {
  url: string;
  type?: 'video' | 'audio';
  qualityId?: string;
  title?: string;
  thumbnail?: string;
}

export async function POST(req: NextRequest) {
  try {
    const { sessionId, isNew } = getOrCreateSessionId(req);
    const body = await req.json().catch(() => ({}));
    const { items, urls, type = 'video', qualityId = 'best' } = body;

    const rawList: BatchItemPayload[] = [];

    // Jika format items kustom diberikan (dengan resolusi per-item)
    if (Array.isArray(items) && items.length > 0) {
      for (const it of items) {
        if (it && typeof it.url === 'string') {
          rawList.push(it);
        }
      }
    } else if (Array.isArray(urls) && urls.length > 0) {
      // Format sederhana: array URL
      for (const u of urls) {
        if (typeof u === 'string') {
          rawList.push({ url: u, type, qualityId });
        }
      }
    }

    if (rawList.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Daftar media tidak boleh kosong.' },
        { status: 400 }
      );
    }

    const manager = getJobManager();
    const createdJobs: Job[] = [];
    const errors: { url: string; error: string }[] = [];

    // Batasi maksimal 20 item per batch
    const sliceList = rawList.slice(0, 20);

    for (let i = 0; i < sliceList.length; i++) {
      const item = sliceList[i];
      const validation = validateAndSanitizeUrl(item.url);
      if (!validation.valid || !validation.url) {
        errors.push({ url: item.url, error: validation.error || 'URL tidak valid' });
        continue;
      }

      // P2: cek resolusi DNS per item (SSRF via DNS).
      const dnsCheck = await checkHostResolvesPublic(new URL(validation.url).hostname);
      if (!dnsCheck.ok) {
        errors.push({ url: item.url, error: dnsCheck.error || 'Domain ditolak demi keamanan.' });
        continue;
      }

      const platformInfo = detectPlatform(validation.url);
      const chosenType = item.type === 'audio' ? 'audio' : 'video';
      const chosenQuality = item.qualityId || (chosenType === 'audio' ? 'mp3-best' : 'best');

      const downloadReq: DownloadRequest = {
        url: validation.url,
        type: chosenType,
        qualityId: chosenQuality,
      };

      const jobTitle = item.title && typeof item.title === 'string'
        ? item.title.slice(0, 200)
        : `Unduhan ${platformInfo.platformName} #${i + 1}`;

      const job = manager.createJob(downloadReq, {
        title: jobTitle,
        ownerSessionId: sessionId,
        platform: platformInfo.platform,
        platformName: platformInfo.platformName,
        thumbnail: typeof item.thumbnail === 'string' ? item.thumbnail : undefined,
      });

      createdJobs.push(job);
      deletePreviewMedia(validation.url);
    }

    if (createdJobs.length === 0 && errors.length > 0) {
      return NextResponse.json(
        { success: false, error: errors[0].error, details: errors },
        { status: 400 }
      );
    }

    const response = NextResponse.json(
      {
        success: true,
        count: createdJobs.length,
        data: toPublicJobs(createdJobs),
        errors: errors.length > 0 ? errors : undefined,
      },
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
      { success: false, error: error.message || 'Gagal membuat antrean unduhan batch.' },
      { status: 500 }
    );
  }
}
