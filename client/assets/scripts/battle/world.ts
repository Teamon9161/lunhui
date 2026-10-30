import { Rng } from './rng';
import { SpatialHash } from './grid';
import type { BattleEvent, Dao, DamageOpts, Dash, HeroState, Projectile, Side, Status, Unit, Zone } from './types';
import { DAOS } from './types';
import {
    CHUSHENG_PET_ATK, CHUSHENG_PET_HP, DAO_DEFS, DIYU_ALTAR_DRAIN, DIYU_AURA_DPS, DIYU_AURA_R, EGUI_KILL_HEAL,
    GROWTH_PER_SHI, NATURE_WEIGHT, REVIVE_TIME, XIULUO_LEASH, XIULUO_RAMP_MAX, XIULUO_RAMP_PER_HIT,
} from './dao';
import type { ActTiming, EnemyDef, HeroDef, ProjectileHook } from './defs';

// 逻辑坐标：竖屏 720×1280，y 向下。敌人从顶部来，英雄守在防线以下。
export const FIELD = { W: 720, H: 1280, LINE_Y: 560, ALTAR_X: 360, ALTAR_Y: 1170, SPAWN_Y: -30 };
export const TICK = 1 / 30;
// 全局调参旋钮，机器人模拟用来扫数值
export const TUNING = { enemyAtkMul: 1, enemySpeedMul: 1 };
const SLOW_TICK = 0.5;
const MELEE_LEASH = 140;
const RANGED_LEASH_PAD = 40;
const ENEMY_AGGRO = 100;
const BOSS_AGGRO = 230;
const TAUNT_EXTRA_CAP = 3;
const MANA_PER_HP_LOST = 40; // 掉满血量回 40 法力
const ABOVE_LINE_STOP = 50;
const CAST_SEARCH = 360;

function newStatus(): Status {
    return { stun: 0, root: 0, slow: 0, slowPct: 0, vuln: 0, vulnPct: 0, burn: 0, burnDps: 0, burnSrc: 0, untargetable: 0 };
}

export interface BattleStats {
    dmg: Record<string, number>;
    kills: Record<string, number>;
    heal: Record<string, number>;
    casts: Record<string, number>;
    deaths: Record<string, number>;
    maxChain: number;
}

export interface WorldOptions {
    seed: number;
    heroDefs: Record<string, HeroDef>;
    enemyDefs: Record<string, EnemyDef>;
    altarHp: number;
}

export class World {
    readonly rng: Rng;
    time = 0;
    tickN = 0;
    units: Unit[] = [];
    projectiles: Projectile[] = [];
    zones: Zone[] = [];
    events: BattleEvent[] = [];
    readonly heroDefs: Record<string, HeroDef>;
    readonly enemyDefs: Record<string, EnemyDef>;
    readonly projHooks: Record<string, ProjectileHook> = {};
    readonly heroStates = new Map<number, HeroState>();
    readonly stats: BattleStats = { dmg: {}, kills: {}, heal: {}, casts: {}, deaths: {}, maxChain: 0 };
    altar: Unit;
    reviveMul = 1;
    // 战斗控制层（波次、首领词缀）挂在这里
    readonly tickHooks: ((dt: number) => void)[] = [];
    readonly heroDeathHooks: ((hero: Unit, killer: Unit | null) => void)[] = [];
    readonly enemyDeathHooks: ((enemy: Unit, killer: Unit | null) => void)[] = [];
    over = false;
    win = false;

    private byId = new Map<number, Unit>();
    private grid = new SpatialHash<Unit>(64);
    private nextId = 1;
    private tasks: { t: number; fn: () => void }[] = [];
    private chains = new Map<number, number>();
    private nextChain = 1;
    private slowAcc = 0;
    private tmp: Unit[] = [];

    constructor(opts: WorldOptions) {
        this.rng = new Rng(opts.seed);
        this.heroDefs = opts.heroDefs;
        this.enemyDefs = opts.enemyDefs;
        this.altar = this.addUnit({
            side: 'hero', kind: 'altar', defId: 'altar', name: '法坛', x: FIELD.ALTAR_X, y: FIELD.ALTAR_Y, r: 48,
            hp: opts.altarHp, maxHp: opts.altarHp, atk: 30, atkCd: 1, range: 90, speed: 0, mass: 1e9,
        });
    }

    // ---------- 单位 ----------

    addUnit(p: Partial<Unit> & { side: Side; kind: Unit['kind']; defId: string; x: number; y: number }): Unit {
        const u: Unit = {
            id: this.nextId++, r: 16, name: '', hp: 100, maxHp: 100, atk: 10, atkCd: 1, atkTimer: 0, range: 40,
            speed: 80, shield: 0, mana: 0, manaMax: 100, manaPerHit: 0, dead: false, removed: false, ranged: false,
            mass: 1, target: 0, anchorX: p.x, anchorY: p.y, leash: MELEE_LEASH, blockCap: 1, engagedBy: 0, engage: 0,
            atkSpeedMul: 1, moveMul: 1, dmgTakenMul: 1, lifesteal: 0, st: newStatus(), dao: 'ren', shiShu: 0,
            reviveT: 0, buddha: false, ownerId: 0, expireT: 0, vars: {}, ai: 'melee', affixes: [], facing: 1,
            kx: 0, ky: 0, dash: null, act: null, anim: 'idle', animT: 0,
            ...p,
        };
        this.units.push(u);
        this.byId.set(u.id, u);
        this.events.push({ type: 'spawn', unit: u.id });
        return u;
    }

    get(id: number): Unit | undefined {
        return this.byId.get(id);
    }

    heroDef(u: Unit): HeroDef | undefined {
        return u.kind === 'hero' ? this.heroDefs[u.defId] : undefined;
    }

    heroes(): Unit[] {
        return this.units.filter(u => u.kind === 'hero');
    }

    aliveHeroes(): Unit[] {
        return this.units.filter(u => u.kind === 'hero' && !u.dead);
    }

    enemies(): Unit[] {
        return this.units.filter(u => u.side === 'enemy' && !u.dead);
    }

