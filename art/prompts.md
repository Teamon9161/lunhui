# 《轮回坛》原型美术：角色设计与出图提示词

> 阶段说明（2026-10-30）：本文保留早期原型的出图记录。正式版使用 Cocos Creator，战斗表现参考 `C:/code/games/my_zzbx` 的完成度；详见 [项目背景与技术决策](../docs/project-context.md)。以下单张待机图、旧英雄名单和代码动作方案均不作为正式版动画要求。

> 当前哪吒、悟空、钟馗、精卫、唐僧的形象讨论见 [首批英雄形象设计](../docs/hero-visual-design.md)，本轮新提示词见 [概念图提示词](concepts/prompts.md)。新图为待反馈方案，尚未定稿。

画风：Q版 2.5 头身、粗深褐描边、平涂加一层阴影；配色走水墨淡彩那张（赭黄、朱红、靛蓝、做旧的金、暖灰）。
参考图：Image 1 = `art-demo/styles/raw/qban.png`（画风基准），Image 2 = `art-demo/styles/raw/shuimo.png`（配色基准）。
本轮原型出图仅为所有角色制作「人道」待机一张，朝右三分之四侧面；原型以代码实现六道换色和简易动作。正式版需要另外制作完整角色动作与技能演出，不能沿用此限制。

## 共用画风段

```text
Style rules for every character: chibi 2.5-head-tall proportions, thick dark-brown outlines, flat cel shading with one shadow tone and one highlight, big clean readable shapes that still read at 56 pixels tall. Image 1 is the style reference: match its outline weight, shading, proportions and level of detail. Image 2 is the color reference: use its muted ink-wash palette (ochre, vermilion, indigo, aged gold, warm grey) instead of bright saturated colors. Do not copy the monk from the references unless asked. Each character stands in an idle pose, full body, three-quarter view facing right. Characters are placed in a single horizontal row, evenly spaced, with wide empty transparent space between them; nothing overlaps and no weapon crosses into a neighbor's space. Fully transparent background, no ground, no floor shadows, no text, no labels, no frames.
```

## heroes — 五位英雄 + 法坛（1536x1024）

```text
A character lineup of five original heroes for a Chinese-mythology tower-defense game, left to right:
1. 阿樵 the woodcutter (tank): broad-shouldered young man, huge woodcutter's axe resting on his shoulder, straw hat hanging on his back, rolled-up ochre sleeves, bandaged forearms, rope belt, sturdy and cheerful.
2. 阿怨 the vengeful spirit (melee): pale girl with very long loose black hair, torn white mourning robe with indigo hem, holding a chipped straight sword, faint cold blue wisps around her feet, sullen eyes.
3. 朱雀 the fire bird (melee): energetic youth wearing a vermilion feather mantle shaped like folded bird wings, flame-tipped short spear, small crest of red feathers on the head, gold armlets.
4. 慧明 the monk (melee): young shaved-head monk, saffron robe with a deep red kasaya, big dark wooden prayer beads around the neck, bronze ring staff with rings.
5. 秀才 the scholar (caster): slender young scholar in an indigo robe and black square scholar's cap, holding an open scroll in one hand and an oversized calligraphy brush in the other, ink stains on the sleeve.
6. At the far right, not a character: a small round stone altar platform seen from a three-quarter top view, carved lotus rim, a golden dharma wheel standing on it, incense smoke.
```

## enemies1 — 第一章 人间山野（1536x1024）

```text
A lineup of six original demon enemies for the first chapter (mountain wilds), all facing right, left to right:
1. 鼠妖 rat demon foot soldier: small hunched rat with a rusty cleaver and a tattered red headband, sly grin.
2. 野猪精 boar demon: stocky boar warrior with tusks, round wooden shield and leather armor, heavy and slow.
3. 狐妖 fox spirit: slim fox woman with two tails, holding a short bow, purple sash, mischievous.
4. 遁地鼠 burrowing mole: plump mole demon with huge digging claws and a miner's lamp on its head, dirt on its fur.
5. 巨猿 giant ape: big grey ape brute with a tree-branch club, chest scars, angry.
6. 小蜘蛛 tiny spiderling: small purple-black spider with a red mark, about one third the height of the rat.
```

## enemies2 — 第二章 阴间冥府 + 第三章 天庭（1536x1024）

```text
A lineup of seven original enemies, all facing right, left to right:
1. 鬼卒 ghost soldier: translucent pale-green ghost in rusty underworld helmet holding a short spear, legs fading into mist.
2. 白骨兵 skeleton soldier: skeleton warrior in a broken lamellar vest with a notched saber.
3. 阴差 underworld bailiff: thin bailiff in a dark robe and tall hat, swinging an iron chain with a hook, ranged.
4. 夜叉 yaksha: lean blue-skinned yaksha with wild red hair, claws and fangs, crouched to pounce.
5. 天兵 heavenly soldier: celestial infantryman in gold-trimmed white armor with a halberd and a cloud-shaped shoulder plate.
6. 力士 heavenly strongman: massive bare-chested strongman with a golden headband and a giant bronze mace.
7. 雷部法师 thunder mage: Taoist mage in an indigo robe with a small drum and lightning sparks around his hand.
```

