import type { EnemyDef } from './defs';
import type { Unit } from './types';
import type { World } from './world';

// 小怪：近战往法坛走、路上被拦就打；远程射程内有英雄就停下来射。
// 特殊动作都是「有条件 + 有概率 + 看得见」。

function slamEvery(period: number, r: number, mul: number) {
    return (w: World, u: Unit, dt: number) => {
        u.vars.slam = (u.vars.slam ?? period * 0.6) - dt;
        if (u.vars.slam > 0 || u.st.stun > 0) return;
        u.vars.slam = period;
        w.fx('warn', u.x, u.y, { r, color: 0xff5040, dur: 0.6 });
        w.schedule(0.6, () => {
            if (u.dead) return;
            w.fx('slam', u.x, u.y, { r, color: 0xc8a070 });
            for (const h of w.query(u.x, u.y, r, 'hero')) w.damage(u, h, u.atk * mul, { tag: 'skill' });
        });
    };
}

export const MINIONS: Record<string, EnemyDef> = {
    // 第一章 人间山野
    rat: { id: 'rat', name: '鼠妖', kind: 'minion', color: 0x9a8a7a, hp: 110, atk: 10, atkCd: 1.0, range: 22, speed: 70, r: 11, ranged: false },
    boar: { id: 'boar', name: '野猪精', kind: 'minion', color: 0x7a5a40, hp: 380, atk: 18, atkCd: 1.4, range: 26, speed: 45, r: 16, ranged: false, mass: 3 },
    fox: {
        id: 'fox', name: '狐妖', kind: 'minion', color: 0xe08a3a, hp: 130, atk: 14, atkCd: 1.5, range: 210, speed: 55, r: 12, ranged: true,
        shot: { speed: 520, visual: 'arrow', kind: 'homing', aoe: 0 },
    },
    mole: {
        id: 'mole', name: '遁地鼠', kind: 'minion', color: 0x5a4a50, hp: 160, atk: 12, atkCd: 1.0, range: 22, speed: 65, r: 13, ranged: false,
        // 第一次碰到英雄时有一半机会钻地，可见的土包一路拱向法坛
        onTick(w, u) {
            if (u.vars.burrowEnd) {
                if (w.time >= u.vars.burrowEnd) { u.vars.burrowEnd = 0; u.ai = 'melee'; u.speed /= 1.8; w.fx('unburrow', u.x, u.y, { r: 24 }); }
                return;
            }
            if (u.vars.tried) return;
            const h = w.nearest(u.x, u.y, 'hero', 60);
            if (!h) return;
            u.vars.tried = 1;
            if (!w.rng.chance(0.5)) return;
            u.vars.burrowEnd = w.time + 3;
            u.st.untargetable = 3;
            u.engage = 0;
            u.ai = 'rush';
            u.speed *= 1.8;
            w.fx('burrow', u.x, u.y, { unit: u.id, dur: 3, r: 18, color: 0x8a6a40 });
        },
    },
    ape: {
        id: 'ape', name: '巨猿', kind: 'elite', color: 0x8a8a8a, hp: 1400, atk: 40, atkCd: 1.6, range: 34, speed: 45, r: 22, ranged: false,
        onTick: slamEvery(6, 80, 1.5),
    },
    spiderling: { id: 'spiderling', name: '小蜘蛛', kind: 'minion', color: 0x6a3a7a, hp: 50, atk: 6, atkCd: 0.8, range: 16, speed: 85, r: 8, ranged: false },

    // 第二章 阴间冥府
    ghost: { id: 'ghost', name: '鬼卒', kind: 'minion', color: 0x8ad8b0, hp: 260, atk: 20, atkCd: 1.1, range: 30, speed: 65, r: 12, ranged: false },
    skeleton: { id: 'skeleton', name: '白骨兵', kind: 'minion', color: 0xe8dcc0, hp: 320, atk: 24, atkCd: 1.2, range: 26, speed: 55, r: 13, ranged: false },
    bailiff: {
        id: 'bailiff', name: '阴差', kind: 'minion', color: 0x3a3a4a, hp: 300, atk: 22, atkCd: 1.6, range: 200, speed: 50, r: 13, ranged: true,
        shot: { speed: 480, visual: 'chain', kind: 'homing', aoe: 0 },
        // 锁链有 25% 把英雄拽过来一截
        onAttack(w, u, t) {
            if (t.kind !== 'hero' || !w.rng.chance(0.25)) return;
            w.schedule(0.35, () => { if (!t.dead) { w.pull(t, u.x, u.y, 60); w.fx('hook', u.x, u.y, { x2: t.x, y2: t.y, color: 0x6a6a7a }); } });
        },
    },
    yaksha: {
        id: 'yaksha', name: '夜叉', kind: 'minion', color: 0x3a6ad8, hp: 280, atk: 30, atkCd: 1.0, range: 24, speed: 80, r: 13, ranged: false,
        // 盯上后排且距离合适时，有一次 50% 的机会扑过去
        onTick(w, u) {
            if (u.vars.tried || u.dash) return;
            const back = w.aliveHeroes().find(h => h.ranged && h.st.untargetable <= 0 && (() => { const d = Math.hypot(h.x - u.x, h.y - u.y); return d > 160 && d < 320; })());
            if (!back) return;
            u.vars.tried = 1;
            if (!w.rng.chance(0.5)) return;
            w.fx('leap', u.x, u.y, { x2: back.x, y2: back.y, color: 0x3a6ad8 });
            w.dash(u, back.x, back.y - back.r - u.r, { speed: 520, onEnd: () => { u.engage = back.id; } });
        },
    },

    ghostgeneral: {
        id: 'ghostgeneral', name: '鬼将', kind: 'elite', color: 0x4a6a5a, hp: 2000, atk: 50, atkCd: 1.6, range: 36, speed: 45, r: 21, ranged: false,
        onTick: slamEvery(6, 85, 1.4),
    },

    // 第三章 天庭边境
    soldier: { id: 'soldier', name: '天兵', kind: 'minion', color: 0xe8e0c8, hp: 520, atk: 34, atkCd: 1.2, range: 40, speed: 55, r: 13, ranged: false },
    strongman: {
        id: 'strongman', name: '力士', kind: 'elite', color: 0xc89060, hp: 2600, atk: 60, atkCd: 1.8, range: 36, speed: 42, r: 22, ranged: false,
        onTick: slamEvery(7, 90, 1.4),
    },
    thunder: {
        id: 'thunder', name: '雷部法师', kind: 'minion', color: 0x3a4ab8, hp: 420, atk: 40, atkCd: 2.0, range: 230, speed: 48, r: 13, ranged: true,
        shot: { speed: 700, visual: 'bolt', kind: 'lob', aoe: 50 },
    },
};

export const CHAPTER_POOL: Record<number, { id: string; w: number }[]> = {
    1: [{ id: 'rat', w: 5 }, { id: 'boar', w: 2 }, { id: 'fox', w: 2 }, { id: 'mole', w: 2 }],
    2: [{ id: 'ghost', w: 4 }, { id: 'skeleton', w: 3 }, { id: 'bailiff', w: 2 }, { id: 'yaksha', w: 2 }],
    3: [{ id: 'soldier', w: 5 }, { id: 'thunder', w: 2 }],
};

export const CHAPTER_ELITE: Record<number, string> = { 1: 'ape', 2: 'ghostgeneral', 3: 'strongman' };
