import React, { useState, useCallback, useRef, useEffect } from 'react';

/* ── Config ───────────────────────────────────────────── */
const GLOW_MODES = [
  { key: 'classic',  label: 'Classic',  icon: '\u2726', desc: 'Cinematic multi-scale bloom' },
  { key: 'aurora',   label: 'Aurora',   icon: '\u{1F30C}', desc: 'Aurora Borealis — green/cyan/violet' },
  { key: 'neon',     label: 'Neon',     icon: '\u26A1', desc: 'Neon Pulse — sharp colored halos' },
  { key: 'cosmic',   label: 'Cosmic',   icon: '\u2B50', desc: 'Cosmic Rays — radial light streaks' },
  { key: 'digital',  label: 'Digital',  icon: '\u{1F4BB}', desc: 'Digital Rain — Matrix-style green' },
];

const SECTIONS = {
  restore: {
    label: 'RESTORE (Topaz)',
    icon: '\uD83D\uDD27',
    sliders: [
      { key: 'compressionFix', min: 0, max: 600, step: 1, label: 'Compression Fix', unit: '%' },
      { key: 'detailEnhance',  min: 0, max: 600, step: 1, label: 'Detail Enhance',  unit: '%' },
      { key: 'detailReveal',   min: 0, max: 600, step: 1, label: 'Detail Reveal',   unit: '%' },
      { key: 'denoise',        min: 0, max: 600, step: 1, label: 'Denoise',          unit: '%' },
      { key: 'dehalo',         min: 0, max: 600, step: 1, label: 'Dehalo',           unit: '%' },
    ],
  },
  style: {
    label: 'STYLE (AE)',
    icon: '\uD83C\uDFA8',
    sliders: [
      { key: 'sharpenIntensity', min: 0.0, max: 18.0, step: 0.05, label: 'Sharpen',       unit: 'x' },
      { key: 'sharpenWidth',     min: 0.5, max: 30.0, step: 0.1,  label: 'Sharpen Width', unit: 'px' },
      { key: 'edgeThreshold',    min: 0,   max: 600, step: 1,    label: 'Edge Threshold', unit: '' },
      { key: 'contrast',         min: 0.5, max: 12.0, step: 0.05, label: 'Contrast',      unit: 'x' },
      { key: 'exposure',         min: 0.0, max: 1.5, step: 0.05, label: 'Exposure',      unit: '' },
      { key: 'saturation',       min: 0.0, max: 12.0, step: 0.05, label: 'Saturation',    unit: 'x' },
      { key: 'vibrance',         min: 0,   max: 100, step: 1,    label: 'Vibrance',      unit: '%' },
      { key: 'warmth',           min: 0.5, max: 9.0, step: 0.05, label: 'Warmth',        unit: 'x' },
      { key: 'glowIntensity',    min: 0.0, max: 6.0, step: 0.05, label: 'Glow',          unit: 'x' },
      { key: 'glowWidth',        min: 5,   max: 480,  step: 1,    label: 'Glow Width',    unit: 'px' },
      { key: 'vignette',         min: 0,   max: 100, step: 1,    label: 'Vignette',      unit: '%' },
    ],
  },
};

const PRESETS = {
  beauty:  { compressionFix: 30, detailEnhance: 40, detailReveal: 30, denoise: 20, dehalo: 10, sharpenIntensity: 1.5, sharpenWidth: 1.5, edgeThreshold: 20, contrast: 1.1, saturation: 1.08, warmth: 1.0, glowIntensity: 0.35, glowWidth: 30, glowMode: 'classic', exposure: 0, vibrance: 10, vignette: 0, label: 'Beauty',  icon: '\u2726' },
  demon:   { compressionFix: 50, detailEnhance: 70, detailReveal: 60, denoise: 30, dehalo: 20, sharpenIntensity: 1.8, sharpenWidth: 2.0, edgeThreshold: 15, contrast: 1.3, saturation: 1.4, warmth: 1.1, glowIntensity: 0.6, glowWidth: 50, glowMode: 'cosmic', exposure: 0.1, vibrance: 0, vignette: 15, label: 'Demon',   icon: '\uD83D\uDD25' },
  cinema:  { compressionFix: 20, detailEnhance: 30, detailReveal: 25, denoise: 15, dehalo: 5,  sharpenIntensity: 0.8, sharpenWidth: 1.0, edgeThreshold: 30, contrast: 1.05, saturation: 1.05, warmth: 0.98, glowIntensity: 0.3, glowWidth: 25, glowMode: 'classic', exposure: 0, vibrance: 0, vignette: 25, label: 'Cinema',  icon: '\uD83C\uDFAC' },
  crunchy: { compressionFix: 40, detailEnhance: 60, detailReveal: 50, denoise: 25, dehalo: 15, sharpenIntensity: 1.5, sharpenWidth: 1.8, edgeThreshold: 18, contrast: 1.15, saturation: 1.1, warmth: 1.02, glowIntensity: 0.4, glowWidth: 35, glowMode: 'neon', exposure: 0, vibrance: 0, vignette: 10, label: 'Crunchy', icon: '\uD83D\uDC8E' },
  clean:   { compressionFix: 60, detailEnhance: 20, detailReveal: 15, denoise: 40, dehalo: 5,  sharpenIntensity: 0.5, sharpenWidth: 0.8, edgeThreshold: 40, contrast: 1.03, saturation: 1.0, warmth: 1.0, glowIntensity: 0.15, glowWidth: 15, glowMode: 'classic', exposure: 0, vibrance: 0, vignette: 0, label: 'Clean',   icon: '\u25FB' },
  aurora:  { compressionFix: 25, detailEnhance: 35, detailReveal: 30, denoise: 15, dehalo: 8,  sharpenIntensity: 1.2, sharpenWidth: 1.3, edgeThreshold: 25, contrast: 1.08, saturation: 1.15, warmth: 0.95, glowIntensity: 0.8, glowWidth: 60, glowMode: 'aurora', exposure: 0, vibrance: 0, vignette: 0, label: 'Aurora',  icon: '\u{1F30C}' },
  neonarc: { compressionFix: 35, detailEnhance: 55, detailReveal: 45, denoise: 10, dehalo: 12, sharpenIntensity: 2.0, sharpenWidth: 2.2, edgeThreshold: 10, contrast: 1.25, saturation: 1.3, warmth: 1.05, glowIntensity: 1.0, glowWidth: 40, glowMode: 'neon', exposure: 0.05, vibrance: 0, vignette: 10, label: 'Neon Arc', icon: '\u26A1' },
  blockbuster: { compressionFix: 25, detailEnhance: 40, detailReveal: 30, denoise: 15, dehalo: 5, sharpenIntensity: 1.1, sharpenWidth: 1.2, edgeThreshold: 25, contrast: 1.15, saturation: 1.15, warmth: 1.08, glowIntensity: 0.5, glowWidth: 45, glowMode: 'classic', exposure: 0.1, vibrance: 0, vignette: 30, label: 'Blockbuster', icon: '\uD83C\uDFA5' },
  ultraSharp: { compressionFix: 15, detailEnhance: 50, detailReveal: 45, denoise: 5, dehalo: 8, sharpenIntensity: 2.0, sharpenWidth: 1.8, edgeThreshold: 12, contrast: 1.15, saturation: 1.08, warmth: 1.0, glowIntensity: 0.0, glowWidth: 5, glowMode: 'classic', exposure: 0, vibrance: 0, vignette: 0, label: 'Ultra Sharp', icon: '\uD83D\uDD2D' },
  tiktok4k: { compressionFix: 20, detailEnhance: 30, detailReveal: 25, denoise: 10, dehalo: 10, sharpenIntensity: 3.2, sharpenWidth: 2.5, edgeThreshold: 8, contrast: 1.25, exposure: 0.45, saturation: 1.25, vibrance: 25, warmth: 1.06, glowIntensity: 0.2, glowWidth: 75, glowMode: 'classic', vignette: 75, label: 'TikTok 4K', icon: '\u{1F4F1}' },
};

