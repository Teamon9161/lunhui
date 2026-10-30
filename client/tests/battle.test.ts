import { describe, expect, test } from 'bun:test';
import { World, FIELD } from '../assets/scripts/battle/world';
import { HEROES } from '../assets/scripts/battle/heroes/index';
import { ENEMY_DEFS, newHeroState, runBattle } from '../assets/scripts/battle/battle';
import type { BattleConfig } from '../assets/scripts/battle/battle';
import { Run } from '../assets/scripts/battle/run';
import { DAOS } from '../assets/scripts/battle/types';
import type { Dao } from '../assets/scripts/battle/types';

const TEAM = ['zhongkui', 'nezha', 'wukong', 'jingwei', 'tangseng'];

function world(seed = 1): World {
    return new World({ seed, heroDefs: HEROES, enemyDefs: ENEMY_DEFS, altarHp: 1000 });
}

function cfg(p: Partial<BattleConfig> = {}): BattleConfig {
    return { seed: 7, chapter: 1, station: 1, type: 'normal', altarHp: 1000, altarMaxHp: 1000, ...p };
}

function steps(w: World, n: number): void {
    for (let i = 0; i < n && !w.over; i++) w.step();
}

describe('确定性', () => {
    test('同种子同结果', () => {
        const a = runBattle(cfg({ seed: 42, station: 3 }), TEAM.map(newHeroState));
        const b = runBattle(cfg({ seed: 42, station: 3 }), TEAM.map(newHeroState));
        expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    });
    test('不同种子不同过程', () => {
        const a = runBattle(cfg({ seed: 1 }), TEAM.map(newHeroState));
        const b = runBattle(cfg({ seed: 2 }), TEAM.map(newHeroState));
        expect(JSON.stringify(a.stats)).not.toBe(JSON.stringify(b.stats));
    });
});

describe('六道神通', () => {
    for (const heroId of TEAM) {
        for (const dao of DAOS) {
            test(`${HEROES[heroId].name}·${dao} 能放出来并产生效果`, () => {
                const w = world(3);
                const st = { ...newHeroState(heroId), dao };
                const ally = w.spawnHero(HEROES.zhongkui, newHeroState('zhongkui'), 200, 700);
                const h = w.spawnHero(HEROES[heroId], st, 360, 700);
                for (let i = 0; i < 8; i++) {
                    const e = w.spawnEnemy('boar', 300 + (i % 4) * 40, 560 + Math.floor(i / 4) * 40, 3);
                    e.ai = 'none';
                }
                // 超度需要有人在等复活
                if (heroId === 'tangseng' && dao === 'diyu') w.damage(null, ally, 1e6);
                const before = w.enemies().reduce((s, e) => s + e.hp, 0);
                h.mana = h.manaMax;
                steps(w, 150);
                expect(w.stats.casts[heroId] ?? 0).toBeGreaterThanOrEqual(1);
                const after = w.enemies().reduce((s, e) => s + e.hp, 0);
                const helped = w.heroes().some(x => x.shield > 0) || (w.stats.heal[heroId] ?? 0) > 0 || !ally.dead;
                expect(before - after > 0 || helped).toBe(true);
            });
        }
    }
});

describe('阵亡与转世', () => {
    test('阵亡立刻转世、加世数、6 秒后在法坛旁复活', () => {
        const w = world();
        const h = w.spawnHero(HEROES.wukong, newHeroState('wukong'), 360, 700);
        w.damage(null, h, 1e6);
        expect(h.dead).toBe(true);
        expect(h.shiShu).toBe(1);
        steps(w, 30 * 5.9);
        expect(h.dead).toBe(true);
        steps(w, 10);
        expect(h.dead).toBe(false);
        expect(h.y).toBeGreaterThan(FIELD.ALTAR_Y - 120);
    });
    test('哪吒在阵亡处从莲花复活，复活时间减半', () => {
        const w = world();
        const h = w.spawnHero(HEROES.nezha, newHeroState('nezha'), 200, 640);
        w.damage(null, h, 1e6);
        steps(w, 30 * 3 + 2);
        expect(h.dead).toBe(false);
        expect(Math.abs(h.x - 200)).toBeLessThan(5);
        expect(Math.abs(h.y - 640)).toBeLessThan(5);
    });
    test('天性那一道权重 ×2', () => {
        const w = world(9);
        const h = w.spawnHero(HEROES.wukong, newHeroState('wukong'), 360, 700);
        const count: Record<string, number> = {};
        for (let i = 0; i < 7000; i++) {
            w.damage(null, h, 1e9);
            count[h.dao] = (count[h.dao] ?? 0) + 1;
            h.dead = false;
            h.hp = h.maxHp;
        }
        expect(count.xiuluo / 7000).toBeGreaterThan(0.25);
        expect(count.xiuluo / 7000).toBeLessThan(0.32);
        expect(count.ren / 7000).toBeGreaterThan(0.11);
    });
    test('孟婆杀死的英雄不加世数', () => {
        const w = world();
        const h = w.spawnHero(HEROES.wukong, newHeroState('wukong'), 360, 700);
        const mp = w.spawnEnemy('mengpo', 360, 600);
        w.damage(mp, h, 1e6);
        expect(h.shiShu).toBe(0);
    });
    test('勾魂标记的英雄死了必入地狱道', () => {
        const w = world();
        const h = w.spawnHero(HEROES.wukong, newHeroState('wukong'), 360, 700);
        h.vars.forceDiyu = 1;
        w.damage(null, h, 1e6);
        expect(h.dao).toBe('diyu' as Dao);
    });
});

