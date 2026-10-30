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
---

# 哪吒 · 战斗动作生成提示词（第一轮生产规格，未出图）

以下段落可由现有 \`art/tools/gen.py\` 按 \`## common\` + \`## 动作名\` 自动组合。先以 \`ref-user-selected.png\` 做第一参考图生成 \`idle\`，检查形象后把 \`raw/idle-v1.png\` 加作其它动作的第二参考图。所有生成品必须经过人工检查；这份提示词不代表动作图已生成或已被确认。

## common

\`\`\`text
Image 1 is the USER-SELECTED authoritative Nezha reference for the original Chinese-mythology mobile game Lunhui Altar. STRICT CHARACTER-IDENTITY LOCK: preserve the exact boyish but sharp face, red-brown almond eyes, serious small closed mouth, twin black hair buns with red ties, black hair silhouette, facial proportions, age and head-to-body ratio. Preserve the black and crimson sleeveless cross-collar outfit, red sash and gold fixtures, dark balloon trousers bearing the SAME flame motifs, red/black forearm guards, ankle wraps, the SAME long fire-tipped spear with red tassel, two separate golden wind-fire wheels beneath the feet, and the flowing long red silk ribbons. Do not recolor his outfit white, enlarge his face, lengthen his body, add armor, change weapon design, remove ribbons or switch to a generic Nezha illustration.
Image 2, when supplied, is the approved idle animation reference. Use the IDENTICAL head size and shape, eye size, face-to-body ratio, clothing details, exact warm-black/crimson/aged-gold palette, and line thickness as Image 2. Keep these invariant ACROSS ALL FRAMES. The first reference always decides his identity.
STYLE: same clean hand-drawn anime cel shading and crisp thick dark-brown outer contour as the selected reference, restrained flat colors with one soft shadow tier. This is real battle animation at about 130 design pixels standing height, not six poster illustrations; use readable silhouette, hands and spear.
CANVAS: EXACTLY 1536x1024 landscape. Six independent 512x512 cells arranged 3 columns by 2 rows, reading left-to-right top then bottom. Same physical scale and same head size across cells; the character including the two wheels should fit about 390-420 px tall. The spear, its tip, wheel flames and silk must ALL fit WITHIN their own cells, at least 30 px clear margin to all cell boundaries, including spear tip and fabric ends. The wheel contact line stays about 40 px above each cell bottom. Center Nezha's torso at the SAME location in each cell; when attacking, pose changes should not move the camera or zoom.
VIEW: screen-right facing, readable three-quarter front view. Never mirror, turn the character's back to the viewer, rotate the camera, duplicate a limb/wheel or reverse the spear between cells. Preserve his recognizable face even during motion.
BACKGROUND: perfectly uniform, fully opaque, pure chroma green #00FF00 everywhere including unused cells. No gradients, scenery, floor, cast shadow, frame dividers, text, labels, guides, extra characters, blur, translucent ghosting, painted fade-outs, or motion trails. Only complete, solid, opaque artwork for character and props. Draw effects in separate FX sheets.
\`\`\`

## idle

\`\`\`text
ONE source pose for a seamless idle rig, NOT six different drawings. Draw exactly ONE Nezha in cell 1 (upper left). The other five cells must remain perfectly empty solid #00FF00.
He floats just above the ground with one foot securely over each distinct wind-fire wheel, slight bent knees, steady stern-yet-youthful expression, body angled three-quarters to the RIGHT. Hold the same fire-tipped spear as Image 1 in a controlled diagonal guard; leave the face unobstructed. Long red ribbons flow distinctly behind him, no ribbon crosses his face or hand grip, two wheel rings visible separately. The head, spear grip, costume and facial expression should match Image 1 as closely as possible.
This exact one frame will later be deformed locally for breathing, hair ties, ribbons and wheel-flame movement. Therefore fully draw all existing equipment even where it overlaps the body; no omitted limbs or partial spear.
\`\`\`

## move

\`\`\`text
SIX-frame looping FLIGHT/GLIDE cycle toward screen-right while riding the paired wind-fire wheels; do NOT draw a running or walking foot cycle. Keep the character near the same center so animation can be played in place.
1: neutral guard, knees flexed, wheels aligned below feet, spear held diagonally.
2: lean slightly forward, shoulders and spear follow, front wheel tilts subtly, ribbons trail behind.
3: maximum forward lean, each wheel turns visibly, flame tongues kick backward, hair ties follow.
4: return toward center, wheels pass through level, spear settles.
5: gentle recoil/bob with knees flexing, ribbon and tassel lag behind.
6: settle into exactly the same silhouette and body alignment as frame 1 for a smooth loop.
The pose should move, not merely slide the entire image. Keep face size and legs identical, exactly two wheels, no duplicated flames or disappearing rings. No afterimages.
\`\`\`

## attack

\`\`\`text
SIX-frame MELEE NORMAL ATTACK with the FIRE-TIPPED SPEAR, thrusting screen-right. This is a spear attack, NOT throwing the spear or a fireball. Same body scale and anchored feet/wheels.
1: guarded pose, spear diagonally across body.
2: preparation, spear slides back through the grip, elbows fold, knees compress and eyes lock onto target.
3: strong wind-up, torso coils back and spear tip points backward/up, red silk and tassel respond.
4: IMPACT/RELEASE keyframe, explosive full spear thrust to the RIGHT, both hands correctly gripping the shaft, front shoulder extended, spear tip visibly farthest forward. No projectile or enemy, tip stays inside its cell.
5: follow-through, spear remains extended but shoulders start retracting, wheel flames flutter with recoil.
6: pull spear back into the diagonal guard, face and proportions unchanged.
One single spear in EVERY frame, no detached spear, no extra hands, no disproportionate head, no action blur or generated flames covering the silhouette. This action's gameplay hit is synchronized to the transition INTO keyframe 4.
\`\`\`

## cast

\`\`\`text
SIX-frame SIGNATURE SKILL: THROW THE QIANKUN GOLDEN RING (乾坤圈), a separate compact gold metal ring, visibly smaller and different from the TWO wind-fire wheels still held under his feet. Keep the spear in the other hand throughout; he does not throw away the spear or a wind-fire wheel.
1: ready on two wheels, spear guarded.
2: draws one gold Qiankun ring into the free hand at waist level, steady gaze.
3: wind-up: torso turns backward, ring-bearing arm drawn behind the shoulder, wheels balanced, spear arm controls the long shaft.
4: RELEASE: snaps the free arm forward toward screen-right, golden ring just leaving the fingertips and still WITHIN the cell, same head size.
5: follow-through, arm fully extended, small ring no longer attached to the wrist, red silk whips after the arm.
6: regrips and recovers to the guarded idle stance; BOTH wind-fire wheels remain.
No extra limbs, no duplicate rings, no projectile trails, no glow or burst. The actual traveling ring and hit effects are a separate FX resource. The gameplay projectile is emitted at the start of frame 4.
\`\`\`

## hit

\`\`\`text
HIT REACTION, exactly THREE frames filling cells 1 to 3. Cells 4 to 6 fully empty green.
1: front-right blow, shoulders jerk backward, eyes tighten, spear stays in hand, knees flex on both wind-fire wheels.
2: recoils sideways and crosses his free arm protectively in front of torso, ribbons and tassel fly forward from inertia.
3: restores balance, fierce youthful eyes open, spear re-centered toward enemy.
Never break the weapon, remove either wheel, redraw the face or add an enemy. No red damage flash; game code owns that effect.
\`\`\`

## die

\`\`\`text
FIVE-frame NON-GORY DEFEAT animation filling cells 1 to 5, cell 6 empty. A brief loss of wheel control ending in a readable collapsed body; the phoenix-lotus revival FX will be drawn separately.
1: staggering from a heavy hit, spear dips, knees buckle, eyes startled.
2: wind-fire wheels slide apart slightly as the body loses balance, one knee drops toward ground, ribbons droop.
3: landing on one knee, both hands lower the spear, head bows.
4: collapsing gently onto side on the ground, one arm and spear lie safely beside the body, both wheels remain visible but dim.
5: same final resting pose with small final settling of ribbon and hair ties, eyes closed. No transparency, fading, extra fragments, blood, weapon truncation or new lotus imagery in the character sheet.
Maintain the same physical body scale despite going horizontal; do not rescale a lying body to match standing height. The last frame should hold indefinitely.
\`\`\`

## fx_ring

\`\`\`text
Standalone EFFECT SHEET for Nezha's golden Qiankun ring projectile, matching the character reference's crisp dark-brown outlines, aged-gold body, red enamel notches and flat warm cel shading. EXACT 1536x1024, 3x2 cells of 512x512. No characters, hands, clothing or wind-fire wheels. Each ring centered, leaving 80px margin on all sides.
Cells 1-4: THE SAME compact circular GOLD Qiankun ring, with a clear empty middle, viewed at four successive rotations in perspective. Same thickness, silhouette, outline, diameter and material; no changes of scale and no extra circles. Cells 5-6: small solid golden impact sparks in two successive outward-burst poses, no ring or enemy.
Perfect pure #00FF00 background, no grid/labels, gradients, glow, transparency, motion blur or cross-cell spill. Each component opaque and fully contained.
\`\`\`

## fx_flame

\`\`\`text
Standalone EFFECT SHEET for the wind-fire-wheel dash: EXACT 1536x1024, six independent 512x512 cells, same hand-drawn anime cel-shaded palette (vermilion, orange, aged gold, warm cream and crisp dark-brown outlines). No character, weapons, wheels, scene or lettering.
Six clearly different stages of one FLAME SWOOSH that follows a RIGHTWARD high-speed dash: tiny ignition, stretching red/orange flame tongue, wide two-layer fire crest, full rushing flame arc, falling short embers, dying flame curls. Center each shape, keep 45px margin around the entire silhouette, no blur/gradient/transparency.
Entire background solid pure #00FF00; game code controls travel and fade.
\`\`\`

## fx_lotus

\`\`\`text
Standalone EFFECT SHEET for Nezha's lotus reincarnation: EXACT 1536x1024 in six 512x512 cells. A stylized red-pink-and-gold lotus with warm orange flame accents in the same cel-shaded line art. No figure, no text, no scenery.
1: a small closed flame-lit lotus bud viewed from slightly above; 2: first two petals spread; 3: petals open symmetrically as a golden center appears; 4: full lotus open, strongest solid-color fire petal accents; 5: petals curve outward with small separate ember shapes; 6: stable fully open lotus without any painted fade, intended for a short hold before code fade.
Keep each flower centered, consistent overall scale and 50px+ side margins. Pure opaque #00FF00 background, no gradients, glow, semi-transparent mist, extra items or frame lines.
\`\`\`
