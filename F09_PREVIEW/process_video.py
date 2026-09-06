#!/usr/bin/env python3
"""F09 Preview — Fast server-side video processor"""
import cv2
import json
import numpy as np
import subprocess
import os
import sys
import tempfile
import shutil

# === SETTINGS ===
p = {
    'compressionFix': 15, 'detailEnhance': 50, 'detailReveal': 45,
    'denoise': 5, 'dehalo': 8, 'sharpenIntensity': 2.0, 'sharpenWidth': 1.8,
    'edgeThreshold': 12, 'contrast': 1.15, 'exposure': 0.0, 'saturation': 1.08,
    'vibrance': 0, 'warmth': 1.0, 'glowIntensity': 0.3, 'glowWidth': 62,
    'vignette': 0,
}

def box_blur(src, radius):
    r = max(1, int(round(radius)))
    return cv2.blur(src, (r*2+1, r*2+1))

def process_frame(img):
    h, w = img.shape[:2]
    # Resize to 720p for speed
    scale = 720 / max(h, w)
    if scale < 1:
        img = cv2.resize(img, (int(w*scale), int(h*scale)), interpolation=cv2.INTER_AREA)
    img_f = img.astype(np.float32)

    # Denoise
    if p['denoise'] > 0:
        s = p['denoise'] / 100.0
        bl = box_blur(img, max(1, round(1 + s*3))).astype(np.float32)
        m = s * 0.4
        img_f = img_f*(1-m) + bl*m

    # Compression Fix
    if p['compressionFix'] > 0:
        s = p['compressionFix'] / 100.0
        bl = box_blur(img_f, 2)
        d = (img_f - bl) * (0.5 + s*0.5)
        img_f = np.clip(img_f + d*0.3, 0, 255)

    # Detail Enhance
    if p['detailEnhance'] > 0:
        a = p['detailEnhance'] / 100.0 * 0.8
        bl = box_blur(img_f, 3)
        img_f = np.clip(img_f + (img_f - bl)*a, 0, 255)

    # Detail Reveal
    if p['detailReveal'] > 0:
        a = p['detailReveal'] / 100.0 * 0.6
        bl = box_blur(img_f, 5)
        img_f = np.clip(img_f + (img_f - bl)*a*1.2, 0, 255)

    # Dehalo
    if p['dehalo'] > 0:
        s = p['dehalo'] / 100.0
        bl = box_blur(img_f, 2)
        diff = img_f - bl
        mask = (np.abs(diff) > 40).astype(np.float32)
        img_f = np.clip(img_f - diff * s * 0.15 * mask, 0, 255)

    # Contrast
    if p['contrast'] != 1.0:
        c = p['contrast']
        img_f = np.clip(img_f * c + 128*(1-c), 0, 255)

    # Exposure (AE Brightness) — out = in * 2^exposure
    if p['exposure'] > 0:
        img_f = np.clip(img_f * (2.0 ** p['exposure']), 0, 255)

    # Saturation
    if p['saturation'] != 1.0:
        gray = 0.0722*img_f[:,:,0] + 0.7152*img_f[:,:,1] + 0.2126*img_f[:,:,2]
        g3 = np.stack([gray, gray, gray], axis=-1)
        img_f = np.clip(g3 + p['saturation']*(img_f - g3), 0, 255)

    # Vibrance — boosts low-saturation pixels, protects skin tones
    if p['vibrance'] > 0:
        strength = p['vibrance'] / 100.0
        mx = img_f.max(axis=-1, keepdims=True)
        mn = img_f.min(axis=-1, keepdims=True)
        sat = (mx - mn) / 255.0
        amt = strength * (1 - sat)
        gray = 0.0722*img_f[:,:,0:1] + 0.7152*img_f[:,:,1:2] + 0.2126*img_f[:,:,2:3]
        img_f = np.clip(gray + amt*(img_f - gray), 0, 255)

    # Warmth
    if p['warmth'] != 1.0:
        shift = (p['warmth']-1)*30
        img_f[:,:,2] = np.clip(img_f[:,:,2]+shift, 0, 255)
        img_f[:,:,0] = np.clip(img_f[:,:,0]-shift*0.5, 0, 255)

    img_u8 = np.clip(img_f, 0, 255).astype(np.uint8)

    # Sharpen (fast unsharp mask)
    if p['sharpenIntensity'] > 0:
        radius = max(1, round(p['sharpenWidth']))
        amount = (p['sharpenIntensity'] - 1.0) * 0.5
        th = p['edgeThreshold']
        bl = box_blur(img_u8, radius).astype(np.float32)
        cd = img_u8.astype(np.float32)

        gray_f = 0.0722*img_u8[:,:,0].astype(np.float32) + 0.7152*img_u8[:,:,1].astype(np.float32) + 0.2126*img_u8[:,:,2].astype(np.float32)
        sx = cv2.Sobel(gray_f, cv2.CV_32F, 1, 0, ksize=3)
        sy = cv2.Sobel(gray_f, cv2.CV_32F, 0, 1, ksize=3)
        edges = np.sqrt(sx*sx + sy*sy)
        emax = edges.max() or 1
        en = (edges/emax)*255
        if th > 0:
            emask = np.clip((en - th)/40.0, 0, 1)
        else:
            emask = np.ones_like(en)

        diff = cd - bl
        for c in range(3):
            cd[:,:,c] = np.clip(cd[:,:,c] + diff[:,:,c]*amount*emask, 0, 255)
        img_u8 = cd.astype(np.uint8)

    # Glow Classic (single pass, fast)
    if p['glowIntensity'] > 0:
        bw = max(1, round(p['glowWidth']))
        intensity = p['glowIntensity']
        luma = 0.0722*img_u8[:,:,0].astype(np.float32) + 0.7152*img_u8[:,:,1].astype(np.float32) + 0.2126*img_u8[:,:,2].astype(np.float32)

        # Highlights mask (smoothstep)
        t = np.clip((luma - 120) / 135.0, 0, 1)
        mask1 = t*t*(3 - 2*t)
        c1 = (img_u8.astype(np.float32) * mask1[:,:,np.newaxis]).astype(np.uint8)
        c1b = box_blur(box_blur(box_blur(c1, bw*0.3), bw*0.3), bw*0.3)

        t2 = np.clip((luma - 140) / 115.0, 0, 1)
        mask2 = t2 * t2
        c2 = (img_u8.astype(np.float32) * mask2[:,:,np.newaxis]).astype(np.uint8)
        c2b = box_blur(box_blur(box_blur(c2, bw*0.7), bw*0.7), bw*0.7)

        # Screen blend
        result = img_u8.astype(np.float32)
        for layer, alpha in [(c1b, 0.6), (c2b, 0.35)]:
            lf = layer.astype(np.float32)
            result = 255 - (255-result)*(255 - lf*alpha)/255.0
        img_u8 = np.clip(result, 0, 255).astype(np.uint8)

    # CC Vignette — radial darkening, applied last
    if p['vignette'] > 0:
        strength = p['vignette'] / 100.0
        hh, ww = img_u8.shape[:2]
        cx, cy = ww / 2.0, hh / 2.0
        ys, xs = np.mgrid[0:hh, 0:ww]
        dist = np.sqrt((xs - cx)**2 + (ys - cy)**2) / np.sqrt(cx*cx + cy*cy)
        t = np.clip((dist - 0.35) / 0.65, 0, 1)
        sm = t*t*(3 - 2*t)
        f = (1 - strength * sm)[:,:,np.newaxis]
        img_u8 = np.clip(img_u8.astype(np.float32) * f, 0, 255).astype(np.uint8)

    return img_u8


