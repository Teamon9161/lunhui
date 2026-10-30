# 绿幕抠图与宫格切分的共用函数。
import numpy as np
from PIL import Image

CELL = 512


def key_green(rgb: np.ndarray) -> np.ndarray:
    """返回 RGBA。按绿色优势度算透明度，并压掉边缘的绿色溢色。"""
    f = rgb.astype(np.float32)
    r, g, b = f[..., 0], f[..., 1], f[..., 2]
    dom = g - np.maximum(r, b)
    # 绿色优势 >= 90 视为背景，<= 25 视为前景，中间线性过渡
    alpha = np.clip((90.0 - dom) / 65.0, 0.0, 1.0)
    # 去溢色：前景里的绿不超过红蓝较大者
    g2 = np.minimum(g, np.maximum(r, b) + 8)
    out = np.dstack([r, g2, b, alpha * 255.0])
    return np.clip(out, 0, 255).astype(np.uint8)


def cells(path: str, count: int, cols: int = 3) -> list[np.ndarray]:
    im = np.asarray(Image.open(path).convert('RGB'))
    rgba = key_green(im)
    out = []
    for i in range(count):
        cx, cy = i % cols, i // cols
        out.append(rgba[cy * CELL:(cy + 1) * CELL, cx * CELL:(cx + 1) * CELL].copy())
    return out


def clean_specks(rgba: np.ndarray, min_area: int = 40) -> np.ndarray:
    """去掉孤立的小色点（抠图残留），保留飘落羽毛等较大的独立部件。"""
    from scipy import ndimage
    mask = rgba[..., 3] > 24
    lab, n = ndimage.label(mask)
    if n == 0:
        return rgba
    areas = ndimage.sum(mask, lab, range(1, n + 1))
    small = np.isin(lab, [i + 1 for i, a in enumerate(areas) if a < min_area])
    rgba = rgba.copy()
    rgba[small, 3] = 0
    rgba[rgba[..., 3] <= 24, 3] = 0
    return rgba


def drop_edge_spill(rgba: np.ndarray, margin: int = 40, max_area: int = 4000) -> np.ndarray:
    """去掉贴近格子边缘的小块独立部件：多半是相邻格子的内容越界画了过来（如掷出的石子）。"""
    from scipy import ndimage
    mask = rgba[..., 3] > 24
    lab, n = ndimage.label(mask)
    h, w = mask.shape
    rgba = rgba.copy()
    for i, sl in enumerate(ndimage.find_objects(lab)):
        ys, xs = sl
        near = xs.start < margin or ys.start < margin or xs.stop > w - margin or ys.stop > h - margin
        if near and int((lab[sl] == i + 1).sum()) < max_area:
            rgba[lab == i + 1, 3] = 0
    return rgba


def bbox(rgba: np.ndarray) -> tuple[int, int, int, int] | None:
    ys, xs = np.nonzero(rgba[..., 3] > 0)
    if len(xs) == 0:
        return None
    return int(xs.min()), int(ys.min()), int(xs.max()) + 1, int(ys.max()) + 1


def feet_x(rgba: np.ndarray, band: int = 50) -> float:
    """脚底带内不透明像素的水平中心，作为身体的水平锚点。"""
    b = bbox(rgba)
    assert b
    y1 = b[3]
    region = rgba[max(0, y1 - band):y1, :, 3] > 128
    xs = np.nonzero(region)[1]
    return float(np.median(xs)) if len(xs) else (b[0] + b[2]) / 2
