# 单张定稿图 + 平滑变形场 → 一组动作帧（类似网格/骨骼动画，离线渲染成逐帧）。
# 所有帧来自同一份像素，头身比例、五官和服饰细节天然一致，适合待机这类幅度小、常驻屏幕的动作。
# 用法：python -I art/tools/rig_frames.py <英雄> <配置名>   （读取 art/heroes/<英雄>/<配置名>.json）
# 输出 art/heroes/<英雄>/rig/<配置名>/NN.png（512×512 已抠图 RGBA），供 prepare_frames.py 的 rgbaFrames 使用。
import json
import math
import os
import sys

import cv2
import numpy as np

sys.path.insert(0, os.path.dirname(__file__))
from keying import CELL, cells, clean_specks  # noqa: E402

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))


def smooth(e0: float, e1: float, v: np.ndarray) -> np.ndarray:
    """e0→e1 之间平滑过渡到 1（e0 > e1 时方向相反）。"""
    t = np.clip((v - e0) / (e1 - e0), 0.0, 1.0)
    return t * t * (3 - 2 * t)


def mask(spec: dict, X: np.ndarray, Y: np.ndarray) -> np.ndarray:
    """矩形 rect: [x0, x1, y0, y1] 或圆 circle: [cx, cy, r]，feather 为边缘渐变宽度。"""
    f = spec.get('feather', 20)
    if 'rect' in spec:
        x0, x1, y0, y1 = spec['rect']
        return smooth(x0 - f, x0, X) * smooth(x1 + f, x1, X) * smooth(y0 - f, y0, Y) * smooth(y1 + f, y1, Y)
    cx, cy, r = spec['circle']
    return smooth(r + f, r, np.hypot(X - cx, Y - cy))


def weight(part: dict, X: np.ndarray, Y: np.ndarray) -> np.ndarray:
    w = np.zeros_like(X)
    for m in part.get('include', []):
        w = np.maximum(w, mask(m, X, Y))
    for m in part.get('exclude', []):
        w *= 1 - mask(m, X, Y)
    return w


def wave(phase: float, lag: float) -> float:
    """0..1 的呼吸曲线，lag 为相位滞后（周期的比例）。"""
    return (1 - math.cos(2 * math.pi * (phase - lag))) / 2


def displacement(cfg: dict, phase: float, X: np.ndarray, Y: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
    DX = np.zeros_like(X)
    DY = np.zeros_like(X)
    for part in cfg['parts']:
        w = weight(part, X, Y)
        s = wave(phase, part.get('lag', 0.0))
        # 位移：s 从 0 到 1 时移动 move 像素
        mx, my = part.get('move', [0, 0])
        DX += w * mx * s
        DY += w * my * s
        # 绕支点旋转：角度在 ±rotate/2 之间随呼吸往返
        if part.get('rotate'):
            px, py = part['pivot']
            a = math.radians(part['rotate'] * (s - 0.5))
            rx, ry = X - px, Y - py
            DX += w * (rx * math.cos(a) - ry * math.sin(a) - rx)
            DY += w * (rx * math.sin(a) + ry * math.cos(a) - ry)
    return DX, DY


def main() -> None:
    hero, name = sys.argv[1:3]
    base = os.path.join(ROOT, 'art', 'heroes', hero)
    cfg = json.load(open(os.path.join(base, name + '.json'), encoding='utf8'))
    src = clean_specks(cells(os.path.join(base, 'raw', cfg['source']), cfg['cell'] + 1)[cfg['cell']]).astype(np.float32)
    # 预乘透明度后再采样，避免边缘混入背景色
    pm = src.copy()
    pm[..., :3] *= pm[..., 3:4] / 255
    Y, X = np.mgrid[0:CELL, 0:CELL].astype(np.float32)
    out = os.path.join(base, 'rig', name)
    os.makedirs(out, exist_ok=True)
    for old in os.listdir(out):
        os.remove(os.path.join(out, old))
    n = cfg['frames']
    for i in range(n):
        DX, DY = displacement(cfg, i / n, X, Y)
        # 位移量很小，用 p - D(p) 近似反向映射
        mapx, mapy = X - DX, Y - DY
        warped = cv2.remap(pm, mapx, mapy, interpolation=cv2.INTER_LINEAR, borderMode=cv2.BORDER_CONSTANT, borderValue=0)
        a = warped[..., 3:4]
        rgb = np.where(a > 0, warped[..., :3] * 255 / np.maximum(a, 1e-3), 0)
        img = np.dstack([rgb, a]).clip(0, 255).astype(np.uint8)
        cv2.imwrite(os.path.join(out, f'{i:02d}.png'), cv2.cvtColor(img, cv2.COLOR_RGBA2BGRA))
    print(f'{n} 帧 -> {os.path.relpath(out, ROOT)}')


main()
