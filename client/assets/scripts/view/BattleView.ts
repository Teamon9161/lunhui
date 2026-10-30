// 战斗表现层：读取战斗核心的状态和事件画出战场。逻辑 30Hz，这里按帧插值绘制。
// 有正式素材的角色（HeroArt）播放逐帧动作，出手帧对齐核心结算；其余仍为占位形状（共用运行时贴图）。
// 战场物体不走 FairyGUI；所有高频对象都用池复用，不在战斗中反复创建销毁节点。
import { Color, Label, Layers, Node, Sprite, SpriteFrame, UITransform } from 'cc';
import { FIELD, TICK } from '../battle/world';
import type { World } from '../battle/world';
import { DAO_DEFS } from '../battle/dao';
import type { BattleEvent, Projectile, Unit, Zone } from '../battle/types';
import { placeholderFrames } from './Placeholder';
import type { PlaceholderFrames } from './Placeholder';
import { AnimPlayer } from './HeroArt';
import type { ArtFrame, HeroArt } from './HeroArt';

const HALF_W = FIELD.W / 2;
const HALF_H = FIELD.H / 2;
const MAX_FX = 160;
const MAX_FLOATERS = 40;
const DEATH_FADE = 0.35;
// 角色素材的站立高度（设计像素），用于血条位置
const ART_BAR_TOP = 140;
// 石子落地尘爆按此 aoe 半径为 1 倍绘制
const IMPACT_BASE_R = 40;
const STONE_SPIN = 540;
// 弹丸画面从角色手上的出手点飞出，在这段时间内并入核心的真实弹道（不影响结算）
const MUZZLE_BLEND = 0.15;
const tmpColor = new Color();

const sx = (x: number) => x - HALF_W;
const sy = (y: number) => HALF_H - y;

function hexColor(out: Color, hex: number, a = 255): Color {
    return out.set((hex >> 16) & 255, (hex >> 8) & 255, hex & 255, a);
}

function newNode(name: string, parent: Node): Node {
    const n = new Node(name);
    n.layer = Layers.Enum.UI_2D;
    parent.addChild(n);
    return n;
}

function newSprite(name: string, parent: Node, frame: SpriteFrame, w: number, h: number): Sprite {
    const n = newNode(name, parent);
    n.addComponent(UITransform).setContentSize(w, h);
    const s = n.addComponent(Sprite);
    s.sizeMode = Sprite.SizeMode.CUSTOM;
    s.trim = false;
    s.spriteFrame = frame;
    return s;
}

function setSize(s: Sprite, w: number, h: number): void {
    s.node.getComponent(UITransform)!.setContentSize(w, h);
}

function tint(s: Sprite, hex: number, a = 255): void {
    s.color = hexColor(tmpColor, hex, a);
}

// 把帧贴到精灵上：尺寸和锚点随帧变化，节点位置即为角色脚底
function applyFrame(s: Sprite, f: ArtFrame): void {
    if (s.spriteFrame !== f.sf) s.spriteFrame = f.sf;
    const t = s.node.getComponent(UITransform)!;
    t.setContentSize(f.w, f.h);
    t.setAnchorPoint(f.ax, f.ay);
}

function lighten(hex: number, k: number): number {
    const r = (hex >> 16) & 255, g = (hex >> 8) & 255, b = hex & 255;
    const m = (c: number) => Math.round(c + (255 - c) * k);
    return (m(r) << 16) | (m(g) << 8) | m(b);
}

class UnitView {
    unit!: Unit;
    px = 0;
    py = 0;
    seen = 0;
    flash = 0;
    dying = -1;
    baseColor = 0xffffff;
    art: HeroArt | null = null;
    readonly anim = new AnimPlayer();
    overlayK = 0;
    constructor(
        readonly body: Sprite,
        readonly rim: Sprite,
        // 循环动作帧间淡入用的上层精灵（身体的子节点，随身体翻转）
        readonly overlay: Sprite,
        readonly shadow: Sprite,
        readonly barBg: Sprite,
        readonly barHp: Sprite,
        readonly barMana: Sprite,
    ) {}
    setActive(on: boolean): void {
        this.body.node.active = on;
        this.shadow.node.active = on;
        this.barBg.node.active = on;
        this.barHp.node.active = on;
        this.barMana.node.active = on;
    }
}

