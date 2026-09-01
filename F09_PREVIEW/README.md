# F09_PREVIEW — AETHER COMPOSITUM

Preview interactif pour F09. Ajuste les paramètres de compositing sur une seule frame, exporte le JSON, puis lance le run complet.

## Fonctionnement

```
Frame (FFmpeg) → Preview UI (React) → Modal (1 frame, $0.001) → Résultat
```

1. Extraire une frame de ta vidéo (en secondes) :
```bash
bash scripts/extract_frame.sh video.mp4 5        # frame à 5s
bash scripts/extract_frame.sh video.mp4 5.25     # frame à 5.25s
bash scripts/extract_frame.sh video.mp4 frame:300 # frame #300 (legacy)
```

2. Lancer le preview UI :
```bash
cd F09_PREVIEW/CODEBASE
npm install
npm run dev
```

3. Dans le navigateur :
   - Upload la frame extraite
   - Bouge les sliders (Sharpen, Contrast, Saturation, Glow, Warmth)
   - Ou choisis un preset (Beauty, Demon, Cinema, Crunchy, Clean)
   - Vois le résultat en side-by-side
   - Exporte le JSON

4. Lance le run complet avec les bonnes valeurs :
```bash
python3 F03_AI/workers/orchestrator.py --preset <config.json>
```

## Paramètres

| Slider | Min | Max | Default | Description |
|---|---|---|---|---|
| Sharpen | 0.0 | 3.0 | 1.5 | Netteté |
| Contrast | 0.5 | 2.0 | 1.1 | Contraste S-curve |
| Saturation | 0.0 | 2.0 | 1.08 | Intensité couleur |
| Glow | 0.0 | 1.0 | 0.35 | Bloom/halation |
| Warmth | 0.5 | 1.5 | 1.0 | Température couleur |

## Presets

| Preset | Sharpen | Contrast | Saturation | Glow | Warmth |
|---|---|---|---|---|---|
| Beauty | 1.5 | 1.1 | 1.08 | 0.35 | 1.0 |
| Demon | 1.8 | 1.3 | 1.4 | 0.6 | 1.1 |
| Cinema | 0.8 | 1.05 | 1.05 | 0.3 | 0.98 |
| Crunchy | 1.5 | 1.15 | 1.1 | 0.4 | 1.02 |
| Clean | 0.5 | 1.03 | 1.0 | 0.15 | 1.0 |

## Coût

- 1 preview (1 frame) : ~$0.001
- 10 itérations : ~$0.01
- Total (10 itérations + 1 run complet) : ~$0.034
