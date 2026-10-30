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


---

# 首批正式动作出图提示词（生产准备，未出图）

下面的段落供 `art/tools/gen.py` 读取；其余旧内容保留，用于追溯透明参考的来源。首批只做 idle / attack / cast，三项未验收前不开始第二批。

## common

```text
Create ONE 1536x1024 landscape sprite strip for a 2D Chinese-mythology mobile game's hero TANG SENG. Use the supplied USER-APPROVED reference as strict source of truth. If a five-person lineup is supplied, Tang Seng is ONLY the RIGHTMOST FIFTH character; ignore the other four. A single-character transparent cutout may be supplied as an additional reference but does not override the approved original.

IDENTITY LOCK: the exact same gentle youthful face, shaved head, soft brown eyes, small composed smile, five-petal golden monk crown with two flowing WHITE ribbons, ochre-yellow inner robe with white collar and generous sleeves, vermilion kasaya with gold trim/pattern, dark wooden prayer-bead necklace with tassel, brown scripture-scroll backpack secured with red cords and orange tassels, tall golden ringed monk staff, and dark shoes. Preserve the approved chibi/anime proportion, body volume, face size, hairless scalp, costume, staff silhouette, and deep warm palette. No redesign, no old monk, no baby face, no elongation of body or changes to the eyes/crown.

SHEET FORMAT: precisely 3 columns x 2 rows, SIX separate full-body poses, reading left to right then top to bottom. Each CELL is 512x512 pixels. The monk is about 400 pixels tall in every upright pose; the shoes stand on the SAME floor line about 40 pixels above the bottom of each cell. Keep at least 30 pixels of margin on all sides; the complete crown, ribbons, staff rings, staff tip, backpack and robe hem must never cross cell borders. Faces must be identical in width, eyes, nose, jaw, and expression style across all cells. Character is shown 3/4 view facing SCREEN RIGHT throughout, feet visible, no mirroring, no rear view.

STYLE: hand-drawn, neat anime cel shading, stable strong dark-brown outline, solid controlled palette, subtle single-tone shadows, readable at approximately 130 design pixels tall in-game. Pixel-perfect colour and proportion continuity matter more than artistic flourish.

BACKGROUND: flat PURE GREEN #00FF00 in each and every cell, with no gradients, no visible separators, no guide lines, no captions, no numbers, no ground, no shadows, no glow, no particles. Do not add extra weapons, characters or objects. No motion blur, translucency, smear frames, fading or duplicated limbs. No light effects in the body strip; VFX are separate runtime sprites.
```

## idle

```text
ANIMATION: TANG SENG neutral IDLE source pose. This strip will supply ONLY the FIRST CELL to an offline same-image small-region deformation process; the other five cells are for checking composition. Draw six IDENTICAL calm key poses, NOT six AI-repainted breathing phases.

Tang Seng stands quietly, both feet anchored on the floor, body relaxed, gentle composed gaze to screen-right. One hand holds the golden ring staff upright with all rings completely visible, the other hand rests naturally by the prayer beads in front of the chest. Necklace and backpack align with the approved reference. The robe and long white ribbons hang naturally with enough negative space for future tiny movement. No large swing, no lifted foot, no floating, no raised staff, no speech or spell effects. Keep the HEAD exactly the same size in all six cells.

The first cell must be the cleanest, complete character suitable as a single authoritative idle frame.
```

## attack

```text
ANIMATION: Tang Seng's NORMAL ATTACK is now the GOLDEN RING STAFF SWEEP shown in the user-selected action reference, NOT bead flicking. Keep the approved youthful face, body ratio, five-petal crown, long WHITE ribbons, vermilion kasaya, ochre sleeves, backpack, mala and the exact design and length of the single golden ring staff, identical through all poses.

SIX DISTINCT KEY POSES in one 3 x 2 sprite strip, each 512 x 512. These are one coherent short staff-combo, not six separate attacks.
CELL 1: calm guard, ring staff upright in dominant hand, gaze to right, both feet planted.
CELL 2: athletic anticipation: knee bends, torso pivots slightly, grip slides down shaft, staff drawn diagonally backward, ribbons and robe lag behind.
CELL 3: LOW SWEEP: staff sweeps from back-left across the front, body lowers, sleeves follow; clear curved staff path. Do NOT draw actual light trails in this BODY sprite strip.
CELL 4: HIT / RELEASE POSE: forceful forward step and broad upward/rightward diagonal staff slash with the ringed head leading, eyes focus on target. The separate attack wave VFX and ranged projectile originate from the staff head at THIS pose. Maintain staff continuity, single shaft, two hands only.
CELL 5: follow-through, robe hem and long white ribbons continue the movement, weight settles on front foot, staff elevated across the right shoulder.
CELL 6: smooth recovery to upright staff guard, face/head unchanged from cell 1.

The reference's golden swoosh is a separate EFFECT strip, NOT fused into the character silhouettes. One weapon only; staff grip must stay consistent; no detached hands, teleported staff, duplicated limbs, face swelling, different crown, sudden full-body scale changes, rear views or terrain. The body motion must be much more powerful and readable than gentle arm-only prayer-bead throwing.
```

## cast

```text
ANIMATION: six distinct full-body key poses for Tang Seng's SERENE GOLDEN BUDDHIST MANTRA, matching the user-selected reference's rising staff, kneeling/lotus blessing and returning to guard. This cast body animation can accompany a team shield or chant. The glowing mandala, golden lotus, floating petals and translucent Buddha silhouette must be generated as separate VFX layers, NOT baked into this character strip.

CELL 1: calm standing posture with the ring staff upright and prayer beads visible.
CELL 2: gently lifts the staff, other hand rises with beads; light preparatory knee bend.
CELL 3: turns chest slightly towards front-right and raises the ringed head high, eyes serene; wide sleeves and ribbons follow.
CELL 4: RELEASE POSE: gathers hands in a readable prayer gesture, lowers or sits naturally on folded legs, chants; the external golden lotus / circular Buddhist halo blooms at this frame.
CELL 5: maintains prayer posture for one beat; fingers, necklace, costume and staff remain mechanically plausible. Do not duplicate the staff when lowering it.
CELL 6: settles back to the standing guard pose, with the same body size, position and face as cell 1.

Make the expression calm but the gesture ceremonial and visually satisfying; avoid random magic-wand waving, extra arms, floating weapon, unreadable hands, synthetic body scaling or half-transparent elements. Keep all parts within cell boundaries and the approved head-to-body ratio exactly.
```