## bosses1 — 第一章首领 + 哮天犬（1536x1024）

```text
A lineup of four original boss characters, larger and more imposing than regular enemies but still chibi, all facing right, left to right:
1. 牛魔 Bull Demon King: massive bull-headed demon in black and gold armor with a heavy iron staff, nose ring, burning eyes.
2. 黄风怪 Yellow Wind Demon: sly yellow marten demon in a sand-colored robe holding a fan, small whirlwind swirling around him.
3. 蜘蛛精 Spider Spirit: elegant woman with the lower body of a giant purple spider, silk threads trailing from her hands.
4. 哮天犬 the celestial hound: fierce black hound with a gold collar, mid-snarl (normal enemy size, smaller than the bosses).
```

## bosses2 — 第二章首领（1536x1024）

```text
A lineup of four original boss characters, larger and more imposing than regular enemies but still chibi, all facing right, left to right:
1. 白骨夫人 Lady White Bone: beautiful pale woman in a white dress whose sleeves and hem turn into bones, a skull hairpin, eerie smile.
2. 孟婆 Granny Meng: old woman with a bent back holding a ladle and a steaming bowl of soup, kindly but uncanny.
3. 黑无常 Black Impermanence: tall figure in a black robe and tall black hat, stern face, holding shackles.
4. 白无常 White Impermanence: tall figure in a white robe and tall white hat, long red tongue, grinning, holding a mourning staff.
```

## bosses3 — 第三章首领（1536x1024）

```text
A lineup of three original boss characters, larger and more imposing than regular enemies but still chibi, all facing right, left to right:
1. 魔礼青 Heavenly King of the East: armored heavenly general in green armor holding a huge jade sword upright.
2. 巨灵神 the Giant Spirit God: enormous god in bronze armor with two great axes, beard, very wide and heavy.
3. 二郎真君 Erlang Shen: handsome general with a third eye on his forehead, silver armor, three-pointed double-edged spear held upright.
```

## relics — 法宝图标（1536x1024，7 列 × 4 行）

```text
An icon sheet of 28 magic treasure icons for a Chinese-mythology game, arranged in a strict grid of 7 columns and 4 rows, every icon the same size, centered in its cell with generous empty transparent space between cells. Each icon is a single object drawn in the same chibi game style as Image 1 (thick dark-brown outline, flat cel shading) using the muted ink-wash palette of Image 2, readable at 40 pixels. Fully transparent background, no frames, no text, no labels. Row by row, left to right:
Row 1: a string of old copper coins; a burning red karmic flame; a bowl of steaming soup; a golden glowing statue torso; a small oil lamp with a long flame; a string of bodhi seed prayer beads; a white soul-guiding banner on a pole.
Row 2: a thick ledger book with a brown cover; a round bronze heart-protecting mirror; a red paper talisman charm; a floating green ghost flame; a judge's red-tipped writing brush; a yellow talisman stuck to a skull with a fuse; a pink lotus flower glowing softly.
Row 3: a small stone well with water; a dark storm cloud with lightning; a bronze incense burner; a bronze bell with a red tassel; a golden eight-spoked dharma wheel; a red book with black corners (book of life and death); a small pagoda-shaped shield ward.
Row 4: a glowing sarira crystal pearl; an ink stone with a brush; an angry red mask; a circular six-color yin-yang reincarnation disc; a golden padlock; a drop of blood on a white lotus petal; a small erupting volcano with purple fire.
```

## 战场背景（各 1024x1024，章各一张）

```text
Game battlefield background seen from a high three-quarter top-down view, square, no characters, no text, no UI. Painted to match Image 2's soft ink-wash palette, with gentle lighting and low contrast so that characters on top stay readable. The upper third is the far side where enemies come in from the top edge; the lower two thirds is open ground where heroes stand, kept mostly flat and uncluttered in the center, with details only near the left and right edges. Scene: {SCENE}
```

- ch1：a mountain pass in the human world: a dirt path coming down from misty pine-covered hills at the top, the lower area a worn stone temple courtyard with moss between flagstones, a few pine roots and stone lanterns at the edges.
- ch2：the underworld: the top is a dark river with a stone arch bridge in fog and red spider lilies, the lower area cracked dark flagstones with faint blue ghost-fire lanterns at the edges.
- ch3：the edge of the heavenly court: the top is a golden gate in drifting clouds, the lower area a pale jade-white marble platform with cloud carvings and gold trim at the edges.
