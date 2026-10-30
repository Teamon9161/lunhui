# 精卫 · 动作条带提示词

形象基准：用户定稿的 v4 精卫，切图见 [ref-v4-approved.png](ref-v4-approved.png)（取自 `art/concepts/heroes-lineup-v4.png` 第四人，仅清除了相邻角色的边缘）。

生成方式：`python -I art/tools/gen.py jingwei <名称> <参考图...>`，调用 Codex 内置 image_gen。每张为 1536×1024、3×2 宫格（512×512 单元格），纯绿背景，之后由 `art/tools/prepare_frames.py` 抠图、按脚底对齐并打包。

先出待机条带，待机通过后作为其余条带的第二参考图，保证比例和画法一致。普攻 v1 的脸比待机圆、眼大、发量多，用户反馈“攻击时脸变大”，v2 加了头部一致性约束。动作时序见 [brief.md](brief.md)。

每段提示词由“共同部分”和“动作部分”拼接，脚本按 `## <名称>` 取用。

## common

```text
Image 1 is the USER-APPROVED final design of our original hero JINGWEI, a bird-spirit girl, for the Chinese-mythology mobile game Lunhui Altar. Preserve her design exactly: dark indigo messy hair to the jaw, ONE swept-back red-and-cream feather crest on the side of her head, calm determined face with large dark-blue eyes, cream cross-collar short robe with red collar trim and red knot buttons, indigo sash with red cord, wide cream sleeves, large indigo-to-cream gradient feathered wings that grow from her back and arms and also hang down as a layered feather skirt, red tail feathers, brown leather cross-body satchel with a red bow holding smooth pale pebbles, dark indigo boots with cream cuffs and small red ornaments. Same head-to-body proportion as Image 1 (large expressive head, youthful slim body). Same art style as Image 1: clean anime cel shading, crisp dark-brown outlines, flat colours with one soft shadow tone, warm restrained palette.
This is an in-game ANIMATION STRIP for a 2D portrait-screen battle game. The sprite will be shown about 150 px tall, so make the OUTER silhouette outline slightly bolder and reduce only the tiniest feather subdivisions; the design, colours and face must stay identical to Image 1.
LAYOUT: canvas exactly 1536x1024, 3 columns x 2 rows of equal 512x512 cells, frames in reading order (top row left to right, then bottom row). Draw the character at the SAME scale in EVERY cell: full figure including wings about 400 px tall, feet on the same invisible ground line about 40 px above the bottom of each cell, body centred in the cell. Nothing may touch or cross a cell edge; keep at least 30 px empty margin on all sides. Facing screen-RIGHT in three-quarter view in every frame, no mirroring, never turning her back.
BACKGROUND: perfectly flat solid pure green #00FF00 in every cell and between cells. No gradient, no floor, no cast shadow, no glow, no grid lines, no borders, no text, no labels, no motion lines unless requested.
```

## idle

```text
IDLE loop, exactly FOUR frames in the first four cells; cells 5 and 6 completely empty green.
Frames: 1) relaxed ready stance like Image 1, one pebble held loosely in the near hand at waist height, wings half folded; 2) inhale: shoulders and wings rise very slightly, crest feather lifts; 3) top of the breath: wings open a little wider, tail feathers sway back; 4) exhale returning toward frame 1. Changes between frames are SMALL and smooth so the loop does not jump. Feet stay planted on the ground line in all frames.
```

## move

```text
MOVE cycle (light quick run toward screen-right), exactly SIX frames filling all six cells.
Frames: 1) contact: near foot forward touching ground, far foot back, wings slightly raised behind; 2) down: knees bend, body lowest, wings lift; 3) passing: far leg swinging forward, near foot pushing off; 4) contact with the OTHER foot forward; 5) down; 6) passing, back toward frame 1. Light bird-like bounce, wings flutter a little with each step, satchel swings slightly. Same scale and ground line every frame, body stays centred in the cell (running in place).
```

## attack