class ProjView {
    p!: Projectile;
    px = 0;
    py = 0;
    pt = 0;
    seen = 0;
    spin = false;
    // 出手点相对核心弹丸起点的偏移，随飞行时间衰减到 0
    ox = 0;
    oy = 0;
    constructor(readonly sprite: Sprite, readonly shadow: Sprite) {}
}

class ZoneView {
    z!: Zone;
    seen = 0;
    constructor(readonly fill: Sprite, readonly ring: Sprite) {}
}

interface FxItem { sprite: Sprite; t: number; dur: number; line: boolean; r: number; color: number; anim: AnimPlayer | null }
interface Floater { label: Label; t: number; dur: number; vy: number; color: number }

export class BattleView {
    readonly root: Node;
    private readonly frames: PlaceholderFrames;
    private readonly lZones: Node;
    private readonly lShadows: Node;
    private readonly lUnits: Node;
    private readonly lBullets: Node;
    private readonly lFx: Node;
    private readonly lBars: Node;
    private readonly lText: Node;

    private world: World | null = null;
    private arts = new Map<string, HeroArt>();
    private frameN = 0;
    private readonly units = new Map<number, UnitView>();
    private readonly unitPool: UnitView[] = [];
    private readonly projs = new Map<number, ProjView>();
    private readonly projPool: ProjView[] = [];
    private readonly zones = new Map<number, ZoneView>();
    private readonly zonePool: ZoneView[] = [];
    private readonly fx: FxItem[] = [];
    private readonly fxPool: Sprite[] = [];
    private readonly fxAnimPool: AnimPlayer[] = [];
    private readonly floaters: Floater[] = [];
    private readonly floaterPool: Label[] = [];
    private readonly sorted: UnitView[] = [];
    private readonly merged = new Map<number, { amount: number; x: number; y: number; big: boolean; shield: boolean }>();
    private readonly banner: Label;
    private bannerT = 0;

    onEnd: ((win: boolean) => void) | null = null;

    constructor(parent: Node) {
        this.frames = placeholderFrames();
        this.root = newNode('BattleField', parent);
        const ground = newNode('Ground', this.root);
        this.lZones = newNode('Zones', this.root);
        this.lShadows = newNode('Shadows', this.root);
        this.lUnits = newNode('Units', this.root);
        this.lBullets = newNode('Bullets', this.root);
        this.lFx = newNode('Fx', this.root);
        this.lBars = newNode('Bars', this.root);
        this.lText = newNode('Text', this.root);

        // 占位场地：敌方区、我方区与防线
        const enemyField = newSprite('EnemyField', ground, this.frames.white, FIELD.W, FIELD.LINE_Y + 400);
        enemyField.node.setPosition(0, sy((FIELD.LINE_Y - 400) / 2));
        tint(enemyField, 0x3a2f2a);
        const heroField = newSprite('HeroField', ground, this.frames.white, FIELD.W, FIELD.H - FIELD.LINE_Y + 400);
        heroField.node.setPosition(0, sy((FIELD.LINE_Y + FIELD.H + 400) / 2));
        tint(heroField, 0x2b2620);
        const line = newSprite('Line', ground, this.frames.white, FIELD.W, 3);
        line.node.setPosition(0, sy(FIELD.LINE_Y));
        tint(line, 0xe8dcc0, 90);

        this.banner = this.newLabel(this.lText, 40);
        this.banner.node.setPosition(0, sy(420));
        this.banner.node.active = false;
    }

    // 角色 id -> 逐帧素材；没有素材的角色继续用占位形状
    setArts(arts: Map<string, HeroArt>): void {
        this.arts = arts;
    }

    private newLabel(parent: Node, size: number): Label {
        const n = newNode('Label', parent);
        n.addComponent(UITransform);
        const l = n.addComponent(Label);
        l.fontSize = size;
        l.lineHeight = size + 4;
        l.cacheMode = Label.CacheMode.CHAR;
        l.isBold = true;
        l.enableOutline = true;
        l.outlineWidth = 2;
        l.outlineColor = hexColor(tmpColor, 0x140f0c, 255);
        return l;
    }

