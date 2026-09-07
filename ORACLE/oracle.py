#!/usr/bin/env python3
"""Oracle LACRIMAE dev6.

Le sandbox reste le centre de commande. Ce module ne traite pas la vidéo :
il gère l'état, les contrats et les appels de workers. Le mode simulation
permet de valider la flotte sans consommer de GPU.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import os
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

STAGES = [
    "F00_PORTA_INGRESSUS",
    "F01_AUSPEX_OCULUS",
    "F02_MOTUS_RIFE",
    "F03_APOTHECA_RESTAURA",
    "F04_FORGE_TEXTURA",
    "F05_LIBRARIUS_FACIES",
    "F06_LUMEN_IGNIS",
    "F07_CHROMA_DOMINATUS",
    "F08_TEMPORALIS_CONSISTENTIA",
    "F09_AETHER_COMPOSITUM",
    "F10_CUSTOS_RESTITUTIO",
]

VALID_PROFILES = (
    "auto", "fast", "balanced", "quality_ultimate",
    "cinematic_hyper_detail", "hdr_imperator", "realistic_aurea",
    "old_main_noctis", "viral_imperator",
)

VALID_PRESETS = ("silver_gray", "dark", "warm", "viral_hdr", "clean_realistic")

COMPOSITING_CONFIG = Path(__file__).resolve().parent.parent / "CONFIG" / "atom_ic_compositing.json"


def now() -> str:
    return datetime.now(timezone.utc).isoformat()


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def campaign_dir(root: Path, campaign_id: str) -> Path:
    return root / "campaigns" / campaign_id


def state_path(root: Path, campaign_id: str) -> Path:
    return campaign_dir(root, campaign_id) / "campaign_state.json"


def save_state(path: Path, state: dict[str, Any]) -> None:
    state["updated_at"] = now()
    tmp = path.with_suffix(".json.tmp")
    tmp.write_text(json.dumps(state, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    tmp.replace(path)


def load_state(path: Path) -> dict[str, Any]:
    return json.loads(path.read_text(encoding="utf-8"))


def probe_video(source: Path) -> dict[str, Any]:
    command = [
        "ffprobe", "-v", "error", "-show_entries",
        "stream=index,codec_type,width,height,avg_frame_rate,channels,sample_rate:format=duration",
        "-of", "json", str(source),
    ]
    try:
        raw = subprocess.run(command, check=True, capture_output=True, text=True).stdout
        payload = json.loads(raw)
    except (OSError, subprocess.CalledProcessError, json.JSONDecodeError) as exc:
        raise ValueError(f"impossible de lire les metadonnees video: {exc}") from exc
    streams = payload.get("streams", [])
    video = next((item for item in streams if item.get("codec_type") == "video"), None)
    if not video or not video.get("width") or not video.get("height"):
        raise ValueError("la source ne contient pas de flux video exploitable")
    rate = video.get("avg_frame_rate", "0/0")
    numerator, denominator = (int(value) for value in rate.split("/", 1))
    fps = numerator / denominator if denominator else 0.0
    return {
        "width": int(video["width"]),
        "height": int(video["height"]),
        "fps": round(fps, 6),
        "duration_seconds": float(payload.get("format", {}).get("duration") or 0.0),
        "orientation": "portrait" if video["height"] > video["width"] else "landscape" if video["width"] > video["height"] else "square",
        "audio_streams": sum(1 for item in streams if item.get("codec_type") == "audio"),
    }


def create_campaign(root: Path, campaign_id: str, source: Path, target_fps: int, profile: str, preset: str) -> Path:
    if target_fps != 120:
        raise ValueError("target_fps doit etre 120 pour le MVP")
    if profile not in VALID_PROFILES:
        raise ValueError(f"profil inconnu: {profile}")
    if preset not in VALID_PRESETS:
        raise ValueError(f"preset inconnu: {preset}")
    if not source.is_file():
        raise FileNotFoundError(source)
    metadata = probe_video(source)
    base = campaign_dir(root, campaign_id)
    for stage in STAGES:
        (base / stage).mkdir(parents=True, exist_ok=True)
    state = {
        "campaign_id": campaign_id,
        "status": "CREATED",
        "source": {
            "uri": str(source.resolve()),
            "sha256": sha256_file(source),
            "width": metadata["width"],
            "height": metadata["height"],
            "fps": metadata["fps"],
            "duration_seconds": metadata["duration_seconds"],
            "orientation": metadata["orientation"],
            "audio_streams": metadata["audio_streams"],
            "rotation": 0,
        },
        "target": {
            "width": metadata["width"],
            "height": metadata["height"],
            "fps": target_fps,
            "audio": "preserve",
            "profile": profile,
            "compositing_preset": preset,
        },
        "current_stage": "F00_PORTA_INGRESSUS",
        "completed_stages": [],
        "artifacts": {"source": str(source.resolve())},
        "worker_profile": os.environ.get("LACRIMAE_WORKER", "local_simulation"),
        "model_manifest_version": "v1",
        "created_at": now(),
        "updated_at": now(),
    }
    path = state_path(root, campaign_id)
    save_state(path, state)
    return path


def advance_simulated(root: Path, campaign_id: str) -> dict[str, Any]:
    path = state_path(root, campaign_id)
    state = load_state(path)
    if state["status"] == "SEALED":
        return state
    stage = state["current_stage"]
    index = STAGES.index(stage)
    stage_dir = campaign_dir(root, campaign_id) / stage
    report = {
        "campaign_id": campaign_id,
        "stage": stage,
        "status": "SUCCEEDED",
        "mode": "simulation",
        "input_sha256": state["source"]["sha256"] if index == 0 else None,
        "output_sha256": None,
        "warnings": ["simulation_only_no_video_rendered"],
        "created_at": now(),
    }
    report_path = stage_dir / "stage_report.json"
    report_path.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    state["completed_stages"].append(stage)
    if index + 1 >= len(STAGES):
        state["status"] = "SEALED"
        state["current_stage"] = "SEALED"
    else:
        state["status"] = "RUNNING"
        state["current_stage"] = STAGES[index + 1]
    state["artifacts"][stage] = str(report_path)
    save_state(path, state)
    return state


def show_presets() -> None:
    """Affiche le tableau des presets compositing disponibles."""
    layer_info = {
        "silver_gray": ("Fort", "Fort", "Non", "Gris", "Moyen"),
        "dark": ("S-curve", "Moyen", "Faible", "Ombres", "Leger"),
        "warm": ("Chaud", "Moyen", "Non", "Chair", "Leger"),
        "viral_hdr": ("Fort", "Fort", "Fort", "HDR", "Fort"),
        "clean_realistic": ("Neutre", "Leger", "Non", "Min.", "Non"),
    }

    print()
    print("  F09 AETHER COMPOSITUM - Presets disponibles")
    print("  " + "=" * 58)
    print(f"  {'#':<4} {'Preset':<18} {'Tonemap':<12} {'Sharpen':<9} {'Glow':<9} {'Grade':<8} {'Finish':<8}")
    print("  " + "-" * 58)

    for i, name in enumerate(VALID_PRESETS, 1):
        layers = layer_info.get(name, ("", "", "", "", ""))
        print(f"  {i:<4} {name:<18} {layers[0]:<12} {layers[1]:<9} {layers[2]:<9} {layers[3]:<8} {layers[4]:<8}")

    print("  " + "=" * 58)
    print()
    print("  Usage: oracle.py create --preset <nom_du_preset>")
    print("  Ex:    oracle.py create --preset dark --profile old_main_noctis")
    print()


def main() -> int:
    parser = argparse.ArgumentParser(description="Oracle LACRIMAE dev6")
    sub = parser.add_subparsers(dest="command", required=True)

    create = sub.add_parser("create", help="creer une campagne")
    create.add_argument("--root", default=".")
    create.add_argument("--campaign-id", required=True)
    create.add_argument("--source", type=Path, required=True)
    create.add_argument("--target-fps", type=int, default=120)
    create.add_argument("--profile", default="cinematic_hyper_detail")
    create.add_argument("--preset", default="clean_realistic",
                        choices=list(VALID_PRESETS))

    simulate = sub.add_parser("simulate", help="avancer une frégate sans GPU")
    simulate.add_argument("--root", default=".")
    simulate.add_argument("--campaign-id", required=True)

    sub.add_parser("presets", help="afficher les presets compositing disponibles")

    args = parser.parse_args()

    try:
        if args.command == "create":
            path = create_campaign(
                Path(args.root), args.campaign_id, args.source,
                args.target_fps, args.profile, args.preset,
            )
            print(json.dumps({"status": "CREATED", "state": str(path)}, ensure_ascii=False))
        elif args.command == "simulate":
            state = advance_simulated(Path(args.root), args.campaign_id)
            print(json.dumps({"status": state["status"], "current_stage": state["current_stage"]}, ensure_ascii=False))
        elif args.command == "presets":
            show_presets()
        return 0
    except (ValueError, FileNotFoundError, KeyError, json.JSONDecodeError) as exc:
        print(f"ORACLE_ERROR: {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
