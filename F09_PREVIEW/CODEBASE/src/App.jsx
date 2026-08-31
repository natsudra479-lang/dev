import React, { useState, useCallback, useRef, useEffect } from 'react';

/* ── Config ───────────────────────────────────────────── */
const SLIDERS = [
  { key: 'sharpen',    min: 0.0, max: 3.0, step: 0.05, label: 'Sharpen',    unit: 'x' },
  { key: 'contrast',   min: 0.5, max: 2.0, step: 0.05, label: 'Contrast',   unit: 'x' },
  { key: 'saturation', min: 0.0, max: 2.0, step: 0.05, label: 'Saturation', unit: 'x' },
  { key: 'glow',       min: 0.0, max: 1.0, step: 0.05, label: 'Glow',       unit: 'x' },
  { key: 'warmth',     min: 0.5, max: 1.5, step: 0.05, label: 'Warmth',     unit: 'x' },
];

const PRESETS = {
  beauty:    { sharpen: 1.5, contrast: 1.1,  saturation: 1.08, glow: 0.35, warmth: 1.0,  label: 'Beauty',    icon: '\u2726' },
  demon:     { sharpen: 1.8, contrast: 1.3,  saturation: 1.4,  glow: 0.6,  warmth: 1.1,  label: 'Demon',     icon: '\uD83D\uDD25' },
  cinema:    { sharpen: 0.8, contrast: 1.05, saturation: 1.05, glow: 0.3,  warmth: 0.98, label: 'Cinema',    icon: '\uD83C\uDFAC' },
  crunchy:   { sharpen: 1.5, contrast: 1.15, saturation: 1.1,  glow: 0.4,  warmth: 1.02, label: 'Crunchy',   icon: '\uD83D\uDC8E' },
  clean:     { sharpen: 0.5, contrast: 1.03, saturation: 1.0,  glow: 0.15, warmth: 1.0,  label: 'Clean',     icon: '\u25FB' },
};

const DEFAULTS = { sharpen: 1.5, contrast: 1.1, saturation: 1.08, glow: 0.35, warmth: 1.0 };

/* ── Canvas Image Processing ──────────────────────────── */
function processImage(canvas, ctx, img, params) {
  const w = img.naturalWidth || img.width;
  const h = img.naturalHeight || img.height;

  canvas.width = w;
  canvas.height = h;
  ctx.drawImage(img, 0, 0, w, h);

  let imageData = ctx.getImageData(0, 0, w, h);
  let data = imageData.data;

  // 1. CONTRAST + BRIGHTNESS
  const contrast = params.contrast;
  const intercept = 128 * (1 - contrast);
  if (contrast !== 1.0) {
    for (let i = 0; i < data.length; i += 4) {
      data[i]     = Math.min(255, Math.max(0, data[i] * contrast + intercept));
      data[i + 1] = Math.min(255, Math.max(0, data[i + 1] * contrast + intercept));
      data[i + 2] = Math.min(255, Math.max(0, data[i + 2] * contrast + intercept));
    }
  }

  // 2. SATURATION
  const sat = params.saturation;
  if (sat !== 1.0) {
    for (let i = 0; i < data.length; i += 4) {
      const gray = 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2];
      data[i]     = Math.min(255, Math.max(0, gray + sat * (data[i] - gray)));
      data[i + 1] = Math.min(255, Math.max(0, gray + sat * (data[i + 1] - gray)));
      data[i + 2] = Math.min(255, Math.max(0, gray + sat * (data[i + 2] - gray)));
    }
  }

  // 3. WARMTH (shift reds up, blues down)
  const warmth = params.warmth;
  if (warmth !== 1.0) {
    const shift = (warmth - 1.0) * 30;
    for (let i = 0; i < data.length; i += 4) {
      data[i]     = Math.min(255, Math.max(0, data[i] + shift));         // Red +
      data[i + 2] = Math.min(255, Math.max(0, data[i + 2] - shift * 0.5)); // Blue -
    }
  }

  ctx.putImageData(imageData, 0, 0);

  // 4. GLOW (bloom on highlights)
  if (params.glow > 0) {
    const glowCanvas = document.createElement('canvas');
    glowCanvas.width = w;
    glowCanvas.height = h;
    const glowCtx = glowCanvas.getContext('2d');
    glowCtx.drawImage(canvas, 0, 0);

    // Extract highlights
    const glowData = glowCtx.getImageData(0, 0, w, h);
    const gd = glowData.data;
    for (let i = 0; i < gd.length; i += 4) {
      const lum = 0.2126 * gd[i] + 0.7152 * gd[i + 1] + 0.0722 * gd[i + 2];
      if (lum < 180) {
        gd[i] = gd[i + 1] = gd[i + 2] = 0;
        gd[i + 3] = 0;
      } else {
        gd[i + 3] = Math.min(255, (lum - 180) * 3);
      }
    }
    glowCtx.putImageData(glowData, 0, 0);

    // Blur the highlights
    ctx.filter = `blur(${Math.round(15 + params.glow * 20)}px)`;
    ctx.globalAlpha = params.glow * 0.6;
    ctx.globalCompositeOperation = 'screen';
    ctx.drawImage(glowCanvas, 0, 0);
    ctx.filter = 'none';
    ctx.globalAlpha = 1.0;
    ctx.globalCompositeOperation = 'source-over';
  }

  // 5. SHARPEN (unsharp mask)
  if (params.sharpen > 0) {
    const amount = (params.sharpen - 1.0) * 0.5;
    if (amount > 0) {
      const srcData = ctx.getImageData(0, 0, w, h);
      const src = srcData.data;
      const sharpCanvas = document.createElement('canvas');
      sharpCanvas.width = w;
      sharpCanvas.height = h;
      const sharpCtx = sharpCanvas.getContext('2d');
      sharpCtx.drawImage(canvas, 0, 0);

      const blurCanvas = document.createElement('canvas');
      blurCanvas.width = w;
      blurCanvas.height = h;
      const blurCtx = blurCanvas.getContext('2d');
      blurCtx.filter = 'blur(1px)';
      blurCtx.drawImage(canvas, 0, 0);
      const blurData = blurCtx.getImageData(0, 0, w, h);
      const bd = blurData.data;

      for (let i = 0; i < src.length; i += 4) {
        src[i]     = Math.min(255, Math.max(0, src[i] + (src[i] - bd[i]) * amount));
        src[i + 1] = Math.min(255, Math.max(0, src[i + 1] + (src[i + 1] - bd[i + 1]) * amount));
        src[i + 2] = Math.min(255, Math.max(0, src[i + 2] + (src[i + 2] - bd[i + 2]) * amount));
      }

      ctx.putImageData(srcData, 0, 0);
    }
  }

  return canvas.toDataURL('image/png');
}

