#!/usr/bin/env python3
"""F09 AETHER COMPOSITUM — compositing multicouche headless.

Reproduit la chaîne After Effects (cc release) en FFmpeg :
  tonemap (curves+eq) → sharpen (unsharp×2) → glow (gblur+blend)
  → grade (colorbalance+eq) → finish (unsharp légère).

Les presets sont définis dans CONFIG/atom_ic_compositing.json.
Chaque preset active/désactive des couches et contrôle leur opacité.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import subprocess
import sys
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


def sha256(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()


def load_compositing_config(config_path: Path) -> dict[str, Any]:
    data = json.loads(config_path.read_text(encoding="utf-8"))
    return data["presets"]


def build_curves_filter(params: dict[str, Any]) -> str:
    curves_str = params.get("curves", "0/0 0.5/0.5 1/1")
    return f"curves=master='{curves_str}'"


def build_eq_filter(params: dict[str, Any]) -> str:
    parts = []
    parts.append(f"brightness={params.get('brightness', 0.0)}")
    parts.append(f"contrast={params.get('contrast', 1.0)}")
    parts.append(f"saturation={params.get('saturation', 1.0)}")
    gamma = params.get("gamma", 1.0)
    if gamma != 1.0:
        parts.append(f"gamma={gamma}")
    return "eq=" + ":".join(parts)


def build_sharpen_filter(params: dict[str, Any]) -> str:
    pass1 = params.get("pass1_luma", "5:5:0.8")
    pass2 = params.get("pass2_luma", None)
    lx, ly, la = pass1.split(":")
    result = f"unsharp={lx}:{ly}:{la}"
    if pass2:
        px, py, pa = pass2.split(":")
        result += f",unsharp={px}:{py}:{pa}"
    return result


def build_glow_complex_filter(params: dict[str, Any]) -> str:
    """Glow via split → gblur → blend screen."""
    sigma = params.get("sigma", 15)
    blend_opacity = params.get("blend_opacity", 0.2)
    return (
        f"split[main][glow_src];"
        f"[glow_src]gblur=sigma={sigma}[blurred];"
        f"[main][blurred]blend=all_mode=screen:all_opacity={blend_opacity}"
    )


def build_grade_filter(params: dict[str, Any]) -> str:
    cr = params.get("cyan_red", 0.0)
    mg = params.get("magenta_green", 0.0)
    yb = params.get("yellow_blue", 0.0)
    sat = params.get("saturation", 1.0)
    gamma = params.get("gamma", 1.0)
    cb = f"colorbalance=rs={cr}:gs={mg}:bs={yb}"
    eq_parts = [f"saturation={sat}"]
    if gamma != 1.0:
        eq_parts.append(f"gamma={gamma}")
    return f"{cb},eq={':'.join(eq_parts)}"


def build_finish_filter(params: dict[str, Any]) -> str:
    luma = params.get("luma", "3:3:0.3")
    lx, ly, la = luma.split(":")
    return f"unsharp={lx}:{ly}:{la}"


def build_ffmpeg_vf(preset: dict[str, Any]) -> str:
    """Construit la chaîne -vf complète. Gère le glow (split/blend) séparément."""
    glow_enabled = preset.get("glow", {}).get("enabled", False)
    glow_opacity = preset.get("glow", {}).get("blend_opacity", 0.0)

    # Couches non-glow
    parts: list[str] = []

    tonemap = preset.get("tonemap", {})
    if tonemap.get("enabled", False):
        parts.append(build_curves_filter(tonemap))
        parts.append(build_eq_filter(tonemap))

    sharpen = preset.get("sharpen", {})
    if sharpen.get("enabled", False):
        parts.append(build_sharpen_filter(sharpen))

    grade = preset.get("grade", {})
    if grade.get("enabled", False):
        parts.append(build_grade_filter(grade))

    finish = preset.get("finish", {})
    if finish.get("enabled", False):
        parts.append(build_finish_filter(finish))

    # Glow : nécessite une拓撲 differente (split/blend)
    if glow_enabled and glow_opacity > 0:
        # Construire : [0:v] → filters_pre_glow → split → gblur → blend
        pre_glow = ",".join(parts) if parts else "null"
        glow_chain = build_glow_complex_filter(preset["glow"])
        # La拓撲 FFmpeg : [0:v]f1,f2,split[main][glow];[glow]gblur[b];[main][b]blend
        return f"[0:v]{pre_glow},{glow_chain}"

    return ",".join(parts) if parts else "null"


def run_ffmpeg_compositing(
    input_path: Path,
    output_path: Path,
    preset_name: str,
    preset_config: dict[str, Any],
) -> dict[str, Any]:
    layers = preset_config.get("layers", preset_config)
    vf = build_ffmpeg_vf(layers)

    command = [
        "ffmpeg", "-y",
        "-i", str(input_path),
        "-vf", vf,
        "-c:v", "libx264", "-crf", "18", "-preset", "slow",
        "-profile:v", "high", "-pix_fmt", "yuv420p",
        "-an",
        str(output_path),
    ]

    started = time.monotonic()
    result = subprocess.run(command, capture_output=True, text=True)
    elapsed = round(time.monotonic() - started, 3)

    if result.returncode != 0:
        return {
            "status": "FAILED",
            "preset": preset_name,
            "error": result.stderr[-2000:] if result.stderr else "unknown",
            "ffmpeg_command": " ".join(command),
            "ffmpeg_filter_chain": vf,
            "elapsed_seconds": elapsed,
        }

    output_hash = sha256(output_path) if output_path.exists() else None
    input_hash = sha256(input_path)

    active_layers = []
    for name in ["tonemap", "sharpen", "glow", "grade", "finish"]:
        layer = layers.get(name, {})
        if layer.get("enabled", False):
            active_layers.append({"name": name, "opacity": layer.get("opacity", 1.0)})

    return {
        "status": "SUCCEEDED",
        "preset": preset_name,
        "input_path": str(input_path.resolve()),
        "input_sha256": input_hash,
        "output_path": str(output_path.resolve()),
        "output_sha256": output_hash,
        "ffmpeg_filter_chain": vf,
        "active_layers": active_layers,
        "elapsed_seconds": elapsed,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }


def main() -> int:
    parser = argparse.ArgumentParser(description="F09 AETHER COMPOSITUM")
    parser.add_argument("--stage", default="F09_AETHER_COMPOSITUM")
    parser.add_argument("--input", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--report", type=Path, required=True)
    parser.add_argument("--preset", default="clean_realistic",
                        choices=["silver_gray", "dark", "warm", "viral_hdr", "clean_realistic"])
    parser.add_argument("--config", type=Path,
                        default=Path(__file__).resolve().parents[2] / "CONFIG" / "atom_ic_compositing.json")
    parser.add_argument("--mode", choices=["apply", "contract"], default="apply")
    args = parser.parse_args()

    if not args.input.is_file():
        print(f"F09 input absente: {args.input}", file=sys.stderr)
        return 1

    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.report.parent.mkdir(parents=True, exist_ok=True)

    if args.mode == "contract":
        input_hash = sha256(args.input)
        report = {
            "stage": args.stage, "status": "SUCCEEDED", "mode": "contract",
            "preset": args.preset, "input_path": str(args.input.resolve()),
            "input_sha256": input_hash, "output_path": str(args.output.resolve()),
            "output_sha256": None, "active_layers": [], "elapsed_seconds": 0.0,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "warnings": ["contract_only_no_compositing"],
        }
        args.report.write_text(json.dumps(report, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
        print(json.dumps(report, ensure_ascii=False))
        return 0

    presets = load_compositing_config(args.config)
    if args.preset not in presets:
        print(f"F09 preset inconnu: {args.preset}", file=sys.stderr)
        print(f"Disponibles: {', '.join(presets.keys())}", file=sys.stderr)
        return 1

    report = run_ffmpeg_compositing(args.input, args.output, args.preset, presets[args.preset])
    args.report.write_text(json.dumps(report, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(json.dumps(report, ensure_ascii=False))
    return 0 if report["status"] == "SUCCEEDED" else 1


if __name__ == "__main__":
    raise SystemExit(main())
