"""
F09_PREVIEW — Modal Web Endpoint
Reçoit 1 frame (PNG) + 5 paramètres, retourne le frame traité.
Coût: ~$0.001/frame | Latence: ~2s
"""
import modal

app = modal.App("lac-f09-preview")

preview_image = (
    modal.Image.debian_slim()
    .apt_install("libgl1-mesa-glx", "libglib2.0-0")
    .pip_install(
        "opencv-python-headless",
        "numpy",
        "Pillow",
    )
)


@app.function(
    image=preview_image,
    gpu="T4",
    timeout=120,
    cpu=2.0,
)
def process_frame(
    frame_bytes: bytes,
    sharpen: float = 1.5,
    contrast: float = 1.1,
    saturation: float = 1.08,
    glow: float = 0.35,
    warmth: float = 1.0,
) -> bytes:
    """Apply F09 compositing to a single frame and return PNG bytes."""
    import cv2
    import numpy as np
    from PIL import Image
    import io

    # Decode frame
    nparr = np.frombuffer(frame_bytes, np.uint8)
    frame = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
    if frame is None:
        raise ValueError("Could not decode frame")

    result = frame.astype(np.float32)

    # --- Layer 1: Contrast (S-curve) ---
    if contrast != 1.0:
        # Build S-curve
        x = np.linspace(0, 1, 256, dtype=np.float32)
        mid = 0.5
        # Sigmoid-based S-curve
        curve = 1.0 / (1.0 + np.exp(-(x - mid) * (contrast * 8)))
        # Normalize to 0-255
        curve = (curve - curve.min()) / (curve.max() - curve.min() + 1e-7) * 255.0
        # Apply per channel
        for c in range(3):
            idx = np.clip(result[:, :, c], 0, 255).astype(np.int32)
            result[:, :, c] = curve[idx]

    # --- Layer 2: Saturation ---
    if saturation != 1.0:
        gray = cv2.cvtColor(result.astype(np.uint8), cv2.COLOR_BGR2GRAY).astype(np.float32)
        gray = np.stack([gray] * 3, axis=-1)
        result = gray + saturation * (result - gray)

    # --- Layer 3: Warmth ---
    if warmth != 1.0:
        result[:, :, 2] *= warmth       # Red channel
        result[:, :, 0] *= (2.0 - warmth)  # Blue channel (inverse)

    # --- Layer 4: Glow (bloom on highlights) ---
    if glow > 0.01:
        gray_full = cv2.cvtColor(
            np.clip(result, 0, 255).astype(np.uint8), cv2.COLOR_BGR2GRAY
        ).astype(np.float32)
        # Threshold highlights
        highlight_mask = np.clip((gray_full - 180) / 75.0, 0, 1)
        highlight_mask = np.stack([highlight_mask] * 3, axis=-1)

        # Small glow
        small_glow = cv2.GaussianBlur(result, (0, 0), sigmaX=15)
        # Wide glow
        wide_glow = cv2.GaussianBlur(result, (0, 0), sigmaX=60)

        glow_layer = small_glow * 0.6 + wide_glow * 0.4
        result = result + glow_layer * highlight_mask * glow

    # --- Layer 5: Sharpen ---
    if sharpen > 0.01:
        blurred = cv2.GaussianBlur(result, (0, 0), sigmaX=2.0)
        result = result + sharpen * (result - blurred)

    # Clamp and encode
    result = np.clip(result, 0, 255).astype(np.uint8)
    _, buffer = cv2.imencode(".png", result)
    return buffer.tobytes()


@app.function(
    image=preview_image,
    timeout=30,
)
@modal.web_endpoint(method="POST")
def preview(frame: bytes, sharpen: float = 1.5, contrast: float = 1.1,
            saturation: float = 1.08, glow: float = 0.35, warmth: float = 1.0):
    """Web endpoint: POST a frame + params, get back the processed frame."""
    result = process_frame.local(
        frame, sharpen=sharpen, contrast=contrast,
        saturation=saturation, glow=glow, warmth=warmth,
    )
    return modal.Image.from_bytes(result)
