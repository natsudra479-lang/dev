"""
F03_AI — Étape 3: AMT-G Frame Interpolation + OpenCV Crunch
Source: CVPR 2023 (MCG-NKU/AMT)
GPU: A10G | Timeout: 900s
Preset beauty_enhance: oversharpening modéré, saturation légère, glow subtil
"""
import modal
import cv2
import numpy as np

app = modal.App("lac-amt-interpolation")

amt_image = (
    modal.Image.debian_slim()
    .apt_install("git", "libgl1-mesa-glx", "libglib2.0-0", "wget")
    .pip_install(
        "torch", "torchvision", "opencv-python-headless",
        "numpy", "tqdm", "einops", "scipy",
    )
    .run_commands(
        "git clone https://github.com/MCG-NKU/AMT.git /app"
    )
    .run_commands(
        "mkdir -p /app/ckpt && "
        "wget -O /app/ckpt/amt-g.pth "
        "https://huggingface.co/lalala125/AMT/resolve/main/amt-g.pth"
    )
)

# ─── Style presets ──────────────────────────────────────────────────
# beauty_enhance: the "wow" look without destroying natural colors
# sharpen: 1.5 (crunchy details), sat: 1.08 (gentle), glow: 0.35 (subtle bloom)
STYLE_PRESETS = {
    "beauty": {"sharpen_int": 1.5, "sat_boost": 1.08, "glow_int": 0.35, "glow_threshold": 200},
    "default": {"sharpen_int": 1.2, "sat_boost": 1.1, "glow_int": 0.4, "glow_threshold": 205},
    "demon": {"sharpen_int": 1.8, "sat_boost": 1.4, "glow_int": 0.6, "glow_threshold": 190},
    "cinema": {"sharpen_int": 0.8, "sat_boost": 1.05, "glow_int": 0.3, "glow_threshold": 210},
    "crunchy": {"sharpen_int": 1.5, "sat_boost": 1.1, "glow_int": 0.5, "glow_threshold": 195},
}


def _apply_style(frame, style):
    """Apply OpenCV crunchy style to a single BGR frame."""
    sharpen_int = style["sharpen_int"]
    sat_boost = style["sat_boost"]
    glow_int = style["glow_int"]
    glow_threshold = style.get("glow_threshold", 205)

    # 1. Unsharp mask (oversharpening)
    blur = cv2.GaussianBlur(frame, (9, 9), 10.0)
    sharpened = cv2.addWeighted(frame, 1.0 + sharpen_int, blur, -sharpen_int, 0)

    # 2. Saturation boost (HSV)
    hsv = cv2.cvtColor(sharpened, cv2.COLOR_BGR2HSV)
    h, s, v = cv2.split(hsv)
    s = np.clip(s * sat_boost, 0, 255).astype(np.uint8)
    v = np.clip(v * 1.06, 0, 255).astype(np.uint8)
    color_popped = cv2.cvtColor(cv2.merge((h, s, v)), cv2.COLOR_HSV2BGR)

    # 3. Glow (inverse-square multi-layer bloom)
    _, highlights = cv2.threshold(color_popped, glow_threshold, 255, cv2.THRESH_TOZERO)
    glow_small = cv2.GaussianBlur(highlights, (25, 25), 0)
    glow_wide = cv2.GaussianBlur(highlights, (71, 71), 0)
    total_glow = cv2.addWeighted(glow_small, 0.7, glow_wide, 0.3, 0)
    final = cv2.addWeighted(color_popped, 1.0, total_glow, glow_int, 0)

    return final


@app.function(
    image=amt_image,
    gpu="A10G",
    timeout=900,
    cpu=4.0,
)
def amt_interpolate(
    video_bytes: bytes,
    multiplier: int = 4,
    style_preset: str = "beauty",
) -> bytes:
    import sys
    sys.path.append("/app")
    import torch
    import os

    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")

    input_path = "/tmp/input_amt.mp4"
    output_path = "/tmp/output_amt.mp4"

    with open(input_path, "wb") as f:
        f.write(video_bytes)

    cap = cv2.VideoCapture(input_path)
    fps = cap.get(cv2.CAP_PROP_FPS)
    width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    target_fps = int(fps * multiplier)

    print(f"[AMT] Input: {width}x{height} @ {fps}fps → {target_fps}fps (×{multiplier})")
    print(f"[AMT] Style: {style_preset}")

    # ─── Load AMT-G ───────────────────────────────────────────────
    print("[AMT] Loading AMT-G model...")
    try:
        from utils.config import dict2object
        from utils.vfi_utils import build_vfi_model

        model_cfg = dict2object({
            "name": "AMT-G",
            "ckpt": "/app/ckpt/amt-g.pth",
            "flownet": "VGG",
            "corr_radius": 4,
        })
        model = build_vfi_model(model_cfg).to(device)
        model.eval()
        print("[AMT] AMT-G loaded")
    except Exception as e:
        print(f"[AMT] AMT-G load failed: {e}, using linear interp")
        model = None

    style = STYLE_PRESETS.get(style_preset, STYLE_PRESETS["beauty"])

    # ─── Extract frames ───────────────────────────────────────────
    frames = []
    while cap.isOpened():
        ret, frame = cap.read()
        if not ret:
            break
        img_tensor = torch.from_numpy(frame).permute(2, 0, 1).float().to(device) / 255.0
        frames.append(img_tensor)
    cap.release()

    print(f"[AMT] {len(frames)} frames loaded")

    # ─── Interpolation + Style ────────────────────────────────────
    fourcc = cv2.VideoWriter_fourcc(*"mp4v")
    out = cv2.VideoWriter(output_path, fourcc, target_fps, (width, height))

    frame_count = 0
    with torch.no_grad():
        for i in range(len(frames) - 1):
            frame0 = frames[i].unsqueeze(0)
            frame1 = frames[i + 1].unsqueeze(0)

            # Original anchor frame
            orig = (frames[i].permute(1, 2, 0).cpu().numpy() * 255).astype(np.uint8)
            # Tensor from cv2 = BGR, so orig is already BGR — no conversion needed
            out.write(_apply_style(orig, style))
            frame_count += 1

            # Interpolated frames
            for t_step in range(1, multiplier):
                t = t_step / multiplier
                if model is not None:
                    try:
                        interp = model.inference(frame0, frame1, t)
                    except Exception:
                        interp = frame0 * (1 - t) + frame1 * t
                else:
                    interp = frame0 * (1 - t) + frame1 * t

                out_img = (interp.squeeze(0).permute(1, 2, 0).clip(0, 1).cpu().numpy() * 255).astype(np.uint8)
                out.write(_apply_style(out_img, style))
                frame_count += 1

        # Final anchor
        if frames:
            final = (frames[-1].permute(1, 2, 0).cpu().numpy() * 255).astype(np.uint8)
            out.write(_apply_style(final, style))
            frame_count += 1

    out.release()

    with open(output_path, "rb") as f:
        output_bytes = f.read()

    for p in [input_path, output_path]:
        if os.path.exists(p):
            os.remove(p)

    print(f"[AMT] Done. {frame_count} frames @ {target_fps}fps")
    return output_bytes
