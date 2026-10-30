import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { getConfig } from '@/lib/config';
import { formatBytes } from '@/lib/media-service';
import { detectFileCategory } from '@/lib/compressor/service';

export const dynamic = 'force-dynamic';

export async function GET() {
  const config = getConfig();

  try {
    if (!fs.existsSync(config.downloadDir)) {
      return NextResponse.json({ success: true, data: [] });
    }

    const entries = fs.readdirSync(config.downloadDir, { withFileTypes: true });
    const files = entries
      .filter((e) => e.isFile() && !e.name.startsWith('.') && !e.name.endsWith('.part') && !e.name.endsWith('.ytdl'))
      .map((e) => {
        const fullPath = path.join(config.downloadDir, e.name);
        const stats = fs.statSync(fullPath);
        return {
          filename: e.name,
          category: detectFileCategory(e.name),
          size: stats.size,
          sizeFormatted: formatBytes(stats.size),
          mtime: stats.mtimeMs,
        };
      })
      .sort((a, b) => b.mtime - a.mtime);

    return NextResponse.json({
      success: true,
      data: files,
    });
  } catch (err: unknown) {
    const error = err as Error;
    return NextResponse.json(
      { success: false, error: error.message || 'Gagal membaca daftar file.' },
      { status: 500 }
    );
  }
}