    spawnHero(def: HeroDef, state: HeroState, anchorX: number, anchorY: number): Unit {
        const u = this.addUnit({
            side: 'hero', kind: 'hero', defId: def.id, name: def.name, x: anchorX, y: anchorY, r: def.r,
            anchorX, anchorY, blockCap: def.blockCap, manaPerHit: def.manaPerHit, dao: state.dao,
            shiShu: state.shiShu, buddha: state.buddha, mass: 3,
        });
        this.heroStates.set(u.id, state);
        if (def.projHooks) Object.assign(this.projHooks, def.projHooks);
        this.applyHeroStats(u);
        u.hp = u.maxHp;
        if (u.buddha) u.st.untargetable = Infinity;
        def.onSpawn?.(this, u);
        this.onDaoEnter(u);
        return u;
    }

    applyHeroStats(u: Unit): void {
        const def = this.heroDefs[u.defId];
        const d = DAO_DEFS[u.dao];
        const growth = 1 + GROWTH_PER_SHI * u.shiShu;
        const ratio = u.maxHp > 0 ? u.hp / u.maxHp : 1;
        u.maxHp = Math.round(def.hp * growth * d.hpMul);
        u.hp = Math.min(u.maxHp, Math.round(u.maxHp * ratio));
        u.atk = def.atk * growth * d.atkMul;
        u.atkCd = def.atkCd;
        u.speed = def.speed;
        u.atkSpeedMul = d.atkSpeedMul;
        u.moveMul = d.moveMul;
        u.dmgTakenMul = d.dmgTakenMul;
        u.lifesteal = d.lifesteal;
        u.vars.ramp = 0;
        // 修罗：远程也变近战
        const melee = u.dao === 'xiuluo' || !def.shot;
        u.ranged = !melee;
        u.range = melee ? Math.min(def.range, 55) : def.range;
        if (u.dao === 'xiuluo') u.leash = XIULUO_LEASH;
        else if (u.dao === 'egui') u.leash = 2000;
        else u.leash = u.ranged ? u.range + RANGED_LEASH_PAD : MELEE_LEASH;
    }

    spawnEnemy(defId: string, x: number, y: number, scale = 1): Unit {
        const def = this.enemyDefs[defId];
        const hp = Math.round(def.hp * scale);
        const u = this.addUnit({
            side: 'enemy', kind: def.kind, defId, name: def.name, x, y, r: def.r, hp, maxHp: hp,
            atk: def.atk * Math.sqrt(scale) * TUNING.enemyAtkMul, atkCd: def.atkCd, range: def.range, speed: def.speed * TUNING.enemySpeedMul, ranged: def.ranged,
            mass: def.mass ?? (def.kind === 'boss' ? 20 : def.kind === 'elite' ? 4 : 1),
            ai: def.ai ?? (def.kind === 'boss' ? 'boss' : def.ranged ? 'ranged' : 'melee'),
            atkTimer: this.rng.range(0, def.atkCd),
        });
        def.onSpawn?.(this, u);
        return u;
    }

    spawnSummon(owner: Unit, p: { defId: string; name: string; x: number; y: number; hp: number; atk: number; life: number; r?: number; speed?: number; range?: number; atkCd?: number }): Unit {
        return this.addUnit({
            side: owner.side, kind: 'summon', defId: p.defId, name: p.name, x: p.x, y: p.y, r: p.r ?? 10,
            hp: p.hp, maxHp: p.hp, atk: p.atk, atkCd: p.atkCd ?? 0.8, range: p.range ?? 30, speed: p.speed ?? 150,
            ownerId: owner.id, expireT: this.time + p.life, blockCap: 1, leash: 180,
        });
    }

    removeSummons(owner: Unit, defId?: string): void {
        for (const s of this.units) {
            if (s.kind === 'summon' && s.ownerId === owner.id && !s.dead && (!defId || s.defId === defId)) {
                s.dead = true;
                this.events.push({ type: 'death', unit: s.id, x: s.x, y: s.y, kind: 'summon' });
            }
        }
    }

    // ---------- 查询 ----------

    // 在 (x,y) 半径 r 内、属于 side 的可选中活单位（不含法坛）
    query(x: number, y: number, r: number, side: Side): Unit[] {
        const out: Unit[] = [];
        this.grid.query(x, y, r, this.tmp);
        for (const u of this.tmp) {
            if (u.side === side && !u.dead && u.kind !== 'altar' && u.st.untargetable <= 0) out.push(u);
        }
        return out;
    }

    queryLine(x0: number, y0: number, x1: number, y1: number, width: number, side: Side): Unit[] {
        const out: Unit[] = [];
        const dx = x1 - x0, dy = y1 - y0, len2 = dx * dx + dy * dy || 1;
        for (const u of this.units) {
            if (u.side !== side || u.dead || u.kind === 'altar' || u.st.untargetable > 0) continue;
            const t = Math.max(0, Math.min(1, ((u.x - x0) * dx + (u.y - y0) * dy) / len2));
            const px = x0 + dx * t, py = y0 + dy * t;
            const rr = width + u.r;
            if ((u.x - px) ** 2 + (u.y - py) ** 2 <= rr * rr) out.push(u);
        }
        return out;
    }

    targetable(u: Unit | undefined): u is Unit {
        return !!u && !u.dead && !u.removed && u.st.untargetable <= 0;
    }

    nearest(x: number, y: number, side: Side, maxR = 4000, filter?: (u: Unit) => boolean): Unit | null {
        let best: Unit | null = null, bd = Infinity;
        for (const u of this.units) {
            if (u.side !== side || u.dead || u.kind === 'altar' || u.st.untargetable > 0) continue;
            if (filter && !filter(u)) continue;
            const d = Math.hypot(u.x - x, u.y - y);
            if (d < bd && d <= maxR) { bd = d; best = u; }
        }
        return best;
    }

    // 敌人最密的点（以单位为圆心数半径内的数量）
    densest(side: Side, r: number, fromX: number, fromY: number, maxR: number): Unit | null {
        let best: Unit | null = null, bn = -1;
        for (const u of this.units) {
            if (u.side !== side || u.dead || u.kind === 'altar' || u.st.untargetable > 0) continue;
            if (Math.hypot(u.x - fromX, u.y - fromY) > maxR) continue;
            const n = this.query(u.x, u.y, r, side).length;
            if (n > bn) { bn = n; best = u; }
        }
        return best;
    }

