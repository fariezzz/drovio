import { NextRequest, NextResponse } from 'next/server';
import { getJobManager } from '@/lib/job-queue';

export const dynamic = 'force-dynamic';

interface RouteContext {
  params: {
    id: string;
  };
}

export async function POST(_req: NextRequest, { params }: RouteContext) {
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
