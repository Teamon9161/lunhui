"""把出图的角色表切成单个精灵，写出 art/sprites/*.png 和 art/sprites.js（锚点清单）。

用法：python build_sprites.py            # 切全部已有的表
角色表按透明列的空隙切段；段数多于预期就把最小的段并进相邻段，少于预期就在最窄处再切。
"""
import json, pathlib, sys
from PIL import Image

HERE = pathlib.Path(__file__).parent
RAW, OUT = HERE / "raw", HERE / "sprites"
SHEETS = {
    "heroes": ["wood", "yuan", "phoenix", "monk", "scholar", "altar"],
    "enemies1": ["grunt", "tank", "archer", "mole", "brute", "spiderling"],
    "enemies2": ["guizu", "baigu", "wuchang", "assassin", "tianbing", "lishi", "leibu"],
    "bosses1": ["ox", "wind", "spider", "dog"],
    "bosses2": ["bone", "mengpo", "hei", "bai"],
    "bosses3": ["moli", "juling", "erlang"],
}
RELICS = ["coin", "karma", "soup", "gold", "lamp", "bodhi", "banner",
          "book", "mirror", "charm", "will", "pen", "corpse", "chant",
          "well", "tribul", "incense", "bell", "wheel", "ledger", "barrier",
          "sarira", "ink", "fury", "order", "lock", "sheshen", "wujian"]
MAX_H = 260  # 战斗里最大画到约 100px，详情页约 120px，260 足够 2 倍屏


def alpha_mask(im, th=40):
    return im.getchannel("A").point(lambda v: 255 if v > th else 0)


def segments(mask):
    w, h = mask.size
    px = mask.load()
    occ = [sum(1 for y in range(0, h, 2) if px[x, y]) for x in range(w)]
    segs, start = [], None
    for x, c in enumerate(occ + [0]):
        if c and start is None:
            start = x
        elif not c and start is not None:
            segs.append([start, x]); start = None
    # 合并很近的碎段（烟、发丝）
    merged = []
    for s in segs:
        if merged and s[0] - merged[-1][1] < 6:
            merged[-1][1] = s[1]
        else:
            merged.append(s)
    return merged, occ


def fit(segs, occ, n):
    segs = [s[:] for s in segs]
    mass = lambda s: sum(occ[s[0]:s[1]])
    while len(segs) > n:  # 最小的段并入更近的邻居
        i = min(range(len(segs)), key=lambda k: mass(segs[k]))
        if i == 0: j = 1
        elif i == len(segs) - 1: j = i - 1
        else: j = i - 1 if segs[i][0] - segs[i - 1][1] < segs[i + 1][0] - segs[i][1] else i + 1
        a, b = sorted([i, j]); segs[a] = [segs[a][0], segs[b][1]]; del segs[b]
    while len(segs) < n:  # 最宽的段在中间最稀处再切
        i = max(range(len(segs)), key=lambda k: segs[k][1] - segs[k][0])
        a, b = segs[i]; lo, hi = a + (b - a) // 4, b - (b - a) // 4
        cut = min(range(lo, hi), key=lambda x: occ[x])
        segs[i:i + 1] = [[a, cut], [cut, b]]
    return segs


def save_sprite(im, key, manifest, kind):
    # 去掉出图自带的淡光晕，只留实体和描边的抗锯齿
    im.putalpha(im.getchannel("A").point(lambda v: 0 if v < 40 else v))
    m = alpha_mask(im)
    # 切段时带进来的邻居碎片（隔着空列、质量很小）清掉
    if kind == "unit":
        segs, occ = segments(m)
        total = sum(occ) or 1
        for a, b in segs:
            if sum(occ[a:b]) < total * 0.04:
                im.paste((0, 0, 0, 0), (a, 0, b, im.height))
        m = alpha_mask(im)
    box = m.getbbox()
    if not box:
        print("  empty", key); return
    im = im.crop(box)
    if im.height > MAX_H:
        r = MAX_H / im.height
        im = im.resize((max(1, round(im.width * r)), MAX_H), Image.LANCZOS)
    OUT.mkdir(exist_ok=True)
    im.save(OUT / f"{key}.png", optimize=True)
    a = alpha_mask(im).load(); w, h = im.size
    xs = [x for y in range(h * 2 // 3, h) for x in range(w) if a[x, y]]
    # 头部中心：上半身 12%–45% 高度里最长的一段连续不透明像素（Q版头最宽，武器细）
    best = (0, w / 2)
    for y in range(h * 12 // 100, h * 45 // 100):
        run = 0
        for x in range(w + 1):
            if x < w and a[x, y]: run += 1
            else:
                if run > best[0]: best = (run, x - run / 2)
                run = 0
    hxs = [best[1]]
    manifest[key] = {"src": f"art/sprites/{key}.png", "w": w, "h": h,
                     "cx": round(sum(xs) / len(xs), 1) if xs else w / 2,
                     "hx": hxs[len(hxs) // 2] if hxs else w / 2, "kind": kind}


def main():
    manifest = {}
    for sheet, keys in SHEETS.items():
        f = RAW / f"{sheet}.png"
        if not f.exists():
            print("skip", sheet); continue
        im = Image.open(f).convert("RGBA")
        segs, occ = segments(alpha_mask(im))
        found = len(segs)
        segs = fit(segs, occ, len(keys))
        print(sheet, "segments", found, "->", [b - a for a, b in segs])
        for key, (a, b) in zip(keys, segs):
            save_sprite(im.crop((a, 0, b, im.height)), key, manifest, "unit")
    f = RAW / "relics.png"
    if f.exists():
        im = Image.open(f).convert("RGBA"); W, H = im.size
        for i, key in enumerate(RELICS):
            c, r = i % 7, i // 7
            save_sprite(im.crop((c * W // 7, r * H // 4, (c + 1) * W // 7, (r + 1) * H // 4)), "relic_" + key, manifest, "icon")
    for ch in (1, 2, 3):
        f = RAW / f"bg{ch}.png"
        if f.exists():
            im = Image.open(f).convert("RGB")
            # 战场区宽高比 420:462，居中裁
            w = round(im.height * 420 / 462); x0 = (im.width - w) // 2
            im.crop((x0, 0, x0 + w, im.height)).save(OUT / f"bg{ch}.jpg", quality=86)
            manifest[f"bg{ch}"] = {"src": f"art/sprites/bg{ch}.jpg", "kind": "bg"}
    (HERE / "sprites.js").write_text("window.SPRITES=" + json.dumps(manifest, ensure_ascii=False) + ";\n", encoding="utf-8")
    print(len(manifest), "assets")


if __name__ == "__main__":
    main()