    bind(world: World): void {
        for (const v of this.units.values()) this.releaseUnit(v);
        this.units.clear();
        for (const v of this.projs.values()) this.releaseProj(v);
        this.projs.clear();
        for (const v of this.zones.values()) this.releaseZone(v);
        this.zones.clear();
        for (const f of this.fx) this.releaseFx(f);
        this.fx.length = 0;
        for (const f of this.floaters) { f.label.node.active = false; this.floaterPool.push(f.label); }
        this.floaters.length = 0;
        this.bannerT = 0;
        this.banner.node.active = false;
        this.world = world;
    }

    // 每个逻辑步之前调用，记下上一步位置供插值
    snapshot(): void {
        for (const v of this.units.values()) { v.px = v.unit.x; v.py = v.unit.y; }
        for (const v of this.projs.values()) { v.px = v.p.x; v.py = v.p.y; v.pt = v.p.t; }
    }

    get activeUnits(): number {
        return this.units.size;
    }

    get activeProjectiles(): number {
        return this.projs.size;
    }

    private artOf(id: number): HeroArt | null {
        const u = this.world?.get(id);
        return u ? this.arts.get(u.defId) ?? null : null;
    }

    // ---------- 事件 ----------

    handleEvents(events: BattleEvent[]): void {
        const w = this.world!;
        const merged = this.merged;
        merged.clear();
        for (const e of events) {
            switch (e.type) {
                case 'damage': {
                    const m = merged.get(e.target);
                    if (m) { m.amount += e.amount; m.big ||= e.big; }
                    else merged.set(e.target, { amount: e.amount, x: e.x, y: e.y, big: e.big, shield: e.shield });
                    const v = this.units.get(e.target);
                    if (v) {
                        v.flash = 0.08;
                        // 受击只打断待机和移动，不打断出手
                        const hit = v.art?.clip('hit');
                        if (hit && !v.unit.dead && (v.anim.name === 'idle' || v.anim.name === 'move')) v.anim.play('hit', hit);
                    }
                    break;
                }
                case 'act': {
                    const v = this.units.get(e.unit);
                    const clip = v?.art?.clip(e.act);
                    if (v && clip) v.anim.play(e.act, clip, e.windup, e.dur - e.windup);
                    break;
                }
                case 'actCancel': {
                    const v = this.units.get(e.unit);
                    const idle = v?.art?.clip('idle');
                    if (v && idle) v.anim.play('idle', idle);
                    break;
                }
                case 'heal': this.float('+' + e.amount, e.x, e.y - 24, 0x7be07b, 18); break;
                case 'cast': {
                    const color = DAO_DEFS[e.dao].color;
                    this.float(e.skill, e.x, e.y - (this.artOf(e.unit) ? ART_BAR_TOP + 30 : 60), color, 24, 1.3, -30);
                    if (!this.artOf(e.unit)) this.addFx(e.x, e.y, 0, 0, 46, color, 0.4, false);
                    break;
                }
                case 'revive': this.addFx(e.x, e.y, 0, 0, 56, 0xffe08a, 0.6, false); break;
                case 'death': if (e.kind === 'hero' && !this.artOf(e.unit)) this.addFx(e.x, e.y, 0, 0, 36, 0xffffff, 0.8, false); break;
                case 'reincarnate': {
                    const u = w.get(e.unit);
                    if (u) this.float(`转世·${DAO_DEFS[e.to].name}`, u.x, u.y - 48, DAO_DEFS[e.to].color, 22, 1.8, -20);
                    break;
                }
                case 'fx': {
                    const impact = e.name === 'boom' && e.unit ? this.artOf(e.unit)?.clip('fx_impact') : undefined;
                    if (impact) { this.addArtFx(e.x, e.y, (e.r ?? IMPACT_BASE_R) / IMPACT_BASE_R, impact); break; }
                    const line = e.x2 !== undefined && e.y2 !== undefined;
                    this.addFx(e.x, e.y, e.x2 ?? 0, e.y2 ?? 0, e.r ?? 40, e.color ?? 0xffffff, e.dur ?? 0.45, line);
                    break;
                }
                case 'text': this.float(e.text, e.x, e.y, e.color, 26, 1.8, -20); break;
                case 'chain': this.showBanner(`连锁 ×${e.n}`, 0xff7050); break;
                case 'wave': this.showBanner(`第 ${e.index}/${e.total} 波`, 0xe8dcc0); break;
                case 'end': this.showBanner(e.win ? '胜利' : '失败', e.win ? 0xffd040 : 0xff6060); this.onEnd?.(e.win); break;
            }
        }
        for (const [id, m] of merged) {
            const u = w.get(id);
            const hero = u?.side === 'hero';
            const color = hero ? 0xff6060 : m.shield ? 0xcfe8ff : m.big ? 0xffd040 : 0xffffff;
            const top = u && this.arts.has(u.defId) ? ART_BAR_TOP - 10 : (u?.r ?? 10) + 8;
            this.float(String(Math.round(m.amount)), m.x, m.y - top, color, m.big ? 28 : 20);
        }
    }