    ownerHero(u: Unit | null | undefined): Unit | null {
        if (!u) return null;
        if (u.kind === 'hero') return u;
        if (u.kind === 'summon') return this.ownerHero(this.get(u.ownerId));
        return null;
    }

    // ---------- 效果原语（技能都通过这些改世界） ----------

    damage(src: Unit | null, tgt: Unit, amount: number, opts: DamageOpts = {}): number {
        if (tgt.dead || tgt.st.untargetable > 0 || amount <= 0) return 0;
        let a = amount * tgt.dmgTakenMul * (tgt.st.vuln > 0 ? 1 + tgt.st.vulnPct : 1);
        if (tgt.side === 'enemy') {
            const def = this.enemyDefs[tgt.defId];
            if (def?.onDamaged) a = def.onDamaged(this, tgt, a, src);
        }
        if (a <= 0) return 0;
        let shieldHit = false;
        if (tgt.shield > 0 && !opts.ignoreShield) {
            const s = Math.min(tgt.shield, a);
            tgt.shield -= s;
            a -= s;
            shieldHit = true;
            if (a <= 0) {
                this.events.push({ type: 'damage', target: tgt.id, amount: Math.round(s), x: tgt.x, y: tgt.y, tag: opts.tag ?? 'atk', shield: true, big: false });
                return s;
            }
        }
        const dealt = Math.min(a, tgt.hp);
        tgt.hp -= a;
        const tag = opts.tag ?? 'atk';
        this.events.push({ type: 'damage', target: tgt.id, amount: Math.round(a), x: tgt.x, y: tgt.y, tag, shield: shieldHit, big: tag !== 'atk' });
        if (tgt.kind === 'hero' || tgt.kind === 'boss') { tgt.anim = tgt.anim === 'idle' ? 'hit' : tgt.anim; }
        const credit = this.ownerHero(src);
        if (credit && tgt.side === 'enemy') {
            this.stats.dmg[credit.defId] = (this.stats.dmg[credit.defId] ?? 0) + dealt;
        }
        if (src && src.lifesteal > 0 && !opts.noLifesteal && !src.dead) this.heal(src, src, dealt * src.lifesteal);
        if (tgt.kind === 'hero' && !opts.noMana) tgt.mana = Math.min(tgt.manaMax, tgt.mana + (dealt / tgt.maxHp) * MANA_PER_HP_LOST);
        // 被近身打了会还手
        if (src && tgt.side === 'enemy' && tgt.ai === 'melee' && tgt.engage === 0 && src.side === 'hero' && src.kind !== 'altar'
            && Math.hypot(src.x - tgt.x, src.y - tgt.y) < 90) {
            tgt.engage = src.id;
        }
        if (tgt.hp <= 0) this.kill(tgt, src, opts.chain ?? 0);
        return dealt;
    }

    heal(src: Unit | null, tgt: Unit, amount: number): number {
        if (tgt.dead || amount <= 0 || tgt.kind === 'altar' && tgt.hp >= tgt.maxHp) return 0;
        const real = Math.min(amount, tgt.maxHp - tgt.hp);
        if (real <= 0) return 0;
        tgt.hp += real;
        const credit = this.ownerHero(src);
        if (credit) this.stats.heal[credit.defId] = (this.stats.heal[credit.defId] ?? 0) + real;
        if (real >= 5) this.events.push({ type: 'heal', target: tgt.id, amount: Math.round(real), x: tgt.x, y: tgt.y });
        return real;
    }

    addShield(tgt: Unit, amount: number, cap = 0.6): void {
        if (tgt.dead) return;
        tgt.shield = Math.min(tgt.maxHp * cap, tgt.shield + amount);
    }

    stun(tgt: Unit, t: number): void {
        if (tgt.kind === 'boss') t *= 0.5;
        tgt.st.stun = Math.max(tgt.st.stun, t);
    }

    root(tgt: Unit, t: number): void {
        tgt.st.root = Math.max(tgt.st.root, t);
    }

    slow(tgt: Unit, pct: number, t: number): void {
        tgt.st.slow = Math.max(tgt.st.slow, t);
        tgt.st.slowPct = Math.max(tgt.st.slow > 0 ? tgt.st.slowPct : 0, pct);
    }

    vuln(tgt: Unit, pct: number, t: number): void {
        tgt.st.vuln = Math.max(tgt.st.vuln, t);
        tgt.st.vulnPct = Math.max(tgt.st.vulnPct, pct);
    }

    burn(src: Unit, tgt: Unit, dps: number, t: number): void {
        tgt.st.burn = Math.max(tgt.st.burn, t);
        tgt.st.burnDps = Math.max(tgt.st.burnDps, dps);
        tgt.st.burnSrc = src.id;
    }

    knock(tgt: Unit, fromX: number, fromY: number, dist: number): void {
        const dx = tgt.x - fromX, dy = tgt.y - fromY, d = Math.hypot(dx, dy) || 1;
        const k = dist * 6 / Math.max(1, tgt.mass ** 0.5);
        tgt.kx += (dx / d) * k;
        tgt.ky += (dy / d) * k;
    }

    // 把单位往一点拉（瞬时位移一段）
    pull(tgt: Unit, x: number, y: number, dist: number): void {
        const dx = x - tgt.x, dy = y - tgt.y, d = Math.hypot(dx, dy);
        if (d < 1) return;
        const m = Math.min(d - tgt.r, dist / Math.max(1, tgt.mass ** 0.5));
        if (m <= 0) return;
        tgt.x += (dx / d) * m;
        tgt.y += (dy / d) * m;
    }

    dash(u: Unit, tx: number, ty: number, p: Partial<Dash> = {}): void {
        if (u.side === 'hero') ty = Math.max(ty, FIELD.LINE_Y - 30);
        u.dash = { tx, ty, speed: 700, dmg: 0, width: 30, tag: 'skill', chain: 0, knock: 0, hit: [], onEnd: null, ...p };
    }