const DEFAULTS = PRESETS.beauty;

/* ── Canvas Processing ─────────────────────────────────── */

// Fast box blur — sliding window O(w*h) regardless of radius
function boxBlur(srcData, w, h, radius) {
  const dst = new Uint8ClampedArray(srcData.length);
  const r = Math.max(1, Math.round(radius));
  const tmp = new Uint8ClampedArray(srcData.length);
  const diam = r * 2 + 1;

  // Horizontal pass
  for (let y = 0; y < h; y++) {
    let rS = 0, gS = 0, bS = 0;
    const row = y * w;
    for (let dx = -r; dx <= r; dx++) {
      const px = Math.min(w - 1, Math.max(0, dx));
      const i = (row + px) * 4;
      rS += srcData[i]; gS += srcData[i+1]; bS += srcData[i+2];
    }
    for (let x = 0; x < w; x++) {
      const i = (row + x) * 4;
      tmp[i] = rS / diam; tmp[i+1] = gS / diam; tmp[i+2] = bS / diam; tmp[i+3] = srcData[i+3];
      const addX = Math.min(w - 1, x + r + 1);
      const remX = Math.max(0, x - r);
      const ai = (row + addX) * 4;
      const ri = (row + remX) * 4;
      rS += srcData[ai] - srcData[ri]; gS += srcData[ai+1] - srcData[ri+1]; bS += srcData[ai+2] - srcData[ri+2];
    }
  }
  // Vertical pass
  for (let x = 0; x < w; x++) {
    let rS = 0, gS = 0, bS = 0;
    for (let dy = -r; dy <= r; dy++) {
      const py = Math.min(h - 1, Math.max(0, dy));
      const i = (py * w) * 4 + x * 4;
      rS += tmp[i]; gS += tmp[i+1]; bS += tmp[i+2];
    }
    for (let y = 0; y < h; y++) {
      const i = (y * w) * 4 + x * 4;
      dst[i] = rS / diam; dst[i+1] = gS / diam; dst[i+2] = bS / diam; dst[i+3] = tmp[i+3];
      const addY = Math.min(h - 1, y + r + 1);
      const remY = Math.max(0, y - r);
      const ai = (addY * w) * 4 + x * 4;
      const ri = (remY * w) * 4 + x * 4;
      rS += tmp[ai] - tmp[ri]; gS += tmp[ai+1] - tmp[ri+1]; bS += tmp[ai+2] - tmp[ri+2];
    }
  }
  return dst;
}

// Sobel edge magnitude
function computeEdgeMap(luma, w, h) {
  const edges = new Float32Array(w * h);
  for (let y = 1; y < h-1; y++) {
    for (let x = 1; x < w-1; x++) {
      const idx = y * w + x;
      const gx = -luma[(y-1)*w+x-1] + luma[(y-1)*w+x+1]
                - 2*luma[y*w+x-1] + 2*luma[y*w+x+1]
                - luma[(y+1)*w+x-1] + luma[(y+1)*w+x+1];
      const gy = -luma[(y-1)*w+x-1] - 2*luma[(y-1)*w+x] - luma[(y-1)*w+x+1]
                + luma[(y+1)*w+x-1] + 2*luma[(y+1)*w+x] + luma[(y+1)*w+x+1];
      edges[idx] = Math.sqrt(gx*gx + gy*gy);
    }
  }
  return edges;
}