    private showBanner(text: string, color: number): void {
        this.banner.string = text;
        this.banner.color = hexColor(tmpColor, color);
        this.banner.node.active = true;
        this.bannerT = 1.4;
    }

    private float(text: string, x: number, y: number, color: number, size: number, dur = 0.8, vy = -60): void {
        let label: Label;
        if (this.floaters.length >= MAX_FLOATERS) {
            const old = this.floaters.shift()!;
            label = old.label;
        } else {
            label = this.floaterPool.pop() ?? this.newLabel(this.lText, size);
        }
        label.node.active = true;
        label.string = text;
        label.fontSize = size;
        label.lineHeight = size + 4;
        label.node.setPosition(sx(x), sy(y));
        this.floaters.push({ label, t: 0, dur, vy, color });
    }

    private takeFxSprite(): Sprite {
        if (this.fx.length >= MAX_FX) {
            const old = this.fx.shift()!;
            if (old.anim) this.fxAnimPool.push(old.anim);
            return old.sprite;
        }
        return this.fxPool.pop() ?? newSprite('Fx', this.lFx, this.frames.ring, 64, 64);
    }

    private releaseFx(f: FxItem): void {
        f.sprite.node.active = false;
        this.fxPool.push(f.sprite);
        if (f.anim) this.fxAnimPool.push(f.anim);
    }

    private addFx(x: number, y: number, x2: number, y2: number, r: number, color: number, dur: number, line: boolean): void {
        const sprite = this.takeFxSprite();
        sprite.node.active = true;
        sprite.spriteFrame = line ? this.frames.white : this.frames.ring;
        sprite.node.getComponent(UITransform)!.setAnchorPoint(0.5, 0.5);
        if (line) {
            const dx = x2 - x, dy = y2 - y;
            setSize(sprite, Math.hypot(dx, dy), Math.max(6, r * 0.5));
            sprite.node.setPosition(sx((x + x2) / 2), sy((y + y2) / 2));
            sprite.node.angle = -Math.atan2(dy, dx) * 180 / Math.PI;
        } else {
            setSize(sprite, r * 2, r * 2);
            sprite.node.setPosition(sx(x), sy(y));
            sprite.node.angle = 0;
        }
        this.fx.push({ sprite, t: 0, dur, line, r, color, anim: null });
    }

    private addArtFx(x: number, y: number, scale: number, clip: NonNullable<ReturnType<HeroArt['clip']>>): void {
        const sprite = this.takeFxSprite();
        const anim = this.fxAnimPool.pop() ?? new AnimPlayer();
        anim.play('fx', clip);
        sprite.node.active = true;
        sprite.node.angle = 0;
        sprite.node.setScale(scale, scale);
        sprite.node.setPosition(sx(x), sy(y));
        tint(sprite, 0xffffff);
        let dur = 0;
        for (const d of clip.durations) dur += d;
        // 末帧再停留一段并淡出
        this.fx.push({ sprite, t: 0, dur: dur + 0.18, line: false, r: 0, color: 0xffffff, anim });
        applyFrame(sprite, anim.frame()!);
    }

