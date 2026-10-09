#!/usr/bin/env python3
"""파이프라인 테스트용 임시 프레임 5장 생성 (힉스필드 이미지가 오기 전용)."""
import math
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw

W, H = 1080, 1350
rng = np.random.default_rng(1)


def torn(points, jag=5, step=12):
    """직선 변을 잘게 쪼개 불규칙하게 흔들어 찢긴 종이 가장자리를 만든다."""
    out = []
    for (x1, y1), (x2, y2) in zip(points, points[1:] + points[:1]):
        n = max(2, int(math.hypot(x2 - x1, y2 - y1) / step))
        for t in np.linspace(0, 1, n, endpoint=False):
            out.append((x1 + (x2 - x1) * t + rng.uniform(-jag, jag),
                        y1 + (y2 - y1) * t + rng.uniform(-jag, jag)))
    return out


def piece(d, pts, color, jag=5):
    p = torn(pts, jag)
    d.polygon([(x + 3, y + 4) for x, y in p], fill=(20, 60, 80))      # 그림자
    d.polygon(p, fill=(245, 242, 235))                               # 종이 흰 단면
    cx = sum(x for x, _ in p) / len(p); cy = sum(y for _, y in p) / len(p)
    d.polygon([(cx + (x - cx) * .985, cy + (y - cy) * .985) for x, y in p], fill=color)


Path("frames").mkdir(exist_ok=True)
for i in range(5):
    im = Image.new("RGB", (W, H), (30, 120, 150))
    d = ImageDraw.Draw(im)
    for k, c in enumerate([(40, 140, 165), (25, 105, 135), (50, 150, 170)]):  # 배경 종이 조각
        y = 250 + k * 420
        piece(d, [(-20, y), (W + 20, y - 40), (W + 20, y + 300), (-20, y + 330)], c, 9)
    swing = math.sin(i / 5 * 2 * math.pi)             # 노 젓는 각도
    piece(d, [(180, 760), (900, 740), (820, 800), (260, 810)], (225, 90, 50))   # 카약
    piece(d, [(470, 540), (610, 540), (620, 760), (460, 760)], (240, 200, 60))  # 몸통
    piece(d, [(500, 450), (580, 450), (590, 535), (490, 535)], (230, 170, 140)) # 머리
    px, py = 540 + swing * 260, 640                    # 노 (좌우로 왕복)
    piece(d, [(px - 340 * 0.9, py - 160 * swing - 10), (px + 340 * 0.9, py + 160 * swing - 10),
              (px + 340 * 0.9, py + 160 * swing + 10), (px - 340 * 0.9, py - 160 * swing + 10)], (90, 60, 40), 2)
    im.save(f"frames/frame_{i + 1}.png")
print("임시 프레임 5장 생성 완료")