describe('本命', () => {
    test('精卫在队友阵亡时衔起遗石，神通会用掉', () => {
        const w = world();
        const st = newHeroState('jingwei');
        const jw = w.spawnHero(HEROES.jingwei, st, 360, 880);
        const ally = w.spawnHero(HEROES.nezha, newHeroState('nezha'), 300, 640);
        w.damage(null, ally, 1e6);
        expect(st.stones.length).toBe(1);
        const e = w.spawnEnemy('boar', 360, 600, 5);
        e.ai = 'none';
        jw.mana = jw.manaMax;
        // 施法有前摇，结算后才消耗遗石
        steps(w, 30);
        expect(st.stones.length).toBe(0);
    });
    test('钟馗吸收魂火回血', () => {
        const w = world();
        const zk = w.spawnHero(HEROES.zhongkui, newHeroState('zhongkui'), 360, 700);
        zk.hp = zk.maxHp / 2;
        const e = w.spawnEnemy('rat', 360, 600);
        e.ai = 'none';
        w.damage(null, e, 1e6);
        steps(w, 30);
        expect(zk.hp).toBeGreaterThan(zk.maxHp / 2);
    });
    test('悟空阵亡时吹出小猴，复活时收回', () => {
        const w = world();
        const wk = w.spawnHero(HEROES.wukong, newHeroState('wukong'), 360, 700);
        wk.vars.hair = 12;
        w.damage(null, wk, 1e6);
        expect(w.units.filter(u => u.defId === 'hair' && !u.dead).length).toBe(4);
        steps(w, 30 * 6 + 5);
        expect(w.units.filter(u => u.defId === 'hair' && !u.dead).length).toBe(0);
    });
    test('唐僧第 10 世必定成佛', () => {
        const w = world();
        const ts = w.spawnHero(HEROES.tangseng, { ...newHeroState('tangseng'), shiShu: 9 }, 360, 880);
        w.damage(null, ts, 1e6);
        expect(ts.buddha).toBe(true);
    });
});

describe('战场规则', () => {
    test('英雄不越过防线', () => {
        const w = world(5);
        const team = TEAM.map(id => w.spawnHero(HEROES[id], newHeroState(id), 360, 700));
        for (let i = 0; i < 12; i++) w.spawnEnemy(i % 3 ? 'rat' : 'fox', 60 + i * 50, 200);
        for (let t = 0; t < 30 * 40; t++) {
            w.step();
            for (const h of team) if (!h.dead && !h.dash) expect(h.y).toBeGreaterThanOrEqual(FIELD.LINE_Y - 31);
        }
    });
    test('第一章普通战不会卡住', () => {
        for (let s = 1; s <= 6; s++) {
            const r = runBattle(cfg({ seed: s }), TEAM.map(newHeroState), 200);
            expect(r.time).toBeLessThan(200);
        }
    });
    test('一局能从头跑到尾', () => {
        const run = new Run(3, TEAM);
        let guard = 0;
        while (!run.over && guard++ < 40) {
            const b = run.next();
            if (!b) continue;
            for (let t = 0; t < 240 * 30 && !b.world.over; t++) b.step();
            if (!b.world.over) b.world.finish(false);
            run.finish(b);
        }
        expect(run.over).toBe(true);
    });
});

describe('出手时序', () => {
    // 精卫普攻有前摇：动作开始时发 act 事件，前摇结束才出石子
    test('前摇结束才结算', () => {
        const w = world(9);
        const jw = w.spawnHero(HEROES.jingwei, newHeroState('jingwei'), 360, 700);
        w.spawnEnemy('boar', 360, 520);
        const windup = HEROES.jingwei.timing!.attack![0];
        let actT = -1, shotT = -1;
        for (let i = 0; i < 30 * 5 && shotT < 0; i++) {
            const before = w.projectiles.filter(p => p.srcId === jw.id).length;
            w.step();
            for (const e of w.drainEvents()) if (e.type === 'act' && e.unit === jw.id && actT < 0) actT = w.time;
            if (actT >= 0 && w.projectiles.filter(p => p.srcId === jw.id).length > before) shotT = w.time;
        }
        expect(actT).toBeGreaterThan(0);
        expect(shotT - actT).toBeCloseTo(windup, 1);
    });
    test('前摇中被眩晕则不出手', () => {
        const w = world(9);
        const jw = w.spawnHero(HEROES.jingwei, newHeroState('jingwei'), 360, 700);
        w.spawnEnemy('boar', 360, 520);
        let cancelled = false;
        for (let i = 0; i < 30 * 5 && !jw.act; i++) w.step();
        expect(jw.act).not.toBeNull();
        jw.st.stun = 1;
        w.step();
        for (const e of w.drainEvents()) if (e.type === 'actCancel' && e.unit === jw.id) cancelled = true;
        expect(cancelled).toBe(true);
        expect(jw.act).toBeNull();
        expect(w.projectiles.filter(p => p.srcId === jw.id).length).toBe(0);
    });
});