    // ---------- 对象池 ----------

    private acquireUnit(u: Unit): UnitView {
        let v = this.unitPool.pop();
        if (!v) {
            const f = this.frames;
            const shadow = newSprite('Shadow', this.lShadows, f.disc, 32, 12);
            const body = newSprite('Unit', this.lUnits, f.disc, 32, 32);
            const rim = newSprite('Rim', body.node, f.ring, 32, 32);
            const overlay = newSprite('Blend', body.node, f.disc, 32, 32);
            const barBg = newSprite('HpBg', this.lBars, f.white, 32, 6);
            const barHp = newSprite('Hp', this.lBars, f.white, 32, 4);
            const barMana = newSprite('Mana', this.lBars, f.white, 32, 3);
            barHp.node.getComponent(UITransform)!.setAnchorPoint(0, 0.5);
            barMana.node.getComponent(UITransform)!.setAnchorPoint(0, 0.5);
            tint(barBg, 0x000000, 160);
            tint(barMana, 0x6ab0ff);
            v = new UnitView(body, rim, overlay, shadow, barBg, barHp, barMana);
        }
        v.unit = u;
        v.px = u.x;
        v.py = u.y;
        v.flash = 0;
        v.dying = -1;
        v.art = this.arts.get(u.defId) ?? null;
        v.anim.clip = null;
        v.anim.name = '';
        v.overlay.node.active = false;
        v.overlayK = 0;
        const d = u.r * 2;
        if (v.art) {
            v.rim.node.active = false;
            setSize(v.shadow, 64, 18);
        } else {
            v.body.spriteFrame = this.frames.disc;
            v.body.node.getComponent(UITransform)!.setAnchorPoint(0.5, 0.5);
            setSize(v.body, d, d);
            v.rim.node.active = true;
            setSize(v.rim, d + 4, d + 4);
            setSize(v.shadow, d * 1.1, d * 0.4);
        }
        tint(v.shadow, 0x000000, 70);
        const hero = u.kind === 'hero';
        const barW = Math.max(28, v.art ? 48 : d);
        setSize(v.barBg, barW + 2, hero ? 9 : 6);
        setSize(v.barHp, barW, 4);
        setSize(v.barMana, barW, 3);
        tint(v.barHp, u.side === 'hero' ? 0x58d068 : 0xe04a3a);
        const def = hero ? this.world!.heroDefs[u.defId] : this.world!.enemyDefs[u.defId];
        v.baseColor = v.art ? 0xffffff : u.kind === 'altar' ? 0xb89a5a : def?.color ?? 0x888888;
        v.setActive(true);
        v.barMana.node.active = hero;
        return v;
    }

    private releaseUnit(v: UnitView): void {
        v.setActive(false);
        v.body.node.setScale(1, 1);
        this.unitPool.push(v);
    }

    private acquireProj(p: Projectile): ProjView {
        let v = this.projPool.pop();
        if (!v) v = new ProjView(newSprite('Bullet', this.lBullets, this.frames.glow, 18, 18), newSprite('BulletShadow', this.lShadows, this.frames.disc, 16, 6));
        v.p = p;
        v.px = p.x;
        v.py = p.y;
        v.pt = p.t;
        const stone = (p.visual === 'pebble' || p.visual === 'stone') ? this.artOf(p.srcId)?.clip('fx_stone') : undefined;
        v.ox = v.oy = 0;
        const owner = this.units.get(p.srcId);
        const muzzle = owner?.anim.clip?.muzzle;
        if (owner && muzzle && (owner.anim.name === 'attack' || owner.anim.name === 'cast')) {
            const u = owner.unit;
            v.ox = u.x + u.facing * muzzle[0] - p.sx;
            v.oy = u.y - muzzle[1] - p.sy;
        }
        v.spin = !!stone;
        const t = v.sprite.node.getComponent(UITransform)!;
        if (stone) {
            applyFrame(v.sprite, stone.frames[0]);
            tint(v.sprite, p.visual === 'stone' ? lighten(p.color, 0.6) : 0xffffff);
        } else {
            const line = p.kind === 'line';
            v.sprite.spriteFrame = line ? this.frames.bolt : this.frames.glow;
            t.setAnchorPoint(0.5, 0.5);
            if (line) setSize(v.sprite, 30, 10);
            else setSize(v.sprite, p.aoe > 0 ? 26 : 18, p.aoe > 0 ? 26 : 18);
            tint(v.sprite, p.color);
        }
        v.sprite.node.angle = !stone && p.kind === 'line' ? -Math.atan2(p.ty - p.sy, p.tx - p.sx) * 180 / Math.PI : 0;
        v.sprite.node.active = true;
        v.shadow.node.active = p.kind === 'lob';
        tint(v.shadow, 0x000000, 60);
        return v;
    }

