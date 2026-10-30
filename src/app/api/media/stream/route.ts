import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import { validateAndSanitizeUrl } from '@/lib/security';
import { ensurePreviewMedia, getPreviewFilePath } from '@/lib/preview-service';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const rawUrl = searchParams.get('url');

    if (!rawUrl) {
      return new Response('URL parameter tidak ditemukan.', { status: 400 });
    }

    const validation = validateAndSanitizeUrl(rawUrl);
    if (!validation.valid || !validation.url) {
      return new Response(validation.error || 'URL tidak valid.', { status: 400 });
    }

    const safeUrl = validation.url;
    let filePath = getPreviewFilePath(safeUrl);

    // Jika belum ada di disk, tunggu proses penyiapan preview media
    if (!fs.existsSync(filePath)) {
      const res = await ensurePreviewMedia(safeUrl);
      if (!res.ready || !res.filePath || !fs.existsSync(res.filePath)) {
        return new Response(res.error || 'Media preview gagal disiapkan.', { status: 404 });
      }
      filePath = res.filePath;
    }

    const stats = fs.statSync(filePath);
    const fileSize = stats.size;
    const rangeHeader = req.headers.get('range');

    // Dukungan HTTP 206 Partial Content untuk kelancaran seeking HTML5 <video>
    if (rangeHeader && rangeHeader.startsWith('bytes=')) {
      const parts = rangeHeader.replace(/bytes=/, '').split('-');
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;

      if (isNaN(start) || start >= fileSize || end >= fileSize || start > end) {
        return new Response('Rentang byte tidak valid.', {
          status: 416,
          headers: { 'Content-Range': `bytes */${fileSize}` },
        });
      }

      const chunkSize = end - start + 1;
      const nodeStream = fs.createReadStream(filePath, { start, end });
      const webStream = new ReadableStream({
        start(controller) {
          nodeStream.on('data', (chunk) => controller.enqueue(chunk));
          nodeStream.on('end', () => controller.close());
          nodeStream.on('error', (err) => controller.error(err));
        },
      });

      return new Response(webStream, {
        status: 206,
        headers: {
          'Content-Range': `bytes ${start}-${end}/${fileSize}`,
          'Accept-Ranges': 'bytes',
          'Content-Length': String(chunkSize),
          'Content-Type': 'video/mp4',
          'Cache-Control': 'public, max-age=3600',
        },
      });
    }

    // Streaming penuh jika tanpa range header
    const nodeStream = fs.createReadStream(filePath);
    const webStream = new ReadableStream({
      start(controller) {
        nodeStream.on('data', (chunk) => controller.enqueue(chunk));
        nodeStream.on('end', () => controller.close());
        nodeStream.on('error', (err) => controller.error(err));
      },
    });

    return new Response(webStream, {
      status: 200,
      headers: {
        'Content-Length': String(fileSize),
        'Accept-Ranges': 'bytes',
        'Content-Type': 'video/mp4',
        'Cache-Control': 'public, max-age=3600',
      },
    });
  } catch (err: unknown) {
    const error = err as Error;
    return new Response(`Kesalahan server saat streaming: ${error.message}`, { status: 500 });
  }
}
