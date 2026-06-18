/**
 * videoExport.js
 * Converts WebM → MP4 using ffmpeg.wasm.
 * Core files are served from /public (no import resolution issues).
 */
import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile } from '@ffmpeg/util';

let ffmpeg = null;
let loadPromise = null;

async function loadFFmpeg() {
  if (loadPromise) return loadPromise;
  ffmpeg = new FFmpeg();
  // Files copied to public/ — served as plain static assets by Vite
  loadPromise = ffmpeg.load({
    coreURL: '/ffmpeg-core.js',
    wasmURL: '/ffmpeg-core.wasm',
  });
  return loadPromise;
}

export async function convertWebMToMP4(inputBlob, onProgress) {
  await loadFFmpeg();
  const handler = ({ progress }) => onProgress?.(Math.min(99, Math.round(progress * 100)));
  ffmpeg.on('progress', handler);
  await ffmpeg.writeFile('in.webm', await fetchFile(inputBlob));
  await ffmpeg.exec([
    '-i', 'in.webm',
    '-c:v', 'libx264',
    '-preset', 'ultrafast',
    '-pix_fmt', 'yuv420p',
    '-movflags', '+faststart',
    '-y', 'out.mp4',
  ]);
  const data = await ffmpeg.readFile('out.mp4');
  ffmpeg.off('progress', handler);
  await ffmpeg.deleteFile('in.webm');
  await ffmpeg.deleteFile('out.mp4');
  return new Blob([data.buffer], { type: 'video/mp4' });
}

export function getBestRecordingFormat() {
  const directMP4 = [
    'video/mp4;codecs=avc1.42E01E,mp4a.40.2',
    'video/mp4;codecs=avc1.42E01E',
    'video/mp4;codecs=h264',
    'video/mp4',
  ].find(t => MediaRecorder.isTypeSupported(t));
  if (directMP4) return { mimeType: directMP4, needsConversion: false };
  const webm = ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm']
    .find(t => MediaRecorder.isTypeSupported(t)) || 'video/webm';
  return { mimeType: webm, needsConversion: true };
}