    private releaseProj(v: ProjView): void {
        v.sprite.node.active = false;
        v.shadow.node.active = false;
        this.projPool.push(v);
    }

    private acquireZone(z: Zone): ZoneView {
        let v = this.zonePool.pop();
        if (!v) v = new ZoneView(newSprite('ZoneFill', this.lZones, this.frames.disc, 64, 64), newSprite('ZoneRing', this.lZones, this.frames.ring, 64, 64));
        v.z = z;
        if (z.line) {
            const dx = z.x2 - z.x, dy = z.y2 - z.y;
            v.fill.spriteFrame = this.frames.white;
            setSize(v.fill, Math.hypot(dx, dy), z.r * 2);
            v.fill.node.setPosition(sx((z.x + z.x2) / 2), sy((z.y + z.y2) / 2));
            v.fill.node.angle = -Math.atan2(dy, dx) * 180 / Math.PI;
            v.ring.node.active = false;
        } else {
            v.fill.spriteFrame = this.frames.disc;
            v.fill.node.angle = 0;
            v.ring.node.active = true;
        }
        v.fill.node.active = true;
        return v;
    }

    private releaseZone(v: ZoneView): void {
        v.fill.node.active = false;
        v.ring.node.active = false;
        this.zonePool.push(v);
    }

    // ---------- 每帧同步 ----------

    // dt 为本帧推进的模拟时间（已乘倍速，暂停时为 0），动作与特效都按它走
    sync(alpha: number, dt: number): void {
        const w = this.world;
        if (!w) return;
        const frame = ++this.frameN;
        this.syncUnits(w, alpha, dt, frame);
        this.syncProjectiles(w, alpha, dt, frame);
        this.syncZones(w, frame);
        this.stepFx(dt);
        this.stepFloaters(dt);
        if (this.bannerT > 0) {
            this.bannerT -= dt;
            if (this.bannerT <= 0) this.banner.node.active = false;
        }
    }

    // 有素材的单位选择当前动作：出手/受击播完前保持，阵亡停在末帧，其余按核心的移动状态循环
    private updateArt(v: UnitView, dt: number): void {
        const u = v.unit, art = v.art!, a = v.anim;
        if (u.dead) {
            if (a.name !== 'die') a.play('die', art.clip('die')!);
        } else if (a.name === 'die' || ((a.name === 'attack' || a.name === 'cast' || a.name === 'hit') && a.done) || !a.clip) {
            a.play(u.anim === 'move' ? 'move' : 'idle', art.clip(u.anim === 'move' ? 'move' : 'idle')!);
        } else if (a.name === 'idle' || a.name === 'move') {
            const want = u.anim === 'move' ? 'move' : 'idle';
            a.loop(want, art.clip(want)!);
        }
        a.advance(dt);
        applyFrame(v.body, a.frame()!);
        const up = a.next();
        v.overlay.node.active = !!up.frame;
        v.overlayK = up.k;
        if (up.frame) applyFrame(v.overlay, up.frame);
    }

