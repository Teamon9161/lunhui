# 哪吒 · 透明参考提示词

日期：2026-10-30。使用内置 imagegen，背景透明参数为 true。输入：[原始形象依据](ref-user-selected.png)；输出：[ref-transparent-v1.png](ref-transparent-v1.png)，1254×1254 RGBA。

状态：派生参考初稿，不替代原始形象。四角 alpha=0，alpha 范围 0–255；火焰与发丝存在半透明像素，后续须做深浅底检查与源图一致性核对。

```text
Use case: background-extraction
Asset type: transparent-background production reference derived from the USER-SELECTED exact Nezha image.
Input is the exact edit target. Remove ONLY its warm ivory paper background and cast ground shadow. Keep the entire original character, held spear, spear tassels, gold spearhead, all red silk ribbons, costume, hair, shoes/ankle wraps, paired wind-fire wheels and their flames exactly as shown.
CRITICAL identity invariants: same boyish face, large red-brown almond eyes, closed serious little mouth, exact twin black hair buns and red ties, head/body relationship and pose. Same black-red sleeveless wrap costume, black balloon trousers with existing flame motifs, gold fastenings and black/red forearm guards. Same left-side spear angle and hand grip, same free clenched fist, same wheel positions and all ribbon curves. Do not redesign, simplify, recolor, mirror, alter expression or proportions, invent details, change the art style or turn this into a new illustration.
Output one complete full-body Nezha with all existing equipment and effects on a truly TRANSPARENT alpha background. No scenery, text, other figure, ground shadow, white backdrop, or painted checkerboard. Remove background inside all wheel rings and all openings between arms, body, ribbons and spear, without deleting pale skin, gold highlights, flame centers or light costume edges. Preserve antialiased edges and semi-transparent flame tips with no ivory fringe. Leave a little transparent padding around all spear/flame/ribbon extremes. This is background removal of the provided selected image, not a fresh design.
```