    projectile(p: Partial<Projectile> & { side: Side; srcId: number; x: number; y: number }): Projectile {
        const pr: Projectile = {
            id: this.nextId++, targetId: 0, tx: p.x, ty: p.y, speed: 500, kind: 'homing', t: 0, dur: 0.6,
            sx: p.x, sy: p.y, dmg: 0, aoe: 0, tag: 'atk', visual: 'dot', color: 0xffffff, chain: 0, hit: [], data: {},
            dead: false, ...p,
        };
        if (pr.kind === 'lob' && !p.dur) pr.dur = Math.max(0.35, Math.hypot(pr.tx - pr.x, pr.ty - pr.y) / pr.speed);
        this.projectiles.push(pr);
        return pr;
    }

    zone(p: Partial<Zone> & { side: Side; srcId: number; x: number; y: number; dur: number }): Zone {
        const z: Zone = {
            id: this.nextId++, r: 60, x2: p.x, y2: p.y, line: false, t: 0, tickT: 0, dps: 0, slowPct: 0, pull: 0,
            vulnPct: 0, visual: 'fire', color: 0xff6633, chain: 0, dead: false, ...p,
        };
        this.zones.push(z);
        this.events.push({ type: 'fx', name: 'zone:' + z.visual, x: z.x, y: z.y, x2: z.x2, y2: z.y2, r: z.r, color: z.color, dur: z.dur });
        return z;
    }

    schedule(delay: number, fn: () => void): void {
        this.tasks.push({ t: this.time + delay, fn });
    }

    fx(name: string, x: number, y: number, extra: Partial<Extract<BattleEvent, { type: 'fx' }>> = {}): void {
        this.events.push({ type: 'fx', name, x, y, ...extra });
    }

    text(text: string, x: number, y: number, color = 0xffffff): void {
        this.events.push({ type: 'text', text, x, y, color });
    }

    newChain(): number {
        const c = this.nextChain++;
        this.chains.set(c, 0);
        return c;
    }

    // ---------- 死亡与转世 ----------

    kill(u: Unit, src: Unit | null, chain: number): void {
        if (u.dead) return;
        if (u.kind === 'altar') {
            u.hp = 0;
            u.dead = true;
            this.finish(false);
            return;
        }
        if (u.kind === 'hero') { this.heroDie(u, src); return; }
        u.dead = true;
        u.anim = 'dead';
        u.dash = null;
        u.act = null;
        this.events.push({ type: 'death', unit: u.id, x: u.x, y: u.y, kind: u.kind });
        const credit = this.ownerHero(src);
        if (u.side === 'enemy') {
            if (credit) this.stats.kills[credit.defId] = (this.stats.kills[credit.defId] ?? 0) + 1;
            if (chain) {
                const n = (this.chains.get(chain) ?? 0) + 1;
                this.chains.set(chain, n);
                if (n >= 2) this.events.push({ type: 'chain', n, x: u.x, y: u.y });
                if (n > this.stats.maxChain) this.stats.maxChain = n;
            }
            if (src && src.dao === 'egui' && src.kind === 'hero' && !src.dead) this.heal(src, src, src.maxHp * EGUI_KILL_HEAL);
            this.enemyDefs[u.defId]?.onDeath?.(this, u, src);
            for (const fn of this.enemyDeathHooks) fn(u, src);
        }
        for (const h of this.units) {
            if (h.kind === 'hero' && !h.dead) this.heroDefs[h.defId].onAnyDeath?.(this, h, u, src);
        }
    }

    private heroDie(u: Unit, src: Unit | null): void {
        const def = this.heroDefs[u.defId];
        u.dead = true;
        u.anim = 'dead';
        u.dash = null;
        u.act = null;
        u.shield = 0;
        u.vars.deathX = u.x;
        u.vars.deathY = u.y;
        u.reviveT = REVIVE_TIME * (def.reviveMul ?? 1) * this.reviveMul;
        this.stats.deaths[u.defId] = (this.stats.deaths[u.defId] ?? 0) + 1;
        this.events.push({ type: 'death', unit: u.id, x: u.x, y: u.y, kind: 'hero' });
        // 先让凶手的规则生效（孟婆：不加世数）
        if (src && src.side === 'enemy') this.enemyDefs[src.defId]?.onKillHero?.(this, src, u);
        // 阵亡立刻转世：天性那一道权重 ×2
        const from = u.dao;
        u.vars.prevDao = DAOS.indexOf(from);
        const forced = u.vars.forceDiyu ? 'diyu' : null;
        u.vars.forceDiyu = 0;
        const to: Dao = forced ?? this.rng.weighted(DAOS, d => (d === def.nature ? NATURE_WEIGHT : 1));
        const gained = !u.vars.noShiShu;
        u.vars.noShiShu = 0;
        if (gained) u.shiShu++;
        u.dao = to;
        const st = this.heroStates.get(u.id);
        if (st) { st.dao = to; st.shiShu = u.shiShu; }
        this.events.push({ type: 'reincarnate', unit: u.id, from, to, shiShu: u.shiShu, gained });
        this.removeSummons(u, 'pet');
        def.onDeath?.(this, u, src);
        def.onReincarnate?.(this, u);
        for (const h of this.units) {
            if (h.kind === 'hero' && !h.dead) this.heroDefs[h.defId].onAnyDeath?.(this, h, u, src);
        }
        for (const fn of this.heroDeathHooks) fn(u, src);
        // 英雄全灭不算输，法坛还在就继续撑
    }

    private revive(u: Unit): void {
        const def = this.heroDefs[u.defId];
        const dx = u.vars.deathX ?? u.anchorX, dy = u.vars.deathY ?? u.anchorY;
        const pos = def.revivePos?.(this, u, dx, dy) ?? {
            x: FIELD.ALTAR_X + this.rng.range(-70, 70), y: FIELD.ALTAR_Y - 70,
        };
        u.x = pos.x;
        u.y = pos.y;
        u.dead = false;
        u.anim = 'idle';
        u.act = null;
        u.st = newStatus();
        u.kx = u.ky = 0;
        u.mana = 0;
        u.target = 0;
        u.hp = u.maxHp; // 让 applyHeroStats 按满血比例算
        this.applyHeroStats(u);
        u.hp = u.maxHp;
        if (u.buddha) u.st.untargetable = Infinity;
        this.events.push({ type: 'revive', unit: u.id, x: u.x, y: u.y });
        this.onDaoEnter(u);
        def.onRevive?.(this, u, dx, dy);
    }

