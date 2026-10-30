import zlib from 'zlib';
import { GenericCompressionOptions } from './types';

export function compressGeneric(
  inputBuffer: Buffer,
  filename: string,
  _options?: GenericCompressionOptions
): { buffer: Buffer; outputFilename: string; mimeType: string } {
  const compressed = zlib.gzipSync(inputBuffer, {
    level: 9,
  });

  return {
    buffer: compressed,
    outputFilename: `${filename}.gz`,
    mimeType: 'application/gzip',
  };
}