// Smoothstep helper
function smoothstep(edge0, edge1, x) {
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

// ═══════════════════════════════════════════════════════
// GLOW MODE: CLASSIC — cinematic multi-scale bloom
// ═══════════════════════════════════════════════════════
function glowClassic(canvas, ctx, w, h, intensity, baseW) {
  // Layer 1: TIGHT BLOOM
  const c1 = document.createElement('canvas'); c1.width = w; c1.height = h;
  const ctx1 = c1.getContext('2d'); ctx1.drawImage(canvas, 0, 0);
  const d1 = ctx1.getImageData(0, 0, w, h).data;
  for (let i = 0; i < d1.length; i += 4) {
    const lum = 0.2126 * d1[i] + 0.7152 * d1[i+1] + 0.0722 * d1[i+2];
    const mask = smoothstep(120, 255, lum);
    d1[i] *= mask; d1[i+1] *= mask; d1[i+2] *= mask;
  }
  ctx1.putImageData(new ImageData(d1, w, h), 0, 0);
  let tmp1 = new Uint8ClampedArray(d1);
  for (let pass = 0; pass < 3; pass++) tmp1 = boxBlur(tmp1, w, h, Math.max(1, Math.round(baseW * 0.3)));
  const gd1 = ctx1.getImageData(0, 0, w, h); gd1.data.set(tmp1); ctx1.putImageData(gd1, 0, 0);

  // Layer 2: HALO
  const c2 = document.createElement('canvas'); c2.width = w; c2.height = h;
  const ctx2 = c2.getContext('2d'); ctx2.drawImage(canvas, 0, 0);
  const d2 = ctx2.getImageData(0, 0, w, h).data;
  for (let i = 0; i < d2.length; i += 4) {
    const lum = 0.2126 * d2[i] + 0.7152 * d2[i+1] + 0.0722 * d2[i+2];
    const mask = smoothstep(140, 255, lum) ** 2;
    d2[i] *= mask; d2[i+1] *= mask; d2[i+2] *= mask;
  }
  ctx2.putImageData(new ImageData(d2, w, h), 0, 0);
  let tmp2 = new Uint8ClampedArray(d2);
  for (let pass = 0; pass < 3; pass++) tmp2 = boxBlur(tmp2, w, h, Math.max(1, Math.round(baseW * 0.7)));
  const gd2 = ctx2.getImageData(0, 0, w, h); gd2.data.set(tmp2); ctx2.putImageData(gd2, 0, 0);

  // Layer 3: ATMOSPHERE
  const c3 = document.createElement('canvas'); c3.width = w; c3.height = h;
  const ctx3 = c3.getContext('2d'); ctx3.drawImage(canvas, 0, 0);
  const d3 = ctx3.getImageData(0, 0, w, h).data;
  for (let i = 0; i < d3.length; i += 4) {
    const lum = 0.2126 * d3[i] + 0.7152 * d3[i+1] + 0.0722 * d3[i+2];
    const t = smoothstep(80, 255, lum);
    d3[i] *= t * 0.4; d3[i+1] *= t * 0.4; d3[i+2] *= t * 0.4;
  }
  ctx3.putImageData(new ImageData(d3, w, h), 0, 0);
  let tmp3 = new Uint8ClampedArray(d3);
  for (let pass = 0; pass < 3; pass++) tmp3 = boxBlur(tmp3, w, h, Math.max(1, Math.round(baseW * 1.5)));
  const gd3 = ctx3.getImageData(0, 0, w, h); gd3.data.set(tmp3); ctx3.putImageData(gd3, 0, 0);

  // Composite
  ctx.globalCompositeOperation = 'screen';
  ctx.globalAlpha = intensity * 0.15; ctx.drawImage(c3, 0, 0);
  ctx.globalAlpha = intensity * 0.35; ctx.drawImage(c2, 0, 0);
  ctx.globalAlpha = intensity * 0.6;  ctx.drawImage(c1, 0, 0);
  ctx.globalAlpha = 1.0; ctx.globalCompositeOperation = 'source-over';
}

// ═══════════════════════════════════════════════════════
// GLOW MODE: AURORA BOREALIS — green/cyan/violet gradients
// ═══════════════════════════════════════════════════════
function glowAurora(canvas, ctx, w, h, intensity, baseW) {
  // Layer 1: Green channel glow (low luminance → green tint)
  const c1 = document.createElement('canvas'); c1.width = w; c1.height = h;
  const ctx1 = c1.getContext('2d'); ctx1.drawImage(canvas, 0, 0);
  const d1 = ctx1.getImageData(0, 0, w, h).data;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      const lum = 0.2126 * d1[i] + 0.7152 * d1[i+1] + 0.0722 * d1[i+2];
      const normY = y / h;
      // Aurora color: green at bottom, cyan in middle, violet at top
      const greenMix = smoothstep(60, 180, lum) * (1 - normY * 0.5);
      const cyanMix = smoothstep(100, 200, lum) * Math.abs(normY - 0.5) * 2;
      const violetMix = smoothstep(140, 255, lum) * normY * 0.8;
      d1[i]   = d1[i]   * (1 - greenMix * 0.6) + 40  * greenMix * 0.6;
      d1[i+1] = d1[i+1] * (1 - greenMix * 0.6) + 220 * greenMix * 0.6;
      d1[i+2] = d1[i+2] * (1 - greenMix * 0.6) + 80  * greenMix * 0.6;
      // Cyan overlay
      d1[i]   = d1[i]   * (1 - cyanMix * 0.4);
      d1[i+1] = d1[i+1] * (1 - cyanMix * 0.4) + 200 * cyanMix * 0.4;
      d1[i+2] = d1[i+2] * (1 - cyanMix * 0.4) + 220 * cyanMix * 0.4;
      // Violet overlay
      d1[i]   = d1[i]   * (1 - violetMix * 0.35) + 160 * violetMix * 0.35;
      d1[i+1] = d1[i+1] * (1 - violetMix * 0.35);
      d1[i+2] = d1[i+2] * (1 - violetMix * 0.35) + 200 * violetMix * 0.35;
    }
  }
  ctx1.putImageData(new ImageData(d1, w, h), 0, 0);
  // Wide soft blur for aurora flow
  let tmp1 = new Uint8ClampedArray(d1);
  for (let pass = 0; pass < 4; pass++) tmp1 = boxBlur(tmp1, w, h, Math.max(1, Math.round(baseW * 0.5)));
  const gd1 = ctx1.getImageData(0, 0, w, h); gd1.data.set(tmp1); ctx1.putImageData(gd1, 0, 0);

  // Layer 2: Bright highlight streaks
  const c2 = document.createElement('canvas'); c2.width = w; c2.height = h;
  const ctx2 = c2.getContext('2d'); ctx2.drawImage(canvas, 0, 0);
  const d2 = ctx2.getImageData(0, 0, w, h).data;
  for (let i = 0; i < d2.length; i += 4) {
    const lum = 0.2126 * d2[i] + 0.7152 * d2[i+1] + 0.0722 * d2[i+2];
    const mask = smoothstep(160, 255, lum);
    d2[i] = 80 * mask; d2[i+1] = 255 * mask; d2[i+2] = 160 * mask;
  }
  ctx2.putImageData(new ImageData(d2, w, h), 0, 0);
  let tmp2 = new Uint8ClampedArray(d2);
  for (let pass = 0; pass < 3; pass++) tmp2 = boxBlur(tmp2, w, h, Math.max(1, Math.round(baseW * 0.8)));
  const gd2 = ctx2.getImageData(0, 0, w, h); gd2.data.set(tmp2); ctx2.putImageData(gd2, 0, 0);

  // Composite
  ctx.globalCompositeOperation = 'screen';
  ctx.globalAlpha = intensity * 0.3; ctx.drawImage(c1, 0, 0);
  ctx.globalAlpha = intensity * 0.5; ctx.drawImage(c2, 0, 0);
  ctx.globalAlpha = 1.0; ctx.globalCompositeOperation = 'source-over';
}