    private onDaoEnter(u: Unit): void {
        if (u.dao === 'chusheng' && !u.buddha) {
            this.spawnSummon(u, {
                defId: 'pet', name: '兽伴', x: u.x + 20, y: u.y + 10, hp: u.maxHp * CHUSHENG_PET_HP,
                atk: u.atk * CHUSHENG_PET_ATK, life: 1e9, r: 10, speed: 170,
            });
        }
    }

    finish(win: boolean): void {
        if (this.over) return;
        this.over = true;
        this.win = win;
        this.events.push({ type: 'end', win });
    }

    // ---------- 主循环 ----------

    step(): void {
        if (this.over) return;
        const dt = TICK;
        this.time += dt;
        this.tickN++;

        if (this.tasks.length) {
            const due = this.tasks.filter(t => t.t <= this.time);
            if (due.length) {
                this.tasks = this.tasks.filter(t => t.t > this.time);
                for (const t of due) t.fn();
            }
        }

        this.grid.clear();
        for (const u of this.units) if (!u.dead) this.grid.insert(u);
        for (const fn of this.tickHooks) fn(dt);
        if (this.over) return;

        for (const u of this.units) u.engagedBy = 0;
        for (const e of this.units) {
            if (e.side !== 'enemy' || e.dead || !e.engage) continue;
            const h = this.get(e.engage);
            if (h && !h.dead) h.engagedBy++;
        }

        this.slowAcc += dt;
        const slowTick = this.slowAcc >= SLOW_TICK;
        if (slowTick) this.slowAcc -= SLOW_TICK;

        const n = this.units.length;
        for (let i = 0; i < n; i++) {
            const u = this.units[i];
            if (u.dead) {
                if (u.kind === 'hero' && !this.over) {
                    u.reviveT -= dt;
                    if (u.reviveT <= 0) this.revive(u);
                }
                continue;
            }
            this.tickStatus(u, dt, slowTick);
            if (u.dead) continue;
            if (u.kind === 'summon' && this.time >= u.expireT) {
                u.dead = true;
                this.events.push({ type: 'death', unit: u.id, x: u.x, y: u.y, kind: 'summon' });
                continue;
            }
            if (u.animT > 0) { u.animT -= dt; if (u.animT <= 0 && (u.anim === 'attack' || u.anim === 'cast' || u.anim === 'hit')) u.anim = 'idle'; }
            if (u.kind === 'hero') this.heroDefs[u.defId].onTick?.(this, u, dt);
            else if (u.side === 'enemy') this.enemyDefs[u.defId]?.onTick?.(this, u, dt);
            if (u.dead) continue;
            if (u.act) { this.stepAct(u, dt); continue; }
            if (u.dash) { this.stepDash(u, dt); continue; }
            if (u.st.stun > 0) continue;
            if (u.kind === 'altar') this.altarAI(u, dt);
            else if (u.side === 'hero') this.heroAI(u, dt);
            else this.enemyAI(u, dt);
        }

        this.stepProjectiles(dt);
        this.stepZones(dt);
        this.separate(dt);

        if (this.units.length > 400 && this.tickN % 90 === 0) this.compact();
    }

    private compact(): void {
        this.units = this.units.filter(u => {
            const keep = !u.dead || u.kind === 'hero';
            if (!keep) this.byId.delete(u.id);
            return keep;
        });
    }

    private tickStatus(u: Unit, dt: number, slowTick: boolean): void {
        const s = u.st;
        if (s.stun > 0) s.stun -= dt;
        if (s.root > 0) s.root -= dt;
        if (s.slow > 0) { s.slow -= dt; if (s.slow <= 0) s.slowPct = 0; }
        if (s.vuln > 0) { s.vuln -= dt; if (s.vuln <= 0) s.vulnPct = 0; }
        if (s.untargetable > 0 && s.untargetable !== Infinity) s.untargetable -= dt;
        if (u.kx || u.ky) {
            u.x += u.kx * dt;
            u.y += u.ky * dt;
            u.kx *= 0.82;
            u.ky *= 0.82;
            if (Math.abs(u.kx) + Math.abs(u.ky) < 4) u.kx = u.ky = 0;
        }
        if (!slowTick) return;
        if (s.burn > 0) {
            s.burn -= SLOW_TICK;
            this.damage(this.get(s.burnSrc) ?? null, u, s.burnDps * SLOW_TICK, { tag: 'burn', noLifesteal: true, noMana: true });
            if (s.burn <= 0) s.burnDps = 0;
        }
        if (u.kind === 'hero' && u.dao === 'diyu' && !u.dead) {
            for (const e of this.query(u.x, u.y, DIYU_AURA_R, 'enemy')) {
                this.damage(u, e, u.atk * DIYU_AURA_DPS * SLOW_TICK, { tag: 'burn', noLifesteal: true });
            }
            this.altar.hp = Math.max(1, this.altar.hp - DIYU_ALTAR_DRAIN * SLOW_TICK);
        }
    }

    private stepDash(u: Unit, dt: number): void {
        const d = u.dash!;
        const dx = d.tx - u.x, dy = d.ty - u.y, dist = Math.hypot(dx, dy);
        const stepLen = d.speed * dt;
        const nx = dist <= stepLen ? d.tx : u.x + (dx / dist) * stepLen;
        const ny = dist <= stepLen ? d.ty : u.y + (dy / dist) * stepLen;
        if (d.dmg > 0) {
            const foe: Side = u.side === 'hero' ? 'enemy' : 'hero';
            for (const e of this.queryLine(u.x, u.y, nx, ny, d.width, foe)) {
                if (d.hit.indexOf(e.id) >= 0) continue;
                d.hit.push(e.id);
                this.damage(u, e, d.dmg, { tag: d.tag, chain: d.chain });
                if (d.knock) this.knock(e, u.x, u.y, d.knock);
            }
        }
        if (Math.abs(dx) > 1) u.facing = dx > 0 ? 1 : -1;
        u.x = nx;
        u.y = ny;
        u.anim = 'move';
        if (dist <= stepLen) {
            const end = d.onEnd;
            u.dash = null;
            u.anim = 'idle';
            end?.();
        }
    }

    // ---------- AI ----------

