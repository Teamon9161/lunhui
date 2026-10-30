# Cocos 正式工程（client/）

更新日期：2026-10-30。记录正式工程的结构、构建方法和实测结果。路线与验收标准见 [项目背景](project-context.md) 和 [战斗架构](battle-architecture.md)。

## 结构

`client/` 是 Creator 3.8.8 工程根目录，同时保留原有的 bun 测试和工具。

| 路径 | 内容 |
| --- | --- |
| `assets/scripts/battle/` | 纯 TS 战斗核心（不依赖 `cc`），bun 测试覆盖 |
| `assets/scripts/bench/stress.ts` | 压测战斗：用真实核心维持 150 单位＋400 弹丸，不依赖 `cc` |
| `assets/scripts/view/` | Cocos 战斗表现层：`GameBoot`（固定 30Hz 推进＋插值）、`BattleView`（池化节点、分层绘制）、`PerfMonitor`（帧耗时统计）、`Placeholder`（运行时占位图集） |
| `assets/scripts/view/HeroArt.ts`、`PreviewGallery.ts` | 角色逐帧素材加载与播放（出手帧对齐核心结算）、动作预览 |
| `assets/scripts/bench/showcase.ts` | 动作样板：单英雄对木桩反复普攻与施法，用真实核心驱动 |
| `assets/resources/heroes/<英雄>/` | 运行时图集 `atlas.png` 与动作表 `anims.json`，由美术流程生成，不要手改 |
| `assets/scenes/battle.scene` | 启动场景：Canvas 720×1280（竖屏，适配宽度）＋`GameBoot` |
| `settings/v2/packages/engine.json` | 引擎模块已裁掉 2D 物理、TiledMap、Spine、DragonBones、视频、WebView；`BATCHER2D_MEM_INCREMENT` 设为 2048 |
| `tools/serve-build.ts`、`tools/web-capture.ts`、`tools/stress-sim.ts` | 网页包服务、无头浏览器采集、纯逻辑压测 |

精卫已接入逐帧生产稿（待用户确认），其余角色、敌人和场景仍是**占位形状**（彩色圆、圆环、光点），画面右上角有标注。它们共用一张运行时生成的贴图，用来验证接入、合批和压测，不是正式美术。底部按钮是开发用调试控件，正式界面由 FairyGUI 另做。

## 构建与预览

```bash
"C:/ProgramData/cocos/editors/Creator/3.8.8/CocosCreator.exe" --project "C:/code/games/lunhui/client" --build "platform=web-mobile;debug=true;startScene=ad8fea63-5d49-430d-81ed-28639848f106"
```

退出码 36 表示构建成功，产物在 `client/build/web-mobile`。用 `bun client/tools/serve-build.ts` 提供本地服务（`.claude/launch.json` 中的 `cocos-web`）。地址加 `?mode=stress` 进入压测，加 `?mode=preview` 进入精卫动作预览；底部按钮可在战斗、压测、动作预览三种模式间切换。

`bun tools/web-capture.ts <url> <png> [秒]` 用本机 Edge 无头模式打开页面，截图并输出 `__lunhuiPerf`；设置 `EVAL` 环境变量可以在页面里执行检查脚本。桌面应用的内置浏览器面板在后台时会被限流（实测 3 秒只跑 3 帧），因此不要用它测帧耗时。

## 角色素材流程

以精卫为样板（规格见 `art/heroes/jingwei/brief.md`）。路线选择、走样问题的对策、配置键和检查清单见 [角色动作制作](animation-pipeline.md)，这里只列步骤：

1. `python -I art/tools/gen.py <英雄> <动作> <参考图...>`：调用 Codex 内置 image_gen，按 `art/heroes/<英雄>/prompts.md` 生成 1536×1024、3×2 宫格的绿幕动作条带。先出待机，通过后把它作为其余条带的第二参考图。
2. `python -I art/tools/prepare_frames.py <英雄>`：按 `frames.json` 抠绿幕、去杂点和越界部件；以基准帧的脸为模板统一各条带比例（倒地等脸部匹配不可靠的动作按身高）；脚底贴地，水平按格子、头部或整帧图像对齐；可重排帧序（`order`）、设循环淡入（`blend`）和出手点（`muzzle`）。输出单帧、`preview.gif` 和运行时图集。
   幅度小、常驻屏幕的动作（待机）不用逐帧重画：`python -I art/tools/rig_frames.py <英雄> <配置>` 以单张定稿图为源，按配置里的部位遮罩、支点、摆角和相位生成变形帧，再以 `rgbaFrames` 交给打包。逐帧重画的头发、脸型会每帧不同，循环播放时会“呼吸式”胀缩。
