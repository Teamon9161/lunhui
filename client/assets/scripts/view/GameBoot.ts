// 启动组件：挂在 battle 场景的 Canvas 上。固定 30Hz 推进战斗核心，按帧插值绘制。
// 模式：普通战斗、压测（150 单位 + 400 弹丸）、动作预览（单英雄样板）。
// 网页预览可用 ?mode=stress / ?mode=preview 直接进入对应模式。
// 底部按钮是开发用调试控件，正式界面由 FairyGUI 另做。
import { _decorator, Color, Component, director, Label, Layers, Node, profiler, Sprite, UITransform, view as screenView } from 'cc';
import { Battle, newHeroState } from '../battle/battle';
import type { StationType } from '../battle/battle';
import { HEROES } from '../battle/heroes/index';
import { TICK } from '../battle/world';
import type { World } from '../battle/world';
import { StressBattle, STRESS_DEFAULT } from '../bench/stress';
import { Showcase } from '../bench/showcase';
import { BattleView } from './BattleView';
import { HeroArt } from './HeroArt';
import { PerfMonitor, formatReport, now } from './PerfMonitor';
import { placeholderFrames } from './Placeholder';
import { PreviewGallery } from './PreviewGallery';

const { ccclass } = _decorator;

const TEAM = ['zhongkui', 'nezha', 'wukong', 'jingwei', 'tangseng'];
// 已有逐帧素材的英雄
const ART_HEROES = ['jingwei'];
const PREVIEW_HERO = 'jingwei';
const MAX_STEPS_PER_FRAME = 8;
const SPEEDS = [1, 2, 3];
const MODES = ['battle', 'stress', 'preview'] as const;
const MODE_NAMES: Record<Mode, string> = { battle: '战斗', stress: '压测', preview: '动作预览' };

type Mode = typeof MODES[number];

interface Sim {
    world: World;
    step(): void;
}

@ccclass('GameBoot')
export class GameBoot extends Component {
    private view!: BattleView;
    private perf = new PerfMonitor();
    private hud!: Label;
    private sim: Sim | null = null;
    private mode: Mode = 'battle';
    private round = 0;
    private acc = 0;
    private speedIdx = 0;
    private paused = false;
    private restartT = 0;
    private hudT = 0;
    private modeBtn!: Label;
    private speedBtn!: Label;
    private pauseBtn!: Label;
    private gallery: PreviewGallery | null = null;
    private galleryTop = 0;
    private arts = new Map<string, HeroArt>();

    start(): void {
        this.view = new BattleView(this.node);
        this.view.onEnd = () => { this.restartT = 3; };
        const vs = screenView.getVisibleSize();
        const top = vs.height / 2, left = -vs.width / 2;
        this.galleryTop = top - 130;
        // 调试包默认显示引擎统计面板，会挡住战场；帧耗时与批次由自己的 HUD 显示
        profiler.hideStats();

        this.hud = this.label('Hud', 18, left + 10, top - 8, 0, 1);
        this.hud.color = new Color(220, 230, 200, 255);
        this.hud.string = '加载素材…';
        const note = this.label('PlaceholderNote', 16, -left - 10, top - 8, 1, 1);
        note.string = '精卫为生产稿 · 其余为占位';
        note.color = new Color(255, 190, 120, 200);

        const by = -vs.height / 2 + 44;
        this.modeBtn = this.button('ModeBtn', -220, by, () => this.switchMode());
        this.speedBtn = this.button('SpeedBtn', 0, by, () => { this.speedIdx = (this.speedIdx + 1) % SPEEDS.length; this.refreshButtons(); });
        this.pauseBtn = this.button('PauseBtn', 220, by, () => { this.paused = !this.paused; this.refreshButtons(); });

        // 调试入口：浏览器控制台或无头采集脚本可读取节点树
        (globalThis as { __lunhuiDebug?: object }).__lunhuiDebug = { canvas: this.node, director, boot: this };
        const search = (globalThis as { location?: { search?: string } }).location?.search ?? '';
        const wanted = MODES.find(m => search.indexOf('mode=' + m) >= 0) ?? 'battle';
        Promise.all(ART_HEROES.map(id => HeroArt.load(`heroes/${id}`).then(a => this.arts.set(id, a))))
            .catch(e => console.error('角色素材加载失败', e))
            .then(() => {
                this.view.setArts(this.arts);
                this.load(wanted);
            });
    }

