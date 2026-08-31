import React, { useState, useCallback, useRef } from 'react';

/* ── Config ───────────────────────────────────────────── */
const PREVIEW_ENDPOINT = import.meta.env.VITE_PREVIEW_ENDPOINT || 'http://localhost:8080';

const SLIDERS = [
  { key: 'sharpen',    min: 0.0, max: 3.0, step: 0.05, label: 'Sharpen',    unit: '×' },
  { key: 'contrast',   min: 0.5, max: 2.0, step: 0.05, label: 'Contrast',   unit: '×' },
  { key: 'saturation', min: 0.0, max: 2.0, step: 0.05, label: 'Saturation', unit: '×' },
  { key: 'glow',       min: 0.0, max: 1.0, step: 0.05, label: 'Glow',       unit: '×' },
  { key: 'warmth',     min: 0.5, max: 1.5, step: 0.05, label: 'Warmth',     unit: '×' },
];

const PRESETS = {
  beauty:    { sharpen: 1.5, contrast: 1.1,  saturation: 1.08, glow: 0.35, warmth: 1.0,  label: 'Beauty',    icon: '✦' },
  demon:     { sharpen: 1.8, contrast: 1.3,  saturation: 1.4,  glow: 0.6,  warmth: 1.1,  label: 'Demon',     icon: '🔥' },
  cinema:    { sharpen: 0.8, contrast: 1.05, saturation: 1.05, glow: 0.3,  warmth: 0.98, label: 'Cinema',    icon: '🎬' },
  crunchy:   { sharpen: 1.5, contrast: 1.15, saturation: 1.1,  glow: 0.4,  warmth: 1.02, label: 'Crunchy',   icon: '💎' },
  clean:     { sharpen: 0.5, contrast: 1.03, saturation: 1.0,  glow: 0.15, warmth: 1.0,  label: 'Clean',     icon: '◻' },
};

const DEFAULTS = {
  sharpen: 1.5,
  contrast: 1.1,
  saturation: 1.08,
  glow: 0.35,
  warmth: 1.0,
};

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
      <span className="w-12 text-right text-sm font-mono text-[#c9a84c]">
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
          className={`preset-btn ${active === key ? 'active' : ''}`}
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

  const handleCopy = () => {
    navigator.clipboard.writeText(json);
  };

  const handleDownload = () => {
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `f09_config_${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

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
          onClick={handleCopy}
          className="flex-1 py-2 px-4 bg-[#222] hover:bg-[#333] text-sm rounded transition-colors"
        >
          Copy JSON
        </button>
        <button
          onClick={handleDownload}
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
  const [error, setError] = useState(null);
  const [frameFile, setFrameFile] = useState(null);
  const debounceRef = useRef(null);

  const handleChange = useCallback((key, value) => {
    setParams((prev) => ({ ...prev, [key]: value }));
    setActivePreset(null); // Custom values

    // Debounce preview call (500ms)
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      // preview will be triggered by useEffect or manual button
    }, 500);
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

  const runPreview = async () => {
    if (!frameFile) return;
    setLoading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('frame', frameFile);
      formData.append('sharpen', params.sharpen);
      formData.append('contrast', params.contrast);
      formData.append('saturation', params.saturation);
      formData.append('glow', params.glow);
      formData.append('warmth', params.warmth);

      const res = await fetch(`${PREVIEW_ENDPOINT}/preview`, {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) throw new Error(`Server error: ${res.status}`);

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      setPreviewUrl(url);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const originalUrl = frameFile ? URL.createObjectURL(frameFile) : null;

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
              Preview — Adjust parameters, see results, export config
            </p>
          </div>
          <div className="text-xs text-[#444]">
            Modal T4 GPU • ~$0.001/frame
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-6 py-6">
        <div className="grid grid-cols-12 gap-6">
          {/* ── Left: Controls ── */}
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

            {/* Run Button */}
            <button
              onClick={runPreview}
              disabled={!frameFile || loading}
              className="w-full py-3 bg-[#c9a84c] hover:bg-[#dbb85e] disabled:bg-[#333] disabled:text-[#666] text-black font-bold rounded-lg transition-colors tracking-wider uppercase text-sm"
            >
              {loading ? 'Processing...' : 'Run Preview'}
            </button>

            {error && (
              <div className="bg-red-900/30 border border-red-800 rounded-lg p-3 text-sm text-red-400">
                {error}
              </div>
            )}

            {/* Export */}
            <ExportPanel params={params} />
          </div>

          {/* ── Right: Preview Comparison ── */}
          <div className="col-span-8">
            <div className="bg-[#161616] border border-[#222] rounded-lg p-4">
              <h3 className="text-xs font-semibold tracking-wider uppercase text-[#888] mb-4">
                Preview Comparison
              </h3>

              {!frameFile && !previewUrl ? (
                <div className="aspect-video bg-[#0a0a0a] rounded-lg flex items-center justify-center border border-dashed border-[#222]">
                  <div className="text-center">
                    <div className="text-4xl mb-3 opacity-30">✦</div>
                    <p className="text-sm text-[#444]">
                      Upload a frame to start previewing
                    </p>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-4">
                  {/* Original */}
                  <div>
                    <div className="text-xs text-[#666] mb-2 text-center uppercase tracking-wider">
                      Original
                    </div>
                    {originalUrl && (
                      <img
                        src={originalUrl}
                        alt="Original frame"
                        className="w-full rounded-lg border border-[#222]"
                      />
                    )}
                  </div>
                  {/* Processed */}
                  <div>
                    <div className="text-xs text-[#666] mb-2 text-center uppercase tracking-wider">
                      {loading ? 'Processing...' : 'Preview'}
                    </div>
                    {loading ? (
                      <div className="aspect-video bg-[#0a0a0a] rounded-lg flex items-center justify-center border border-[#c9a84c]/30">
                        <div className="text-center">
                          <div className="animate-pulse text-[#c9a84c] text-2xl mb-2">✦</div>
                          <p className="text-xs text-[#666]">Modal GPU processing...</p>
                        </div>
                      </div>
                    ) : previewUrl ? (
                      <img
                        src={previewUrl}
                        alt="Preview frame"
                        className="w-full rounded-lg border border-[#c9a84c]/30"
                      />
                    ) : (
                      <div className="aspect-video bg-[#0a0a0a] rounded-lg flex items-center justify-center border border-dashed border-[#222]">
                        <p className="text-sm text-[#444]">Click "Run Preview"</p>
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
                  Move sliders or pick a preset. Each change runs the Modal preview worker on1 frame.
                </div>
                <div>
                  <div className="text-[#c9a84c] font-semibold mb-1">3. Export</div>
                  Download the JSON config, then run the full pipeline with those exact settings.
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
