import React, { useState, useCallback, useRef, useEffect } from 'react';

/* ── Config ───────────────────────────────────────────── */
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
      { key: 'saturation',       min: 0.0, max: 12.0, step: 0.05, label: 'Saturation',    unit: 'x' },
      { key: 'warmth',           min: 0.5, max: 9.0, step: 0.05, label: 'Warmth',        unit: 'x' },
      { key: 'glowIntensity',    min: 0.0, max: 6.0, step: 0.05, label: 'Glow',          unit: 'x' },
      { key: 'glowWidth',        min: 5,   max: 480,  step: 1,    label: 'Glow Width',    unit: 'px' },
    ],
  },
};

const PRESETS = {
  beauty:  { compressionFix: 30, detailEnhance: 40, detailReveal: 30, denoise: 20, dehalo: 10, sharpenIntensity: 1.5, sharpenWidth: 1.5, edgeThreshold: 20, contrast: 1.1, saturation: 1.08, warmth: 1.0, glowIntensity: 0.35, glowWidth: 30, label: 'Beauty',  icon: '\u2726' },
  demon:   { compressionFix: 50, detailEnhance: 70, detailReveal: 60, denoise: 30, dehalo: 20, sharpenIntensity: 1.8, sharpenWidth: 2.0, edgeThreshold: 15, contrast: 1.3, saturation: 1.4, warmth: 1.1, glowIntensity: 0.6, glowWidth: 50, label: 'Demon',   icon: '\uD83D\uDD25' },
  cinema:  { compressionFix: 20, detailEnhance: 30, detailReveal: 25, denoise: 15, dehalo: 5,  sharpenIntensity: 0.8, sharpenWidth: 1.0, edgeThreshold: 30, contrast: 1.05, saturation: 1.05, warmth: 0.98, glowIntensity: 0.3, glowWidth: 25, label: 'Cinema',  icon: '\uD83C\uDFAC' },
  crunchy: { compressionFix: 40, detailEnhance: 60, detailReveal: 50, denoise: 25, dehalo: 15, sharpenIntensity: 1.5, sharpenWidth: 1.8, edgeThreshold: 18, contrast: 1.15, saturation: 1.1, warmth: 1.02, glowIntensity: 0.4, glowWidth: 35, label: 'Crunchy', icon: '\uD83D\uDC8E' },
  clean:   { compressionFix: 60, detailEnhance: 20, detailReveal: 15, denoise: 40, dehalo: 5,  sharpenIntensity: 0.5, sharpenWidth: 0.8, edgeThreshold: 40, contrast: 1.03, saturation: 1.0, warmth: 1.0, glowIntensity: 0.15, glowWidth: 15, label: 'Clean',   icon: '\u25FB' },
};

const DEFAULTS = PRESETS.beauty;

/* ── Canvas Processing ─────────────────────────────────── */

// Fast box blur — sliding window O(w*h) regardless of radius
function boxBlur(srcData, w, h, radius) {
  const dst = new Uint8ClampedArray(srcData.length);
  const r = Math.max(1, Math.round(radius));
  const tmp = new Uint8ClampedArray(srcData.length);
  const diam = r * 2 + 1;

  // Horizontal pass (sliding window)
  for (let y = 0; y < h; y++) {
    let rS = 0, gS = 0, bS = 0;
    const row = y * w;
    // Init first window
    for (let dx = -r; dx <= r; dx++) {
      const px = Math.min(w - 1, Math.max(0, dx));
      const i = (row + px) * 4;
      rS += srcData[i]; gS += srcData[i+1]; bS += srcData[i+2];
    }
    for (let x = 0; x < w; x++) {
      const i = (row + x) * 4;
      tmp[i] = rS / diam; tmp[i+1] = gS / diam; tmp[i+2] = bS / diam; tmp[i+3] = srcData[i+3];
      // Slide: add right, remove left
      const addX = Math.min(w - 1, x + r + 1);
      const remX = Math.max(0, x - r);
      const ai = (row + addX) * 4;
      const ri = (row + remX) * 4;
      rS += srcData[ai] - srcData[ri];
      gS += srcData[ai+1] - srcData[ri+1];
      bS += srcData[ai+2] - srcData[ri+2];
    }
  }
  // Vertical pass (sliding window)
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
      rS += tmp[ai] - tmp[ri];
      gS += tmp[ai+1] - tmp[ri+1];
      bS += tmp[ai+2] - tmp[ri+2];
    }
  }
  return dst;
}

