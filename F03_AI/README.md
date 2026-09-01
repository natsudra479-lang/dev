# F03_AI — Workers Modal Beauté

Workers GPU Modal pour le pipeline beauté video.

## Architecture

```
orchestrator.py          → Pipeline complet (3 étapes en série)
├── diffbir_pipeline.py  → Upscale DiffBIR (lac-upscale, A10G)
├── vcg_pipeline.py      → Color Grading ACES (lac-vcg, A10G)
├── amt_pipeline.py      → Interpolation RIFE ×4 (lac-amt, A10G)
└── opencv_style.py      → Sharpen/crunch (CPU, local)
```

## Workers

### diffbir_pipeline.py — Upscale
- App Modal : `lac-upscale`
- GPU : A10G
- Input : vidéo 720p
- Output : vidéo 1080p (DiffBIR 2×)
- Environnement : `modal.DiffBiR`

### vcg_pipeline.py — Color Grading
- App Modal : `lac-vcg`
- GPU : A10G
- Input : vidéo + image de référence
- Output : vidéo avec LUT ACES appliqué
- LUT resolution : 16×16×16 (configurable)
- Saturation boost, contrast S-curve, warmth

### amt_pipeline.py — Interpolation 120fps
- App Modal : `lac-amt`
- GPU : A10G
- Input : vidéo 30fps
- Output : vidéo 120fps (RIFE ×4)
- Sharpen multi-scale Luma-only
- Glow (screen blend + highlight extraction)

### opencv_style.py — Sharpen/Crunch
- Traitement local (CPU)
- Unsharp mask avec edge threshold
- Multi-scale sharpen (tiny/small/medium/large)
- Luma-only pour éviter noise couleur

## Usage

```bash
# Pipeline complet
python3 F03_AI/workers/orchestrator.py \
  --input input.mp4 \
  --reference frame.png \
  --output output.mp4 \
  --preset beauty \
  --sr-scale 2 \
  --amt-multiplier 4

# Worker seul (test)
modal deploy F03_AI/workers/vcg_pipeline.py
modal run F03_AI/workers/vcg_pipeline.py --video input.mp4
```

## Presets

| Preset | VCG Sat | VCG Contrast | VCG Warmth | AMT Sharpen | AMT Glow |
|---|---|---|---|---|---|
| beauty | 1.05 | 1.1 | 1.0 | 1.5 | 0.35 |
| demon | 1.4 | 1.3 | 1.1 | 1.8 | 0.6 |
| cinema | 1.05 | 1.05 | 0.98 | 0.8 | 0.3 |
| crunchy | 1.1 | 1.15 | 1.02 | 1.5 | 0.4 |
| clean | 1.0 | 1.03 | 1.0 | 0.5 | 0.15 |

## Preview Worker

`preview_worker.py` expose un endpoint web Modal pour preview 1 frame :
- Input : image + paramètres JSON
- Output : image traitée
- Temps : ~0.3s par frame
- Coût : ~$0.001