// ═══════════════════════════════════════════════════════
// GLOW MODE: NEON PULSE — sharp colored edge halos
// ═══════════════════════════════════════════════════════
function glowNeon(canvas, ctx, w, h, intensity, baseW) {
  const srcData = ctx.getImageData(0, 0, w, h).data;

  // Compute edge map
  const luma = new Float32Array(w * h);
  for (let i = 0; i < srcData.length; i += 4) {
    luma[i >> 2] = 0.2126 * srcData[i] + 0.7152 * srcData[i+1] + 0.0722 * srcData[i+2];
  }
  const edges = computeEdgeMap(luma, w, h);
  let edgeMax = 0;
  for (let k = 0; k < edges.length; k++) { if (edges[k] > edgeMax) edgeMax = edges[k]; }
  edgeMax = edgeMax || 1;

  // Neon edge glow: warm (magenta/orange) on vertical edges, cool (cyan/blue) on horizontal
  const c1 = document.createElement('canvas'); c1.width = w; c1.height = h;
  const ctx1 = c1.getContext('2d');
  const imgData = ctx1.createImageData(w, h);
  const nd = imgData.data;
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const idx = y * w + x;
      const e = edges[idx] / edgeMax;
      if (e < 0.05) continue;
      const mask = smoothstep(0.05, 0.5, e);
      // Direction: gx tells horizontal, gy tells vertical
      const gy = -luma[(y-1)*w+x] - 2*luma[y*w+x] - luma[(y+1)*w+x]
                + luma[(y-1)*w+x] + 2*luma[y*w+x] + luma[(y+1)*w+x]; // simplified
      const gx = -luma[y*w+x-1] + luma[y*w+x+1];
      const absGx = Math.abs(gx);
      const absGy = Math.abs(gy);
      const total = absGx + absGy || 1;
      const hFactor = absGx / total;
      const vFactor = absGy / total;
      const i4 = idx * 4;
      // Cool (cyan) for horizontal edges, warm (magenta) for vertical
      nd[i4]   = (80 * hFactor + 255 * vFactor) * mask;
      nd[i4+1] = (255 * hFactor + 40 * vFactor) * mask;
      nd[i4+2] = (255 * hFactor + 180 * vFactor) * mask;
      nd[i4+3] = 255 * mask;
    }
  }
  ctx1.putImageData(imgData, 0, 0);
  let tmp1 = new Uint8ClampedArray(nd);
  for (let pass = 0; pass < 3; pass++) tmp1 = boxBlur(tmp1, w, h, Math.max(1, Math.round(baseW * 0.25)));
  const gd1 = ctx1.getImageData(0, 0, w, h); gd1.data.set(tmp1); ctx1.putImageData(gd1, 0, 0);

  // Layer 2: Broad warm bloom for highlights
  const c2 = document.createElement('canvas'); c2.width = w; c2.height = h;
  const ctx2 = c2.getContext('2d'); ctx2.drawImage(canvas, 0, 0);
  const d2 = ctx2.getImageData(0, 0, w, h).data;
  for (let i = 0; i < d2.length; i += 4) {
    const lum = 0.2126 * d2[i] + 0.7152 * d2[i+1] + 0.0722 * d2[i+2];
    const mask = smoothstep(180, 255, lum);
    d2[i] = 255 * mask; d2[i+1] = 100 * mask; d2[i+2] = 200 * mask;
  }
  ctx2.putImageData(new ImageData(d2, w, h), 0, 0);
  let tmp2 = new Uint8ClampedArray(d2);
  for (let pass = 0; pass < 3; pass++) tmp2 = boxBlur(tmp2, w, h, Math.max(1, Math.round(baseW * 0.6)));
  const gd2 = ctx2.getImageData(0, 0, w, h); gd2.data.set(tmp2); ctx2.putImageData(gd2, 0, 0);

  // Composite
  ctx.globalCompositeOperation = 'screen';
  ctx.globalAlpha = intensity * 0.7; ctx.drawImage(c1, 0, 0);
  ctx.globalAlpha = intensity * 0.25; ctx.drawImage(c2, 0, 0);
  ctx.globalAlpha = 1.0; ctx.globalCompositeOperation = 'source-over';
}

// ═══════════════════════════════════════════════════════
// GLOW MODE: COSMIC RAYS — radial light streaks
// ═══════════════════════════════════════════════════════
function glowCosmic(canvas, ctx, w, h, intensity, baseW) {
  // Layer 1: Colored bloom from highlights
  const c1 = document.createElement('canvas'); c1.width = w; c1.height = h;
  const ctx1 = c1.getContext('2d'); ctx1.drawImage(canvas, 0, 0);
  const d1 = ctx1.getImageData(0, 0, w, h).data;
  for (let i = 0; i < d1.length; i += 4) {
    const lum = 0.2126 * d1[i] + 0.7152 * d1[i+1] + 0.0722 * d1[i+2];
    const mask = smoothstep(130, 255, lum);
    // Warm shift on highlights
    d1[i]   = d1[i]   * mask * 1.1;
    d1[i+1] = d1[i+1] * mask * 0.85;
    d1[i+2] = d1[i+2] * mask * 1.2;
  }
  ctx1.putImageData(new ImageData(d1, w, h), 0, 0);
  let tmp1 = new Uint8ClampedArray(d1);
  for (let pass = 0; pass < 3; pass++) tmp1 = boxBlur(tmp1, w, h, Math.max(1, Math.round(baseW * 0.5)));
  const gd1 = ctx1.getImageData(0, 0, w, h); gd1.data.set(tmp1); ctx1.putImageData(gd1, 0, 0);

  // Layer 2: Chromatic aberration — offset R, G, B channels slightly
  const c2 = document.createElement('canvas'); c2.width = w; c2.height = h;
  const ctx2 = c2.getContext('2d'); ctx2.drawImage(canvas, 0, 0);
  const d2 = ctx2.getImageData(0, 0, w, h);
  const src2 = new Uint8ClampedArray(d2.data);
  const offset = Math.max(1, Math.round(baseW * 0.04));
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      const lum = 0.2126 * src2[i] + 0.7152 * src2[i+1] + 0.0722 * src2[i+2];
      if (lum > 140) {
        const mask = smoothstep(140, 255, lum);
        // Red shifts left, blue shifts right
        const rx = Math.min(w - 1, x + offset);
        const bx = Math.max(0, x - offset);
        d2.data[i]   = src2[(y * w + rx) * 4] * mask + d2.data[i] * (1 - mask);
        d2.data[i+2] = src2[(y * w + bx) * 4 + 2] * mask + d2.data[i+2] * (1 - mask);
      }
    }
  }
  ctx2.putImageData(d2, 0, 0);
  let tmp2 = new Uint8ClampedArray(ctx2.getImageData(0, 0, w, h).data);
  for (let pass = 0; pass < 3; pass++) tmp2 = boxBlur(tmp2, w, h, Math.max(1, Math.round(baseW * 0.4)));
  const gd2 = ctx2.getImageData(0, 0, w, h); gd2.data.set(tmp2); ctx2.putImageData(gd2, 0, 0);

  // Layer 3: Radial streak simulation — directional blur from center
  const c3 = document.createElement('canvas'); c3.width = w; c3.height = h;
  const ctx3 = c3.getContext('2d'); ctx3.drawImage(canvas, 0, 0);
  const d3 = ctx3.getImageData(0, 0, w, h);
  const src3 = new Uint8ClampedArray(d3.data);
  const cx = w / 2, cy = h / 2;
  const streakLen = Math.max(2, Math.round(baseW * 0.15));
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      const lum = 0.2126 * src3[i] + 0.7152 * src3[i+1] + 0.0722 * src3[i+2];
      if (lum < 160) continue;
      const mask = smoothstep(160, 255, lum);
      const dx = (x - cx) / (w * 0.5);
      const dy = (y - cy) / (h * 0.5);
      const dist = Math.sqrt(dx * dx + dy * dy) || 0.01;
      const nx = dx / dist, ny = dy / dist;
      let rSum = 0, gSum = 0, bSum = 0, count = 0;
      for (let s = 1; s <= streakLen; s++) {
        const sx = Math.round(x + nx * s); const sy = Math.round(y + ny * s);
        if (sx >= 0 && sx < w && sy >= 0 && sy < h) {
          const si = (sy * w + sx) * 4;
          rSum += src3[si]; gSum += src3[si+1]; bSum += src3[si+2]; count++;
        }
      }
      if (count > 0) {
        const f = mask * 0.5;
        d3.data[i]   = Math.min(255, d3.data[i]   + (rSum / count - d3.data[i]) * f);
        d3.data[i+1] = Math.min(255, d3.data[i+1] + (gSum / count - d3.data[i+1]) * f);
        d3.data[i+2] = Math.min(255, d3.data[i+2] + (bSum / count - d3.data[i+2]) * f);
      }
    }
  }
  ctx3.putImageData(d3, 0, 0);
  let tmp3 = new Uint8ClampedArray(ctx3.getImageData(0, 0, w, h).data);
  for (let pass = 0; pass < 2; pass++) tmp3 = boxBlur(tmp3, w, h, Math.max(1, Math.round(baseW * 0.3)));
  const gd3 = ctx3.getImageData(0, 0, w, h); gd3.data.set(tmp3); ctx3.putImageData(gd3, 0, 0);

  // Composite
  ctx.globalCompositeOperation = 'screen';
  ctx.globalAlpha = intensity * 0.35; ctx.drawImage(c3, 0, 0);
  ctx.globalAlpha = intensity * 0.3;  ctx.drawImage(c2, 0, 0);
  ctx.globalAlpha = intensity * 0.4;  ctx.drawImage(c1, 0, 0);
  ctx.globalAlpha = 1.0; ctx.globalCompositeOperation = 'source-over';
}

