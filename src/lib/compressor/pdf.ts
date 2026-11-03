import { PDFDocument, PDFName, PDFNumber } from 'pdf-lib';
import path from 'path';
import sharp from 'sharp';
import { PdfCompressionOptions } from './types';

export async function compressPdf(
  inputBuffer: Buffer,
  filename: string,
  options: PdfCompressionOptions
): Promise<{ buffer: Buffer; outputFilename: string; mimeType: string }> {
  const baseName = path.basename(filename, path.extname(filename));

  const doc = await PDFDocument.load(inputBuffer, {
    ignoreEncryption: true,
    updateMetadata: false,
  });

  // 1. Bersihkan metadata dokumen jika diminta untuk privasi dan mengurangi ukuran
  if (options.stripMetadata !== false) {
    try {
      doc.setTitle('');
      doc.setAuthor('');
      doc.setSubject('');
      doc.setKeywords([]);
      doc.setProducer('All-in-One Compressor');
      doc.setCreator('');
    } catch {
      // Abaikan jika struktur metadata tidak mendukung mutasi langsung
    }
  }

  // 2. Kompresi gambar tertanam di dalam PDF jika diaktifkan
  if (options.compressImages !== false) {
    const qualityLevel = options.level === 'high' ? 45 : options.level === 'medium' ? 65 : 80;

    try {
      for (const [, obj] of doc.context.enumerateIndirectObjects()) {
        if (!obj || typeof obj !== 'object' || !('dict' in obj)) continue;

        const anyObj = obj as { dict?: Map<unknown, unknown>; contents?: Uint8Array };
        if (!anyObj.dict || !anyObj.contents) continue;

        const subtype = (anyObj.dict as any).get?.(PDFName.of('Subtype'))?.toString();
        if (subtype === '/Image') {
          const filter = (anyObj.dict as any).get?.(PDFName.of('Filter'))?.toString();

          // Jika gambar menggunakan kompresi DCT (JPEG). Filter bisa
          // berupa string '/DCTDecode' atau array yang mengandungnya,
          // jadi cek dengan includes, bukan persamaan persis.
          if (filter && filter.includes('DCTDecode') && anyObj.contents && anyObj.contents.length > 5000) {
            try {
              const imageBuffer = Buffer.from(anyObj.contents);
              const compressedJpg = await sharp(imageBuffer)
                .jpeg({ quality: qualityLevel, mozjpeg: true })
                .toBuffer();

              if (compressedJpg.length < anyObj.contents.length) {
                anyObj.contents = new Uint8Array(compressedJpg);
                (anyObj.dict as any).set?.(PDFName.of('Length'), PDFNumber.of(compressedJpg.length));
              }
            } catch {
              // Jika gambar tidak dapat didekode oleh sharp, lewati tanpa error
            }
          }
        }
      }
    } catch {
      // Abaikan jika terjadi kendala pada traversi objek gambar internal
    }
  }

  // 3. Simpan dengan useObjectStreams: true untuk mengompresi tabel objek PDF
  const outputBytes = await doc.save({
    useObjectStreams: true,
    addDefaultPage: false,
  });

  return {
    buffer: Buffer.from(outputBytes),
    outputFilename: `${baseName}-terkompresi.pdf`,
    mimeType: 'application/pdf',
  };
}
