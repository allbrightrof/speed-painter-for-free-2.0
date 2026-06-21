/**
 * videoConverter.js
 *
 * Converts a video file to a painted/sketch version, frame by frame.
 * Strategy:
 *   1. Load video into a hidden <video> element.
 *   2. Seek to each output frame's timestamp.
 *   3. Draw the video frame to a canvas, apply the pencil-sketch
 *      algorithm (grayscale → invert → gaussian blur → color dodge).
 *   4. Encode each painted canvas frame with VideoEncoder (WebCodecs).
 *   5. Mux everything with mp4-muxer and return an MP4 Blob.
 *
 * No server, no WASM. Runs entirely in Chrome 94+.
 * Output is silent (no audio track) — intended for YouTube speed-paint content
 * where creators add their own background music.
 */

import { Muxer, ArrayBufferTarget } from 'mp4-muxer';
import { drawTextHook } from './sketchUtils';

export const VIDEO_OUTPUT_FPS    = 24;          // cinematic feel, smaller file
export const MAX_VIDEO_DURATION  = 60;          // seconds
const TIMESCALE                  = 1_000_000;   // microseconds
const BLUR_RADIUS                = 9;

// ── Output dimensions ─────────────────────────────────────────────────────────

export function getVideoDimensions(aspectRatio) {
  if (aspectRatio === '9:16') return { width: 720,  height: 1280 };
  if (aspectRatio === '1:1')  return { width: 1080, height: 1080 };
  return                              { width: 1280, height: 720  };
}

// ── Load a video file into a hidden <video> element ───────────────────────────

export function loadVideoFile(file) {
  return new Promise((resolve, reject) => {
    const video       = document.createElement('video');
    video.muted       = true;
    video.playsInline = true;
    video.preload     = 'metadata';

    const url = URL.createObjectURL(file);

    const cleanup = () => {
      video.removeEventListener('loadedmetadata', onLoaded);
      video.removeEventListener('error', onError);
    };
    const onLoaded = () => { cleanup(); resolve({ video, url }); };
    const onError  = () => {
      cleanup();
      URL.revokeObjectURL(url);
      reject(new Error('Failed to load video. Try a different format (MP4, WebM, MOV).'));
    };

    video.addEventListener('loadedmetadata', onLoaded);
    video.addEventListener('error', onError);
    video.src = url;
  });
}

// ── Seek video to a specific time ─────────────────────────────────────────────

function seekTo(video, time) {
  return new Promise((resolve, reject) => {
    // Already at the right time (within 1ms)
    if (Math.abs(video.currentTime - time) < 0.001) { resolve(); return; }

    const cleanup = () => {
      video.removeEventListener('seeked', onSeeked);
      video.removeEventListener('error', onError);
    };
    const onSeeked = () => { cleanup(); resolve(); };
    const onError  = () => { cleanup(); reject(new Error('Seek failed at t=' + time)); };

    video.addEventListener('seeked', onSeeked);
    video.addEventListener('error', onError);
    video.currentTime = time;
  });
}

// ── Hex → [r, g, b] ──────────────────────────────────────────────────────────

function hexToRgb(hex) {
  return [
    parseInt(hex.slice(1, 3), 16),
    parseInt(hex.slice(3, 5), 16),
    parseInt(hex.slice(5, 7), 16),
  ];
}

// ── Pencil-sketch algorithm (self-contained, pure ImageData ops) ──────────────
// Duplicated from sketchUtils.js so this module is fully self-contained.

function toGrayscale(imgData) {
  const d = new Uint8ClampedArray(imgData.data);
  for (let i = 0; i < d.length; i += 4) {
    const g = 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2];
    d[i] = d[i + 1] = d[i + 2] = g;
  }
  return new ImageData(d, imgData.width, imgData.height);
}

function invertImage(imgData) {
  const d = new Uint8ClampedArray(imgData.data);
  for (let i = 0; i < d.length; i += 4) {
    d[i] = 255 - d[i]; d[i + 1] = 255 - d[i + 1]; d[i + 2] = 255 - d[i + 2];
  }
  return new ImageData(d, imgData.width, imgData.height);
}

function buildGaussianKernel(radius, sigma) {
  const size = 2 * radius + 1;
  const k    = new Float32Array(size);
  const s2   = 2 * sigma * sigma;
  for (let i = 0; i < size; i++) { const x = i - radius; k[i] = Math.exp(-(x * x) / s2); }
  return k;
}