// ═══════════════════════════════════════════════════════
// GLOW MODE: DIGITAL RAIN — Matrix-style green vertical streaks
// ═══════════════════════════════════════════════════════
function glowDigitalRain(canvas, ctx, w, h, intensity, baseW) {
  // Layer 1: Green vertical streaks based on luminance
  const c1 = document.createElement('canvas'); c1.width = w; c1.height = h;
  const ctx1 = c1.getContext('2d');
  const imgData = ctx1.createImageData(w, h);
  const nd = imgData.data;
  const srcData = ctx.getImageData(0, 0, w, h).data;
  const streakLen = Math.max(3, Math.round(baseW * 0.12));
  for (let x = 0; x < w; x++) {
    for (let y = 0; y < h; y++) {
      const si = (y * w + x) * 4;
      const lum = 0.2126 * srcData[si] + 0.7152 * srcData[si+1] + 0.0722 * srcData[si+2];
      if (lum > 100) {
        const mask = smoothstep(100, 220, lum);
        // Look up the column for brighter pixels above
        let maxLum = 0;
        for (let sy = Math.max(0, y - streakLen); sy < y; sy++) {
          const ssi = (sy * w + x) * 4;
          const sl = 0.2126 * srcData[ssi] + 0.7152 * srcData[ssi+1] + 0.0722 * srcData[ssi+2];
          if (sl > maxLum) maxLum = sl;
        }
        const streakMask = smoothstep(80, 200, maxLum) * mask;
        // Digital green (#00ff41)
        nd[si]   = 0;
        nd[si+1] = Math.min(255, 255 * streakMask);
        nd[si+2] = Math.min(255, 65 * streakMask);
        nd[si+3] = 255 * streakMask;
      }
    }
  }
  ctx1.putImageData(imgData, 0, 0);
  let tmp1 = new Uint8ClampedArray(nd);
  for (let pass = 0; pass < 2; pass++) tmp1 = boxBlur(tmp1, w, h, Math.max(1, Math.round(baseW * 0.15)));
  const gd1 = ctx1.getImageData(0, 0, w, h); gd1.data.set(tmp1); ctx1.putImageData(gd1, 0, 0);

  // Layer 2: Bright green bloom for highlights
  const c2 = document.createElement('canvas'); c2.width = w; c2.height = h;
  const ctx2 = c2.getContext('2d'); ctx2.drawImage(canvas, 0, 0);
  const d2 = ctx2.getImageData(0, 0, w, h).data;
  for (let i = 0; i < d2.length; i += 4) {
    const lum = 0.2126 * d2[i] + 0.7152 * d2[i+1] + 0.0722 * d2[i+2];
    const mask = smoothstep(150, 255, lum);
    d2[i] = 20 * mask; d2[i+1] = 255 * mask; d2[i+2] = 65 * mask;
  }
  ctx2.putImageData(new ImageData(d2, w, h), 0, 0);
  let tmp2 = new Uint8ClampedArray(d2);
  for (let pass = 0; pass < 3; pass++) tmp2 = boxBlur(tmp2, w, h, Math.max(1, Math.round(baseW * 0.5)));
  const gd2 = ctx2.getImageData(0, 0, w, h); gd2.data.set(tmp2); ctx2.putImageData(gd2, 0, 0);

  // Composite
  ctx.globalCompositeOperation = 'screen';
  ctx.globalAlpha = intensity * 0.6; ctx.drawImage(c1, 0, 0);
  ctx.globalAlpha = intensity * 0.35; ctx.drawImage(c2, 0, 0);
  ctx.globalAlpha = 1.0; ctx.globalCompositeOperation = 'source-over';
}

