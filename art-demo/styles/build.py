"""Crop the style samples to the figure and embed them into the comparison page."""
import base64, io, json, pathlib
from PIL import Image

here = pathlib.Path(__file__).parent
meta = json.loads((here / "styles.json").read_text(encoding="utf-8"))
out = []
for s in meta["styles"]:
    im = Image.open(here / "raw" / f"{s['key']}.png").convert("RGBA")
    a = im.getchannel("A").point(lambda v: 255 if v > 24 else 0)
    box = a.getbbox()
    im = im.crop(box)
    # 战斗里最多画 64px、放大最多约 340px，裁到 360 高足够
    if im.height > 360:
        r = 360 / im.height
        im = im.resize((round(im.width * r), 360), Image.NEAREST if s.get("pixel") else Image.LANCZOS)
    buf = io.BytesIO(); im.save(buf, "PNG", optimize=True)
    # 脚底取最下沿，中心取下半身不透明像素的平均横坐标（锡杖不影响站位）
    al = im.getchannel("A"); w, h = im.size; px = al.load()
    xs = [x for y in range(h // 2, h) for x in range(w) if px[x, y] > 24]
    out.append({**s, "src": "data:image/png;base64," + base64.b64encode(buf.getvalue()).decode(),
                "h": h, "feet": h, "cx": sum(xs) / len(xs)})
html = (here / "template.html").read_text(encoding="utf-8")
html = html.replace("/*STYLES*/", json.dumps(out, ensure_ascii=False)).replace("/*NOTE*/", meta["note"])
(here / "index.html").write_text(html, encoding="utf-8")
print(len(html), [(o["key"], o["h"], round(o["cx"])) for o in out])
