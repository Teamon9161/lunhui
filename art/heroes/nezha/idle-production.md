# 哪吒待机动作：第一轮可复现生产稿

状态：**候选稿，尚待用户确认；未接入 Cocos。**

## 来源与做法

- 形象以 [ref-user-selected.png](ref-user-selected.png) 为唯一权威。脚本仅抠去米白色背景并重排到 3×2、每格 512 像素的绿幕条带；不重画五官、服装、武器。
- 生成器 [seed_nezha.py](../../tools/seed_nezha.py) 制作第一格的同源待机图；`raw/idle-v1.png` 是从原图派生的中间生产素材。
- [idle-rig.json](idle-rig.json) 定义 16 帧微动：呼吸、头部轻点、左右红绫、左右风火轮。小幅摆动不改变人物整体头身比例。
- 使用项目现有 [rig_frames.py](../../tools/rig_frames.py) 生成透明 RGBA 待机帧，输出 `rig/idle-rig/NN.png`。
- 原图带浅色地面投影，自动抠图不是逐像素无损；正式入库前必须放在深浅底、战斗尺寸检查边缘和衣服内部孔洞。

## 运行步骤

在仓库根目录（Windows、Python 已装 Pillow、numpy、opencv-python、scipy）：

```powershell
python -I art/tools/seed_nezha.py
python -I art/tools/rig_frames.py nezha idle-rig
```

用肉眼检查 16 帧是否存在拉伸、闪边和可见的背景残留。通过后再把待机接进 `frames.json`、`prepare_frames.py` 与游戏资源目录，保持原有精卫的制作与出手时序流程。

## 普攻候选稿

已另行生成并提供六帧“收枪蓄力 → 向右刺枪 → 收势”的候选预览。由于该条带是 AI 重绘，人物脸、服装细节以及武器位置与定稿原图仍存在差异，**不放进本 PR 或正式运行时图集**。后续应以用户确认的表情、细节一致性为准重新生成或挑帧修复，禁止把它标记成正式可用资源。

## 交付边界

本 PR 只提供经过本地试运行的待机生产脚本及变形参数，没有提交自动生成的 PNG、图集或未核验的战斗时序修改。用户确认候选动画后，再按项目素材入库规则提交采用的源帧与 Cocos 图集。
