"""Create a reproducible single-frame idle seed from Nezha's selected image.

The script only extracts the ivory background. It preserves the approved
character drawing and places it inside the animation pipeline's 512px cell.
Run: python -I art/tools/seed_nezha.py
"""

from pathlib import Path

import cv2
import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
HERO = ROOT / "art/heroes/nezha"
CELL = 512


def extract_foreground(image: Image.Image) -> Image.Image:
    """Remove the ivory paper and floor shadow without repainting the figure."""
    rgb = np.asarray(image.convert("RGB"), dtype=np.float32)
    r, g, b = rgb[:, :, 0], rgb[:, :, 1], rgb[:, :, 2]
    distance = np.sqrt((r - 254) ** 2 + (g - 252) ** 2 + (b - 242) ** 2)
    strong = (distance > 52) | ((r - b > 39) & (r - g > 15)) | (np.min(rgb, axis=2) < 209)
    candidate = (distance > 27) | ((r - b > 27) & (r - g > 11))
    height, width = strong.shape
    yy, xx = np.indices((height, width))
    shadow = (
        (yy > height * 0.895) & (xx > width * 0.35) & (xx < width * 0.69)
        & (r - g < 24) & (g - b < 30)
    )
    strong &= ~shadow
    kernel = np.ones((5, 5), np.uint8)
    core = cv2.morphologyEx(strong.astype("uint8"), cv2.MORPH_CLOSE, kernel)
    mask = (cv2.dilate(core, kernel, iterations=1) > 0) & candidate
    count, labels, stats, _ = cv2.connectedComponentsWithStats(mask.astype("uint8"), 8)
    for component in range(1, count):
        if stats[component, cv2.CC_STAT_AREA] < 20:
            mask[labels == component] = False
    alpha = cv2.GaussianBlur(mask.astype("uint8") * 255, (3, 3), 0.55)
    rgba = np.dstack((rgb.astype("uint8"), alpha))
    rgba[alpha == 0, :3] = 0
    return Image.fromarray(rgba, "RGBA")


def main() -> None:
    art = extract_foreground(Image.open(HERO / "ref-user-selected.png"))
    art.thumbnail((402, 402), Image.Resampling.LANCZOS)
    cell = Image.new("RGBA", (CELL, CELL), (0, 255, 0, 255))
    cell.alpha_composite(art, ((CELL - art.width) // 2, 80))
    sheet = Image.new("RGB", (CELL * 3, CELL * 2), (0, 255, 0))
    sheet.paste(cell.convert("RGB"), (0, 0))
    dest = HERO / "raw" / "idle-v1.png"
    dest.parent.mkdir(parents=True, exist_ok=True)
    sheet.save(dest)
    print(dest.relative_to(ROOT))


if __name__ == "__main__":
    main()
