/**
 * cartoonFilter.js
 *
 * Implements a high-performance CPU-based cartoon/cel-shaded filter for video frames.
 *
 * Steps:
 * 1. Boost color saturation relative to pixel luminance (makes colors vibrant).
 * 2. Posterize (quantize) colors to a small number of discrete levels (cel-shading).
 * 3. Compute a fast gradient outline check using local pixel differences.
 * 4. Blend outlines with posterized colors.
 *
 * Runs in O(W * H) time with zero inner-loop memory allocations for maximum speed.
 */

/**
 * Apply the cartoon filter to a frame's ImageData.
 * Writes output pixels directly into outData.
 *
 * @param {ImageData} srcData  Source pixels (from canvas/video)
 * @param {ImageData} outData  Target pixels to write into
 * @param {number} W           Canvas width
 * @param {number} H           Canvas height
 * @param {Object} settings    { detail: 'low'|'medium'|'high', vibrancy: 'normal'|'vibrant'|'intense', thickness: 'thin'|'medium'|'thick' }
 */
export function applyCartoonFilter(srcData, outData, W, H, settings = {}) {
  const src = srcData.data;
  const out = outData.data;

  // 1. Map setting strings to numeric parameters
  let levels = 5;
  if (settings.detail === 'low') levels = 3;
  if (settings.detail === 'high') levels = 8;

  let saturation = 1.45;
  if (settings.vibrancy === 'normal') saturation = 1.0;
  if (settings.vibrancy === 'intense') saturation = 1.95;

  let thickness = 2;
  if (settings.thickness === 'thin') thickness = 1;
  if (settings.thickness === 'thick') thickness = 3;

  const edgeThreshold = 18;
  const edgeStrengthFactor = 1.5;
  const outlineColor = [22, 22, 26]; // dark slate gray / near-black

  // 2. Pre-calculate lookup table for color quantization to save CPU math in loop
  const quantizeTable = new Uint8Array(256);
  const step = 256 / levels;
  const range = levels - 1;
  for (let i = 0; i < 256; i++) {
    const level = Math.floor(i / step);
    quantizeTable[i] = Math.round((level / range) * 255);
  }

  // 3. Process frame pixels
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const idx = (y * W + x) * 4;

      const r = src[idx];
      const g = src[idx + 1];
      const b = src[idx + 2];

      // Luminance (using standard Rec. 601 coefficients)
      const l = 0.299 * r + 0.587 * g + 0.114 * b;

      // Saturate color: Lerp from gray (luminance) to source channel by saturation scale
      let sr = l + saturation * (r - l);
      let sg = l + saturation * (g - l);
      let sb = l + saturation * (b - l);

      // Clamp color channels
      sr = sr < 0 ? 0 : (sr > 255 ? 255 : sr);
      sg = sg < 0 ? 0 : (sg > 255 ? 255 : sg);
      sb = sb < 0 ? 0 : (sb > 255 ? 255 : sb);

      // Posterize via lookup table
      let qr = quantizeTable[Math.round(sr)];
      let qg = quantizeTable[Math.round(sg)];
      let qb = quantizeTable[Math.round(sb)];

      // Outline detection: compute luminance differences between current pixel and its right/bottom neighbors
      const nx = x + thickness < W ? x + thickness : W - 1;
      const ny = y + thickness < H ? y + thickness : H - 1;

      const idxR = (y * W + nx) * 4;
      const idxB = (ny * W + x) * 4;

      const rR = src[idxR];
      const gR = src[idxR + 1];
      const bR = src[idxR + 2];

      const rB = src[idxB];
      const gB = src[idxB + 1];
      const bB = src[idxB + 2];

      const lRight = 0.299 * rR + 0.587 * gR + 0.114 * bR;
      const lDown  = 0.299 * rB + 0.587 * gB + 0.114 * bB;

      const grad = Math.abs(l - lRight) + Math.abs(l - lDown);

      // Blend posterized color with ink outline color if threshold exceeded
      if (grad > edgeThreshold) {
        const factor = Math.min(1.0, (grad - edgeThreshold) * 0.05 * edgeStrengthFactor);
        qr = Math.round(qr * (1 - factor) + outlineColor[0] * factor);
        qg = Math.round(qg * (1 - factor) + outlineColor[1] * factor);
        qb = Math.round(qb * (1 - factor) + outlineColor[2] * factor);
      }

      out[idx]     = qr;
      out[idx + 1] = qg;
      out[idx + 2] = qb;
      out[idx + 3] = 255;
    }
  }
}
