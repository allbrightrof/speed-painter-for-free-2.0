/**
 * sketchUtils.js
 *
 * Pencil sketch via "Color Dodge" blend — the same technique
 * Photoshop uses for its sketch effect. Produces fine detail,
 * shading AND outlines, not just edges.
 *
 * Algorithm:
 *   1. Grayscale the image
 *   2. Invert it
 *   3. Gaussian-blur the inverted version (radius controls line thickness)
 *   4. Color-dodge blend: gray ÷ (1 - blur/255)
 *   → result is a bright paper with dark pencil lines
 */

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Convert image → pencil sketch.
 * @param {HTMLImageElement} img
 * @param {number} W  canvas width  (1280)
 * @param {number} H  canvas height (720)
 * @returns {{ sketchCanvas, imageData }}
 */
/**
 * Convert image → pencil sketch.
 * @param {HTMLImageElement} img
 * @param {number} W  canvas width  (1280)
 * @param {number} H  canvas height (720)
 * @param {string} paperColor background paper color
 * @param {boolean} isChalkboard whether it is chalkboard mode (inverted colors)
 * @returns {{ sketchCanvas, imageData }}
 */
export function convertToSketch(img, W, H, paperColor = '#fef8f0', isChalkboard = false) {
  const tmp    = makeCanvas(W, H);
  const tmpCtx = tmp.getContext('2d');

  // background + letterboxed image
  tmpCtx.fillStyle = paperColor;
  tmpCtx.fillRect(0, 0, W, H);
  const { drawX, drawY, drawW, drawH } = fitImage(img, W, H);
  tmpCtx.drawImage(img, drawX, drawY, drawW, drawH);

  const src  = tmpCtx.getImageData(0, 0, W, H);
  const gray = toGrayscale(src);              // step 1
  const inv  = invertImage(gray);             // step 2
  const blur = gaussianBlur(inv, W, H, 9);   // step 3  (radius 9 = medium line weight)
  const sketch = colorDodge(gray, blur, W, H); // step 4

  if (isChalkboard) {
    const d = sketch.data;
    for (let i = 0; i < d.length; i += 4) {
      d[i] = 255 - d[i];
      d[i + 1] = 255 - d[i + 1];
      d[i + 2] = 255 - d[i + 2];
    }
  }

  const out    = makeCanvas(W, H);
  const outCtx = out.getContext('2d');
  outCtx.fillStyle = paperColor;
  outCtx.fillRect(0, 0, W, H);
  outCtx.putImageData(sketch, 0, 0);

  return { sketchCanvas: out, imageData: sketch };
}

/**
 * Convert sketch ImageData into a sorted list of ink pixels.
 * Pixels are sorted in a scanline-sweep pattern that looks like
 * an artist drawing from top to bottom.
 *
 * @param {ImageData} imageData  — from convertToSketch
 * @param {number} W
 * @param {number} H
 * @param {number} [threshold=240]  — R channel boundary
 * @param {boolean} [isChalkboard=false] — chalkboard flag
 * @returns {Array<{x, y, alpha}>}
 */
export function generateInkPixels(imageData, W, H, threshold = 240, isChalkboard = false) {
  const data   = imageData.data;
  const pixels = [];

  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const r = data[(y * W + x) * 4]; // R channel (grayscale = R=G=B)
      
      if (isChalkboard) {
        const whiteThreshold = 255 - threshold; // e.g. 15
        if (r > whiteThreshold) {
          const alpha = Math.pow(r / 255, 0.7);
          pixels.push({ x, y, alpha });
        }
      } else {
        if (r < threshold) {
          const alpha = Math.pow((threshold - r) / threshold, 0.7);
          pixels.push({ x, y, alpha });
        }
      }
    }
  }

  // Sort in horizontal band sweeps (alternating direction) — like an artist's hand
  const BAND = 18;
  pixels.sort((a, b) => {
    const ba = Math.floor(a.y / BAND);
    const bb = Math.floor(b.y / BAND);
    if (ba !== bb) return ba - bb;
    return ba % 2 === 0 ? a.x - b.x : b.x - a.x;
  });

  return pixels;
}

/**
 * Fit image inside W×H preserving aspect ratio (letterbox).
 * @returns {{ drawX, drawY, drawW, drawH }}
 */
export function fitImage(img, W, H) {
  const scale = Math.min(W / img.naturalWidth, H / img.naturalHeight);
  const drawW = img.naturalWidth  * scale;
  const drawH = img.naturalHeight * scale;
  return { drawW, drawH, drawX: (W - drawW) / 2, drawY: (H - drawH) / 2 };
}

// ── Internal helpers ──────────────────────────────────────────────────────────

function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return c;
}

/** Luminosity grayscale */
function toGrayscale(imgData) {
  const d = new Uint8ClampedArray(imgData.data);
  for (let i = 0; i < d.length; i += 4) {
    const g = 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2];
    d[i] = d[i + 1] = d[i + 2] = g;
  }
  return new ImageData(d, imgData.width, imgData.height);
}

/** Invert pixel values */
function invertImage(imgData) {
  const d = new Uint8ClampedArray(imgData.data);
  for (let i = 0; i < d.length; i += 4) {
    d[i] = 255 - d[i];
    d[i + 1] = 255 - d[i + 1];
    d[i + 2] = 255 - d[i + 2];
  }
  return new ImageData(d, imgData.width, imgData.height);
}

/**
 * Separable Gaussian blur — O(n·r) instead of O(n·r²).
 * Good quality, handles large radii for the sketch effect.
 */
function gaussianBlur(imgData, W, H, radius) {
  const src = imgData.data;
  let tmp   = new Float32Array(src.length);
  let out   = new Float32Array(src.length);

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
        sum  += kernel[k] * v;
        wSum += kernel[k];
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
        sum  += kernel[k] * v;
        wSum += kernel[k];
      }
      const i = (y * W + x) * 4;
      out[i] = out[i + 1] = out[i + 2] = sum / wSum;
      out[i + 3] = 255;
    }
  }

  return new ImageData(new Uint8ClampedArray(out), W, H);
}

function buildGaussianKernel(radius, sigma) {
  const size   = 2 * radius + 1;
  const kernel = new Float32Array(size);
  const s2     = 2 * sigma * sigma;
  for (let i = 0; i < size; i++) {
    const x = i - radius;
    kernel[i] = Math.exp(-(x * x) / s2);
  }
  return kernel;
}

/**
 * Color Dodge blend: result = base / (1 - blend/255)
 * base  = original grayscale
 * blend = blurred inverted
 * Produces paper-white background with dark pencil lines.
 */
function colorDodge(base, blend, W, H) {
  const b = base.data;
  const e = blend.data;
  const out = new Uint8ClampedArray(b.length);

  for (let i = 0; i < b.length; i += 4) {
    for (let c = 0; c < 3; c++) {
      const bv = b[i + c] / 255;
      const ev = e[i + c] / 255;
      // Dodge: saturate to 1 when denominator → 0
      const res = ev >= 1 ? 1 : Math.min(1, bv / (1 - ev));
      out[i + c] = Math.round(res * 255);
    }
    out[i + 3] = 255;
  }

  return new ImageData(out, W, H);
}