/* ── Slider Component ─────────────────────────────────── */
function Slider({ config, value, onChange }) {
  const pct = ((value - config.min) / (config.max - config.min)) * 100;
  return (
    <div className="flex items-center gap-4 group">
      <label className="w-24 text-xs font-semibold tracking-wider uppercase text-[#888] group-hover:text-[#c9a84c] transition-colors">
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
          className="w-full"
          style={{
            background: `linear-gradient(to right, #c9a84c ${pct}%, #333 ${pct}%)`,
          }}
        />
      </div>
      <span className="w-14 text-right text-sm font-mono text-[#c9a84c]">
        {value.toFixed(2)}{config.unit}
      </span>
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
      version: '1.0.0',
      generated: new Date().toISOString(),
      params: { ...params },
    },
  };
  const json = JSON.stringify(config, null, 2);

  return (
    <div className="bg-[#161616] border border-[#222] rounded-lg p-4">
      <h3 className="text-xs font-semibold tracking-wider uppercase text-[#888] mb-3">
        Export Config
      </h3>
      <pre className="text-xs text-[#c9a84c] bg-[#0a0a0a] rounded p-3 overflow-auto max-h-40 mb-3 font-mono">
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

  // Load image when file changes
  useEffect(() => {
    if (!frameFile) return;
    const url = URL.createObjectURL(frameFile);
    originalUrlRef.current = url;

    const img = new Image();
    img.onload = () => {
      imgRef.current = img;
      // Auto-run with current params
      runProcessing(img, params);
    };
    img.src = url;
  }, [frameFile]);

  const runProcessing = useCallback((img, p) => {
    if (!img) return;
    setLoading(true);

    // Use requestAnimationFrame for non-blocking
    requestAnimationFrame(() => {
      const canvas = canvasRef.current || document.createElement('canvas');
      if (!canvasRef.current) canvasRef.current = canvas;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      const result = processImage(canvas, ctx, img, p);
      setPreviewUrl(result);
      setLoading(false);
    });
  }, []);

  // Re-process when params change (if image is loaded)
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
    setParams({
      sharpen: p.sharpen,
      contrast: p.contrast,
      saturation: p.saturation,
      glow: p.glow,
      warmth: p.warmth,
    });
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
      {/* Header */}
      <header className="border-b border-[#222] px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold tracking-wide">
              <span className="text-[#c9a84c]">F09</span> AETHER COMPOSITUM
            </h1>
            <p className="text-xs text-[#666] mt-0.5">
              Preview — Client-side processing, instant results
            </p>
          </div>
          <div className="text-xs text-[#444]">
            100% Browser • Zero cost
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-6 py-6">
        <div className="grid grid-cols-12 gap-6">
          {/* Left: Controls */}
          <div className="col-span-4 space-y-6">
            {/* Frame Upload */}
            <div className="bg-[#161616] border border-[#222] rounded-lg p-4">
              <h3 className="text-xs font-semibold tracking-wider uppercase text-[#888] mb-3">
                Source Frame
              </h3>
              <label className="block w-full py-6 border-2 border-dashed border-[#333] hover:border-[#c9a84c] rounded-lg text-center cursor-pointer transition-colors">
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleFrameUpload}
                  className="hidden"
                />
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

            {/* Sliders */}
            <div className="bg-[#161616] border border-[#222] rounded-lg p-4 space-y-4">
              <h3 className="text-xs font-semibold tracking-wider uppercase text-[#888] mb-1">
                Parameters
              </h3>
              {SLIDERS.map((s) => (
                <Slider
                  key={s.key}
                  config={s}
                  value={params[s.key]}
                  onChange={handleChange}
                />
              ))}
            </div>

            {loading && (
              <div className="w-full py-3 bg-[#222] text-[#c9a84c] font-bold rounded-lg text-center tracking-wider uppercase text-sm animate-pulse">
                Processing...
              </div>
            )}

            {/* Export */}
            <ExportPanel params={params} />
          </div>

          {/* Right: Preview Comparison */}
          <div className="col-span-8">
            <div className="bg-[#161616] border border-[#222] rounded-lg p-4">
              <h3 className="text-xs font-semibold tracking-wider uppercase text-[#888] mb-4">
                Preview Comparison
              </h3>

              {!frameFile ? (
                <div className="aspect-video bg-[#0a0a0a] rounded-lg flex items-center justify-center border border-dashed border-[#222]">
                  <div className="text-center">
                    <div className="text-4xl mb-3 opacity-30">{'\u2726'}</div>
                    <p className="text-sm text-[#444]">
                      Upload a frame to start previewing
                    </p>
                    <p className="text-xs text-[#333] mt-2">
                      Or use: bash scripts/extract_frame.sh video.mp4 4
                    </p>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="text-xs text-[#666] mb-2 text-center uppercase tracking-wider">
                      Original
                    </div>
                    <img
                      src={originalUrl}
                      alt="Original frame"
                      className="w-full rounded-lg border border-[#222]"
                    />
                  </div>
                  <div>
                    <div className="text-xs text-[#666] mb-2 text-center uppercase tracking-wider">
                      {loading ? 'Processing...' : 'Preview'}
                    </div>
                    {previewUrl ? (
                      <img
                        src={previewUrl}
                        alt="Preview frame"
                        className="w-full rounded-lg border border-[#c9a84c]/30"
                      />
                    ) : (
                      <div className="aspect-video bg-[#0a0a0a] rounded-lg flex items-center justify-center border border-dashed border-[#222]">
                        <p className="text-sm text-[#444]">Loading...</p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Info */}
            <div className="mt-4 bg-[#161616] border border-[#222] rounded-lg p-4">
              <h3 className="text-xs font-semibold tracking-wider uppercase text-[#888] mb-2">
                How it works
              </h3>
              <div className="grid grid-cols-3 gap-4 text-xs text-[#666]">
                <div>
                  <div className="text-[#c9a84c] font-semibold mb-1">1. Upload</div>
                  Extract a frame at N seconds:<br />
                  <code className="text-[10px] text-[#555]">bash scripts/extract_frame.sh video.mp4 5</code>
                </div>
                <div>
                  <div className="text-[#c9a84c] font-semibold mb-1">2. Adjust</div>
                  Move sliders or pick a preset. Preview updates instantly in your browser.
                </div>
                <div>
                  <div className="text-[#c9a84c] font-semibold mb-1">3. Export</div>
                  Download the JSON config, then run the full pipeline on Modal with those settings.
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Hidden canvas for processing */}
      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
}