    private syncUnits(w: World, alpha: number, dt: number, frame: number): void {
        for (const u of w.units) {
            if (u.removed) continue;
            let v = this.units.get(u.id);
            if (!v) {
                // 已死的非英雄单位不再新建视图
                if (u.dead && u.kind !== 'hero') continue;
                v = this.acquireUnit(u);
                this.units.set(u.id, v);
            }
            v.seen = frame;
        }
        const sorted = this.sorted;
        sorted.length = 0;
        for (const [id, v] of this.units) {
            const u = v.unit;
            if (v.seen !== frame) { this.releaseUnit(v); this.units.delete(id); continue; }
            const x = v.px + (u.x - v.px) * alpha;
            const y = v.py + (u.y - v.py) * alpha;
            let a = 255;
            let scale = 1;
            if (u.dead && u.kind !== 'hero') {
                if (v.dying < 0) v.dying = 0;
                v.dying += dt;
                if (v.dying >= DEATH_FADE) { this.releaseUnit(v); this.units.delete(id); continue; }
                const k = v.dying / DEATH_FADE;
                a = Math.round(255 * (1 - k));
                scale = 1 - 0.4 * k;
            } else if (u.dead) {
                // 阵亡英雄：有素材时播完倒地再淡下去，等待复活
                a = v.art ? (v.anim.done ? 150 : 255) : 70;
            }
            if (v.flash > 0) v.flash -= dt;
            const hero = u.kind === 'hero';
            v.body.node.setPosition(sx(x), sy(y));
            if (v.art) {
                this.updateArt(v, dt);
                v.body.node.setScale(u.facing < 0 ? -scale : scale, scale);
                // 受击闪色：正片叠底只能变暗，先用偏红代替，白闪需要专用材质
                const color = v.flash > 0 ? 0xff9a9a : 0xffffff;
                tint(v.body, color, a);
                if (v.overlay.node.active) tint(v.overlay, color, Math.round(a * v.overlayK));
                v.shadow.node.setPosition(sx(x), sy(y) - 2);
            } else {
                v.body.node.setScale(scale, scale);
                if (v.flash > 0) tint(v.body, 0xffffff, a);
                else if (u.dead) tint(v.body, 0x8a8a8a, a);
                else tint(v.body, v.baseColor, a);
                const rimColor = hero ? DAO_DEFS[u.dao].color : u.kind === 'boss' ? 0xff5040 : u.kind === 'elite' ? 0xffb040 : 0x1a1410;
                tint(v.rim, rimColor, a);
                v.shadow.node.setPosition(sx(x), sy(y + u.r * 0.8));
            }
            tint(v.shadow, 0x000000, Math.round(a * 0.28));

            const showBar = !u.dead && u.kind !== 'altar' && (hero || u.hp < u.maxHp);
            v.barBg.node.active = showBar;
            v.barHp.node.active = showBar;
            v.barMana.node.active = showBar && hero;
            if (showBar) {
                const barW = v.barHp.node.getComponent(UITransform)!.width;
                const top = sy(y) + (v.art ? ART_BAR_TOP : u.r + 10);
                v.barBg.node.setPosition(sx(x), hero ? top - 1.5 : top);
                v.barHp.node.setPosition(sx(x) - barW / 2, top);
                v.barHp.node.setScale(Math.max(0, u.hp / u.maxHp), 1);
                tint(v.barBg, u.shield > 0 ? 0x9ad8ff : 0x000000, u.shield > 0 ? 220 : 160);
                if (hero) {
                    v.barMana.node.setPosition(sx(x) - barW / 2, top - 4);
                    v.barMana.node.setScale(u.manaMax > 0 ? Math.min(1, u.mana / u.manaMax) : 0, 1);
                }
            }
            sorted.push(v);
        }
        // 按 y 排前后遮挡；只在顺序变化时调整节点
        sorted.sort((a, b) => a.body.node.position.y === b.body.node.position.y ? a.unit.id - b.unit.id : b.body.node.position.y - a.body.node.position.y);
        const children = this.lUnits.children;
        for (let i = 0; i < sorted.length; i++) {
            const n = sorted[i].body.node;
            if (children[i] !== n) n.setSiblingIndex(i);
        }
    }

