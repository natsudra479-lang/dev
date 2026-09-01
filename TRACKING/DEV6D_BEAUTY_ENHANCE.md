# DEV6-D — Beauty Enhance Pipeline

> Branche dev6-D : Pipeline vidéo beauté complet avec preview UI

## Date : 2026-09-01

## Objectif

Créer un pipeline vidéo beauté complet :
1. Workers Modal pour le traitement GPU (upscale, color grading, interpolation)
2. Preview UI pour l'ajustement paramètres en temps réel (client-side)
3. Configuration centralisée des presets

## Fichiers ajoutés

### F03_AI/ — Workers Modal

| Fichier | Lignes | Rôle |
|---|---|---|
| workers/orchestrator.py | ~200 | Pipeline complet 3 étapes |
| workers/diffbir_pipeline.py | ~150 | Upscale DiffBIR |
| workers/vcg_pipeline.py | ~120 | Color Grading ACES |
| workers/amt_pipeline.py | ~180 | Interpolation RIFE 120fps |
| workers/opencv_style.py | ~100 | Sharpen/crunch local |
| workers/preview_worker.py | ~130 | Preview Modal endpoint |
| workers/config.py | ~50 | Config partagée |
| workers/__init__.py | ~5 | Package init |
| PRESETS/style_presets.json | ~100 | 5 presets (beauty/demon/cinema/crunchy/clean) |

### F09_PREVIEW/ — Preview UI

| Fichier | Lignes | Rôle |
|---|---|---|
| CODEBASE/src/App.jsx | 640 | 14 sliders + Canvas processing |
| CODEBASE/src/main.jsx | 10 | Entry React |
| CODEBASE/src/index.css | 200 | Dark Luxury theme |
| CODEBASE/package.json | 15 | Dependencies |
| CODEBASE/vite.config.js | 15 | Vite config |
| CODEBASE/index.html | 15 | Entry HTML |
| CODEBASE/tailwind.config.js | 10 | Tailwind |
| CODEBASE/postcss.config.js | 5 | PostCSS |

### Scripts / Config

| Fichier | Rôle |
|---|---|
| scripts/extract_frame.sh | Extraction frame par secondes (FFmpeg) |
| CONFIG/atom_ic_preview.json | Bornes sliders + presets |

## Performance

| Métrique | Valeur |
|---|---|
| Pipeline 5s vidéo | ~77s, $0.024 |
| Pipeline 20s vidéo | ~210s, $0.064 |
| Preview 1 frame | ~0.5s, $0 |
| Blur optimisé | O(w×h) sliding window |
| Sharpen | Multi-scale Luma-only |

## Bugs fixés

1. **Math.max spread crash** — `Math.max(...edges)` sur 2M+ pixels écrase la stack → remplacé par boucle for
2. **Box blur lent** — O(w×h×r) → sliding window O(w×h), 10× plus rapide
3. **GitHub Pages cache** — Assets servis en cache → cache busting + nouveaux hashes
4. **Frame pas chargée** — Upload requis → auto-load frame_4s.png par défaut

## Tests réalisés

| Test | Frames | Coût | Résultat |
|---|---|---|---|
| 5s video, beauty preset | 597 | $0.024 | ✅ 1920×1080 120fps |
| 20s video, beauty preset | 2397 | $0.064 | ✅ 1080×1920 120fps |
| 5 presets sur frame 4s | 5 | $0 | ✅ Canvas instantané |
| Preview UI GitHub Pages | — | $0 | ✅ 14 sliders live |