function gaussianBlur(imgData, W, H, radius) {
  const src    = imgData.data;
  const tmp    = new Float32Array(src.length);
  const out    = new Float32Array(src.length);
  const sigma  = radius / 2;
  const kernel = buildGaussianKernel(radius, sigma);
  const kLen   = kernel.length;
  const half   = Math.floor(kLen / 2);

  // Horizontal pass
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      let sum = 0, wSum = 0;
      for (let k = 0; k < kLen; k++) {
        const nx = Math.min(W - 1, Math.max(0, x + k - half));
        const v  = src[(y * W + nx) * 4];
        sum += kernel[k] * v; wSum += kernel[k];
      }
      tmp[(y * W + x) * 4] = sum / wSum;
    }
  }
  // Vertical pass
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      let sum = 0, wSum = 0;
      for (let k = 0; k < kLen; k++) {
        const ny = Math.min(H - 1, Math.max(0, y + k - half));
        const v  = tmp[(ny * W + x) * 4];
        sum += kernel[k] * v; wSum += kernel[k];
      }
      const i = (y * W + x) * 4;
      out[i] = out[i + 1] = out[i + 2] = sum / wSum;
      out[i + 3] = 255;
    }
  }
  return new ImageData(new Uint8ClampedArray(out), W, H);
}

function colorDodge(base, blend, W, H) {
  const b = base.data, e = blend.data;
  const o = new Uint8ClampedArray(b.length);
  for (let i = 0; i < b.length; i += 4) {
    for (let c = 0; c < 3; c++) {
      const bv = b[i + c] / 255, ev = e[i + c] / 255;
      o[i + c]  = Math.round(Math.min(1, ev >= 1 ? 1 : bv / (1 - ev)) * 255);
    }
    o[i + 3] = 255;
  }
  return new ImageData(o, W, H);
}

/**
 * Apply pencil-sketch effect to an ImageData snapshot of a video frame.
 * Returns the sketch ImageData (grayscale lines).
 */
function sketchFrame(imageData, W, H, isChalkboard) {
  const gray   = toGrayscale(imageData);
  const inv    = invertImage(gray);
  const blur   = gaussianBlur(inv, W, H, BLUR_RADIUS);
  const sketch = colorDodge(gray, blur, W, H);

  if (isChalkboard) {
    const d = sketch.data;
    for (let i = 0; i < d.length; i += 4) {
      d[i] = 255 - d[i]; d[i + 1] = 255 - d[i + 1]; d[i + 2] = 255 - d[i + 2];
    }
  }
  return sketch;
}

/**
 * Map sketch grayscale values → pencil color on paper color background.
 * Mirrors the pixel-drawing logic in mp4Export.js but applied all at once.
 */
function colorizeSketch(sketchData, pencilColor, paperColor, isChalkboard, threshold = 240) {
  const out        = new Uint8ClampedArray(sketchData.data);
  const [pr, pg, pb] = hexToRgb(paperColor);
  const [lr, lg, lb] = hexToRgb(pencilColor);

  for (let i = 0; i < out.length; i += 4) {
    const r = out[i];
    let   a = 0;

    if (isChalkboard) {
      const wt = 255 - threshold;
      a = r > wt ? Math.pow(r / 255, 0.7) : 0;
    } else {
      a = r < threshold ? Math.pow((threshold - r) / threshold, 0.7) : 0;
    }

    out[i]     = Math.round(lr * a + pr * (1 - a));
    out[i + 1] = Math.round(lg * a + pg * (1 - a));
    out[i + 2] = Math.round(lb * a + pb * (1 - a));
    out[i + 3] = 255;
  }

  return new ImageData(out, sketchData.width, sketchData.height);
}

// ── Rough time estimate ───────────────────────────────────────────────────────

/**
 * Estimated conversion time in seconds.
 * Based on ~80 ms/frame at 1280×720 (scaled by pixel count).
 */
export function estimateConversionTime(durationSec, W, H) {
  const pixels      = W * H;
  const refPixels   = 1280 * 720;
  const msPerFrame  = 80 * (pixels / refPixels);
  const totalFrames = Math.ceil(Math.min(durationSec, MAX_VIDEO_DURATION) * VIDEO_OUTPUT_FPS);
  return Math.round((totalFrames * msPerFrame) / 1000);
}

// ── Main conversion function ──────────────────────────────────────────────────