3. 核心里给英雄配置 `timing`（前摇、收势）。核心在动作开始时发 `act` 事件，前摇结束才结算。表现层按 `pre`/`post` 占比把各帧分配到这两段，离手帧与弹丸生成在同一逻辑步。`bun tools/showcase-trace.ts` 可打印出手与弹丸时刻。

已知限制：受击闪色目前用偏红色调代替（精灵颜色只能相乘变暗），白闪需要专用材质；阵亡第 5 帧和尘爆最后一帧被画成半透明，与绿幕混色，已弃用，改由代码淡出。

## 合批要点（已实测）

Creator 3.8 的 2D 合批键包含顶点缓冲区编号（`render-data.ts` 的 `updateHash`）。默认 `BATCHER2D_MEM_INCREMENT` 为 144KB，约 1000 个四边形；超出后节点分散到多个缓冲区，同一贴图也会被拆开。压测场景因此达到 306 个批次。改为 2048KB（约 58000 顶点，低于 16 位索引上限）后降到 9 个批次，整个战场为 1 个。后续加入正式图集时，要继续用逐层关闭的方法核对批次。

## 实测记录

**2026-10-30，开发机 PC，Edge 无头模式（540×1170），web-mobile 调试包，1 倍速。不代表手机性能，手机验收仍未进行。**

| 场景 | FPS | 帧均值 / P95 / P99 / 最大 | 长帧（>33ms） | 逻辑均值 / 峰值 | 表现均值 | 批次 | 堆 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 压测：155 单位＋396 弹丸，约 29 秒 | 60.0 | 16.7 / 19.5 / 21.3 / 25.9ms | 2 | 0.69 / 7.7ms | 0.49ms | 9 | 47MB |
| 普通战斗：第 1 章，约 18 秒 | 60.0 | 16.7 / 16.9 / 19.4 / 22.5ms | 1 | 0.04 / 2.6ms | 0.04ms | 9 | 25MB |

| 压测（含两名精卫逐帧素材）：157 单位＋394 弹丸，约 23 秒 | 60.0 | 16.7 / 19.1 / 19.5 / 22.4ms | 0 | 1.05 / 4.2ms | 0.83ms | 10 | 60MB |
| 精卫动作预览 | 60.0 | 16.7 / 16.9 / 17.2 / 19.8ms | 0 | 0.03 / 0.9ms | 0.05ms | 24 | 45MB |

纯逻辑（`bun tools/stress-sim.ts 60`）：150 单位＋400 弹丸，每个 30Hz 逻辑步平均 0.36ms，P99 1.0ms，最大 2.0ms。

这些数据只说明占位画面下的架构可行。正式角色帧动画、特效、透明叠加和音效接入后需要重测；中端安卓机上的 150＋400 / 60FPS 目标**尚未验证**。

## 尚未完成

- 安卓：SDK 已有（build-tools 36、platform 37），缺 NDK 和 cmdline-tools，也没有连接设备；尚未进行原生打包和真机测试。
- Windows 原生：Windows SDK 库仍缺失。
- FairyGUI 尚未接入；战斗核心的热点分配（`filter`、闭包、弹丸对象）尚未改为复用，等真机分析结果再定。
- 正式角色动作、特效、场景、音效均未开始。

## 参考 my_zzbx 的方式（评估结论）

`my_zzbx` 是在商业游戏《正中靶心2》APK（Creator 2.2.2）基础上做的本地改版。它的战斗完成度大部分来自原版客户端：特效池（`ObjectAnimationPool`）、原生状态特效、阴影、震屏、弹丸延迟渲染队列，以及原版的角色与特效美术。用户自己新增的英雄（天女兽、悟空等）使用 AI 逐帧图，通过 `pack.json` 设定逐帧停顿（`delays`）来卡出手时机，悟空用登记过的握点控制独立的棒子。

因此"在人家的基础上做得更好"的含义是：**借鉴其表现方法和完成度标准，用我们自己的素材和代码实现**。原版解密代码和美术属于他人作品，不复制进本项目。可以借鉴的是：

- 每个动作的逐帧停顿和出手帧，与核心结算时间对齐；
- 武器、身体、特效分层，用握点和挂点让独立武器跟随动作；
- 特效池、状态特效随体型缩放、地面/人物/弹丸/覆盖分层；
- 受击、死亡、震屏和倍速下仍可读的停留节拍。

可以超过它的地方：固定 30Hz 的确定性核心与插值渲染、无物理引擎的空间网格、整场 1 个批次的战场、从一开始就记录帧耗时和长帧，以及统一的原创画风。真正的工作量和风险在美术：保持角色逐帧一致、做出完整的技能演出。这部分需要先用一个角色做出样板来验证。
