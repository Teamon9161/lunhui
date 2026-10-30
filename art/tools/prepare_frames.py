# 把 Codex 生成的绿幕动作条带处理成运行时图集。
# 用法：python -I art/tools/prepare_frames.py <英雄>
# 读取 art/heroes/<英雄>/frames.json（条带来源、帧数、对齐方式、时序），输出：
#   art/heroes/<英雄>/frames/<动作>/NN.png    处理后的单帧（审阅用）
#   art/heroes/<英雄>/preview.gif             各动作循环预览
#   client/assets/resources/heroes/<英雄>/atlas.png + anims.json   运行时图集与动作表
import json
import os
import sys

import numpy as np
from PIL import Image, ImageDraw

sys.path.insert(0, os.path.dirname(__file__))
from keying import bbox, cells, clean_specks, drop_edge_spill, feet_x  # noqa: E402

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
PAD = 2


def head_x(rgba: np.ndarray) -> float:
    """头部（包围盒上方 28%）不透明像素的水平中心，跑动时用它稳住身体。"""
    b = bbox(rgba)
    assert b
    y0 = b[1]
    y1 = y0 + int((b[3] - b[1]) * 0.28)
    xs = np.nonzero(rgba[y0:y1, :, 3] > 128)[1]
    return float(np.median(xs))


def match_dx(ref: np.ndarray, img: np.ndarray, rng: int = 16) -> int:
    """在 ±rng 像素内找使 img 与 ref 最吻合的水平平移（纵向也搜索，但只返回横向）。
    返回值 d 表示 img 的内容相对 ref 向右偏了 -d。"""
    def lum(a: np.ndarray) -> np.ndarray:
        return a[..., :3].astype(np.float32).mean(2) * (a[..., 3].astype(np.float32) / 255)
    A, B = lum(ref), lum(img)
    best = (float('inf'), 0)
    for dy in range(-6, 7, 2):
        By = np.roll(B, dy, 0)
        for dx in range(-rng, rng + 1):
            e = float(np.abs(A - np.roll(By, dx, 1)).mean())
            if e < best[0]:
                best = (e, dx)
    return best[1]


def gray(rgba: np.ndarray) -> np.ndarray:
    import cv2
    a = rgba[..., 3:4].astype(np.float32) / 255
    rgb = rgba[..., :3].astype(np.float32) * a + 128 * (1 - a)
    return cv2.cvtColor(rgb.astype(np.uint8), cv2.COLOR_RGB2GRAY)


class FaceRef:
    """以基准帧（通常是待机第 1 帧）的脸为模板，测量其他条带里脸的相对大小。
    各条带按脸统一比例，避免某条带画得头大脸圆时，按身高缩放后脸忽大忽小。"""

    def __init__(self, rgba: np.ndarray, target_h: float):
        b = bbox(rgba)
        assert b
        self.base_scale = target_h / (b[3] - b[1])
        top = rgba[b[1]:b[1] + int((b[3] - b[1]) * 0.35)].astype(int)
        skin = (top[..., 3] > 200) & (top[..., 0] > 215) & (top[..., 1] > 180) & (top[..., 2] > 150)
        ys, xs = np.nonzero(skin)
        cy, cx = int(np.median(ys)) + b[1], int(np.median(xs))
        self.tpl = gray(rgba)[cy - 45:cy + 40, cx - 45:cx + 45]

    def factor(self, frames: list[np.ndarray]) -> float:
        """返回把这些帧放大多少倍后脸与模板一样大（取匹配可靠的帧的中位数）。"""
        import cv2
        found = []
        for c in frames:
            g = gray(c)
            best = (-1.0, 1.0)
            for f in np.arange(0.75, 1.41, 0.01):
                gi = cv2.resize(g, None, fx=f, fy=f, interpolation=cv2.INTER_AREA)
                if gi.shape[0] < self.tpl.shape[0] or gi.shape[1] < self.tpl.shape[1]:
                    continue
                r = float(cv2.matchTemplate(gi, self.tpl, cv2.TM_CCOEFF_NORMED).max())
                if r > best[0]:
                    best = (r, float(f))
            found.append(best)
        good = [f for r, f in found if r >= 0.7] or [f for r, f in sorted(found, reverse=True)[:2]]
        return float(np.median(good))


