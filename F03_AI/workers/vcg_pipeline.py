"""
F03_AI — Étape 2: L-Diffuser Video Color Grading
Source: ICCV 2025 (seunghyuns98/VideoColorGrading)
GPU: A10G | Timeout: 600s
Preset beauty_enhance: subtil, respecte les couleurs naturelles
"""
import modal

app = modal.App("lac-vcg-color-grading")

vcg_image = (
    modal.Image.debian_slim()
    .apt_install("git", "libgl1-mesa-glx", "libglib2.0-0", "wget")
    .pip_install(
        "torch", "torchvision", "torchaudio",
        "opencv-python-headless", "transformers", "numpy",
        "accelerate", "diffusers", "einops", "scipy",
    )
    .run_commands(
        "git clone https://github.com/seunghyuns98/VideoColorGrading.git /app"
    )
)


@app.function(
    image=vcg_image,
    gpu="A10G",
    timeout=600,
    cpu=4.0,
)
def vcg_grade(
    video_bytes: bytes,
    reference_image_bytes: bytes,
    lut_resolution: int = 16,
    temporal_consistency: bool = True,
) -> bytes:
    import sys
    sys.path.append("/app")
    import torch
    import cv2
    import numpy as np
    import os

    device = "cuda" if torch.cuda.is_available() else "cpu"

    input_path = "/tmp/input_vcg.mp4"
    ref_path = "/tmp/reference_vcg.png"
    output_path = "/tmp/output_vcg.mp4"

    with open(input_path, "wb") as f:
        f.write(video_bytes)
    with open(ref_path, "wb") as f:
        f.write(reference_image_bytes)

    cap = cv2.VideoCapture(input_path)
    fps = cap.get(cv2.CAP_PROP_FPS)
    width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    cap.release()

    print(f"[VCG] Input: {width}x{height} @ {fps}fps, {total_frames} frames")

    # ─── Try real VCG pipeline ─────────────────────────────────────
    vcg_success = False
    try:
        from models.vcg_pipeline import VideoColorGradingPipeline
        pipeline = VideoColorGradingPipeline.from_pretrained(
            "seunghyuns98/VCG-Weights",
            torch_dtype=torch.float16,
        ).to(device)
        print("[VCG] L-Diffuser model loaded")
        pipeline(
            video_path=input_path,
            reference_image_path=ref_path,
            output_path=output_path,
            lut_resolution=lut_resolution,
            temporal_consistency=temporal_consistency,
        )
        vcg_success = True
        print("[VCG] L-Diffuser grading applied")
    except Exception as e:
        print(f"[VCG] L-Diffuser failed: {e}")

    # ─── Fallback: beauty_enhance cinematic grade ──────────────────
    if not vcg_success:
        print("[VCG] Using beauty_enhance fallback")

        def beauty_enhance(frame):
            """
            Subtle enhancement: boost saturation +1.05, contrast +1.1.
            Does NOT shift warmth — preserves natural colors.
            """
            # Saturation: gentle +5%
            hsv = cv2.cvtColor(frame, cv2.COLOR_BGR2HSV).astype(np.float32)
            hsv[:, :, 1] = np.clip(hsv[:, :, 1] * 1.05, 0, 255)
            frame = cv2.cvtColor(hsv.astype(np.uint8), cv2.COLOR_HSV2BGR)

            # Contrast: +10%
            frame = cv2.convertScaleAbs(frame, alpha=1.1, beta=0)

            return frame

        cap = cv2.VideoCapture(input_path)
        fourcc = cv2.VideoWriter_fourcc(*"mp4v")
        out = cv2.VideoWriter(output_path, fourcc, fps, (width, height))

        count = 0
        while cap.isOpened():
            ret, frame = cap.read()
            if not ret:
                break
            out.write(beauty_enhance(frame))
            count += 1

        cap.release()
        out.release()
        print(f"[VCG] beauty_enhance applied to {count} frames")

    with open(output_path, "rb") as f:
        output_bytes = f.read()

    for p in [input_path, ref_path, output_path]:
        if os.path.exists(p):
            os.remove(p)

    print(f"[VCG] Done. {len(output_bytes)} bytes")
    return output_bytes
