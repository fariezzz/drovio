import { NextRequest, NextResponse } from 'next/server';
import { checkSystemHealth } from '@/lib/media-service';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const force = req.nextUrl.searchParams.get('refresh') === 'true';
  const health = checkSystemHealth(force);
  return NextResponse.json(
    {
      success: true,
      data: health,
    },
    {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
      },
    }
  );
}
