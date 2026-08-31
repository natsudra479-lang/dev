"""
F09 Preview — Test les 5 presets sur la frame 4s
"""
import modal
import time
import os

# Load frame
frame_path = "F09_PREVIEW/CODEBASE/public/frame.png"
with open(frame_path, "rb") as f:
    frame_bytes = f.read()

print(f"Frame: {len(frame_bytes)} bytes")

# Connect to Modal endpoint
preview_fn = modal.Function.from_name("lac-f09-preview", "preview")

PRESETS = {
    "beauty":    {"sharpen": 1.5, "contrast": 1.1,  "saturation": 1.08, "glow": 0.35, "warmth": 1.0},
    "demon":     {"sharpen": 1.8, "contrast": 1.3,  "saturation": 1.4,  "glow": 0.6,  "warmth": 1.1},
    "cinema":    {"sharpen": 0.8, "contrast": 1.05, "saturation": 1.05, "glow": 0.3,  "warmth": 0.98},
    "crunchy":   {"sharpen": 1.5, "contrast": 1.15, "saturation": 1.1,  "glow": 0.4,  "warmth": 1.02},
    "clean":     {"sharpen": 0.5, "contrast": 1.03, "saturation": 1.0,  "glow": 0.15, "warmth": 1.0},
}

output_dir = "F09_PREVIEW/CODEBASE/public/preview"
os.makedirs(output_dir, exist_ok=True)

# Save original for comparison
with open(f"{output_dir}/original.png", "wb") as f:
    f.write(frame_bytes)

total_start = time.time()

for name, params in PRESETS.items():
    print(f"\n🎨 Testing preset: {name}")
    print(f"   Params: {params}")
    
    start = time.time()
    try:
        result = preview_fn.remote(
            frame=frame_bytes,
            sharpen=params["sharpen"],
            contrast=params["contrast"],
            saturation=params["saturation"],
            glow=params["glow"],
            warmth=params["warmth"],
        )
        elapsed = time.time() - start
        
        out_path = f"{output_dir}/{name}.png"
        with open(out_path, "wb") as f:
            f.write(result)
        
        print(f"   ✅ {name}: {elapsed:.2f}s → {out_path} ({len(result)} bytes)")
    except Exception as e:
        print(f"   ❌ {name}: {e}")

total = time.time() - total_start
print(f"\n{'='*50}")
print(f"Total: {total:.2f}s for {len(PRESETS)} presets")
print(f"Average: {total/len(PRESETS):.2f}s per frame")
print(f"Estimated cost: ~${0.001 * len(PRESETS):.3f}")
