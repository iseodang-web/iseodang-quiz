#!/usr/bin/env python3
"""Vox 스타일 종이 컷아웃 루프 영상 제작기.

frames/ 폴더의 이미지(frame_1~5)를 순서대로 반복 재생하고,
종이 질감 노이즈와 미세한 떨림(boil)을 더해 mp4로 저장한다.

사용 예:
    python make_loop.py --frames frames --out kayak.mp4 --seconds 6
"""
import argparse
import subprocess
import sys
from pathlib import Path

import numpy as np
from PIL import Image


def load_frames(folder: Path, size):
    """frame_1.png ... 순서대로 읽어 같은 크기로 맞춘다 (비율 유지 + 중앙 크롭)."""
    files = sorted(
        [p for p in folder.iterdir() if p.suffix.lower() in (".png", ".jpg", ".jpeg", ".webp")],
        key=lambda p: p.name,
    )
    if not files:
        sys.exit(f"이미지가 없습니다: {folder}")
    frames = []
    for f in files:
        im = Image.open(f).convert("RGB")
        scale = max(size[0] / im.width, size[1] / im.height)
        im = im.resize((round(im.width * scale), round(im.height * scale)), Image.LANCZOS)
        left, top = (im.width - size[0]) // 2, (im.height - size[1]) // 2
        frames.append(im.crop((left, top, left + size[0], top + size[1])))
    print("불러온 프레임:", [f.name for f in files])
    return frames


def paper_grain(size, rng, strength):
    """종이 섬유 느낌의 정적 노이즈(-1~1)를 만든다."""
    w, h = size
    fine = rng.normal(0, 1, (h, w))
    coarse = np.array(
        Image.fromarray(rng.normal(0, 1, (h // 8, w // 8)).astype(np.float32), "F")
        .resize((w, h), Image.BICUBIC)
    )
    return ((fine * 0.6 + coarse * 0.4) * strength)[..., None]


def boil(img: Image.Image, rng, shift, rot):
    """프레임마다 미세하게 이동·회전시켜 손으로 만든 모션 느낌을 준다."""
    dx, dy = rng.uniform(-shift, shift, 2)
    a = rng.uniform(-rot, rot)
    return img.rotate(a, resample=Image.BICUBIC, translate=(dx, dy), fillcolor=img.getpixel((2, 2)))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--frames", default="frames")
    ap.add_argument("--out", default="kayak_loop.mp4")
    ap.add_argument("--size", default="1080x1350", help="출력 해상도 WxH (기본 4:5)")
    ap.add_argument("--fps", type=int, default=24)
    ap.add_argument("--hold", type=int, default=3, help="그림 1장을 몇 프레임 유지할지 (3 = 8장/초, 스톱모션 느낌)")
    ap.add_argument("--seconds", type=float, default=6)
    ap.add_argument("--pingpong", action="store_true", help="1-2-3-4-5-4-3-2 로 왕복 재생")
    ap.add_argument("--shift", type=float, default=3, help="떨림 이동 픽셀")
    ap.add_argument("--rot", type=float, default=0.25, help="떨림 회전 각도")
    ap.add_argument("--grain", type=float, default=7, help="종이 질감 강도")
    ap.add_argument("--seed", type=int, default=7)
    a = ap.parse_args()

    size = tuple(int(v) for v in a.size.lower().split("x"))
    rng = np.random.default_rng(a.seed)
    frames = load_frames(Path(a.frames), size)

    order = list(range(len(frames)))
    if a.pingpong and len(frames) > 2:
        order += order[-2:0:-1]

    grain = paper_grain(size, rng, a.grain)
    total = int(a.seconds * a.fps)

    ff = subprocess.Popen(
        ["ffmpeg", "-y", "-loglevel", "error", "-f", "rawvideo", "-pix_fmt", "rgb24",
         "-s", f"{size[0]}x{size[1]}", "-r", str(a.fps), "-i", "-",
         "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "16", a.out],
        stdin=subprocess.PIPE,
    )
    cur = None
    for i in range(total):
        if i % a.hold == 0:  # 새 그림으로 바뀔 때만 떨림을 새로 계산 → "on threes" 느낌
            idx = order[(i // a.hold) % len(order)]
            cur = boil(frames[idx], rng, a.shift, a.rot)
            arr = np.asarray(cur, dtype=np.float32)
        out = np.clip(arr + grain, 0, 255).astype(np.uint8)
        ff.stdin.write(out.tobytes())
    ff.stdin.close()
    ff.wait()
    print("저장 완료:", a.out)


if __name__ == "__main__":
    main()
