"""Embed the Wukong frames into the six-path demo page."""
import base64, json, pathlib, sys

src = pathlib.Path(sys.argv[1])  # art/heroes/sunwukong/frames
here = pathlib.Path(__file__).parent
pick = {"idle": ["anim-idle/00.png", "anim-idle/02.png"],
        "walk": [f"anim-walk/0{i}.png" for i in range(4)],
        "attack": [f"anim-attack/0{i}.png" for i in range(5)] + ["anim-attack/00.png"]}
frames = {k: ["data:image/png;base64," + base64.b64encode((src / f).read_bytes()).decode() for f in v] for k, v in pick.items()}
html = (here / "template.html").read_text(encoding="utf-8").replace("/*FRAMES*/", json.dumps(frames))
(here / "index.html").write_text(html, encoding="utf-8")
print(len(html))