/**
 * Convert a video file into a painted MP4.
 *
 * @param {File}     file       — any video format the browser can play
 * @param {Object}   settings   — { theme, pencilColor, aspectRatio }
 * @param {Function} onProgress — (currentFrame, totalFrames, percent) → void
 * @param {Object}   signal     — { cancelled: boolean }  set .cancelled = true to abort early
 * @returns {Promise<Blob|null>} — MP4 Blob, or null if cancelled
 */
export async function convertVideoToPainting(file, settings, onProgress, signal = {}) {
  const {
    theme       = 'cream',
    pencilColor = '#1a0a02',
    aspectRatio = '16:9',
    hookTextEnabled = false,
    hookText        = '',
    hookTextPosition = 'top',
    hookTextDuration = 2.0,
  } = settings;

  const paperColor   = theme === 'chalkboard' ? '#121214' : theme === 'white' ? '#ffffff' : '#fef8f0';
  const isChalkboard = theme === 'chalkboard';
  const { width: W, height: H } = getVideoDimensions(aspectRatio);

  // ── Load video ──────────────────────────────────────────────────────────────
  const { video, url } = await loadVideoFile(file);

  try {
    const duration    = Math.min(video.duration, MAX_VIDEO_DURATION);
    const totalFrames = Math.ceil(duration * VIDEO_OUTPUT_FPS);

    // Letterbox parameters (fit video inside output canvas)
    const vw    = video.videoWidth;
    const vh    = video.videoHeight;
    const scale = Math.min(W / vw, H / vh);
    const drawW = vw * scale;
    const drawH = vh * scale;
    const drawX = (W - drawW) / 2;
    const drawY = (H - drawH) / 2;

    // Working canvas
    const canvas = document.createElement('canvas');
    canvas.width  = W;
    canvas.height = H;
    const ctx = canvas.getContext('2d');

    // ── Muxer ────────────────────────────────────────────────────────────────
    const target = new ArrayBufferTarget();
    const muxer  = new Muxer({
      target,
      video: { codec: 'avc', width: W, height: H },
      fastStart: 'in-memory',
    });

    // ── Encoder ──────────────────────────────────────────────────────────────
    const encoder = new VideoEncoder({
      output: (chunk, meta) => muxer.addVideoChunk(chunk, meta),
      error:  (e) => { throw new Error('VideoEncoder: ' + e.message); },
    });
    encoder.configure({
      codec:     'avc1.420034',   // H.264 High Profile
      width:     W,
      height:    H,
      bitrate:   8_000_000,
      framerate: VIDEO_OUTPUT_FPS,
    });

    // ── Frame-by-frame loop ───────────────────────────────────────────────────
    for (let f = 0; f < totalFrames; f++) {
      if (signal.cancelled) {
        encoder.close();
        return null;
      }

      // Seek video to this frame's timestamp
      await seekTo(video, f / VIDEO_OUTPUT_FPS);

      // Draw letterboxed video frame
      ctx.fillStyle = paperColor;
      ctx.fillRect(0, 0, W, H);
      ctx.drawImage(video, drawX, drawY, drawW, drawH);

      // Get raw pixels, sketch them, colorize
      const rawData    = ctx.getImageData(0, 0, W, H);
      const sketched   = sketchFrame(rawData, W, H, isChalkboard);
      const colorized  = colorizeSketch(sketched, pencilColor, paperColor, isChalkboard);

      // Write painted frame back to canvas
      ctx.putImageData(colorized, 0, 0);

      // Render text hook overlay if enabled
      if (hookTextEnabled && hookText && (f / VIDEO_OUTPUT_FPS) < hookTextDuration) {
        drawTextHook(ctx, hookText, W, H, hookTextPosition);
      }

      // Encode as a VideoFrame
      const timestamp     = Math.round((f / VIDEO_OUTPUT_FPS) * TIMESCALE);
      const frameDuration = Math.round(TIMESCALE / VIDEO_OUTPUT_FPS);
      const vf = new VideoFrame(canvas, { timestamp, duration: frameDuration });
      encoder.encode(vf, { keyFrame: f % VIDEO_OUTPUT_FPS === 0 });
      vf.close();

      onProgress?.(f + 1, totalFrames, Math.round(((f + 1) / totalFrames) * 100));

      // Yield to browser every 2 frames so UI stays responsive
      if (f % 2 === 0) await new Promise(r => setTimeout(r, 0));
    }

    // ── Finish ───────────────────────────────────────────────────────────────
    await encoder.flush();
    muxer.finalize();
    onProgress?.(totalFrames, totalFrames, 100);

    return new Blob([target.buffer], { type: 'video/mp4' });

  } finally {
    URL.revokeObjectURL(url);
  }
}
