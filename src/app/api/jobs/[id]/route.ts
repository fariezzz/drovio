import { NextRequest, NextResponse } from 'next/server';
import { getJobManager } from '@/lib/job-queue';

export const dynamic = 'force-dynamic';

interface RouteContext {
  params: {
    id: string;
  };
}

export async function GET(_req: NextRequest, { params }: RouteContext) {
  const { id } = params;
  const manager = getJobManager();
  const job = manager.getJob(id);

  if (!job) {
    return NextResponse.json(
      { success: false, error: 'Pekerjaan unduhan tidak ditemukan.' },
      { status: 404 }
    );
  }

  return NextResponse.json({
    success: true,
    data: job,
  });
}

export async function DELETE(_req: NextRequest, { params }: RouteContext) {
  const { id } = params;
  const manager = getJobManager();
  const result = manager.cancelJob(id);

  if (!result.success) {
    return NextResponse.json(
      { success: false, error: result.message },
      { status: 400 }
    );
  }

  return NextResponse.json({
    success: true,
    message: result.message,
    data: manager.getJob(id),
  });
}
