import React, { useRef, useEffect, useCallback, useState, forwardRef, useImperativeHandle } from 'react';
import { fitImage, drawTextHook } from '../utils/sketchUtils';
import HandCursor from './HandCursor';

const CanvasPreview = forwardRef(({
  image, pixels, command, speed,
  aspectRatio = '16/9', canvasWidth = 1280, canvasHeight = 720,
  paperColor = '#fef8f0', pencilColor = '#1a0a02',
  colorRevealEnabled = true,
  onReady, onProgress, onCommandConsumed,
  teaserStyle = 'none', teaserDuration = 1.0,
  hookTextEnabled = false, hookText = '',
  hookTextPosition = 'top', hookTextDuration = 2.0,
  speedCurve = 'linear',
}, ref) => {
  const canvasRef            = useRef(null);
  const offscreenCanvasRef   = useRef(null);
  const rafRef               = useRef(null);
  const pixelsRef            = useRef([]);
  const currentRef           = useRef(0);
  const isPlayingRef         = useRef(false);
  const accumulatedTimeRef   = useRef(0);
  const lastFrameTimeRef     = useRef(0);
  const drawingInitializedRef = useRef(false);
  const baseImgDrawnRef      = useRef(false);

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
    if (ctx) {
      ctx.fillStyle = paperColor;
      ctx.fillRect(0, 0, canvasWidth, canvasHeight);
    }
    if (offscreenCanvasRef.current) {
      const oCtx = offscreenCanvasRef.current.getContext('2d');
      oCtx.fillStyle = paperColor;
      oCtx.fillRect(0, 0, canvasWidth, canvasHeight);
    }
  }, [paperColor, canvasWidth, canvasHeight]);

  // ── Process uploaded image ────────────────────────────────────────────────
  useEffect(() => {
    if (!image || !pixels) return;
    cancelAnimationFrame(rafRef.current);
    isPlayingRef.current         = false;
    currentRef.current           = 0;
    accumulatedTimeRef.current   = 0;
    lastFrameTimeRef.current     = 0;
    drawingInitializedRef.current = false;
    baseImgDrawnRef.current      = false;
    setPencilVisible(false);

    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.width  = canvasWidth;
    canvas.height = canvasHeight;

    // Initialize offscreen canvas
    if (!offscreenCanvasRef.current) {
      offscreenCanvasRef.current = document.createElement('canvas');
    }
    offscreenCanvasRef.current.width  = canvasWidth;
    offscreenCanvasRef.current.height = canvasHeight;
    const oCtx = offscreenCanvasRef.current.getContext('2d');
    oCtx.fillStyle = paperColor;
    oCtx.fillRect(0, 0, canvasWidth, canvasHeight);

    pixelsRef.current  = pixels;
    currentRef.current = 0;
    clearCanvas();
    onReady();
    onProgress(0);
  }, [image, pixels, canvasWidth, canvasHeight, clearCanvas, paperColor]); // eslint-disable-line

  // ── Animation loop (play/pause mode) ─────────────────────────────────────
  const animate = useCallback(() => {
    if (!isPlayingRef.current) return;
    const canvas = canvasRef.current;
    const ctx    = canvas?.getContext('2d');
    if (!ctx) return;

    const pixels     = pixelsRef.current;
    const total      = pixels.length;
    if (total === 0) return;

    // Game loop timing updates
    const now = performance.now();
    const dt = (now - lastFrameTimeRef.current) / 1000;
    lastFrameTimeRef.current = now;
    accumulatedTimeRef.current += dt;
    const elapsed = accumulatedTimeRef.current;

    const targetSec  = Math.max(0.8, 11 - speed);
    const teaserVal  = teaserStyle !== 'none' ? teaserDuration : 0;
    const drawRatio  = colorRevealEnabled ? 0.8 : 1.0;
    const drawSec    = targetSec * drawRatio;
    const revealSec  = targetSec * (1.0 - drawRatio);
    const totalDuration = teaserVal + drawSec + revealSec;

    if (elapsed < teaserVal) {
      // 1. Teaser Phase
      if (!baseImgDrawnRef.current) {
        const oCtx = offscreenCanvasRef.current.getContext('2d');
        oCtx.fillStyle = paperColor;
        oCtx.fillRect(0, 0, canvasWidth, canvasHeight);

        if (teaserStyle === 'completed') {
          for (let i = 0; i < total; i++) {
            const { x, y, alpha } = pixels[i];
            const jx = x + (Math.random() - 0.5) * 1.4;
            const jy = y + (Math.random() - 0.5) * 1.4;
            oCtx.save();
            oCtx.beginPath();
            oCtx.arc(jx, jy, 0.55 + Math.random() * 0.6, 0, Math.PI * 2);
            oCtx.fillStyle   = pencilColor;
            oCtx.globalAlpha = Math.min(0.95, Math.max(0.04, alpha * (0.55 + Math.random() * 0.45)));
            oCtx.fill();
            oCtx.restore();
          }
        } else if (teaserStyle === 'color' && image) {
          const { drawX, drawY, drawW, drawH } = fitImage(image, canvasWidth, canvasHeight);
          oCtx.drawImage(image, drawX, drawY, drawW, drawH);
        }
        baseImgDrawnRef.current = true;
      }

      ctx.drawImage(offscreenCanvasRef.current, 0, 0);
      setPencilVisible(false);

      const pct = Math.min(99, (elapsed / totalDuration) * 100);
      onProgress(pct);

      if (hookTextEnabled && hookText && elapsed < hookTextDuration) {
        drawTextHook(ctx, hookText, canvasWidth, canvasHeight, hookTextPosition);
      }
      rafRef.current = requestAnimationFrame(animate);
    } else if (elapsed < teaserVal + drawSec) {
      // 2. Drawing Phase
      const drawElapsed = elapsed - teaserVal;
      if (!drawingInitializedRef.current) {
        const oCtx = offscreenCanvasRef.current.getContext('2d');
        oCtx.fillStyle = paperColor;
        oCtx.fillRect(0, 0, canvasWidth, canvasHeight);
        currentRef.current = 0;
        drawingInitializedRef.current = true;
        setPencilVisible(true);
      }

      const t = Math.min(1.0, drawElapsed / drawSec);
      let p = t; // default linear
      if (speedCurve === 'fast-start') {
        p = 1 - Math.pow(1 - t, 3); // ease-out cubic
      } else if (speedCurve === 'waves') {
        p = t + 0.08 * Math.sin(t * Math.PI * 4);
        p = Math.min(1.0, Math.max(0.0, p));
      }

      const targetIdx = Math.min(total, Math.floor(p * total));
      const oCtx = offscreenCanvasRef.current.getContext('2d');
      let lastX = 0, lastY = 0;

      for (let i = currentRef.current; i < targetIdx; i++) {
        const { x, y, alpha } = pixels[i];
        const jx = x + (Math.random() - 0.5) * 1.4;
        const jy = y + (Math.random() - 0.5) * 1.4;
        oCtx.save();
        oCtx.beginPath();
        oCtx.arc(jx, jy, 0.55 + Math.random() * 0.6, 0, Math.PI * 2);
        oCtx.fillStyle   = pencilColor;
        oCtx.globalAlpha = Math.min(0.95, Math.max(0.04, alpha * (0.55 + Math.random() * 0.45)));
        oCtx.fill();
        oCtx.restore();
        lastX = x;
        lastY = y;
      }

      if (targetIdx > currentRef.current && lastX > 0) {
        const rect = canvas.getBoundingClientRect();
        setPencilPos({
          x: rect.left + lastX * (rect.width  / canvasWidth),
          y: rect.top  + lastY * (rect.height / canvasHeight),
        });
      }
      currentRef.current = targetIdx;

      // Copy offscreen state onto onscreen
      ctx.drawImage(offscreenCanvasRef.current, 0, 0);

      const pct = Math.min(99, (teaserVal + drawElapsed) / totalDuration * 100);
      onProgress(pct);

      if (hookTextEnabled && hookText && elapsed < hookTextDuration) {
        drawTextHook(ctx, hookText, canvasWidth, canvasHeight, hookTextPosition);
      }
      rafRef.current = requestAnimationFrame(animate);
    } else if (colorRevealEnabled && image) {
      // 3. Reveal Phase
      const revealElapsed = elapsed - teaserVal - drawSec;
      const revealProgress = Math.min(1.0, revealElapsed / (revealSec || 1));
      setPencilVisible(false);

      ctx.drawImage(offscreenCanvasRef.current, 0, 0);
      const { drawX, drawY, drawW, drawH } = fitImage(image, canvasWidth, canvasHeight);

      ctx.save();
      ctx.globalAlpha = Math.min(1.0, Math.max(0.0, revealProgress));
      ctx.drawImage(image, drawX, drawY, drawW, drawH);
      ctx.restore();

      const pct = Math.min(100, (teaserVal + drawSec + revealElapsed) / totalDuration * 100);
      onProgress(pct);

      if (hookTextEnabled && hookText && elapsed < hookTextDuration) {
        drawTextHook(ctx, hookText, canvasWidth, canvasHeight, hookTextPosition);
      }

      if (revealProgress >= 1.0) {
        isPlayingRef.current = false;
        onProgress(100);
        return;
      }
      rafRef.current = requestAnimationFrame(animate);
    } else {
      setPencilVisible(false);
      ctx.drawImage(offscreenCanvasRef.current, 0, 0);
      isPlayingRef.current = false;
      onProgress(100);

      if (hookTextEnabled && hookText && elapsed < hookTextDuration) {
        drawTextHook(ctx, hookText, canvasWidth, canvasHeight, hookTextPosition);
      }
    }
  }, [speed, onProgress, pencilColor, colorRevealEnabled, image, canvasWidth, canvasHeight, teaserStyle, teaserDuration, hookTextEnabled, hookText, hookTextPosition, hookTextDuration, speedCurve, paperColor]); // eslint-disable-line

  // ── Command handler ───────────────────────────────────────────────────────
  useEffect(() => {
    if (!command) return;

    if (command === 'play') {
      isPlayingRef.current = true;
      lastFrameTimeRef.current = performance.now();
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
      currentRef.current           = 0;
      accumulatedTimeRef.current   = 0;
      lastFrameTimeRef.current     = 0;
      drawingInitializedRef.current = false;
      baseImgDrawnRef.current      = false;
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