    private label(name: string, size: number, x: number, y: number, ax: number, ay: number): Label {
        const n = new Node(name);
        n.layer = Layers.Enum.UI_2D;
        this.node.addChild(n);
        n.addComponent(UITransform).setAnchorPoint(ax, ay);
        n.setPosition(x, y);
        const l = n.addComponent(Label);
        l.fontSize = size;
        l.lineHeight = size + 6;
        l.cacheMode = Label.CacheMode.CHAR;
        l.horizontalAlign = ax === 0 ? Label.HorizontalAlign.LEFT : ax === 1 ? Label.HorizontalAlign.RIGHT : Label.HorizontalAlign.CENTER;
        l.enableOutline = true;
        l.outlineWidth = 2;
        l.outlineColor = new Color(0, 0, 0, 255);
        return l;
    }

    private button(name: string, x: number, y: number, onTap: () => void): Label {
        const n = new Node(name);
        n.layer = Layers.Enum.UI_2D;
        this.node.addChild(n);
        n.setPosition(x, y);
        n.addComponent(UITransform).setContentSize(190, 64);
        const bg = n.addComponent(Sprite);
        bg.sizeMode = Sprite.SizeMode.CUSTOM;
        bg.spriteFrame = placeholderFrames().white;
        bg.color = new Color(60, 48, 40, 220);
        const ln = new Node('Text');
        ln.layer = Layers.Enum.UI_2D;
        n.addChild(ln);
        ln.addComponent(UITransform);
        const l = ln.addComponent(Label);
        l.fontSize = 26;
        l.lineHeight = 30;
        l.cacheMode = Label.CacheMode.CHAR;
        l.color = new Color(240, 228, 200, 255);
        n.on(Node.EventType.TOUCH_END, onTap);
        return l;
    }

    private refreshButtons(): void {
        const next = MODES[(MODES.indexOf(this.mode) + 1) % MODES.length];
        this.modeBtn.string = `切到${MODE_NAMES[next]}`;
        this.speedBtn.string = `倍速 ×${SPEEDS[this.speedIdx]}`;
        this.pauseBtn.string = this.paused ? '继续' : '暂停';
    }

    private switchMode(): void {
        this.load(MODES[(MODES.indexOf(this.mode) + 1) % MODES.length]);
    }

    private load(mode: Mode): void {
        this.mode = mode;
        this.acc = 0;
        this.restartT = 0;
        if (mode === 'stress') {
            this.sim = new StressBattle(STRESS_DEFAULT);
        } else if (mode === 'preview') {
            this.sim = new Showcase(PREVIEW_HERO);
        } else {
            const chapter = (this.round % 3) + 1;
            const type: StationType = 'normal';
            this.sim = new Battle(
                { seed: 1000 + this.round, chapter, station: 1 + Math.floor(this.round / 3), type, altarHp: 1000, altarMaxHp: 1000 },
                TEAM.map(newHeroState),
            );
            this.round++;
        }
        const art = this.arts.get(PREVIEW_HERO);
        if (mode === 'preview' && art && !this.gallery) {
            this.gallery = new PreviewGallery(this.node, art, HEROES[PREVIEW_HERO].timing, `${HEROES[PREVIEW_HERO].name} · 动作预览（实际游戏尺寸）`, this.galleryTop);
        }
        if (this.gallery) this.gallery.visible = mode === 'preview';
        this.view.bind(this.sim.world);
        this.perf.reset(mode === 'stress' ? `压测 ${STRESS_DEFAULT.units}单位+${STRESS_DEFAULT.bullets}弹丸` : MODE_NAMES[mode]);
        this.refreshButtons();
    }

    update(dt: number): void {
        if (!this.sim) return;
        const t0 = now();
        const w = this.sim.world;
        const simDt = this.paused ? 0 : Math.min(dt, 0.25) * SPEEDS[this.speedIdx];
        if (!w.over) {
            this.acc += simDt;
            let steps = 0;
            while (this.acc >= TICK && steps < MAX_STEPS_PER_FRAME) {
                this.view.snapshot();
                this.sim.step();
                this.view.handleEvents(w.drainEvents());
                this.acc -= TICK;
                steps++;
                if (w.over) break;
            }
            if (steps === MAX_STEPS_PER_FRAME) this.acc = 0;
        }
        const t1 = now();
        this.view.sync(w.over ? 1 : Math.min(1, this.acc / TICK), simDt);
        if (this.gallery && this.mode === 'preview') this.gallery.update(simDt);
        const t2 = now();
        this.perf.frame(t1 - t0, t2 - t1);

        if (this.restartT > 0) {
            this.restartT -= dt;
            if (this.restartT <= 0) this.load(this.mode);
        }
        this.hudT -= dt;
        if (this.hudT <= 0) {
            this.hudT = 0.5;
            this.hud.string = formatReport(this.perf.report(this.view.activeUnits, this.view.activeProjectiles, SPEEDS[this.speedIdx]));
        }
    }
}
