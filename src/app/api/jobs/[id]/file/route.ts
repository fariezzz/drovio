import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { getJobManager } from '@/lib/job-queue';
import { getConfig } from '@/lib/config';
import { isPathInside } from '@/lib/security';

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
  const config = getConfig();

  if (!job) {
    return NextResponse.json(
      { success: false, error: 'Pekerjaan unduhan tidak ditemukan.' },
      { status: 404 }
    );
  }

  if (job.status !== 'completed' || !job.outputFilepath) {
    return NextResponse.json(
      { success: false, error: 'File unduhan belum selesai diproses atau gagal.' },
      { status: 400 }
    );
  }

  // Verifikasi keamanan path: tidak boleh keluar dari direktori unduhan
  if (!isPathInside(config.downloadDir, job.outputFilepath)) {
    return NextResponse.json(
      { success: false, error: 'Akses ke file ditolak (keamanan direktori).' },
      { status: 403 }
    );
  }

  if (!fs.existsSync(job.outputFilepath)) {
    return NextResponse.json(
      { success: false, error: 'File fisik telah dihapus atau dipindahkan dari disk lokal.' },
      { status: 404 }
    );
  }

  try {
    const stats = fs.statSync(job.outputFilepath);
    const filename = job.outputFilename || path.basename(job.outputFilepath);
    const ext = path.extname(filename).toLowerCase();

    let contentType = 'application/octet-stream';
    if (ext === '.mp4') contentType = 'video/mp4';
    else if (ext === '.mp3') contentType = 'audio/mpeg';
    else if (ext === '.webm') contentType = 'video/webm';
    else if (ext === '.m4a') contentType = 'audio/mp4';

    // Baca file sebagai ReadableStream untuk transfer efisien
    const nodeStream = fs.createReadStream(job.outputFilepath);
    const webStream = new ReadableStream({
      start(controller) {
        nodeStream.on('data', (chunk) => {
          controller.enqueue(chunk);
        });
        nodeStream.on('end', () => {
          controller.close();
        });
        nodeStream.on('error', (err) => {
          controller.error(err);
        });
      },
      cancel() {
        nodeStream.destroy();
      },
    });

    const safeAscii = filename.replace(/[^\x20-\x7E]/g, '_').replace(/"/g, '');
    const encodedFilename = encodeURIComponent(filename);

    return new Response(webStream, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Length': stats.size.toString(),
        'Content-Disposition': `attachment; filename="${safeAscii}"; filename*=UTF-8''${encodedFilename}`,
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      },
    });
  } catch (err: unknown) {
    const error = err as Error;
    return NextResponse.json(
      { success: false, error: `Gagal membaca file dari disk: ${error.message}` },
      { status: 500 }
    );
  }
}
