"""
F09 Preview — Test local (sans Modal) des 5 presets sur la frame 4s
"""
import cv2
import numpy as np
import time
import os

# Load frame
frame_path = "F09_PREVIEW/CODEBASE/public/frame.png"
frame = cv2.imread(frame_path)
if frame is None:
    raise FileNotFoundError(f"Frame not found: {frame_path}")

print(f"Frame: {frame.shape[1]}×{frame.shape[0]}, {frame.nbytes} bytes")

PRESETS = {
    "beauty":    {"sharpen": 1.5, "contrast": 1.1,  "saturation": 1.08, "glow": 0.35, "warmth": 1.0},
    "demon":     {"sharpen": 1.8, "contrast": 1.3,  "saturation": 1.4,  "glow": 0.6,  "warmth": 1.1},
    "cinema":    {"sharpen": 0.8, "contrast": 1.05, "saturation": 1.05, "glow": 0.3,  "warmth": 0.98},
    "crunchy":   {"sharpen": 1.5, "contrast": 1.15, "saturation": 1.1,  "glow": 0.4,  "warmth": 1.02},
    "clean":     {"sharpen": 0.5, "contrast": 1.03, "saturation": 1.0,  "glow": 0.15, "warmth": 1.0},
}

def process_frame(frame, sharpen=1.5, contrast=1.1, saturation=1.08, glow=0.35, warmth=1.0):
    """Apply F09 compositing to a single frame."""
    result = frame.astype(np.float32)

    # Layer 1: Contrast (S-curve)
    if contrast != 1.0:
        x = np.linspace(0, 1, 256, dtype=np.float32)
        mid = 0.5
        curve = 1.0 / (1.0 + np.exp(-(x - mid) * (contrast * 8)))
        curve = (curve - curve.min()) / (curve.max() - curve.min() + 1e-7) * 255.0
        for c in range(3):
            idx = np.clip(result[:, :, c], 0, 255).astype(np.int32)
            result[:, :, c] = curve[idx]

    # Layer 2: Saturation
    if saturation != 1.0:
        gray = cv2.cvtColor(result.astype(np.uint8), cv2.COLOR_BGR2GRAY).astype(np.float32)
        gray = np.stack([gray] * 3, axis=-1)
        result = gray + saturation * (result - gray)

    # Layer 3: Warmth
    if warmth != 1.0:
        result[:, :, 2] *= warmth
        result[:, :, 0] *= (2.0 - warmth)

    # Layer 4: Glow
    if glow > 0.01:
        gray_full = cv2.cvtColor(np.clip(result, 0, 255).astype(np.uint8), cv2.COLOR_BGR2GRAY).astype(np.float32)
        highlight_mask = np.clip((gray_full - 180) / 75.0, 0, 1)
        highlight_mask = np.stack([highlight_mask] * 3, axis=-1)
        small_glow = cv2.GaussianBlur(result, (0, 0), sigmaX=15)
        wide_glow = cv2.GaussianBlur(result, (0, 0), sigmaX=60)
        glow_layer = small_glow * 0.6 + wide_glow * 0.4
        result = result + glow_layer * highlight_mask * glow

    # Layer 5: Sharpen
    if sharpen > 0.01:
        blurred = cv2.GaussianBlur(result, (0, 0), sigmaX=2.0)
        result = result + sharpen * (result - blurred)

    return np.clip(result, 0, 255).astype(np.uint8)


output_dir = "F09_PREVIEW/CODEBASE/public/preview"
os.makedirs(output_dir, exist_ok=True)

# Save original
cv2.imwrite(f"{output_dir}/original.png", frame)

total_start = time.time()

for name, params in PRESETS.items():
    print(f"\n🎨 Preset: {name}")
    start = time.time()
    
    result = process_frame(frame, **params)
    elapsed = time.time() - start
    
    out_path = f"{output_dir}/{name}.png"
    cv2.imwrite(out_path, result)
    print(f"   ✅ {elapsed:.3f}s → {out_path}")

total = time.time() - total_start
print(f"\n{'='*50}")
print(f"Total: {total:.3f}s for {len(PRESETS)} presets")
print(f"Average: {total/len(PRESETS):.3f}s per frame")
print(f"\n📁 Results in: {output_dir}/")
print(f"   original.png")
for name in PRESETS:
    print(f"   {name}.png")
