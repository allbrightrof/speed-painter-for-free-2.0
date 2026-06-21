/**
 * mp4Export.js
 * Encodes canvas frames directly to H.264 MP4 using the WebCodecs API + mp4-muxer.
 * No WASM, no CDN, no MediaRecorder — pure browser API (Chrome 94+).
 *
 * Strategy: drive the animation frame-by-frame in JS (faster than real-time),
 * capture each canvas state as a VideoFrame, encode it with VideoEncoder,
 * mux everything with mp4-muxer, return an MP4 Blob.
 */
import { Muxer, ArrayBufferTarget } from 'mp4-muxer';
import { fitImage, drawTextHook } from './sketchUtils';

const FPS        = 30;
const TIMESCALE  = 1_000_000; // microseconds

/**
 * @param {HTMLCanvasElement} canvas     — the drawing canvas
 * @param {Array}  pixels               — [{x,y,alpha}] sorted ink-pixel list
 * @param {number} durationSec          — target duration
 * @param {string} paperColor           — background fill style
 * @param {string} pencilColor          — pencil fill style
 * @param {boolean} colorRevealEnabled  — whether to fade color back in
 * @param {HTMLImageElement} originalImg — the original image for reveal
 * @param {function} onProgress         — called with 0-100
 * @param {function} onFrameDrawn       — optional: called after each frame so UI can update
 * @param {Object}   settings           — { teaserStyle, teaserDuration, hookTextEnabled, hookText, hookTextPosition, hookTextDuration, speedCurve }
 * @returns {Promise<Blob>}             — MP4 blob
 */