def process_action(base: str, name: str, spec: dict, target_h: float, face: 'FaceRef | None' = None) -> list[dict]:
    """返回该动作的帧：{img, ax, ay}，ax/ay 为锚点（脚底）在帧图内的坐标，ay 从上往下量。"""
    if 'rgbaFrames' in spec:
        # 已抠好的单帧（如 rig_frames.py 由单张定稿图变形生成的帧）
        d = os.path.join(base, spec['rgbaFrames'])
        raw = [np.asarray(Image.open(os.path.join(d, f)).convert('RGBA')) for f in sorted(os.listdir(d)) if f.endswith('.png')]
    else:
        src = os.path.join(base, 'raw', spec['source'])
        raw = [clean_specks(c) for c in cells(src, spec['cells'])]
    if spec.get('dropSpill'):
        raw = [drop_edge_spill(c) for c in raw]
    use = spec.get('use', list(range(len(raw))))
    ref = raw[spec.get('ref', 0)]
    rb = bbox(ref)
    assert rb
    if spec.get('scale'):
        scale = spec['scale']
    elif face and spec.get('scaleBy', 'face') == 'face':
        f = face.factor([raw[i] for i in use])
        scale = face.base_scale * f
        print(f'{name}: 按脸统一比例，系数 {f:.2f}')
    else:
        # 用参考站姿帧的高度统一各条带的绘制比例（脸部匹配不可靠的动作，如倒地）
        scale = target_h / (spec.get('refHeight') or (rb[3] - rb[1]))
    mode = spec.get('anchor', 'cell')
    ref_x = feet_x(ref)
    if mode == 'head':
        heads = [head_x(raw[i]) for i in use]
        offset = float(np.median([feet_x(raw[i]) - h for i, h in zip(use, heads)]))
    frames = []
    for k, i in enumerate(use):
        c = raw[i]
        b = bbox(c)
        assert b, f'{name} 第 {i + 1} 格为空'
        if mode == 'head':
            anchor_x = heads[k] + offset
        elif mode == 'align':
            # 整个人与参考帧做图像对齐，消除逐帧重绘带来的横向漂移；纵向仍按脚底贴地
            anchor_x = ref_x - match_dx(ref, c)
        elif mode == 'center':
            anchor_x = (b[0] + b[2]) / 2
        else:
            anchor_x = ref_x
        # 特效以包围盒中心为锚点，角色以脚底为锚点
        anchor_y = (b[1] + b[3]) / 2 if mode == 'center' else b[3]
        crop = Image.fromarray(c).crop(b)
        w = max(1, round(crop.width * scale))
        h = max(1, round(crop.height * scale))
        img = crop.resize((w, h), Image.LANCZOS)
        frames.append({'img': img, 'ax': (anchor_x - b[0]) * scale, 'ay': (anchor_y - b[1]) * scale})
    return frames


def pack(images: list[Image.Image], width: int = 2048) -> tuple[list[tuple[int, int]], int]:
    """按高度排序的货架打包，返回各图位置和图集高度。"""
    order = sorted(range(len(images)), key=lambda i: -images[i].height)
    pos: list[tuple[int, int]] = [(0, 0)] * len(images)
    x = y = shelf = 0
    for i in order:
        im = images[i]
        if x + im.width + PAD > width:
            x, y, shelf = 0, y + shelf + PAD, 0
        pos[i] = (x, y)
        x += im.width + PAD
        shelf = max(shelf, im.height)
    h = y + shelf
    p2 = 1
    while p2 < h:
        p2 *= 2
    return pos, p2


