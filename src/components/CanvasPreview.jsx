/**
 * CanvasPreview.jsx
 * Ink-pixel animation player with support for dynamic dimensions and themes.
 */
import React, { useRef, useEffect, useCallback, useState, forwardRef, useImperativeHandle } from 'react';
import { fitImage } from '../utils/sketchUtils';
import HandCursor from './HandCursor';

const CanvasPreview = forwardRef(({
  image, pixels, command, speed,
  aspectRatio = '16/9', canvasWidth = 1280, canvasHeight = 720,
  paperColor = '#fef8f0', pencilColor = '#1a0a02',
  colorRevealEnabled = true,
  onReady, onProgress, onCommandConsumed,
}, ref) => {
  const canvasRef    = useRef(null);
  const rafRef       = useRef(null);
  const pixelsRef    = useRef([]);
  const currentRef   = useRef(0);
  const isPlayingRef = useRef(false);
  const revealStartRef = useRef(null);

  const [pencilPos, setPencilPos]         = useState({ x: 0, y: 0 });
  const [pencilVisible, setPencilVisible] = useState(false);

  // ── Exposed: save current canvas frame as PNG ────────────────────────────
  useImperativeHandle(ref, () => ({
    savePNG() {
      const canvas = canvasRef.current;
      if (!canvas) return;
      canvas.toBlob(blob => {
        if (!blob) return;
        const url = URL.createObjectURL(blob);
        const a = Object.assign(document.createElement('a'), { href: url, download: 'speedpaint-sketch.png' });
        document.body.appendChild(a); a.click(); document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(url), 4000);
      }, 'image/png');
    },
  }), []);

  const clearCanvas = useCallback(() => {
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    ctx.fillStyle = paperColor;
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);
  }, [paperColor, canvasWidth, canvasHeight]);

  // ── Process uploaded image ────────────────────────────────────────────────
  useEffect(() => {
    if (!image || !pixels) return;
    cancelAnimationFrame(rafRef.current);
    isPlayingRef.current = false;
    currentRef.current   = 0;
    revealStartRef.current = null;
    setPencilVisible(false);

    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.width  = canvasWidth;
    canvas.height = canvasHeight;
    pixelsRef.current  = pixels;
    currentRef.current = 0;
    clearCanvas();
    onReady();
    onProgress(0);
  }, [image, pixels, canvasWidth, canvasHeight, clearCanvas]); // eslint-disable-line

  // ── Animation loop (play/pause mode) ─────────────────────────────────────
  const animate = useCallback(() => {
    if (!isPlayingRef.current) return;
    const canvas = canvasRef.current;
    const ctx    = canvas?.getContext('2d');
    if (!ctx) return;

    const pixels     = pixelsRef.current;
    const total      = pixels.length;
    if (total === 0) return;

    const drawRatio = colorRevealEnabled ? 0.8 : 1.0;
    const targetSec  = Math.max(0.8, 11 - speed);

    // If drawing phase is active
    if (currentRef.current < total) {
      const drawSec = targetSec * drawRatio;
      const pxPerFrame = Math.max(1, Math.ceil(total / (drawSec * 60)));

      let drawn = 0;
      while (drawn < pxPerFrame && currentRef.current < total) {
        const idx = currentRef.current;
        const { x, y, alpha } = pixels[idx];
        const jx = x + (Math.random() - 0.5) * 1.4;
        const jy = y + (Math.random() - 0.5) * 1.4;
        ctx.save();
        ctx.beginPath();
        ctx.arc(jx, jy, 0.55 + Math.random() * 0.6, 0, Math.PI * 2);
        ctx.fillStyle   = pencilColor;
        ctx.globalAlpha = Math.min(0.95, Math.max(0.04, alpha * (0.55 + Math.random() * 0.45)));
        ctx.fill();
        ctx.restore();
        currentRef.current++;
        drawn++;
        if (drawn % 12 === 0) {
          const rect = canvas.getBoundingClientRect();
          setPencilPos({
            x: rect.left + x * (rect.width  / canvasWidth),
            y: rect.top  + y * (rect.height / canvasHeight),
          });
        }
      }
      const pct = Math.min(99, (currentRef.current / total) * 100 * drawRatio);
      onProgress(pct);

      if (currentRef.current >= total) {
        setPencilVisible(false);
        revealStartRef.current = performance.now();
      }
      rafRef.current = requestAnimationFrame(animate);
    } else if (colorRevealEnabled && image) {
      // Color reveal phase: fade in original color photo
      const revealSec = targetSec * (1.0 - drawRatio);
      if (!revealStartRef.current) revealStartRef.current = performance.now();

      const elapsed = (performance.now() - revealStartRef.current) / 1000;
      const revealProgress = Math.min(1.0, elapsed / (revealSec || 1));

      const { drawX, drawY, drawW, drawH } = fitImage(image, canvasWidth, canvasHeight);

      ctx.save();
      ctx.globalAlpha = Math.min(1.0, Math.max(0.0, revealProgress));
      ctx.drawImage(image, drawX, drawY, drawW, drawH);
      ctx.restore();

      const pct = Math.min(100, (drawRatio + revealProgress * (1 - drawRatio)) * 100);
      onProgress(pct);

      if (revealProgress >= 1.0) {
        isPlayingRef.current = false;
        onProgress(100);
        return;
      }
      rafRef.current = requestAnimationFrame(animate);
    } else {
      isPlayingRef.current = false;
      onProgress(100);
    }
  }, [speed, onProgress, pencilColor, colorRevealEnabled, image, canvasWidth, canvasHeight]); // eslint-disable-line

  // ── Command handler ───────────────────────────────────────────────────────
  useEffect(() => {
    if (!command) return;

    if (command === 'play') {
      isPlayingRef.current = true;
      setPencilVisible(true);
      rafRef.current = requestAnimationFrame(animate);
    }

    if (command === 'pause') {
      isPlayingRef.current = false;
      setPencilVisible(false);
      cancelAnimationFrame(rafRef.current);
    }

    if (command === 'reset') {
      isPlayingRef.current = false;
      cancelAnimationFrame(rafRef.current);
      currentRef.current = 0;
      revealStartRef.current = null;
      setPencilVisible(false);
      clearCanvas();
      onProgress(0);
    }

    onCommandConsumed();
  }, [command]); // eslint-disable-line

  useEffect(() => {
    if (!isPlayingRef.current) return;
    cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(animate);
  }, [animate]);

  useEffect(() => () => cancelAnimationFrame(rafRef.current), []);

  // Determine standard preview aspect ratio style (e.g. 16/9, 9/16, 1/1)
  const displayRatio = aspectRatio.replace(':', '/');

  return (
    <section style={{ width: '100%', maxWidth: '740px', margin: '0 auto' }}>
      <div className="glass-card" style={{ padding: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
          <h2 style={{ fontWeight: 700, fontSize: '0.88rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            🖼️ Canvas Preview
          </h2>
          <span style={{ fontSize: '0.68rem', fontWeight: 700, padding: '2px 9px', borderRadius: '6px', background: 'rgba(56,189,248,0.1)', border: '1px solid rgba(56,189,248,0.25)', color: '#38bdf8' }}>
            {aspectRatio} · {canvasWidth}×{canvasHeight}
          </span>
        </div>

        <div style={{ position: 'relative', background: paperColor, borderRadius: '12px', overflow: 'hidden' }}>
          {!image && (
            <div style={{ width: '100%', aspectRatio: displayRatio, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '12px', color: 'var(--text-muted)', border: '1px dashed rgba(255,255,255,0.08)', borderRadius: '12px' }}>
              <span style={{ fontSize: '44px', opacity: 0.25 }}>✏️</span>
              <p style={{ fontSize: '0.82rem' }}>Your sketch animation will appear here</p>
              <p style={{ fontSize: '0.72rem', opacity: 0.5 }}>Format: {aspectRatio} · max 10 sec</p>
            </div>
          )}
          <canvas ref={canvasRef} id="speedpaint-canvas"
            style={{ display: image ? 'block' : 'none', width: '100%', height: 'auto', aspectRatio: displayRatio, borderRadius: '12px', background: paperColor, boxShadow: '0 6px 40px rgba(0,0,0,0.35)' }}
          />
        </div>
      </div>
      <HandCursor x={pencilPos.x} y={pencilPos.y} visible={pencilVisible} />
    </section>
  );
});

CanvasPreview.displayName = 'CanvasPreview';
export default CanvasPreview;
