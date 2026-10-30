import type { EnemyDef } from './defs';
import type { Unit } from './types';
import type { World } from './world';
import { FIELD } from './world';

// 首领机制尽量碰到轮回系统本身，而不只是血厚。技能都先给预警再生效。

function every(u: Unit, key: string, period: number, dt: number, first = period * 0.5): boolean {
    if (u.vars[key] === undefined) u.vars[key] = first;
    u.vars[key] -= dt;
    if (u.vars[key] > 0 || u.st.stun > 0 || u.dash) return false;
    u.vars[key] = period;
    return true;
}

function randomHero(w: World): Unit | null {
    const hs = w.aliveHeroes().filter(h => h.st.untargetable <= 0);
    return hs.length ? w.rng.pick(hs) : null;
}

export const BOSSES: Record<string, EnemyDef> = {
    // 第一章
    niumo: {
        id: 'niumo', name: '牛魔', kind: 'boss', color: 0x5a3a2a, hp: 9000, atk: 70, atkCd: 1.6, range: 40, speed: 45, r: 30, ranged: false,
        // 冲撞英雄防线，把路上的英雄撞开；半血狂暴
        onTick(w, u, dt) {
            if (!u.vars.enraged && u.hp < u.maxHp / 2) {
                u.vars.enraged = 1;
                u.atk *= 1.5;
                u.atkSpeedMul *= 1.3;
                w.text('狂暴', u.x, u.y - 50, 0xff5040);
            }
            if (!every(u, 'charge', 9, dt)) return;
            const t = randomHero(w);
            if (!t) return;
            const dx = t.x - u.x, dy = t.y - u.y, d = Math.hypot(dx, dy) || 1;
            const len = Math.min(d + 140, 520);
            const tx = u.x + (dx / d) * len, ty = u.y + (dy / d) * len;
            w.fx('warnline', u.x, u.y, { x2: tx, y2: ty, r: 40, color: 0xff5040, dur: 0.8 });
            u.st.root = 0.8;
            w.schedule(0.8, () => { if (!u.dead) w.dash(u, tx, ty, { speed: 620, dmg: u.atk * 1.2, width: 40, knock: 120 }); });
        },
    },
    huangfeng: {
        id: 'huangfeng', name: '黄风怪', kind: 'boss', color: 0xd8b040, hp: 8000, atk: 55, atkCd: 1.4, range: 160, speed: 40, r: 26, ranged: true,
        shot: { speed: 500, visual: 'sand', kind: 'homing', aoe: 30 },
        // 定时吹风，把英雄吹回法坛边，打乱阵型
        onTick(w, u, dt) {
            if (!every(u, 'wind', 10, dt, 6)) return;
            w.fx('warn', u.x, u.y, { r: 120, color: 0xd8b040, dur: 1 });
            w.schedule(1, () => {
                if (u.dead) return;
                w.fx('wind', u.x, u.y, { x2: FIELD.ALTAR_X, y2: FIELD.ALTAR_Y, color: 0xd8b040, dur: 1.2 });
                for (const h of w.aliveHeroes()) {
                    if (h.st.untargetable > 0) continue;
                    const pushY = Math.min(FIELD.ALTAR_Y - 90, h.y + 380) - h.y;
                    if (pushY > 0) h.ky += pushY * 4;
                    h.target = 0;
                    w.damage(u, h, u.atk * 0.5, { tag: 'skill' });
                }
            });
        },
    },
    zhizhu: {
        id: 'zhizhu', name: '蜘蛛精', kind: 'boss', color: 0x7a3a8a, hp: 8500, atk: 50, atkCd: 1.3, range: 170, speed: 42, r: 28, ranged: true,
        shot: { speed: 460, visual: 'silk', kind: 'homing', aoe: 0 },
        // 吐丝定住英雄，放出小蜘蛛
        onTick(w, u, dt) {
            if (every(u, 'web', 8, dt, 4)) {
                for (let i = 0; i < 2; i++) {
                    const h = randomHero(w);
                    if (!h) break;
                    w.fx('web', h.x, h.y, { unit: h.id, dur: 3, color: 0xe8e0f0 });
                    w.root(h, 3);
                    h.st.stun = Math.max(h.st.stun, 1);
                }
            }
            if (every(u, 'brood', 6, dt, 3)) {
                for (let i = 0; i < 3; i++) w.spawnEnemy('spiderling', u.x + w.rng.range(-40, 40), u.y + w.rng.range(10, 40));
            }
        },
    },

    // 第二章
    baigu: {
        id: 'baigu', name: '白骨夫人', kind: 'boss', color: 0xf0e8d8, hp: 15000, atk: 70, atkCd: 1.4, range: 170, speed: 45, r: 26, ranged: true,
        shot: { speed: 560, visual: 'bone', kind: 'homing', aoe: 0 },
        // 三变：打到三分之二、三分之一血就「转世」换一种形态，召骷髅
        onTick(w, u, dt) {
            const form = u.vars.form ?? 0;
            const next = u.hp < u.maxHp / 3 ? 2 : u.hp < (u.maxHp * 2) / 3 ? 1 : 0;
            if (next > form) {
                u.vars.form = next;
                u.st.untargetable = 1.5;
                w.fx('rebirth', u.x, u.y, { r: 80, color: 0xf0e8d8, dur: 1.5 });
                w.text(next === 1 ? '二变·骨刃' : '三变·白骨阵', u.x, u.y - 50, 0xf0e8d8);
                for (let i = 0; i < 4; i++) w.spawnEnemy('skeleton', u.x + w.rng.range(-60, 60), u.y + w.rng.range(-20, 40));
                if (next === 1) { u.ranged = false; u.range = 40; u.speed = 70; u.atkSpeedMul = 1.6; }
                if (next === 2) { u.ranged = true; u.range = 190; u.speed = 40; u.atkSpeedMul = 1.2; }
            }
            if (every(u, 'bones', 12, dt, 8)) {
                const n = (u.vars.form ?? 0) === 2 ? 4 : 2;
                for (let i = 0; i < n; i++) w.spawnEnemy('skeleton', u.x + w.rng.range(-60, 60), u.y + 30);
            }
        },
    },
    mengpo: {
        id: 'mengpo', name: '孟婆', kind: 'boss', color: 0xc8a050, hp: 14000, atk: 60, atkCd: 1.6, range: 200, speed: 40, r: 24, ranged: true,
        shot: { speed: 420, visual: 'soup', kind: 'lob', aoe: 60 },
        // 被她杀死的英雄转世不加世数
        onKillHero(w, u, hero) {
            hero.vars.noShiShu = 1;
            w.text('忘川·世数不增', hero.x, hero.y - 40, 0xc8a050);
        },
        onTick(w, u, dt) {
            if (!every(u, 'bowl', 9, dt, 5)) return;
            const h = randomHero(w);
            if (!h) return;
            w.fx('warn', h.x, h.y, { r: 90, color: 0xc8a050, dur: 1 });
            const x = h.x, y = h.y;
            w.schedule(1, () => {
                if (u.dead) return;
                w.zone({ side: 'enemy', srcId: u.id, x, y, r: 90, dur: 4, dps: u.atk * 0.5, slowPct: 0.4, visual: 'soup', color: 0xc8a050 });
            });
        },
    },
    heiwuchang: {
        id: 'heiwuchang', name: '黑无常', kind: 'boss', color: 0x2a2a3a, hp: 8000, atk: 70, atkCd: 1.4, range: 42, speed: 55, r: 24, ranged: false,
        onTick(w, u, dt) { soulMark(w, u, dt); },
    },
    baiwuchang: {
        id: 'baiwuchang', name: '白无常', kind: 'boss', color: 0xf0f0f0, hp: 8000, atk: 55, atkCd: 1.3, range: 180, speed: 50, r: 24, ranged: true,
        shot: { speed: 480, visual: 'chain', kind: 'homing', aoe: 0 },
        onTick(w, u, dt) { soulMark(w, u, dt); },
    },

    // 第三章
    moliqing: {
        id: 'moliqing', name: '魔礼青', kind: 'boss', color: 0x3a8a6a, hp: 24000, atk: 90, atkCd: 1.5, range: 50, speed: 48, r: 30, ranged: false,
        // 青云剑沿整列横扫：考验阵型分散
        onTick(w, u, dt) {
            if (!every(u, 'sweep', 10, dt, 6)) return;
            const hs = w.aliveHeroes().filter(h => h.st.untargetable <= 0);
            if (!hs.length) return;
            // 选英雄最挤的一列
            let bestX = hs[0].x, bestN = 0;
            for (const h of hs) {
                const n = hs.filter(o => Math.abs(o.x - h.x) < 70).length;
                if (n > bestN) { bestN = n; bestX = h.x; }
            }
            w.fx('warnline', bestX, 0, { x2: bestX, y2: FIELD.H, r: 70, color: 0x3a8a6a, dur: 1.2 });
            w.schedule(1.2, () => {
                if (u.dead) return;
                w.fx('swordsweep', bestX, 0, { x2: bestX, y2: FIELD.H, r: 70, color: 0x6ad8a0 });
                for (const h of w.queryLine(bestX, 0, bestX, FIELD.H, 70, 'hero')) w.damage(u, h, u.atk * 2.5, { tag: 'skill' });
            });
        },
    },
    juling: {
        id: 'juling', name: '巨灵神', kind: 'boss', color: 0x8a6a3a, hp: 40000, atk: 100, atkCd: 2.0, range: 46, speed: 35, r: 36, ranged: false, mass: 40,
        // 超厚血，震地眩晕
        onTick(w, u, dt) {
            if (!every(u, 'stomp', 9, dt, 5)) return;
            w.fx('warn', u.x, u.y, { r: 200, color: 0xff5040, dur: 1 });
            w.schedule(1, () => {
                if (u.dead) return;
                w.fx('quake', u.x, u.y, { r: 200, color: 0xc8a070 });
                for (const h of w.query(u.x, u.y, 200, 'hero')) {
                    w.damage(u, h, u.atk, { tag: 'skill' });
                    w.stun(h, 1.5);
                }
            });
        },
    },
    erlang: {
        id: 'erlang', name: '二郎真君', kind: 'boss', color: 0xc0c8d8, hp: 26000, atk: 90, atkCd: 1.3, range: 60, speed: 60, r: 28, ranged: false,
        // 哮天犬切后排；天眼拆护盾
        onSpawn(w, u) {
            u.vars.hound = w.spawnEnemy('xiaotian', u.x + 40, u.y + 20).id;
        },
        onTick(w, u, dt) {
            if (every(u, 'houndCheck', 15, dt, 15)) {
                const hd = w.get(u.vars.hound);
                if (!hd || hd.dead) u.vars.hound = w.spawnEnemy('xiaotian', u.x + 40, u.y + 20).id;
            }
            if (!every(u, 'eye', 8, dt, 4)) return;
            const t = randomHero(w);
            if (!t) return;
            const x2 = u.x + (t.x - u.x) * 3, y2 = u.y + (t.y - u.y) * 3;
            w.fx('warnline', u.x, u.y, { x2, y2, r: 26, color: 0xf2c84b, dur: 0.8 });
            w.schedule(0.8, () => {
                if (u.dead) return;
                w.fx('eyebeam', u.x, u.y - 20, { x2, y2, r: 26, color: 0xf2e8a0 });
                for (const h of w.queryLine(u.x, u.y, x2, y2, 26, 'hero')) {
                    h.shield = 0;
                    w.damage(u, h, u.atk * 1.5, { tag: 'skill', ignoreShield: true });
                }
            });
        },
        onAttack(w, u, t) {
            // 天眼：普攻也无视护盾，打掉一截
            t.shield *= 0.5;
        },
    },
    xiaotian: {
        id: 'xiaotian', name: '哮天犬', kind: 'elite', color: 0x2a2a2a, hp: 1800, atk: 45, atkCd: 0.8, range: 24, speed: 170, r: 14, ranged: false, ai: 'hound',
    },
};

// 黑白无常：勾魂标记一位英雄，它死了必入地狱道
function soulMark(w: World, u: Unit, dt: number): void {
    if (!every(u, 'mark', 12, dt, u.defId === 'heiwuchang' ? 4 : 10)) return;
    for (const h of w.heroes()) if ((h.vars.markUntil ?? 0) < w.time) h.vars.forceDiyu = 0;
    const t = randomHero(w);
    if (!t) return;
    t.vars.forceDiyu = 1;
    t.vars.markUntil = w.time + 10;
    w.fx('soulmark', t.x, t.y, { unit: t.id, dur: 10, color: 0x8a3cc8 });
    w.text('勾魂', t.x, t.y - 40, 0x8a3cc8);
}

export const CHAPTER_BOSSES: Record<number, string[][]> = {
    1: [['niumo'], ['huangfeng'], ['zhizhu']],
    2: [['baigu'], ['mengpo'], ['heiwuchang', 'baiwuchang']],
    3: [['moliqing'], ['juling'], ['erlang']],
};
