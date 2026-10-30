import { NextRequest, NextResponse } from 'next/server';
import { getJobManager } from '@/lib/job-queue';
import {
  getOrCreateSessionId,
  setPrivateSessionCookie,
} from '@/lib/private-history';
import { canAccessPrivateJob, toPublicJob } from '@/lib/job-access';

export const dynamic = 'force-dynamic';

interface RouteContext {
  params: {
    id: string;
  };
}

export async function POST(req: NextRequest, { params }: RouteContext) {
  const { sessionId, isNew } = getOrCreateSessionId(req);
  const manager = getJobManager();
  const job = manager.getJob(params.id);

  if (!job || !canAccessPrivateJob(job.ownerSessionId, sessionId)) {
    return NextResponse.json(
      { success: false, error: 'Pekerjaan unduhan tidak ditemukan.' },
      { status: 404 }
    );
  }

  const result = manager.cancelJob(params.id);
  if (!result.success) {
    return NextResponse.json(
      { success: false, error: result.message },
      { status: 400 }
    );
  }

  const updatedJob = manager.getJob(params.id);
  const response = NextResponse.json(
    {
      success: true,
      message: result.message,
      data: updatedJob ? toPublicJob(updatedJob) : undefined,
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