    private moveToward(u: Unit, x: number, y: number, stop: number, dt: number): boolean {
        if (u.st.root > 0) return false;
        const dx = x - u.x, dy = y - u.y, d = Math.hypot(dx, dy);
        if (d <= stop) return true;
        const sp = u.speed * u.moveMul * (u.st.slow > 0 ? 1 - u.st.slowPct : 1) * dt;
        const m = Math.min(sp, d - stop);
        u.x += (dx / d) * m;
        u.y += (dy / d) * m;
        if (Math.abs(dx) > 2) u.facing = dx > 0 ? 1 : -1;
        if (u.anim === 'idle') u.anim = 'move';
        if (u.side === 'hero' && u.kind !== 'altar') u.y = Math.max(u.y, FIELD.LINE_Y);
        return d - m <= stop + 0.5;
    }

    private inReach(u: Unit, t: Unit): boolean {
        return Math.hypot(t.x - u.x, t.y - u.y) <= u.range + u.r + t.r;
    }

    private atkRate(u: Unit): number {
        return u.atkSpeedMul * (1 + (u.vars.ramp ?? 0));
    }

    private actTiming(u: Unit): ActTiming | undefined {
        if (u.kind === 'hero') return this.heroDefs[u.defId]?.timing;
        if (u.side === 'enemy') return this.enemyDefs[u.defId]?.timing;
        return undefined;
    }

    private tryAttack(u: Unit, t: Unit, dt: number): void {
        u.atkTimer -= dt * this.atkRate(u);
        if (u.atkTimer > 0) return;
        u.atkTimer = u.atkCd;
        if (Math.abs(t.x - u.x) > 2) u.facing = t.x > u.x ? 1 : -1;
        const timing = this.actTiming(u)?.attack;
        if (timing) { this.startAct(u, 'attack', timing, t); return; }
        u.anim = 'attack';
        u.animT = 0.25;
        this.releaseAttack(u, t, t.x, t.y);
    }

    // 普攻结算。t 为空表示前摇期间目标已失效：远程打向最后位置，近战落空
    private releaseAttack(u: Unit, t: Unit | null, tx: number, ty: number): void {
        const hdef = this.heroDef(u);
        const edef = u.side === 'enemy' ? this.enemyDefs[u.defId] : undefined;
        const shot = u.ranged ? (hdef?.shot ?? edef?.shot) : undefined;
        if (shot) {
            this.projectile({
                side: u.side, srcId: u.id, x: u.x, y: u.y - u.r, targetId: t ? t.id : 0, tx, ty, speed: shot.speed,
                kind: shot.kind, dmg: u.atk, aoe: shot.aoe, visual: shot.visual, color: hdef?.color ?? edef?.color ?? 0xffffff,
            });
        } else if (t) {
            this.damage(u, t, u.atk);
        }
        if (!t) return;
        if (u.kind === 'hero') {
            u.mana = Math.min(u.manaMax, u.mana + u.manaPerHit);
            if (u.dao === 'xiuluo') u.vars.ramp = Math.min(XIULUO_RAMP_MAX, (u.vars.ramp ?? 0) + XIULUO_RAMP_PER_HIT);
            hdef?.onAttack?.(this, u, t);
        } else if (edef?.onAttack) {
            edef.onAttack(this, u, t);
        }
    }

    cast(u: Unit): void {
        const def = this.heroDefs[u.defId];
        u.mana = 0;
        const dao: Dao = u.buddha ? 'ren' : u.dao;
        this.stats.casts[u.defId] = (this.stats.casts[u.defId] ?? 0) + 1;
        this.events.push({ type: 'cast', unit: u.id, skill: def.skillNames[dao], dao, x: u.x, y: u.y });
        const timing = def.timing?.cast;
        if (timing) { this.startAct(u, 'cast', timing, null); return; }
        u.anim = 'cast';
        u.animT = 0.45;
        def.cast[dao](this, u);
    }

    private releaseCast(u: Unit): void {
        const dao: Dao = u.buddha ? 'ren' : u.dao;
        this.heroDefs[u.defId].cast[dao](this, u);
    }

    // 带前摇的出手：动作期间不移动、不换目标，前摇结束时结算。普攻的前摇和收势随攻速缩短
    private startAct(u: Unit, kind: 'attack' | 'cast', timing: [number, number], t: Unit | null): void {
        const rate = kind === 'attack' ? this.atkRate(u) : 1;
        const windup = timing[0] / rate, recover = timing[1] / rate;
        const tx = t ? t.x : u.x, ty = t ? t.y : u.y;
        u.act = { kind, t: 0, windup, recover, released: false, targetId: t ? t.id : 0, tx, ty };
        u.anim = kind;
        u.animT = windup + recover;
        this.events.push({ type: 'act', unit: u.id, act: kind, windup, dur: windup + recover, tx, ty });
    }

    private stepAct(u: Unit, dt: number): void {
        const a = u.act!;
        if (!a.released && u.st.stun > 0) {
            u.act = null;
            u.anim = 'idle';
            u.animT = 0;
            this.events.push({ type: 'actCancel', unit: u.id });
            return;
        }
        // 动作期间攻击冷却照常走，出手节奏仍由 atkCd 决定
        if (a.kind === 'attack') u.atkTimer -= dt * this.atkRate(u);
        a.t += dt;
        if (!a.released) {
            const t = this.get(a.targetId);
            const valid = this.targetable(t) && t.side !== u.side;
            if (valid) { a.tx = t.x; a.ty = t.y; }
            if (a.t < a.windup - 1e-6) return;
            a.released = true;
            if (a.kind === 'attack') this.releaseAttack(u, valid ? t : null, a.tx, a.ty);
            else this.releaseCast(u);
            // 技能里发起了冲刺，交给冲刺接管
            if (u.dash) { u.act = null; return; }
        }
        if (a.t >= a.windup + a.recover) {
            u.act = null;
            if (u.anim === a.kind) u.anim = 'idle';
        }
    }

    private altarAI(u: Unit, dt: number): void {
        u.atkTimer -= dt;
        if (u.atkTimer > 0) return;
        const t = this.nearest(u.x, u.y, 'enemy', u.range + u.r);
        if (!t) return;
        u.atkTimer = u.atkCd;
        this.fx('zap', u.x, u.y - 40, { x2: t.x, y2: t.y, color: 0xffe08a });
        this.damage(u, t, u.atk, { tag: 'altar' });
    }

