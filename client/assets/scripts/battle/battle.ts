import { World, FIELD } from './world';
import type { BattleStats } from './world';
import type { HeroState, Unit } from './types';
import { HEROES } from './heroes/index';
import { MINIONS, CHAPTER_POOL, CHAPTER_ELITE } from './enemies';
import { BOSSES } from './bosses';
import type { EnemyDef } from './defs';

export const ENEMY_DEFS: Record<string, EnemyDef> = { ...MINIONS, ...BOSSES };

export const AFFIXES: Record<string, string> = {
    kuangbao: '狂暴', fenhun: '分魂', xihun: '吸魂', zhenhun: '镇魂', hufa: '护法', cuibing: '催兵',
};
export const AFFIX_IDS = Object.keys(AFFIXES);

export type StationType = 'normal' | 'elite' | 'boss';

export interface BattleConfig {
    seed: number;
    chapter: number;
    station: number;
    type: StationType;
    boss?: string[];
    affixes?: string[];
    altarHp: number;
    altarMaxHp: number;
}

export interface BattleResult {
    win: boolean;
    time: number;
    altarHp: number;
    stats: BattleStats;
    heroes: HeroState[];
}

const WAVE_PAUSE = 2;
const SPAWN_GAP = 0.45;
const FRONT_Y = FIELD.LINE_Y + 90;
const BACK_Y = FIELD.LINE_Y + 320;

export class Battle {
    readonly world: World;
    readonly config: BattleConfig;
    readonly team: HeroState[];
    private waves: string[][] = [];
    private waveIdx = -1;
    private queue: { t: number; id: string }[] = [];
    private pauseT = 1;
    private bosses: Unit[] = [];
    private bossSpawned = false;
    private trickleT = 8;

    constructor(config: BattleConfig, team: HeroState[]) {
        this.config = config;
        this.team = team;
        this.world = new World({ seed: config.seed, heroDefs: HEROES, enemyDefs: ENEMY_DEFS, altarHp: config.altarMaxHp });
        this.world.altar.hp = config.altarHp;
        this.placeHeroes();
        this.buildWaves();
        this.world.tickHooks.push(dt => this.control(dt));
    }

    private placeHeroes(): void {
        const front = this.team.filter(s => HEROES[s.heroId].role === 'tank' || HEROES[s.heroId].role === 'melee');
        const back = this.team.filter(s => !front.includes(s));
        // 坦克站中间
        front.sort((a, b) => (HEROES[a.heroId].role === 'tank' ? 0 : 1) - (HEROES[b.heroId].role === 'tank' ? 0 : 1));
        const order = (n: number) => { const idx: number[] = []; for (let i = 0; i < n; i++) idx.push(i); return idx.sort((a, b) => Math.abs(a - (n - 1) / 2) - Math.abs(b - (n - 1) / 2)); };
        const fo = order(front.length);
        front.forEach((s, i) => this.world.spawnHero(HEROES[s.heroId], s, (FIELD.W * (fo[i] + 1)) / (front.length + 1), FRONT_Y));
        back.forEach((s, i) => this.world.spawnHero(HEROES[s.heroId], s, (FIELD.W * (i + 1)) / (back.length + 1), BACK_Y));
    }

    private pickMinion(): string {
        return this.world.rng.weighted(CHAPTER_POOL[this.config.chapter], p => p.w).id;
    }

    private buildWaves(): void {
        const { type, station, chapter } = this.config;
        if (type === 'boss') {
            this.waves = [Array.from({ length: 6 }, () => this.pickMinion())];
            return;
        }
        const total = 14 + 3 * (station - 1) + 2 * (chapter - 1);
        const nWaves = type === 'elite' ? 2 : 3;
        for (let i = 0; i < nWaves; i++) {
            const n = Math.round((total * (i + 2)) / (nWaves * (nWaves + 3) / 2));
            this.waves.push(Array.from({ length: n }, () => this.pickMinion()));
        }
        if (type === 'elite') this.waves[1].push('elite:' + CHAPTER_ELITE[chapter]);
    }

    private scale(): number {
        return 1 + 0.07 * (this.config.station - 1);
    }

    private spawn(id: string): Unit {
        const w = this.world;
        const x = w.rng.range(60, FIELD.W - 60);
        if (id.startsWith('elite:')) {
            const u = w.spawnEnemy(id.slice(6), x, FIELD.SPAWN_Y, this.scale());
            const affix = this.config.affixes?.[0] ?? w.rng.pick(AFFIX_IDS);
            this.applyAffixes(u, [affix]);
            return u;
        }
        return w.spawnEnemy(id, x, FIELD.SPAWN_Y, this.scale());
    }

    private spawnBosses(): void {
        const w = this.world;
        const ids = this.config.boss ?? [];
        ids.forEach((id, i) => {
            const x = ids.length === 1 ? FIELD.W / 2 : FIELD.W * (i + 1) / (ids.length + 1);
            const b = w.spawnEnemy(id, x, FIELD.SPAWN_Y);
            this.bosses.push(b);
            this.applyAffixes(b, this.config.affixes ?? []);
        });
        w.text(ids.map(id => ENEMY_DEFS[id].name).join('·') + ' 降临', FIELD.W / 2, 300, 0xff7050);
    }