def main():
    p.update(json.loads(sys.argv[3]) if len(sys.argv) > 3 else {})

    input_video = sys.argv[1] if len(sys.argv) > 1 else 'v2_original_5s_run2_final.mp4'
    output_video = sys.argv[2] if len(sys.argv) > 2 else 'f09_ultrasharp_output.mp4'

    # First downscale to 30fps
    cap = cv2.VideoCapture(input_video)
    fps_in = cap.get(cv2.CAP_PROP_FPS)
    total = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    w = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    h = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    print(f"Input: {w}x{h} @ {fps_in}fps, {total} frames")

    fps_out = 30
    skip = max(1, round(fps_in / fps_out))
    print(f"Output: {fps_out}fps (every {skip} frames), 720p")

    tmpdir = tempfile.mkdtemp(prefix='f09_')
    idx = 0
    written = 0

    while True:
        ret, frame = cap.read()
        if not ret:
            break
        if idx % skip == 0:
            processed = process_frame(frame)
            cv2.imwrite(os.path.join(tmpdir, f'frame_{written:05d}.png'), processed)
            written += 1
            if written % 20 == 0:
                print(f"  {written} frames done...")
        idx += 1

    cap.release()
    print(f"Wrote {written} frames")

    # Extract audio from original
    audio_path = os.path.join(tmpdir, 'audio.aac')
    subprocess.run(['ffmpeg', '-y', '-i', input_video, '-vn', '-acodec', 'copy', audio_path],
                   capture_output=True)

    # Reassemble
    print("Encoding MP4...")
    cmd = ['ffmpeg', '-y',
           '-framerate', str(fps_out),
           '-i', os.path.join(tmpdir, 'frame_%05d.png')]
    if os.path.exists(audio_path):
        cmd += ['-i', audio_path, '-c:a', 'copy', '-map', '0:v', '-map', '1:a', '-shortest']
    cmd += ['-c:v', 'libx264', '-crf', '20', '-preset', 'fast', output_video]
    subprocess.run(cmd, check=True, capture_output=True)

    shutil.rmtree(tmpdir)
    size = os.path.getsize(output_video) / (1024*1024)
    print(f"\nDone! {output_video} ({size:.1f} MB)")


if __name__ == '__main__':
    main()
