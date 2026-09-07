# DOMINUS HYPERFLUIDA — Contrat de frégate universelle

## Objectif

`DOMINUS_HYPERFLUIDA` est l’unique frégate visible par l’utilisateur. Oracle lui transmet une vidéo quelconque ; la frégate conserve la résolution, l’orientation, le ratio et les pistes audio de l’entrée, puis produit une sortie à 120 FPS avec restauration et finition adaptatives.

La 4K n’est pas une obligation du MVP. L’upscale est désactivé par défaut et ne doit être activé que par une option explicite.

## Sous-frégates

| ID | Nom | Responsabilité | Politique MVP |
|---|---|---|---|
| F00 | `PORTA_INGRESSUS` | Hash, métadonnées, validation du conteneur et préparation du workspace | Obligatoire |
| F01 | `AUSPEX_OCULUS` | Scènes, cadence, visages et zones de contenu | Obligatoire progressivement |
| F02 | `MOTUS_RIFE` | Interpolation vers 120 FPS | Obligatoire et protégée |
| F03 | `APOTHECA_RESTAURA` | Débruitage/restauration générale à résolution native | À intégrer |
| F04 | `FORGE_TEXTURA` | Détails de métal, vêtements, végétation, bâtiments et créatures | À intégrer |
| F05 | `LIBRARIUS_FACIES` | Restauration faciale sur masques de visages uniquement | Optionnelle selon F01 |
| F06 | `LUMEN_IGNIS` | Netteté, micro-contraste, contraste, saturation et bloom modéré | À intégrer |
| F07 | `VOX_PERSISTENS` | Remux audio avec FFmpeg ; aucun modèle IA | Intégré à la sortie |
| F10 | `CUSTOS_RESTITUTIO` | Récupération, hash, validation et livraison à Oracle | Obligatoire |

## Invariants de sortie

1. `width`, `height`, orientation et ratio de l’entrée sont conservés par défaut.
2. `target_fps` vaut 120 pour le MVP ; le multiplicateur est calculé depuis le FPS réel de l’entrée.
3. Les changements de plan ne sont jamais interpolés à travers deux scènes distinctes.
4. Le traitement facial est limité aux masques détectés et peut être désactivé si la confiance ou la taille est insuffisante.
5. L’audio est conservé et remuxé après traitement vidéo.
6. Chaque sous-frégate écrit un artefact temporaire, un rapport JSON et un hash ; aucune sortie partielle n’est déclarée finale.
7. L’échec d’un module optionnel ne doit pas détruire la sortie principale ; il doit produire un avertissement et une reprise contrôlée.
8. F04 4K/Real-ESRGAN reste hors du chemin MVP tant que sa performance n’est pas validée.

## Parcours nominal

`F00_PORTA_INGRESSUS → F01_AUSPEX_OCULUS → F02_MOTUS_RIFE → F03_APOTHECA_RESTAURA → F04_FORGE_TEXTURA → F05_LIBRARIUS_FACIES si nécessaire → F06_LUMEN_IGNIS → F07_VOX_PERSISTENS → F10_CUSTOS_RESTITUTIO`.

Oracle demeure le centre de commande : il crée la campagne, suit l’état, relance une sous-frégate isolée et récupère le résultat final. Modal exécute les opérations GPU ; GitHub conserve le code et les manifests.
