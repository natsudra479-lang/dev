# LACRIMAE dev6-B — JOURNAL DE CAMPAGNES

Ce journal conserve une ligne par campagne et ne doit jamais remplacer une tentative précédente. Les sorties doivent toujours provenir de la source originale de la campagne.

| Date | Campagne | Source | Profil | Preset | Entrée | Sortie | Statut | Gate critique | Décision |
|---|---|---|---|---|---|---|---|---|---|
| 2026-08-28 | `v2_original_5s_run2` | `rife_input_5s.mp4` | `hdr_imperator` | non défini | 30 FPS / 1920×1080 | 120 FPS / 1920×1080 | SEALED | F08 transparent | Référence v2 à améliorer avec F09 |
| 2026-09-06 | `v2_tiktok4k_test` | `v2_original_5s_run2_final.mp4` | F09 preview v2.2.0 | `tiktok4k` (TikTok 4K) | 120 FPS / 1920×1080 (5 s) | 30 FPS / 720p, 1.1 Mo | OK | Mesures : chroma +43%, lum +12% vs source | Preset AE-parity (sharpen 3.2, exp 0.6, sat 1.45, vib 40, vign 75). Fixes: vibrance direction, contrast pivot adaptatif, glow intensity Python |
| 2026-09-06 | `v2_cleancc_test` | `v2_original_5s_run2_final.mp4` | F09 preview v2.2.0 | `cleanCC` (Clean CC) | 120 FPS / 1920×1080 (5 s) | 30 FPS / 720p, 0.9 Mo | OK | Mesures : chroma +15%, lum +7%, contraste préservé | Preset "correction naturelle" (glow 0, exp 0.35, sat 1.25, vign 50, clarity via detailReveal). Sortie : `output/v2_cleancc_test.mp4` |
| — | — | — | — | — | — | — | PENDING | — | — |

## Règle de comparaison

Une comparaison doit conserver la source, l’intermédiaire RIFE, la sortie restaurée et la sortie finale. Les variantes doivent utiliser le même segment, le même nombre de frames et le même point de départ afin que la différence visuelle soit attribuable au preset ou à la Frégate testée.

## Colonnes minimales à compléter

Chaque nouvelle ligne doit renseigner le hash source, le workspace Modal, les versions de modèles, le profil AUSPEX, le stride facial, les paramètres Motus, le preset F09, la présence audio et les décisions G0 à G9. Une ligne sans ces données reste `NEEDS_REVIEW`.