    private syncProjectiles(w: World, alpha: number, dt: number, frame: number): void {
        for (const p of w.projectiles) {
            if (p.dead) continue;
            let v = this.projs.get(p.id);
            if (!v) { v = this.acquireProj(p); this.projs.set(p.id, v); }
            v.seen = frame;
        }
        for (const [id, v] of this.projs) {
            const p = v.p;
            if (v.seen !== frame || p.dead) { this.releaseProj(v); this.projs.delete(id); continue; }
            let x = v.px + (p.x - v.px) * alpha;
            const gy = v.py + (p.y - v.py) * alpha;
            let y = gy;
            if (v.ox || v.oy) {
                const k = Math.max(0, 1 - (v.pt + (p.t - v.pt) * alpha) / MUZZLE_BLEND);
                const e = k * k;
                x += v.ox * e;
                y += v.oy * e;
            }
            if (p.kind === 'lob') {
                const t = v.pt + (p.t - v.pt) * alpha;
                const k = Math.min(1, t / Math.max(TICK, p.dur));
                y -= Math.sin(Math.PI * k) * Math.min(140, Math.hypot(p.tx - p.sx, p.ty - p.sy) * 0.4);
                v.shadow.node.setPosition(sx(x), sy(gy));
            }
            if (v.spin) v.sprite.node.angle -= STONE_SPIN * dt;
            else if (p.kind === 'homing') v.sprite.node.angle = -Math.atan2(p.y - v.py, p.x - v.px) * 180 / Math.PI;
            v.sprite.node.setPosition(sx(x), sy(y));
        }
    }

    private syncZones(w: World, frame: number): void {
        for (const z of w.zones) {
            if (z.dead) continue;
            let v = this.zones.get(z.id);
            if (!v) { v = this.acquireZone(z); this.zones.set(z.id, v); }
            v.seen = frame;
        }
        for (const [id, v] of this.zones) {
            const z = v.z;
            if (v.seen !== frame || z.dead) { this.releaseZone(v); this.zones.delete(id); continue; }
            const a = Math.min(1, (z.dur - z.t) / 0.5, z.t / 0.15);
            tint(v.fill, z.color, Math.round(60 * a));
            if (!z.line) {
                setSize(v.fill, z.r * 2, z.r * 2);
                setSize(v.ring, z.r * 2, z.r * 2);
                v.fill.node.setPosition(sx(z.x), sy(z.y));
                v.ring.node.setPosition(sx(z.x), sy(z.y));
                tint(v.ring, z.color, Math.round(150 * a));
            }
        }
    }

    private stepFx(dt: number): void {
        let n = 0;
        for (const f of this.fx) {
            f.t += dt;
            if (f.t >= f.dur) { this.releaseFx(f); continue; }
            const k = f.t / f.dur;
            if (f.anim) {
                f.anim.advance(dt);
                applyFrame(f.sprite, f.anim.frame()!);
                // 序列帧播完后在末帧上淡出
                const fade = f.anim.done ? Math.max(0, 1 - (f.t - (f.dur - 0.18)) / 0.18) : 1;
                tint(f.sprite, 0xffffff, Math.round(255 * fade));
            } else if (!f.line) {
                const s = 0.35 + 0.65 * (1 - (1 - k) * (1 - k));
                f.sprite.node.setScale(s, s);
                tint(f.sprite, f.color, Math.round(230 * (1 - k)));
            } else {
                f.sprite.node.setScale(1, 1 - 0.6 * k);
                tint(f.sprite, f.color, Math.round(230 * (1 - k)));
            }
            this.fx[n++] = f;
        }
        this.fx.length = n;
    }

    private stepFloaters(dt: number): void {
        let n = 0;
        for (const f of this.floaters) {
            f.t += dt;
            if (f.t >= f.dur) { f.label.node.active = false; this.floaterPool.push(f.label); continue; }
            const p = f.label.node.position;
            f.label.node.setPosition(p.x, p.y - f.vy * dt * (1 - f.t / f.dur));
            const k = f.t / f.dur;
            f.label.color = hexColor(tmpColor, f.color, Math.round(255 * Math.min(1, (1 - k) * 2.5)));
            this.floaters[n++] = f;
        }
        this.floaters.length = n;
    }
}