```text
NORMAL ATTACK: she pulls a pebble from her satchel and THROWS it in an upward arc toward screen-right. Exactly SIX frames filling all six cells.
Frames: 1) ready stance; 2) near hand reaches into the satchel at her hip and grips one smooth pale pebble, eyes on the target; 3) WIND-UP: throwing arm cocked far back and high behind the head with the pebble, body twisted back, weight on the back foot, wings lift and spread; 4) RELEASE: arm whips forward and up toward the upper right, the pebble just leaving her fingers (draw the pebble small, just beyond the hand), body leaning forward, wings sweeping forward; 5) follow-through: arm extended forward and down, empty hand, wings settling, slight lean; 6) recover back toward the ready stance. Strong readable poses, clear silhouette change between wind-up and release. No large effects, no trails, only the single pebble.
HEAD CONSISTENCY (v2, user noticed the face grew during the attack): Image 2 is the approved idle strip. Draw her at EXACTLY the same scale as frame 1 of Image 2: same head size, same face shape (slightly long, calm, NOT rounder or more childlike), same eye size and spacing, same hair volume. The head must not get bigger or rounder in any frame. Full figure about 470 px tall in each cell like Image 2.
```

## cast

```text
SIGNATURE SKILL "Filling the Sea": she gathers all her memorial stones with her wings and hurls a volley upward toward screen-right. Exactly SIX frames filling all six cells.
Frames: 1) ready stance; 2) GATHER: crouching low, wings curl forward around her, both hands at the satchel, four or five pale pebbles float up out of the satchel with a faint warm glow; 3) RISE: she springs up onto her toes, wings spread wide and high, both arms raised overhead holding the cluster of glowing pebbles above her head; 4) RELEASE: both arms thrust forward and up toward the upper right, the pebbles scatter out of her hands in a fan just beyond her reach, wings beat forward; 5) follow-through: arms extended and open, wings swept forward and low, hair and crest blown back; 6) land and recover toward the ready stance, wings settling. The faint glow only on the pebbles; no big magic circles, no water.
```

## hit

```text
HIT REACTION, exactly THREE frames in cells 1 to 3; cells 4 to 6 completely empty green.
Frames: 1) struck from the front-right: head and shoulders snap back, eyes squeezed, wings jerk open, one foot slides back; 2) recoil: body curled slightly, wings pulled in protectively, pained expression; 3) recovering toward the ready stance, determined again. Feet stay on the ground line.
```

## die

```text
DEFEAT, exactly FIVE frames in cells 1 to 5; cell 6 completely empty green.
Frames: 1) staggered backward, arms dropping, wings limp; 2) falling to her knees, head bowed, wings drooping to the ground; 3) collapsing forward and sideways, wings spreading over the ground; 4) lying on the ground on her side, eyes closed, wings draped over her, a few loose feathers drifting; 5) the same lying pose fading a little, one smooth pale pebble resting on the ground beside her hand. Peaceful and sad, not gory. Ground line the same in every frame.
```

## fx_stone

```text
EFFECT SHEET for the same game, matching Image 1's art style (crisp dark-brown outline, flat cel colours). No character in this sheet. Exactly SIX cells, each item centred and at most 360 px in size, at least 60 px margin.
Cells: 1) a single smooth pale grey-cream pebble with a dark outline and one soft highlight, about 120 px, slightly oval (the projectile); 2) the same pebble rotated 45 degrees; 3) IMPACT frame 1: the pebble just hitting the ground, a small burst of dusty cream-brown puffs and three tiny rock chips flying outward, about 160 px wide; 4) IMPACT frame 2: dust cloud expanding wider and lower, chips further out, about 260 px wide; 5) IMPACT frame 3: dust thinning into a flat ring of soft puffs on the ground, about 320 px wide; 6) IMPACT frame 4: last faint wisps dissipating, mostly transparent-looking light puffs, about 340 px wide.
BACKGROUND: perfectly flat solid pure green #00FF00, no gradient, no glow outside the items, no grid lines, no text.
```