def preview(base: str, actions: dict[str, list[dict]], durations: dict[str, list[float]], orders: dict[str, list[int]]) -> None:
    names = [n for n in actions if not n.startswith('fx')]
    cw, ch = 260, 250
    sheet_frames = []
    total = 2.4
    step = 1 / 20
    for f in range(int(total / step)):
        t = f * step
        canvas = Image.new('RGBA', (cw * len(names), ch), (58, 52, 46, 255))
        d = ImageDraw.Draw(canvas)
        for col, n in enumerate(names):
            durs = durations[n]
            loop = sum(durs)
            tt = t % (loop + 0.4)
            idx = len(durs) - 1
            acc = 0.0
            for j, du in enumerate(durs):
                acc += du
                if tt < acc:
                    idx = j
                    break
            fr = actions[n][orders[n][idx]]
            ox, oy = col * cw + cw // 2, ch - 24
            d.line((col * cw + 20, oy, col * cw + cw - 20, oy), fill=(110, 100, 90, 255))
            canvas.alpha_composite(fr['img'], (int(ox - fr['ax']), int(oy - fr['ay'])))
            d.text((col * cw + 8, 6), n, fill=(240, 230, 210, 255))
        sheet_frames.append(canvas.convert('RGB'))
    sheet_frames[0].save(os.path.join(base, 'preview.gif'), save_all=True, append_images=sheet_frames[1:], duration=int(step * 1000), loop=0)


def main() -> None:
    hero = sys.argv[1]
    base = os.path.join(ROOT, 'art', 'heroes', hero)
    cfg = json.load(open(os.path.join(base, 'frames.json'), encoding='utf8'))
    actions: dict[str, list[dict]] = {}
    # 脸部基准：frames.json 的 face 指定条带与格子（一般是待机第 1 帧）
    face = None
    if 'face' in cfg:
        fr = cfg['face']
        face = FaceRef(clean_specks(cells(os.path.join(base, 'raw', fr['source']), fr['cell'] + 1)[fr['cell']]), cfg['targetHeight'])
    for name, spec in cfg['actions'].items():
        actions[name] = process_action(base, name, spec, spec.get('targetHeight', cfg['targetHeight']), None if name.startswith('fx') else face)
        out = os.path.join(base, 'frames', name)
        os.makedirs(out, exist_ok=True)
        for old in os.listdir(out):
            os.remove(os.path.join(out, old))
        for i, fr in enumerate(actions[name]):
            fr['img'].save(os.path.join(out, f'{i:02d}.png'))

    flat = [(n, i, fr) for n, frs in actions.items() for i, fr in enumerate(frs)]
    pos, h = pack([fr['img'] for _, _, fr in flat])
    atlas = Image.new('RGBA', (2048, h), (0, 0, 0, 0))
    frames_meta = {}
    for (n, i, fr), (x, y) in zip(flat, pos):
        atlas.alpha_composite(fr['img'], (x, y))
        frames_meta[f'{n}/{i:02d}'] = {
            'x': x, 'y': y, 'w': fr['img'].width, 'h': fr['img'].height,
            'ax': round(fr['ax'], 1), 'ay': round(fr['ay'], 1),
        }
    # 实际用到的宽度按 2 的幂收紧
    used_w = max(x + fr['img'].width for (_, _, fr), (x, _) in zip(flat, pos))
    w2 = 1
    while w2 < used_w:
        w2 *= 2
    atlas = atlas.crop((0, 0, w2, h))
    dest = os.path.join(ROOT, 'client', 'assets', 'resources', 'heroes', hero)
    os.makedirs(dest, exist_ok=True)
    atlas.save(os.path.join(dest, 'atlas.png'), optimize=True)

    anims = {}
    durations: dict[str, list[float]] = {}
    orders: dict[str, list[int]] = {}
    for name, spec in cfg['actions'].items():
        anim = {k: v for k, v in spec.items() if k in ('loop', 'release', 'pre', 'post', 'durations', 'hold', 'blend', 'muzzle')}
        # order 可重排或重复帧（如待机往返播放），默认按条带顺序
        anim['frames'] = [f'{name}/{i:02d}' for i in spec.get('order', range(len(actions[name])))]
        anims[name] = anim
        orders[name] = list(spec.get('order', range(len(actions[name]))))
        durations[name] = spec.get('durations') or [0.1] * len(orders[name])
    meta = {'pixelsPerUnit': cfg['pixelsPerUnit'], 'frames': frames_meta, 'anims': anims}
    with open(os.path.join(dest, 'anims.json'), 'w', encoding='utf8') as f:
        json.dump(meta, f, ensure_ascii=False, indent=1)
    preview(base, actions, durations, orders)
    print(f'图集 {w2}x{h}，{len(flat)} 帧 -> {os.path.relpath(dest, ROOT)}')


main()