// Sobel edge magnitude (0-255)
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

function processImage(canvas, ctx, img, p) {
  let w = img.naturalWidth || img.width;
  let h = img.naturalHeight || img.height;

  // Cap at 1024px on longest side for performance
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

  // ═══════════════════════════════════════════════════════
  // TOPAZ RESTORE — simulated via OpenCV-like ops
  // ═══════════════════════════════════════════════════════

  // Denoise: bilateral-like (smooth flat areas, keep edges)
  if (p.denoise > 0) {
    const strength = p.denoise / 100;
    const blurred = boxBlur(d, w, h, Math.round(1 + strength * 3));
    for (let i = 0; i < d.length; i += 4) {
      const mix = strength * 0.4;
      d[i]   = d[i]   * (1-mix) + blurred[i]   * mix;
      d[i+1] = d[i+1] * (1-mix) + blurred[i+1] * mix;
      d[i+2] = d[i+2] * (1-mix) + blurred[i+2] * mix;
    }
  }

  // Compression Fix: subtle local contrast boost (removes block artifacts)
  if (p.compressionFix > 0) {
    const strength = p.compressionFix / 100;
    const blurred = boxBlur(d, w, h, 2);
    for (let i = 0; i < d.length; i += 4) {
      const detail = (d[i] - blurred[i]) * (0.5 + strength * 0.5);
      d[i]   = Math.min(255, Math.max(0, d[i] + detail * 0.3));
      d[i+1] = Math.min(255, Math.max(0, d[i+1] + detail * 0.3));
      d[i+2] = Math.min(255, Math.max(0, d[i+2] + detail * 0.3));
    }
  }

  // Detail Enhance: unsharp mask with wider kernel
  if (p.detailEnhance > 0) {
    const amount = p.detailEnhance / 100 * 0.8;
    const blurred = boxBlur(d, w, h, 3);
    for (let i = 0; i < d.length; i += 4) {
      d[i]   = Math.min(255, Math.max(0, d[i]   + (d[i]   - blurred[i])   * amount));
      d[i+1] = Math.min(255, Math.max(0, d[i+1] + (d[i+1] - blurred[i+1]) * amount));
      d[i+2] = Math.min(255, Math.max(0, d[i+2] + (d[i+2] - blurred[i+2]) * amount));
    }
  }

  // Detail Reveal: high-pass detail boost
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

  // Dehalo: reduce ringing around edges
  if (p.dehalo > 0) {
    const strength = p.dehalo / 100;
    const blurred = boxBlur(d, w, h, 2);
    for (let i = 0; i < d.length; i += 4) {
      const diff = d[i] - blurred[i];
      if (Math.abs(diff) > 40) {
        const reduce = strength * 0.15;
        d[i]   = Math.min(255, Math.max(0, d[i] - diff * reduce));
        d[i+1] = Math.min(255, Math.max(0, d[i+1] - diff * reduce));
        d[i+2] = Math.min(255, Math.max(0, d[i+2] - diff * reduce));
      }
    }
  }

  // ═══════════════════════════════════════════════════════
  // AE STYLE
  // ═══════════════════════════════════════════════════════

  // Contrast
  if (p.contrast !== 1.0) {
    const c = p.contrast;
    const intercept = 128 * (1 - c);
    for (let i = 0; i < d.length; i += 4) {
      d[i]   = Math.min(255, Math.max(0, d[i] * c + intercept));
      d[i+1] = Math.min(255, Math.max(0, d[i+1] * c + intercept));
      d[i+2] = Math.min(255, Math.max(0, d[i+2] * c + intercept));
    }
  }

  // Saturation
  if (p.saturation !== 1.0) {
    for (let i = 0; i < d.length; i += 4) {
      const gray = 0.2126 * d[i] + 0.7152 * d[i+1] + 0.0722 * d[i+2];
      d[i]   = Math.min(255, Math.max(0, gray + p.saturation * (d[i] - gray)));
      d[i+1] = Math.min(255, Math.max(0, gray + p.saturation * (d[i+1] - gray)));
      d[i+2] = Math.min(255, Math.max(0, gray + p.saturation * (d[i+2] - gray)));
    }
  }

  // Warmth
  if (p.warmth !== 1.0) {
    const shift = (p.warmth - 1.0) * 30;
    for (let i = 0; i < d.length; i += 4) {
      d[i]   = Math.min(255, Math.max(0, d[i] + shift));
      d[i+2] = Math.min(255, Math.max(0, d[i+2] - shift * 0.5));
    }
  }

  ctx.putImageData(imageData, 0, 0);

  // ═══════════════════════════════════════════════════════
  // SHARPEN — Unsharp Mask (edge-aware)
  // ═══════════════════════════════════════════════════════
  if (p.sharpenIntensity > 0) {
    const currentData = ctx.getImageData(0, 0, w, h);
    const cd = currentData.data;
    const radius = Math.max(1, Math.round(p.sharpenWidth));
    const blurred = boxBlur(cd, w, h, radius);
    const amount = (p.sharpenIntensity - 1.0) * 0.5;
    const threshold = p.edgeThreshold;

    // Compute luma for edge-aware sharpening
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

  // ═══════════════════════════════════════════════════════
  // GLOW (screen blend, highlight extraction)
  // ═══════════════════════════════════════════════════════
  if (p.glowIntensity > 0) {
    const glowCanvas = document.createElement('canvas');
    glowCanvas.width = w;
    glowCanvas.height = h;
    const glowCtx = glowCanvas.getContext('2d');
    glowCtx.drawImage(canvas, 0, 0);

    // Extract highlights
    const gd = glowCtx.getImageData(0, 0, w, h);
    const gdata = gd.data;
    for (let i = 0; i < gdata.length; i += 4) {
      const lum = 0.2126 * gdata[i] + 0.7152 * gdata[i+1] + 0.0722 * gdata[i+2];
      if (lum < 160) {
        gdata[i] = gdata[i+1] = gdata[i+2] = 0;
        gdata[i+3] = 0;
      } else {
        gdata[i+3] = Math.min(255, (lum - 160) * 2.5);
      }
    }
    glowCtx.putImageData(gd, 0, 0);

    // Blur highlights
    ctx.filter = `blur(${Math.round(p.glowWidth)}px)`;
    ctx.globalAlpha = p.glowIntensity * 0.5;
    ctx.globalCompositeOperation = 'screen';
    ctx.drawImage(glowCanvas, 0, 0);
    ctx.filter = 'none';
    ctx.globalAlpha = 1.0;
    ctx.globalCompositeOperation = 'source-over';
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

/* ── Section (collapsible) ────────────────────────────── */
function Section({ sectionKey, section, values, onChange, defaultOpen }) {
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
    <div className="flex gap-2 flex-wrap">
      {Object.entries(PRESETS).map(([key, p]) => (
        <button
          key={key}
          className={`px-3 py-1.5 rounded text-xs font-semibold transition-all ${
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
      version: '2.0.0',
      generated: new Date().toISOString(),
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
              Preview v2 — Topaz Restore + AE Style — 14 parameters
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
                  Restore (Topaz) + Style (AE) — instant preview
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
