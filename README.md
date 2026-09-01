# LACRIMAE — Beauty Enhance Pipeline

> **Branche dev6-D** — Pipeline vidéo beauté complet : Upscale → Color Grading → Interpolation 120fps

## Architecture

```
F00_INGEST    → Extraction & ingest vidéo
F01_CANTOR    → Analyse audio/temporelle
F02_VISIO     → Vision par ordinateur
F03_PICTOR    → Composition Remotion
F03_AI        → 🆕 Workers Modal — Pipeline beauté
F03_PREVIEW   → Preview Remotion
F04_SIGNUM    → Signature visuelle
F05_CAMOUFLAGE→ Camouflage/fusion
F06_LUTHER    → Audio final
F09_PREVIEW   → 🆕 Preview UI — 14 sliders, Canvas client-side
```

## F03_AI — Pipeline Beauté Modal

3 workers GPU en série, ~$0.024 pour 5 secondes :

| Worker | App Modal | GPU | Rôle |
|---|---|---|---|
| Upscale | `lac-upscale` | A10G | DiffBIR upscale 2× |
| Color Grading | `lac-vcg` | A10G | LUT ACES + grading |
| Interpolation | `lac-amt` | A10G | RIFE ×4 → 120fps |

### Quick Start

```bash
# Extraire une frame
bash scripts/extract_frame.sh video.mp4 4

# Lancer le pipeline complet
python3 F03_AI/workers/orchestrator.py \
  --input input.mp4 \
  --reference frame.png \
  --output output.mp4 \
  --preset beauty
```

### Presets

| Preset | Sharpen | Contrast | Sat | Glow | Warmth |
|---|---|---|---|---|---|
| Beauty | 1.5 | 1.1 | 1.08 | 0.35 | 1.0 |
| Demon | 1.8 | 1.3 | 1.4 | 0.6 | 1.1 |
| Cinema | 0.8 | 1.05 | 1.05 | 0.3 | 0.98 |
| Crunchy | 1.5 | 1.15 | 1.1 | 0.4 | 1.02 |
| Clean | 0.5 | 1.03 | 1.0 | 0.15 | 1.0 |

## F09_PREVIEW — Preview UI

14 sliders client-side (zéro coût) :

🔧 **RESTORE (Topaz)** — Compression Fix, Detail Enhance, Detail Reveal, Denoise, Dehalo

🎨 **STYLE (AE)** — Sharpen, Sharpen Width, Edge Threshold, Contrast, Saturation, Warmth, Glow, Glow Width

🌐 **Live** : https://natsudra479-lang.github.io/dev/

## Structure

```
LACRIMAE/
├── F03_AI/                  ← Workers Modal (Python)
│   ├── workers/             ← 8 fichiers .py
│   └── PRESETS/             ← JSON presets
├── F09_PREVIEW/             ← Preview UI (React + Vite)
│   └── CODEBASE/
├── CONFIG/
│   ├── atom_ic_compositing.json
│   ├── atom_ic_profiles.json
│   └── atom_ic_preview.json ← Bornes sliders
├── scripts/
│   └── extract_frame.sh     ← Extraction FFmpeg
├── modal/                   ← Config Modal deploy
├── SHARED/                  ← Code partagé
├── TRACKING/                ← Documentation
└── tools/                   ← Utils
```

## Coût

| Action | Coût |
|---|---|
| 1 preview (1 frame, Canvas) | $0 |
| 1 run complet (5s vidéo) | ~$0.024 |
| 1 run complet (20s vidéo) | ~$0.064 |
| 10 itérations via preview | ~$0.01 |
| **Total itération optimisée** | **~$0.034** |

## Stack

- **Backend** : Modal (Python, GPU A10G)
- **Frontend** : React + Vite + Tailwind
- **Processing** : OpenCV, DiffBIR, RIFE, VCG
- **Preview** : Canvas API (client-side, zéro serveur)
