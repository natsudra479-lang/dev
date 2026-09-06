# F09_PREVIEW — AETHER COMPOSITUM

Preview interactif pour F09. Ajuste les paramètres de compositing sur une seule frame, exporte le JSON, puis lance le run complet.

**v2.2.0** — Restore + Style AE (avec Exposure / Vibrance / Vignette) + 5 Glow Modes. 100% navigateur, zéro coût.

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
   - Bouge les sliders (RESTORE + STYLE) ou choisis un preset (12 disponibles)
   - Choisis un Glow Mode (Classic, Aurora, Neon, Cosmic, Digital)
   - Vois le résultat en side-by-side
   - Exporte le JSON (il contient TOUT, y compris exposure/vibrance/vignette)

4. Lance le rendu complet avec le JSON exporté — la preview utilise le même moteur :
```bash
python3 F09_PREVIEW/process_video.py input.mp4 output.mp4 "$(cat mon_preset.json)"
# (le 3e argument accepte le contenu JSON de la section style+restore)
```

## Paramètres — RESTORE (Topaz)

| Slider | Min | Max | Description |
|---|---|---|---|
| Compression Fix | 0 | 600 | Réparation des artefacts de compression |
| Detail Enhance | 0 | 600 | Renforcement du détail fin |
| Detail Reveal | 0 | 600 | Révélation du détail masqué (rôle "clarity") |
| Denoise | 0 | 600 | Réduction du bruit |
| Dehalo | 0 | 600 | Suppression des halos |

## Paramètres — STYLE (AE)

| Slider | Min | Max | Description |
|---|---|---|---|
| Sharpen | 0.0 | 18.0 | Unsharp mask (plages ×6 vs version 1) |
| Sharpen Width | 0.5 | 30.0 | Rayon du masque (grand rayon ≈ Unsharp Mask radius 20 d'AE) |
| Edge Threshold | 0 | 600 | Seuil de protection des zones plates |
| Contrast | 0.5 | 12.0 | **Pivot adaptatif** (luminance moyenne de l'image) — préserve les clips sombres |
| Exposure | 0.0 | 1.5 | Exposition AE (`out = in × 2^exp`) |
| Saturation | 0.0 | 12.0 | Intensité couleur globale |
| Vibrance | 0 | 100 | Saturation intelligente (booste les pixels peu saturés, protège les tons chair) |
| Warmth | 0.5 | 9.0 | Température couleur |
| Glow | 0.0 | 6.0 | Bloom multi-échelle (mode-dépendant) |
| Glow Width | 5 | 480 | Rayon du glow |
| Vignette | 0 | 100 | Assombrissement radial (équivalent CC Vignette), appliqué en dernier |

## Presets (12)

| Preset | Look | Points clés |
|---|---|---|
| ✨ Beauty | Doux premium | glow léger, vibrance 10 |
| 🔥 Demon | Agressif sombre | cosmic glow, vignette 15 |
| 🎬 Cinema | Film discret | vignette 25, glow doux |
| 💎 Crunchy | Net et pêchu | neon glow |
| ◻ Clean | Neutre propre | glow minimal |
| 🌌 Aurora | Boréal coloré | aurora glow |
| ⚡ Neon Arc | Halos néon | neon glow fort |
| 🎥 Blockbuster | Ciné chaud | classic glow, exposure 0.1 |
| 🔍 Ultra Sharp | Clarté max, zéro glow | sharpen fort |
| 📱 TikTok 4K | Oversharpen viral | exposure 0.6, saturation 1.45, vibrance 40, vignette 75, glow 0.1 |
| 🎞 Clean CC | Correction naturelle (tuto n°2) | glow 0, exposure 0.35, saturation 1.25, vignette 50, clarity via detailReveal |
| (Beauty par défaut) | | |

## Corrections v2.2.0 (parité preview ↔ rendu)

- **Vibrance** : direction corrigée (booster, pas délaver)
- **Contraste** : pivot adaptatif sur la luminance moyenne — plus d'écrasement des ombres sur clips sombres
- **Glow (rendu Python)** : alphas désormais multipliés par `glowIntensity` (identique à la preview JS)

## Coût

- 1 preview (1 frame) : ~$0.001
- 10 itérations : ~$0.01
- Total (10 itérations + 1 run complet) : ~$0.034
- Rendu local `process_video.py` (30s @ 720p) : ~30 s CPU, gratuit