    // 词缀：狂暴、分魂、吸魂、镇魂、护法、催兵
    private applyAffixes(u: Unit, affixes: string[]): void {
        const w = this.world;
        u.affixes = affixes.slice();
        for (const a of affixes) {
            if (a === 'zhenhun') w.reviveMul = 1.5;
            if (a === 'hufa') {
                const guard = u.kind === 'boss' ? 'elite:' + CHAPTER_ELITE[this.config.chapter] : this.pickMinion();
                for (let i = 0; i < 2; i++) {
                    const g = w.spawnEnemy(guard.replace('elite:', ''), u.x + (i ? 50 : -50), u.y - 10, this.scale());
                    g.affixes = [];
                }
            }
            if (a === 'xihun') {
                w.heroDeathHooks.push(() => {
                    if (u.dead) return;
                    w.heal(null, u, u.maxHp * 0.05);
                    w.fx('soulsuck', u.x, u.y, { r: u.r + 10, color: 0x8a3cc8 });
                });
            }
        }
    }

    private affixTick(u: Unit, dt: number): void {
        const w = this.world;
        if (u.affixes.includes('kuangbao') && !u.vars.berserk && u.hp < u.maxHp / 2) {
            u.vars.berserk = 1;
            u.atk *= 1.5;
            w.text('狂暴', u.x, u.y - 50, 0xff5040);
        }
        if (u.affixes.includes('fenhun') && !u.vars.split && u.hp < u.maxHp / 2) {
            u.vars.split = 1;
            const c = w.spawnEnemy(u.defId, u.x + 50, u.y, 1);
            c.maxHp = u.maxHp;
            c.hp = u.hp;
            c.atk = u.atk;
            c.affixes = u.affixes.filter(a => a !== 'fenhun' && a !== 'hufa');
            c.vars.split = 1;
            if (u.kind === 'boss') this.bosses.push(c);
            w.text('分魂', u.x, u.y - 50, 0xc0a0ff);
        }
        if (u.affixes.includes('cuibing')) {
            u.vars.cuibing = (u.vars.cuibing ?? 4) - dt;
            if (u.vars.cuibing <= 0) {
                u.vars.cuibing = 4;
                for (let i = 0; i < 2; i++) this.spawn(this.pickMinion());
            }
        }
    }

    private control(dt: number): void {
        const w = this.world;
        for (const e of w.units) if (e.side === 'enemy' && !e.dead && e.affixes.length) this.affixTick(e, dt);
        if (this.config.type === 'boss') {
            if (!this.bossSpawned && w.time >= 3) { this.bossSpawned = true; this.spawnBosses(); }
            const bossAlive = this.bosses.some(b => !b.dead);
            if (this.bossSpawned && !bossAlive) w.reviveMul = 1;
            if (this.bossSpawned && bossAlive) {
                this.trickleT -= dt;
                if (this.trickleT <= 0) {
                    this.trickleT = 8;
                    for (let i = 0; i < 3; i++) this.queue.push({ t: w.time + i * SPAWN_GAP, id: this.pickMinion() });
                }
            }
        }
        while (this.queue.length && this.queue[0].t <= w.time) this.spawn(this.queue.shift()!.id);

        const alive = w.enemies().length;
        if (!this.queue.length && alive === 0) {
            if (this.waveIdx + 1 < this.waves.length) {
                this.pauseT -= dt;
                if (this.pauseT <= 0) {
                    this.waveIdx++;
                    this.pauseT = WAVE_PAUSE;
                    w.events.push({ type: 'wave', index: this.waveIdx + 1, total: this.waves.length });
                    this.waves[this.waveIdx].forEach((id, i) => this.queue.push({ t: w.time + i * SPAWN_GAP, id }));
                }
            } else if (this.config.type !== 'boss' || (this.bossSpawned && this.bosses.every(b => b.dead))) {
                w.finish(true);
            }
        }
    }

    step(): void {
        this.world.step();
    }

    result(): BattleResult {
        const w = this.world;
        return { win: w.win, time: w.time, altarHp: Math.max(0, Math.round(w.altar.hp)), stats: w.stats, heroes: this.team };
    }
}

export function newHeroState(heroId: string): HeroState {
    return { heroId, dao: 'ren', shiShu: 0, buddha: false, stones: [] };
}

// 跑完一场（无渲染），给测试和机器人模拟用
export function runBattle(config: BattleConfig, team: HeroState[], maxSeconds = 240): BattleResult {
    const b = new Battle(config, team);
    const maxTicks = maxSeconds * 30;
    for (let i = 0; i < maxTicks && !b.world.over; i++) b.step();
    if (!b.world.over) b.world.finish(false);
    return b.result();
}
