# LACRIMAE dev6-B — GATES DE VALIDATION

## Doctrine

Une campagne ne peut pas être déclarée réussie uniquement parce qu’un fichier MP4 a été produit. Chaque gate vérifie une propriété technique et visuelle distincte. Les décisions doivent être enregistrées dans le ledger de campagne.

| Gate | Moment | Vérification | Critère de passage |
|---|---|---|---|
| G0 PORTA | Avant calcul | Source, hash, orientation, résolution, FPS, audio | Métadonnées connues et source originale confirmée |
| G1 AUSPEX | Avant GPU | Analyse pixel et mouvement | Rapport produit, profil justifié |
| G2 MOTUS | Après RIFE | Cadence et structure temporelle | FPS cible atteint, pas de déformation majeure |
| G3 ENHANCE | Après restauration | Denoise, dehalo, détails généraux | Détail accru sans halos excessifs |
| G4 FACIES | Après GFPGAN | Visages, yeux, peau, cheveux | Visage plus lisible sans peau cireuse excessive |
| G5 CHROMA | Après F07 | Contraste, couleur, hautes lumières | Noirs lisibles, couleurs cohérentes, pas de clipping visible |
| G6 TEMPORALIS | Après F08 | Flicker, ghosting, warps, stabilité | Textures et logos stables entre frames |
| G7 AETHER | Après F09 | Preset compositing, couches activées, opacité, FFmpeg filter chain | Preset sélectionné correct, couches actives cohérentes, sortie sans artefact, rapport contient active_layers |
| G8 HUMANUS | Avant livraison | Visionnage réel en mouvement | Résultat supérieur à la source et acceptable face à la cible |
| G9 CUSTOS | Scellement | Hashes, rapports, artefact final | Campagne SEALED et récupérable |

## Mesures minimales

Chaque rapport doit contenir la résolution d’entrée et de sortie, le FPS d’entrée et de sortie, le nombre de frames, la durée, le codec, la présence audio, les hashes, le profil utilisé et les paramètres principaux de restauration.

Pour F05, il faut enregistrer le nombre de visages détectés et le `frame_stride`. Pour F08, il faut enregistrer `temporal_strength`, `motion_blur` et `frame_blend`. Pour F09, il faut enregistrer le nom du preset, les couches activées (`active_layers`), leur opacité, et la chaîne FFmpeg (`ffmpeg_filter_chain`). Les presets disponibles sont : `silver_gray`, `dark`, `warm`, `viral_hdr`, `clean_realistic`. Le schéma complet est dans `CONFIG/atom_ic_compositing.json`.

## Décision humaine

Les métriques automatisées ne remplacent pas le visionnage. Un score élevé de netteté ne valide pas un visage cireux, un halo ou un effet soap opera. Le gate G8 doit être décidé après visionnage de la vidéo en mouvement.

## Politique d’échec

En cas d’échec, la campagne reste `FAILED` ou `NEEDS_REVIEW`. Il ne faut pas écraser la sortie précédente. Une nouvelle tentative reçoit un nouvel identifiant de campagne et référence l’échec initial dans le ledger.