// ═══════════════════════════════════════════════════════
// MAIN PROCESSING
// ═══════════════════════════════════════════════════════
function processImage(canvas, ctx, img, p) {
  let w = img.naturalWidth || img.width;
  let h = img.naturalHeight || img.height;

  const MAX = 1024;
  if (w > MAX || h > MAX) {
    const scale = MAX / Math.max(w, h);
    w = Math.round(w * scale);
    h = Math.round(h * scale);
  }

  canvas.width = w;
  canvas.height = h;
  ctx.drawImage(img, 0, 0, w, h);

  let imageData = ctx.getImageData(0, 0, w, h);
  let d = imageData.data;

  // ═══ TOPAZ RESTORE ═══
  if (p.denoise > 0) {
    const strength = p.denoise / 100;
    const blurred = boxBlur(d, w, h, Math.round(1 + strength * 3));
    for (let i = 0; i < d.length; i += 4) {
      const mix = strength * 0.4;
      d[i] = d[i]*(1-mix) + blurred[i]*mix;
      d[i+1] = d[i+1]*(1-mix) + blurred[i+1]*mix;
      d[i+2] = d[i+2]*(1-mix) + blurred[i+2]*mix;
    }
  }

  if (p.compressionFix > 0) {
    const strength = p.compressionFix / 100;
    const blurred = boxBlur(d, w, h, 2);
    for (let i = 0; i < d.length; i += 4) {
      const detail = (d[i] - blurred[i]) * (0.5 + strength * 0.5);
      d[i]   = Math.min(255, Math.max(0, d[i]   + detail * 0.3));
      d[i+1] = Math.min(255, Math.max(0, d[i+1] + detail * 0.3));
      d[i+2] = Math.min(255, Math.max(0, d[i+2] + detail * 0.3));
    }
  }

  if (p.detailEnhance > 0) {
    const amount = p.detailEnhance / 100 * 0.8;
    const blurred = boxBlur(d, w, h, 3);
    for (let i = 0; i < d.length; i += 4) {
      d[i]   = Math.min(255, Math.max(0, d[i]   + (d[i]   - blurred[i])   * amount));
      d[i+1] = Math.min(255, Math.max(0, d[i+1] + (d[i+1] - blurred[i+1]) * amount));
      d[i+2] = Math.min(255, Math.max(0, d[i+2] + (d[i+2] - blurred[i+2]) * amount));
    }
  }

  if (p.detailReveal > 0) {
    const amount = p.detailReveal / 100 * 0.6;
    const blurred = boxBlur(d, w, h, 5);
    for (let i = 0; i < d.length; i += 4) {
      const hp = d[i] - blurred[i];
      d[i]   = Math.min(255, Math.max(0, d[i]   + hp * amount * 1.2));
      d[i+1] = Math.min(255, Math.max(0, d[i+1] + hp * amount * 1.2));
      d[i+2] = Math.min(255, Math.max(0, d[i+2] + hp * amount * 1.2));
    }
  }

  if (p.dehalo > 0) {
    const strength = p.dehalo / 100;
    const blurred = boxBlur(d, w, h, 2);
    for (let i = 0; i < d.length; i += 4) {
      const diff = d[i] - blurred[i];
      if (Math.abs(diff) > 40) {
        const reduce = strength * 0.15;
        d[i]   = Math.min(255, Math.max(0, d[i]   - diff * reduce));
        d[i+1] = Math.min(255, Math.max(0, d[i+1] - diff * reduce));
        d[i+2] = Math.min(255, Math.max(0, d[i+2] - diff * reduce));
      }
    }
  }

  // ═══ AE STYLE ═══
  if (p.contrast !== 1.0) {
    const c = p.contrast;
    const intercept = 128 * (1 - c);
    for (let i = 0; i < d.length; i += 4) {
      d[i]   = Math.min(255, Math.max(0, d[i] * c + intercept));
      d[i+1] = Math.min(255, Math.max(0, d[i+1] * c + intercept));
      d[i+2] = Math.min(255, Math.max(0, d[i+2] * c + intercept));
    }
  }

  // AE Brightness/Exposure — out = in * 2^exposure
  if (p.exposure > 0) {
    const f = Math.pow(2, p.exposure);
    for (let i = 0; i < d.length; i += 4) {
      d[i]   = Math.min(255, d[i] * f);
      d[i+1] = Math.min(255, d[i+1] * f);
      d[i+2] = Math.min(255, d[i+2] * f);
    }
  }

  if (p.saturation !== 1.0) {
    for (let i = 0; i < d.length; i += 4) {
      const gray = 0.2126 * d[i] + 0.7152 * d[i+1] + 0.0722 * d[i+2];
      d[i]   = Math.min(255, Math.max(0, gray + p.saturation * (d[i] - gray)));
      d[i+1] = Math.min(255, Math.max(0, gray + p.saturation * (d[i+1] - gray)));
      d[i+2] = Math.min(255, Math.max(0, gray + p.saturation * (d[i+2] - gray)));
    }
  }

  // AE Vibrance — boosts low-saturation pixels, protects skin tones
  if (p.vibrance > 0) {
    const strength = p.vibrance / 100;
    for (let i = 0; i < d.length; i += 4) {
      const r = d[i], g = d[i+1], b = d[i+2];
      const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
      const sat = (mx - mn) / 255;
      let amt = strength * (1 - sat);
      if (r > g && g > b && (r - b) > 15 && (r - b) < 130) amt *= 0.35;
      const gray = 0.2126 * r + 0.7152 * g + 0.0722 * b;
      d[i]   = Math.min(255, Math.max(0, gray + amt * (r - gray)));
      d[i+1] = Math.min(255, Math.max(0, gray + amt * (g - gray)));
      d[i+2] = Math.min(255, Math.max(0, gray + amt * (b - gray)));
    }
  }

  if (p.warmth !== 1.0) {
    const shift = (p.warmth - 1.0) * 30;
    for (let i = 0; i < d.length; i += 4) {
      d[i]   = Math.min(255, Math.max(0, d[i] + shift));
      d[i+2] = Math.min(255, Math.max(0, d[i+2] - shift * 0.5));
    }
  }

  ctx.putImageData(imageData, 0, 0);

  // ═══ SHARPEN — Unsharp Mask ═══
  if (p.sharpenIntensity > 0) {
    const currentData = ctx.getImageData(0, 0, w, h);
    const cd = currentData.data;
    const radius = Math.max(1, Math.round(p.sharpenWidth));
    const blurred = boxBlur(cd, w, h, radius);
    const amount = (p.sharpenIntensity - 1.0) * 0.5;
    const threshold = p.edgeThreshold;
    const luma = new Float32Array(w * h);
    for (let i = 0; i < cd.length; i += 4) {
      luma[i >> 2] = 0.2126 * cd[i] + 0.7152 * cd[i+1] + 0.0722 * cd[i+2];
    }
    const edges = computeEdgeMap(luma, w, h);
    let edgeMax = 0;
    for (let k = 0; k < edges.length; k++) { if (edges[k] > edgeMax) edgeMax = edges[k]; }
    edgeMax = edgeMax || 1;
    for (let i = 0; i < cd.length; i += 4) {
      const px = (i >> 2) % w;
      const py = (i >> 2) / w | 0;
      const edgeVal = (edges[py * w + px] / edgeMax) * 255;
      const edgeMask = threshold > 0 ? Math.max(0, Math.min(1, (edgeVal - threshold) / 40)) : 1.0;
      const diff = cd[i] - blurred[i];
      cd[i]   = Math.min(255, Math.max(0, cd[i]   + diff * amount * edgeMask));
      cd[i+1] = Math.min(255, Math.max(0, cd[i+1] + (cd[i+1] - blurred[i+1]) * amount * edgeMask));
      cd[i+2] = Math.min(255, Math.max(0, cd[i+2] + (cd[i+2] - blurred[i+2]) * amount * edgeMask));
    }
    ctx.putImageData(currentData, 0, 0);
  }

  // ═══ GLOW — mode-based ═══
  if (p.glowIntensity > 0) {
    const baseW = Math.round(p.glowWidth);
    const mode = p.glowMode || 'classic';
    switch (mode) {
      case 'aurora':  glowAurora(canvas, ctx, w, h, p.glowIntensity, baseW); break;
      case 'neon':    glowNeon(canvas, ctx, w, h, p.glowIntensity, baseW); break;
      case 'cosmic':  glowCosmic(canvas, ctx, w, h, p.glowIntensity, baseW); break;
      case 'digital': glowDigitalRain(canvas, ctx, w, h, p.glowIntensity, baseW); break;
      default:        glowClassic(canvas, ctx, w, h, p.glowIntensity, baseW); break;
    }
  }

  // CC Vignette — radial darkening, applied last on the composite
  if (p.vignette > 0) {
    const strength = p.vignette / 100;
    const vData = ctx.getImageData(0, 0, w, h);
    const vd = vData.data;
    const cx = w / 2, cy = h / 2;
    const norm = Math.sqrt(cx * cx + cy * cy);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = (y * w + x) * 4;
        const dx = x - cx, dy = y - cy;
        const dist = Math.sqrt(dx * dx + dy * dy) / norm;
        const t = Math.max(0, Math.min(1, (dist - 0.35) / 0.65));
        const sm = t * t * (3 - 2 * t);
        const f = 1 - strength * sm;
        vd[i] *= f; vd[i+1] *= f; vd[i+2] *= f;
      }
    }
    ctx.putImageData(vData, 0, 0);
  }

  return canvas.toDataURL('image/png');
}

