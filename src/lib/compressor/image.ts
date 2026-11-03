import sharp from 'sharp';
import path from 'path';
import { ImageCompressionOptions } from './types';

export async function compressImage(
  inputBuffer: Buffer,
  filename: string,
  options: ImageCompressionOptions
): Promise<{ buffer: Buffer; outputFilename: string; mimeType: string }> {
  let pipeline = sharp(inputBuffer);
  const metadata = await pipeline.metadata();

  // 1. Ubah ukuran (resize) jika diminta persentase
  if (options.resizePercent && options.resizePercent < 100 && metadata.width && metadata.height) {
    const scale = options.resizePercent / 100;
    const newWidth = Math.round(metadata.width * scale);
    const newHeight = Math.round(metadata.height * scale);
    pipeline = pipeline.resize(newWidth, newHeight, {
      fit: 'inside',
      withoutEnlargement: true,
    });
  }

  // 2. Strip EXIF & metadata jika diminta (default true untuk efisiensi ukuran)
  if (options.stripMetadata !== false) {
    // Sharp secara default tidak menyertakan EXIF kecuali withMetadata() dipanggil
  } else {
    pipeline = pipeline.withMetadata();
  }

  // 3. Tentukan kualitas berdasarkan level kompresi
  const qualityMap = {
    low: { jpeg: 82, webp: 80, pngQuality: 85, avif: 70 },
    medium: { jpeg: 65, webp: 60, pngQuality: 70, avif: 55 },
    high: { jpeg: 45, webp: 40, pngQuality: 50, avif: 40 },
  };

  const currentQuality = qualityMap[options.level || 'medium'];

  // 4. Tentukan format output
  const originalExt = path.extname(filename).toLowerCase().replace('.', '');
  const targetFormat = options.format && options.format !== 'original'
    ? options.format
    : originalExt;

  const baseName = path.basename(filename, path.extname(filename));

  // P2: format 'original' sebelumnya jatuh ke default JPEG untuk SEMUA
  // format yang tidak dikenali switch (gif/avif/bmp/tiff) — GIF animasi
  // diam-diam jadi JPEG statis, transparansi hilang. Sekarang tiap format
  // ditangani eksplisit; GIF animasi dikembalikan apa adanya (Sharp tidak
  // bisa mempertahankan animasi) sehingga pengecekan P1 di service akan
  // mengembalikannya sebagai file asli, bukan JPEG rusak.
  if (targetFormat === 'gif' && (metadata.pages || 1) > 1) {
    return {
      buffer: inputBuffer,
      outputFilename: `${baseName}-terkompresi.gif`,
      mimeType: 'image/gif',
    };
  }

  switch (targetFormat) {
    case 'webp':
      pipeline = pipeline.webp({
        quality: currentQuality.webp,
        effort: 5,
      });
      return {
        buffer: await pipeline.toBuffer(),
        outputFilename: `${baseName}-terkompresi.webp`,
        mimeType: 'image/webp',
      };

    case 'png':
      pipeline = pipeline.png({
        compressionLevel: 9,
        palette: true,
        quality: currentQuality.pngQuality,
        effort: 8,
      });
      return {
        buffer: await pipeline.toBuffer(),
        outputFilename: `${baseName}-terkompresi.png`,
        mimeType: 'image/png',
      };

    case 'avif':
      pipeline = pipeline.avif({
        quality: currentQuality.avif,
        effort: 5,
      });
      return {
        buffer: await pipeline.toBuffer(),
        outputFilename: `${baseName}-terkompresi.avif`,
        mimeType: 'image/avif',
      };

    case 'tiff':
    case 'tif':
      pipeline = pipeline.tiff({
        compression: 'lzw',
        quality: currentQuality.pngQuality,
      });
      return {
        buffer: await pipeline.toBuffer(),
        outputFilename: `${baseName}-terkompresi.tiff`,
        mimeType: 'image/tiff',
      };

    case 'gif':
      pipeline = pipeline.gif();
      return {
        buffer: await pipeline.toBuffer(),
        outputFilename: `${baseName}-terkompresi.gif`,
        mimeType: 'image/gif',
      };

    case 'bmp':
      // Sharp tidak punya encoder BMP; kembalikan asli daripada
      // diam-diam mengubahnya jadi JPEG (P1 akan menandainya originalKept).
      return {
        buffer: inputBuffer,
        outputFilename: `${baseName}-terkompresi.bmp`,
        mimeType: 'image/bmp',
      };

    case 'jpeg':
    case 'jpg':
    default:
      // Default ke JPEG dengan mozjpeg untuk kompresi paling optimal
      pipeline = pipeline.jpeg({
        quality: currentQuality.jpeg,
        mozjpeg: true,
        chromaSubsampling: '4:2:0',
      });
      return {
        buffer: await pipeline.toBuffer(),
        outputFilename: `${baseName}-terkompresi.jpg`,
        mimeType: 'image/jpeg',
      };
  }
}
