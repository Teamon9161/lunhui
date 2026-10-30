# 唐僧 · 透明参考提示词

日期：2026-10-30。使用内置 imagegen，背景透明参数为 true。输入：[原始形象依据](source-v4-approved-lineup.png)；输出：[ref-transparent-v1.png](ref-transparent-v1.png)，1024×1536 RGBA。

状态：派生参考初稿，不替代原始形象。四角 alpha=0，alpha 范围 0–254；已发现周围暖色晕边，作为参考初稿保存，正式入战场前仍需修边与核对。

```text
Use case: background-extraction
Asset type: ONE standalone transparent-background reference cutout of an APPROVED existing hero, not a redesign.
Input image is the exact edit target: a five-character lineup. Extract ONLY the RIGHTMOST FIFTH character, Tang Sanzang / 唐僧, the gentle young monk in a five-petal golden crown, saffron robe and vermilion kasaya, dark prayer beads, scripture backpack, holding a tall golden ringed staff. Delete the other FOUR figures, title, labels, ground shadow and entire ivory backdrop.
Preserve Tang's exact approved identity, face shape, soft eyes, tiny calm smile, age, head-to-body relationship, upright pose, hands, crown shape, beads, robe pattern/colors/folds, backpack and staff. Do NOT repaint him into a different face, make him taller or cuter, change his costume, remove objects, mirror him, change his gaze or add any new details. Keep every staff ring, the staff tip, crown, backpack, shoes and robe hem fully visible, with clean empty margin.
Output a single full-body Tang with his existing staff on a genuinely TRANSPARENT alpha background, no other character, no text, no shadow, no scenery, no white fill, no checkerboard painted into the image. Empty areas between staff rings, arm/body and other openings must also be transparent. Retain clean antialiased dark-brown edges with no ivory halo. This is a faithful extraction/production reference derived from an approved source; the source design itself must remain unchanged.
```