/* ── Slider Component ─────────────────────────────────── */
function Slider({ config, value, onChange }) {
  const pct = ((value - config.min) / (config.max - config.min)) * 100;
  return (
    <div className="flex items-center gap-3 group">
      <label className="w-32 text-[11px] font-semibold tracking-wider uppercase text-[#888] group-hover:text-[#c9a84c] transition-colors">
        {config.label}
      </label>
      <div className="flex-1 relative">
        <input
          type="range"
          min={config.min}
          max={config.max}
          step={config.step}
          value={value}
          onChange={(e) => onChange(config.key, parseFloat(e.target.value))}
          className="w-full cursor-pointer"
          style={{ background: `linear-gradient(to right, #c9a84c ${pct}%, #333 ${pct}%)` }}
        />
      </div>
      <span className="w-14 text-right text-xs font-mono text-[#c9a84c]">
        {typeof value === 'number' && value % 1 !== 0 ? value.toFixed(2) : Math.round(value)}{config.unit}
      </span>
    </div>
  );
}

/* ── Glow Mode Selector ────────────────────────────────── */
function GlowModeSelector({ active, onChange }) {
  return (
    <div className="space-y-2">
      <h4 className="text-[10px] font-bold tracking-widest uppercase text-[#666]">Glow Mode</h4>
      <div className="grid grid-cols-5 gap-1.5">
        {GLOW_MODES.map((mode) => (
          <button
            key={mode.key}
            onClick={() => onChange(mode.key)}
            className={`flex flex-col items-center py-2 px-1 rounded-lg text-[10px] font-semibold transition-all border ${
              active === mode.key
                ? 'bg-[#c9a84c]/15 border-[#c9a84c] text-[#c9a84c]'
                : 'bg-[#111] border-[#222] text-[#666] hover:border-[#444] hover:text-[#999]'
            }`}
            title={mode.desc}
          >
            <span className="text-base mb-0.5">{mode.icon}</span>
            <span className="leading-tight">{mode.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

/* ── Section (collapsible) ────────────────────────────── */
function Section({ sectionKey, section, values, onChange, defaultOpen, children }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="bg-[#161616] border border-[#222] rounded-lg overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-[#1a1a1a] transition-colors"
      >
        <span className="text-xs font-bold tracking-wider uppercase text-[#c9a84c]">
          {section.icon} {section.label}
        </span>
        <span className="text-[#666] text-sm">{open ? '\u2212' : '+'}</span>
      </button>
      {open && (
        <div className="px-4 pb-4 space-y-3">
          {children}
          {section.sliders.map((s) => (
            <Slider key={s.key} config={s} value={values[s.key]} onChange={onChange} />
          ))}
        </div>
      )}
    </div>
  );
}

/* ── Preset Bar ───────────────────────────────────────── */
function PresetBar({ active, onSelect }) {
  return (
    <div className="flex gap-1.5 flex-wrap">
      {Object.entries(PRESETS).map(([key, p]) => (
        <button
          key={key}
          className={`px-2.5 py-1 rounded text-[11px] font-semibold transition-all ${
            active === key
              ? 'bg-[#c9a84c] text-black'
              : 'bg-[#222] text-[#888] hover:bg-[#333] hover:text-[#c9a84c]'
          }`}
          onClick={() => onSelect(key)}
        >
          {p.icon} {p.label}
        </button>
      ))}
    </div>
  );
}

/* ── Export Panel ──────────────────────────────────────── */
function ExportPanel({ params }) {
  const config = {
    f09_preview: {
      version: '2.2.0',
      generated: new Date().toISOString(),
      glowMode: params.glowMode,
      restore: {
        compressionFix: params.compressionFix,
        detailEnhance: params.detailEnhance,
        detailReveal: params.detailReveal,
        denoise: params.denoise,
        dehalo: params.dehalo,
      },
      style: {
        sharpenIntensity: params.sharpenIntensity,
        sharpenWidth: params.sharpenWidth,
        edgeThreshold: params.edgeThreshold,
        contrast: params.contrast,
        saturation: params.saturation,
        warmth: params.warmth,
        glowIntensity: params.glowIntensity,
        glowWidth: params.glowWidth,
        exposure: params.exposure,
        vibrance: params.vibrance,
        vignette: params.vignette,
      },
    },
  };
  const json = JSON.stringify(config, null, 2);

  return (
    <div className="bg-[#161616] border border-[#222] rounded-lg p-4">
      <h3 className="text-xs font-semibold tracking-wider uppercase text-[#888] mb-3">
        Export Config
      </h3>
      <pre className="text-xs text-[#c9a84c] bg-[#0a0a0a] rounded p-3 overflow-auto max-h-48 mb-3 font-mono">
        {json}
      </pre>
      <div className="flex gap-2">
        <button
          onClick={() => navigator.clipboard.writeText(json)}
          className="flex-1 py-2 px-4 bg-[#222] hover:bg-[#333] text-sm rounded transition-colors"
        >
          Copy JSON
        </button>
        <button
          onClick={() => {
            const blob = new Blob([json], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `f09_config_${Date.now()}.json`;
            a.click();
            URL.revokeObjectURL(url);
          }}
          className="flex-1 py-2 px-4 bg-[#c9a84c] hover:bg-[#dbb85e] text-black text-sm font-semibold rounded transition-colors"
        >
          Download .json
        </button>
      </div>
    </div>
  );
}

/* ── Main App ─────────────────────────────────────────── */
export default function App() {
  const [params, setParams] = useState({ ...DEFAULTS });
  const [activePreset, setActivePreset] = useState('beauty');
  const [previewUrl, setPreviewUrl] = useState(null);
  const [loading, setLoading] = useState(false);
  const [frameFile, setFrameFile] = useState(null);
  const originalUrlRef = useRef(null);
  const canvasRef = useRef(null);
  const imgRef = useRef(null);

  const runProcessing = useCallback((img, p) => {
    if (!img) return;
    setLoading(true);
    setTimeout(() => {
      const canvas = canvasRef.current || document.createElement('canvas');
      if (!canvasRef.current) canvasRef.current = canvas;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      try {
        const result = processImage(canvas, ctx, img, p);
        setPreviewUrl(result);
      } catch (e) {
        console.error('Processing error:', e);
        setPreviewUrl(null);
      } finally {
        setLoading(false);
      }
    }, 20);
  }, []);

  useEffect(() => {
    if (!frameFile) return;
    const url = URL.createObjectURL(frameFile);
    originalUrlRef.current = url;
    const img = new Image();
    img.onload = () => {
      imgRef.current = img;
      runProcessing(img, params);
    };
    img.src = url;
  }, [frameFile]);

  useEffect(() => {
    if (imgRef.current) {
      runProcessing(imgRef.current, params);
    }
  }, [params, runProcessing]);

  const handleChange = useCallback((key, value) => {
    setParams((prev) => ({ ...prev, [key]: value }));
    setActivePreset(null);
  }, []);

  const handleGlowMode = useCallback((mode) => {
    setParams((prev) => ({ ...prev, glowMode: mode }));
    setActivePreset(null);
  }, []);

  const handlePreset = useCallback((key) => {
    const p = PRESETS[key];
    setParams({ ...p });
    setActivePreset(key);
  }, []);

  const handleFrameUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      setFrameFile(file);
      setPreviewUrl(null);
    }
  };

  const originalUrl = frameFile ? originalUrlRef.current || URL.createObjectURL(frameFile) : null;

  return (
    <div className="min-h-screen bg-[#0a0a0a]">
      <header className="border-b border-[#222] px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold tracking-wide">
              <span className="text-[#c9a84c]">F09</span> AETHER COMPOSITUM
            </h1>
            <p className="text-xs text-[#666] mt-0.5">
              Preview v2.2 — Restore + AE Style (Exposure/Vibrance/Vignette) + 5 Glow Modes
            </p>
          </div>
          <div className="text-xs text-[#444]">
            100% Browser &bull; Zero cost
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-6 py-6">
        <div className="grid grid-cols-12 gap-6">
          {/* Left: Controls */}
          <div className="col-span-4 space-y-4">
            {/* Frame Upload */}
            <div className="bg-[#161616] border border-[#222] rounded-lg p-4">
              <h3 className="text-xs font-semibold tracking-wider uppercase text-[#888] mb-3">
                Source Frame
              </h3>
              <label className="block w-full py-5 border-2 border-dashed border-[#333] hover:border-[#c9a84c] rounded-lg text-center cursor-pointer transition-colors">
                <input type="file" accept="image/*" onChange={handleFrameUpload} className="hidden" />
                {frameFile ? (
                  <span className="text-sm text-[#c9a84c]">{frameFile.name}</span>
                ) : (
                  <span className="text-sm text-[#666]">Click to upload frame</span>
                )}
              </label>
            </div>

            {/* Presets */}
            <div className="bg-[#161616] border border-[#222] rounded-lg p-4">
              <h3 className="text-xs font-semibold tracking-wider uppercase text-[#888] mb-3">
                Presets
              </h3>
              <PresetBar active={activePreset} onSelect={handlePreset} />
            </div>

            {/* Glow Mode Selector */}
            <div className="bg-[#161616] border border-[#222] rounded-lg p-4">
              <GlowModeSelector active={params.glowMode || 'classic'} onChange={handleGlowMode} />
            </div>

            {/* Sections */}
            {Object.entries(SECTIONS).map(([key, section], i) => (
              <Section
                key={key}
                sectionKey={key}
                section={section}
                values={params}
                onChange={handleChange}
                defaultOpen={i === 1}
              />
            ))}

            {loading && (
              <div className="w-full py-3 bg-[#222] text-[#c9a84c] font-bold rounded-lg text-center tracking-wider uppercase text-sm animate-pulse">
                Processing...
              </div>
            )}

            {/* Export */}
            <ExportPanel params={params} />
          </div>

          {/* Right: Preview */}
          <div className="col-span-8">
            <div className="bg-[#161616] border border-[#222] rounded-lg p-4">
              <h3 className="text-xs font-semibold tracking-wider uppercase text-[#888] mb-4">
                Preview Comparison
              </h3>
              {!frameFile ? (
                <div className="aspect-video bg-[#0a0a0a] rounded-lg flex items-center justify-center border border-dashed border-[#222]">
                  <div className="text-center">
                    <div className="text-4xl mb-3 opacity-30">{'\u2726'}</div>
                    <p className="text-sm text-[#444]">Upload a frame to start previewing</p>
                  </div>
                </div>
              ) : (
                <div className="flex gap-4">
                  <div className="w-1/4 flex-shrink-0">
                    <div className="text-[10px] text-[#666] mb-1 text-center uppercase tracking-wider">Original</div>
                    <img src={originalUrl} alt="Original" className="w-full rounded-lg border border-[#222]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs text-[#c9a84c] mb-1 text-center uppercase tracking-wider font-semibold">
                      {loading ? 'Processing...' : 'Preview'}
                    </div>
                    {previewUrl ? (
                      <img src={previewUrl} alt="Preview" className="w-full rounded-lg border border-[#c9a84c]/30" />
                    ) : (
                      <div className="aspect-video bg-[#0a0a0a] rounded-lg flex items-center justify-center border border-dashed border-[#222]">
                        <p className="text-sm text-[#444]">Loading...</p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="mt-4 bg-[#161616] border border-[#222] rounded-lg p-4">
              <h3 className="text-xs font-semibold tracking-wider uppercase text-[#888] mb-2">How it works</h3>
              <div className="grid grid-cols-3 gap-4 text-xs text-[#666]">
                <div>
                  <div className="text-[#c9a84c] font-semibold mb-1">1. Upload</div>
                  <code className="text-[10px] text-[#555]">bash scripts/extract_frame.sh video.mp4 4</code>
                </div>
                <div>
                  <div className="text-[#c9a84c] font-semibold mb-1">2. Adjust</div>
                  Restore + Style + Glow Mode — instant preview
                </div>
                <div>
                  <div className="text-[#c9a84c] font-semibold mb-1">3. Export</div>
                  Download JSON, run full pipeline on Modal
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
}
