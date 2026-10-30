import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import { getConfig } from '../config';
import { VideoCompressionOptions, AudioCompressionOptions } from './types';

export async function compressVideo(
  inputFilePath: string,
  outputDir: string,
  options: VideoCompressionOptions
): Promise<{ outputPath: string; outputFilename: string; mimeType: string }> {
  const config = getConfig();
  const baseName = path.basename(inputFilePath, path.extname(inputFilePath));
  const outputFilename = `${baseName}-terkompresi.mp4`;
  const outputPath = path.join(outputDir, outputFilename);

  // Jika file keluaran sudah ada, beri sufiks unik
  let finalPath = outputPath;
  let counter = 1;
  while (fs.existsSync(finalPath)) {
    finalPath = path.join(outputDir, `${baseName}-terkompresi-${counter}.mp4`);
    counter++;
  }

  // Tentukan CRF berdasarkan level
  const crfMap = {
    low: '23',
    medium: '28',
    high: '32',
  };
  const crf = crfMap[options.level || 'medium'];

  const args: string[] = [
    '-y',
    '-i', inputFilePath,
    '-c:v', 'libx264',
    '-crf', crf,
    '-preset', 'fast',
    '-c:a', 'aac',
    '-b:a', options.audioBitrate || '128k',
    '-movflags', '+faststart',
  ];

  // Skala resolusi jika diminta
  if (options.targetResolution && options.targetResolution !== 'original') {
    const scaleMap: Record<string, string> = {
      '1080p': 'scale=min(1920\\,iw):-2',
      '720p': 'scale=min(1280\\,iw):-2',
      '480p': 'scale=min(854\\,iw):-2',
    };
    if (scaleMap[options.targetResolution]) {
      args.push('-vf', scaleMap[options.targetResolution]);
    }
  }

  args.push(finalPath);

  return new Promise((resolve, reject) => {
    const child = spawn(config.ffmpegPath, args, {
      shell: false,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let stderr = '';
    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });

    child.on('close', (code) => {
      if (code === 0 && fs.existsSync(finalPath)) {
        resolve({
          outputPath: finalPath,
          outputFilename: path.basename(finalPath),
          mimeType: 'video/mp4',
        });
      } else {
        reject(new Error(`Kompresi video FFmpeg gagal (kode ${code}): ${stderr.slice(-300)}`));
      }
    });

    child.on('error', (err) => {
      reject(new Error(`Gagal mengeksekusi FFmpeg: ${err.message}`));
    });
  });
}

export async function compressAudio(
  inputFilePath: string,
  outputDir: string,
  options: AudioCompressionOptions
): Promise<{ outputPath: string; outputFilename: string; mimeType: string }> {
  const config = getConfig();
  const baseName = path.basename(inputFilePath, path.extname(inputFilePath));
  const outputFilename = `${baseName}-terkompresi.mp3`;
  const outputPath = path.join(outputDir, outputFilename);

  let finalPath = outputPath;
  let counter = 1;
  while (fs.existsSync(finalPath)) {
    finalPath = path.join(outputDir, `${baseName}-terkompresi-${counter}.mp3`);
    counter++;
  }

  const args: string[] = [
    '-y',
    '-i', inputFilePath,
    '-c:a', 'libmp3lame',
    '-b:a', options.bitrate || '128k',
    finalPath,
  ];

  return new Promise((resolve, reject) => {
    const child = spawn(config.ffmpegPath, args, {
      shell: false,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let stderr = '';
    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });

    child.on('close', (code) => {
      if (code === 0 && fs.existsSync(finalPath)) {
        resolve({
          outputPath: finalPath,
          outputFilename: path.basename(finalPath),
          mimeType: 'audio/mpeg',
        });
      } else {
        reject(new Error(`Kompresi audio FFmpeg gagal (kode ${code}): ${stderr.slice(-300)}`));
      }
    });

    child.on('error', (err) => {
      reject(new Error(`Gagal mengeksekusi FFmpeg: ${err.message}`));
    });
  });
}