export async function exportToMP4(
  canvas, pixels, durationSec,
  paperColor = '#fef8f0', pencilColor = '#1a0a02',
  colorRevealEnabled = true, originalImg = null,
  onProgress, onFrameDrawn,
  settings = {}
) {
  const W = canvas.width;
  const H = canvas.height;

  // Teaser parameters
  const teaserStyle = settings.teaserStyle || 'none';
  const teaserDuration = settings.teaserDuration || 1.0;
  const teaserFrames = teaserStyle !== 'none' ? Math.ceil(FPS * teaserDuration) : 0;

  // Text Hook parameters
  const hookTextEnabled = settings.hookTextEnabled || false;
  const hookText = settings.hookText || '';
  const hookTextPosition = settings.hookTextPosition || 'top';
  const hookTextDuration = settings.hookTextDuration || 2.0;

  // Speed Curve parameters
  const speedCurve = settings.speedCurve || 'linear';

  const drawingFramesTotal = Math.ceil(FPS * Math.min(durationSec, 10));
  const drawRatio = colorRevealEnabled && originalImg ? 0.8 : 1.0;
  const drawFrames = Math.ceil(drawingFramesTotal * drawRatio);
  const revealFrames = drawingFramesTotal - drawFrames;

  // Total frames in the exported MP4 video
  const totalExportFrames = teaserFrames + drawFrames + revealFrames;

  // ── Muxer ──────────────────────────────────────────────────────────────────
  const target = new ArrayBufferTarget();
  const muxer  = new Muxer({
    target,
    video: { codec: 'avc', width: W, height: H },
    fastStart: 'in-memory',
  });

  // ── Encoder ────────────────────────────────────────────────────────────────
  const encoder = new VideoEncoder({
    output: (chunk, meta) => muxer.addVideoChunk(chunk, meta),
    error: (e) => { throw new Error('VideoEncoder error: ' + e.message); },
  });

  encoder.configure({
    codec:     'avc1.420034',  // H.264 High Profile Level 5.2
    width:     W,
    height:    H,
    bitrate:   8_000_000,
    framerate: FPS,
  });

  // ── Draw + encode frame by frame ───────────────────────────────────────────
  const ctx = canvas.getContext('2d');
  let pixelIdx = 0;

  for (let f = 0; f < totalExportFrames; f++) {
    const timeSec = f / FPS;

    if (f < teaserFrames) {
      // Teaser Phase
      ctx.fillStyle = paperColor;
      ctx.fillRect(0, 0, W, H);
      if (teaserStyle === 'completed') {
        for (let i = 0; i < pixels.length; i++) {
          const { x, y, alpha } = pixels[i];
          const jx = x + (Math.random() - 0.5) * 1.4;
          const jy = y + (Math.random() - 0.5) * 1.4;
          ctx.save();
          ctx.beginPath();
          ctx.arc(jx, jy, 0.55 + Math.random() * 0.6, 0, Math.PI * 2);
          ctx.fillStyle   = pencilColor;
          ctx.globalAlpha = Math.min(0.95, Math.max(0.04, alpha * (0.55 + Math.random() * 0.45)));
          ctx.fill();
          ctx.restore();
        }
      } else if (teaserStyle === 'color' && originalImg) {
        const { drawX, drawY, drawW, drawH } = fitImage(originalImg, W, H);
        ctx.drawImage(originalImg, drawX, drawY, drawW, drawH);
      }
    } else {
      // Drawing Phase or Reveal Phase
      const drawF = f - teaserFrames;

      if (drawF === 0) {
        // Clear canvas for drawing phase
        ctx.fillStyle = paperColor;
        ctx.fillRect(0, 0, W, H);
        pixelIdx = 0;
      }

      if (drawF < drawFrames) {
        // Drawing Phase: calculate target index using Speed Curve formula
        const t = drawFrames > 1 ? drawF / (drawFrames - 1) : 1.0;
        let p = t; // default linear
        if (speedCurve === 'fast-start') {
          p = 1 - Math.pow(1 - t, 3); // ease-out cubic
        } else if (speedCurve === 'waves') {
          p = t + 0.08 * Math.sin(t * Math.PI * 4);
          p = Math.min(1.0, Math.max(0.0, p));
        }

        const targetIdx = Math.min(pixels.length, Math.floor(p * pixels.length));
        for (let i = pixelIdx; i < targetIdx; i++) {
          const { x, y, alpha } = pixels[i];
          const jx = x + (Math.random() - 0.5) * 1.4;
          const jy = y + (Math.random() - 0.5) * 1.4;
          ctx.save();
          ctx.beginPath();
          ctx.arc(jx, jy, 0.55 + Math.random() * 0.6, 0, Math.PI * 2);
          ctx.fillStyle   = pencilColor;
          ctx.globalAlpha = Math.min(0.95, Math.max(0.04, alpha * (0.55 + Math.random() * 0.45)));
          ctx.fill();
          ctx.restore();
        }
        pixelIdx = targetIdx;
      } else if (colorRevealEnabled && originalImg) {
        // Reveal Phase: fade in original color image (original sketch remains underneath)
        const revealF = drawF - drawFrames;
        const revealProgress = revealFrames > 1 ? revealF / (revealFrames - 1) : 1.0;
        const { drawX, drawY, drawW, drawH } = fitImage(originalImg, W, H);

        ctx.save();
        ctx.globalAlpha = Math.min(1.0, Math.max(0.0, revealProgress));
        ctx.drawImage(originalImg, drawX, drawY, drawW, drawH);
        ctx.restore();
      }
    }

    // Render Text Hook Overlay on top of onscreen canvas if active
    if (hookTextEnabled && hookText && timeSec < hookTextDuration) {
      drawTextHook(ctx, hookText, W, H, hookTextPosition);
    }

    // Capture canvas → VideoFrame → encode
    const timestamp = Math.round((f / FPS) * TIMESCALE);
    const duration  = Math.round(TIMESCALE / FPS);
    const videoFrame = new VideoFrame(canvas, { timestamp, duration });
    encoder.encode(videoFrame, { keyFrame: f % FPS === 0 });
    videoFrame.close();

    onProgress?.(Math.round((f / totalExportFrames) * 100));
    onFrameDrawn?.();

    // Yield every 5 frames so the browser stays responsive
    if (f % 5 === 0) await new Promise(r => setTimeout(r, 0));
  }

  // ── Finish ─────────────────────────────────────────────────────────────────
  await encoder.flush();
  muxer.finalize();
  onProgress?.(100);

  return new Blob([target.buffer], { type: 'video/mp4' });
}

/** Returns true if Chrome 94+ WebCodecs API is available. */
export function isWebCodecsSupported() {
  return typeof VideoEncoder !== 'undefined' && typeof VideoFrame !== 'undefined';
}