    private heroValidTarget(u: Unit, t: Unit | undefined): t is Unit {
        if (!this.targetable(t) || t.side === u.side) return false;
        if (u.kind === 'summon') return true;
        if (u.dao === 'egui') return t.y >= FIELD.LINE_Y - 60;
        const d = Math.hypot(t.x - u.anchorX, t.y - u.anchorY);
        if (d > u.leash + t.r) return false;
        if (!u.ranged && t.y < FIELD.LINE_Y - u.range - t.r) return false;
        return true;
    }

    private heroPick(u: Unit): Unit | null {
        let best: Unit | null = null, bestScore = Infinity;
        const cx = u.kind === 'summon' ? (this.get(u.ownerId)?.x ?? u.x) : u.anchorX;
        const cy = u.kind === 'summon' ? (this.get(u.ownerId)?.y ?? u.y) : u.anchorY;
        const pool = u.dao === 'egui' && u.kind === 'hero' ? this.enemies() : this.query(cx, cy, u.leash, 'enemy');
        for (const e of pool) {
            if (!this.heroValidTarget(u, e)) continue;
            const d = Math.hypot(e.x - u.x, e.y - u.y);
            let score: number;
            if (u.kind === 'hero' && u.dao === 'xiuluo') score = -e.maxHp * 10 + d;
            else if (u.kind === 'hero' && u.dao === 'egui') score = (e.hp / e.maxHp) * 1000 + d * 0.5;
            else {
                // 正在打我的 > 正在打队友的 > 正在冲法坛的 > 最近的
                const tier = e.engage === u.id || e.target === u.id ? 0 : e.engage ? 1 : e.target === this.altar.id ? 2 : 3;
                score = tier * 10000 + d;
            }
            if (score < bestScore) { bestScore = score; best = e; }
        }
        return best;
    }

    private heroAI(u: Unit, dt: number): void {
        // 法力满了就放，不必等下一次普攻
        if (u.kind === 'hero' && u.mana >= u.manaMax && this.nearest(u.x, u.y, 'enemy', CAST_SEARCH)) {
            this.cast(u);
            return;
        }
        let t = this.get(u.target);
        if (!this.heroValidTarget(u, t)) {
            t = this.heroPick(u) ?? undefined;
            u.target = t ? t.id : 0;
            if (u.kind === 'hero') u.vars.ramp = 0;
        }
        if (!t) {
            // 没敌人就回阵位；召唤物跟着主人
            const owner = u.kind === 'summon' ? this.get(u.ownerId) : null;
            const hx = owner && !owner.dead ? owner.x + 24 : u.anchorX;
            const hy = owner && !owner.dead ? owner.y + 16 : u.anchorY;
            if (this.moveToward(u, hx, hy, 4, dt)) { if (u.anim === 'move') u.anim = 'idle'; }
            return;
        }
        if (this.inReach(u, t)) {
            if (u.anim === 'move') u.anim = 'idle';
            this.tryAttack(u, t, dt);
        } else {
            this.moveToward(u, t.x, t.y, u.range + u.r + t.r - 2, dt);
            // 被防线挡住够不到：远程照打，近战放弃
            if (!this.inReach(u, t) && u.y <= FIELD.LINE_Y + 0.5 && t.y < FIELD.LINE_Y && !u.ranged) {
                if (Math.hypot(t.x - u.x, t.y - u.y) > u.range + u.r + t.r + 30) u.target = 0;
            }
        }
    }

    private canBlock(h: Unit): boolean {
        return !h.dead && h.st.untargetable <= 0 && h.engagedBy < h.blockCap;
    }

    private tauntHero(e: Unit, within: number): Unit | null {
        for (const h of this.units) {
            if (h.kind !== 'hero' || h.dead || h.st.untargetable > 0) continue;
            const r = this.heroDefs[h.defId].taunt;
            if (!r) continue;
            if (Math.hypot(h.x - e.x, h.y - e.y) <= Math.max(r, within) && h.engagedBy < h.blockCap + TAUNT_EXTRA_CAP) return h;
        }
        return null;
    }

    private enemyAI(u: Unit, dt: number): void {
        if (u.ai === 'none') return;
        // 防线以上不停留：远程和首领也要压到防线附近才开打，否则近战英雄够不着
        if (u.y < FIELD.LINE_Y - (u.ranged ? 0 : ABOVE_LINE_STOP) && !u.engage) {
            this.moveToward(u, this.altar.x, this.altar.y, 0, dt);
            return;
        }
        let t: Unit | undefined | null;
        if (u.ai === 'melee') {
            t = this.get(u.engage);
            if (!t || t.dead || t.st.untargetable > 0 || Math.hypot(t.x - u.x, t.y - u.y) > u.range + u.r + t.r + 60) {
                u.engage = 0;
                t = this.tauntHero(u, 0) ?? this.nearest(u.x, u.y, 'hero', ENEMY_AGGRO, h => this.canBlock(h));
                if (t) { u.engage = t.id; t.engagedBy++; }
            }
        } else if (u.ai === 'rush') {
            t = null;
        } else if (u.ai === 'hound') {
            // 哮天犬：不管拦截，直扑后排
            t = this.get(u.target);
            if (!this.targetable(t) || t.kind !== 'hero') {
                const back = this.aliveHeroes().filter(h => h.ranged && h.st.untargetable <= 0).sort((a, b) => a.hp - b.hp)[0];
                t = back ?? this.nearest(u.x, u.y, 'hero');
            }
        } else if (u.ai === 'ranged') {
            t = this.get(u.target);
            if (!this.targetable(t) || t.side !== 'hero' || t.kind === 'altar' || !this.inReach(u, t)) {
                t = this.tauntHero(u, u.range) ?? this.nearest(u.x, u.y, 'hero', u.range + u.r + 20);
            }
        } else {
            t = this.get(u.target);
            if (!this.targetable(t) || t.kind === 'altar' || Math.hypot(t.x - u.x, t.y - u.y) > BOSS_AGGRO + 40) {
                t = this.tauntHero(u, BOSS_AGGRO) ?? this.nearest(u.x, u.y, 'hero', BOSS_AGGRO);
            }
        }
        if (!t) t = this.altar;
        u.target = t.id;
        if (this.inReach(u, t)) {
            if (u.anim === 'move') u.anim = 'idle';
            this.tryAttack(u, t, dt);
        } else {
            this.moveToward(u, t.x, t.y, u.range + u.r + t.r - 2, dt);
        }
    }

    // ---------- 弹道与区域 ----------

    private stepProjectiles(dt: number): void {
        for (const p of this.projectiles) {
            if (p.dead) continue;
            p.t += dt;
            if (p.kind === 'lob') {
                const k = Math.min(1, p.t / p.dur);
                p.x = p.sx + (p.tx - p.sx) * k;
                p.y = p.sy + (p.ty - p.sy) * k;
                if (k >= 1) this.hitProjectile(p, null);
                continue;
            }
            if (p.kind === 'homing') {
                const t = this.get(p.targetId);
                if (t && !t.dead) { p.tx = t.x; p.ty = t.y; }
                const dx = p.tx - p.x, dy = p.ty - p.y, d = Math.hypot(dx, dy);
                const s = p.speed * dt;
                if (d <= s + (t ? t.r : 4)) {
                    p.x = p.tx; p.y = p.ty;
                    this.hitProjectile(p, t && !t.dead ? t : null);
                } else {
                    p.x += (dx / d) * s;
                    p.y += (dy / d) * s;
                }
                continue;
            }
            // line：直线穿透，打到每个敌人一次
            const dx = p.tx - p.sx, dy = p.ty - p.sy, d = Math.hypot(dx, dy) || 1;
            const nx = p.x + (dx / d) * p.speed * dt, ny = p.y + (dy / d) * p.speed * dt;
            const foe: Side = p.side === 'hero' ? 'enemy' : 'hero';
            for (const e of this.queryLine(p.x, p.y, nx, ny, p.aoe || 14, foe)) {
                if (p.hit.indexOf(e.id) >= 0) continue;
                p.hit.push(e.id);
                this.damage(this.get(p.srcId) ?? null, e, p.dmg, { tag: p.tag, chain: p.chain });
                this.projHooks[p.tag]?.(this, p, e);
            }
            p.x = nx; p.y = ny;
            if (p.t * p.speed >= d) p.dead = true;
        }
        if (this.projectiles.length > 64 && this.tickN % 30 === 0) this.projectiles = this.projectiles.filter(p => !p.dead);
    }

    private hitProjectile(p: Projectile, hit: Unit | null): void {
        p.dead = true;
        const src = this.get(p.srcId) ?? null;
        const foe: Side = p.side === 'hero' ? 'enemy' : 'hero';
        if (p.aoe > 0) {
            this.fx('boom', p.x, p.y, { r: p.aoe, color: p.color, unit: p.srcId });
            for (const e of this.query(p.x, p.y, p.aoe, foe)) this.damage(src, e, p.dmg, { tag: p.tag, chain: p.chain });
            if (foe === 'hero' && Math.hypot(this.altar.x - p.x, this.altar.y - p.y) <= p.aoe + this.altar.r) {
                this.damage(src, this.altar, p.dmg, { tag: p.tag });
            }
        } else if (hit) {
            this.damage(src, hit, p.dmg, { tag: p.tag, chain: p.chain });
        }
        this.projHooks[p.tag]?.(this, p, hit);
    }

    private stepZones(dt: number): void {
        for (const z of this.zones) {
            if (z.dead) continue;
            z.t += dt;
            if (z.t >= z.dur) { z.dead = true; continue; }
            const foe: Side = z.side === 'hero' ? 'enemy' : 'hero';
            const inside = z.line ? this.queryLine(z.x, z.y, z.x2, z.y2, z.r, foe) : this.query(z.x, z.y, z.r, foe);
            if (z.pull > 0) for (const e of inside) this.pull(e, z.x, z.y, z.pull * dt);
            z.tickT -= dt;
            if (z.tickT > 0) continue;
            z.tickT = 0.25;
            const src = this.get(z.srcId) ?? null;
            for (const e of inside) {
                if (z.dps > 0) this.damage(src, e, z.dps * 0.25, { tag: 'zone', chain: z.chain, noLifesteal: true, noMana: true });
                if (z.slowPct > 0) this.slow(e, z.slowPct, 0.4);
                if (z.vulnPct > 0) this.vuln(e, z.vulnPct, 0.4);
            }
        }
        if (this.zones.length > 32 && this.tickN % 30 === 0) this.zones = this.zones.filter(z => !z.dead);
    }

    // 圆与圆挤开；法坛不动，首领很重
    private separate(dt: number): void {
        for (const u of this.units) {
            if (u.dead || u.kind === 'altar' || u.st.untargetable > 0) continue;
            this.grid.query(u.x, u.y, u.r * 2 + 8, this.tmp);
            for (const o of this.tmp) {
                if (o === u || o.dead || o.st.untargetable > 0 || o.id < u.id && o.kind !== 'altar') continue;
                const dx = u.x - o.x, dy = u.y - o.y;
                const min = (u.r + o.r) * 0.85;
                const d2 = dx * dx + dy * dy;
                if (d2 >= min * min) continue;
                const d = Math.sqrt(d2) || 0.01;
                const push = (min - d) * Math.min(1, dt * 12);
                const nx = d2 ? dx / d : this.rng.range(-1, 1), ny = d2 ? dy / d : this.rng.range(-1, 1);
                const wu = o.mass / (u.mass + o.mass), wo = u.mass / (u.mass + o.mass);
                u.x += nx * push * wu; u.y += ny * push * wu;
                if (o.kind !== 'altar') { o.x -= nx * push * wo; o.y -= ny * push * wo; }
            }
            u.x = Math.max(u.r, Math.min(FIELD.W - u.r, u.x));
            u.y = Math.max(FIELD.SPAWN_Y - 40, Math.min(FIELD.H - u.r, u.y));
            if (u.side === 'hero' && !u.dash && u.kind !== 'summon') u.y = Math.max(u.y, FIELD.LINE_Y - 30);
        }
    }

    drainEvents(): BattleEvent[] {
        const ev = this.events;
        this.events = [];
        return ev;
    }
}
