import type { HeroDef } from '../defs';
import type { Unit } from '../types';
import type { World } from '../world';
import { focus } from './common';

const STONE_MUL = 1.2; // × 阵亡英雄的攻击
const STONE_SELF = 0.5; // + × 精卫自己的攻击
const RAIN_COUNT = 5;
const EGUI_CHAIN_CAP = 30;

interface Stone { atk: number; color: number }

function stones(w: World, u: Unit): Stone[] {
    return w.heroStates.get(u.id)?.stones ?? [];
}

// 没有遗石时砸一片普通石雨
function takeStones(w: World, u: Unit): Stone[] {
    const st = w.heroStates.get(u.id);
    const list = st ? st.stones.splice(0) : [];
    if (list.length) return list;
    const rain: Stone[] = [];
    for (let i = 0; i < RAIN_COUNT; i++) rain.push({ atk: u.atk, color: 0x9a8f80 });
    return rain;
}

function stoneDmg(u: Unit, s: Stone): number {
    return s.atk * STONE_MUL + u.atk * STONE_SELF;
}

function lob(w: World, u: Unit, s: Stone, x: number, y: number, delay: number, p: { aoe?: number; dmgMul?: number; chain?: number; tag?: string; visual?: string; targetId?: number; kind?: 'lob' | 'homing' } = {}): void {
    w.schedule(delay, () => {
        if (u.dead && p.tag !== 'jw_chain') return;
        w.projectile({
            side: 'hero', srcId: u.id, x: u.x, y: u.y - 30, tx: x, ty: y, targetId: p.targetId ?? 0, speed: p.kind === 'homing' ? 520 : 600,
            kind: p.kind ?? 'lob', dmg: stoneDmg(u, s) * (p.dmgMul ?? 1), aoe: p.aoe ?? 60, tag: p.tag ?? 'jw_stone',
            visual: p.visual ?? 'stone', color: s.color, chain: p.chain ?? 0, data: { atk: s.atk },
        });
    });
}

function scatter(w: World, x: number, y: number, r: number): { x: number; y: number } {
    const a = w.rng.range(0, Math.PI * 2), d = w.rng.range(0, r);
    return { x: x + Math.cos(a) * d, y: y + Math.sin(a) * d };
}

export const JINGWEI: HeroDef = {
    id: 'jingwei', name: '精卫', nature: 'chusheng', role: 'ranged', color: 0x4a7ab8,
    hp: 620, atk: 40, atkCd: 1.0, range: 280, speed: 115, r: 15, blockCap: 1, manaPerHit: 14,
    // 取石、举臂、掷出：前摇后石子离手；施法为展翼聚石后齐掷
    timing: { attack: [0.3, 0.25], cast: [0.5, 0.35] },
    shot: { speed: 520, visual: 'pebble', kind: 'lob', aoe: 36 },
    passiveName: '遗石',
    skillNames: { ren: '填海', tian: '流星衔石', xiuluo: '俯冲', chusheng: '群鸟填海', egui: '冤石连环', diyu: '熔岩坑' },
    cast: {
        ren(w, u) {
            const t = w.densest('enemy', 80, u.x, u.y, 420) ?? focus(w, u, 420);
            if (!t) return;
            const chain = w.newChain();
            takeStones(w, u).forEach((s, i) => {
                const p = scatter(w, t.x, t.y, 40);
                lob(w, u, s, p.x, p.y, i * 0.08, { chain });
            });
        },
        tian(w, u) {
            const foes = w.query(u.x, u.y, 520, 'enemy');
            if (!foes.length) return;
            const chain = w.newChain();
            takeStones(w, u).forEach((s, i) => {
                const t = foes[i % foes.length];
                lob(w, u, s, t.x, t.y, i * 0.06, { chain, kind: 'homing', targetId: t.id, aoe: 40, visual: 'meteor' });
            });
        },
        xiuluo(w, u) {
            const t = w.densest('enemy', 80, u.x, u.y, 260) ?? focus(w, u, 260);
            if (!t) return;
            const chain = w.newChain();
            w.dash(u, t.x, t.y + t.r + u.r, {
                speed: 900, dmg: u.atk * 1.5, width: 30, chain, onEnd: () => {
                    const list = takeStones(w, u);
                    w.fx('dive', u.x, u.y, { r: 90, color: 0x4a7ab8 });
                    list.forEach((s, i) => {
                        const p = scatter(w, u.x, u.y - 20, 50);
                        lob(w, u, s, p.x, p.y, i * 0.05, { chain, aoe: 70 });
                    });
                },
            });
        },
        chusheng(w, u) {
            const t = w.densest('enemy', 100, u.x, u.y, 460) ?? focus(w, u, 460);
            if (!t) return;
            const chain = w.newChain();
            w.fx('birds', u.x, u.y, { x2: t.x, y2: t.y, color: 0xe8e0d0 });
            takeStones(w, u).forEach((s, i) => {
                for (let k = 0; k < 2; k++) {
                    const p = scatter(w, t.x, t.y, 110);
                    lob(w, u, s, p.x, p.y, i * 0.07 + k * 0.03, { chain, dmgMul: 0.65, aoe: 50, visual: 'birdstone' });
                }
            });
        },
        egui(w, u) {
            const chain = w.newChain();
            const foes = w.query(u.x, u.y, 520, 'enemy').sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp);
            if (!foes.length) return;
            takeStones(w, u).forEach((s, i) => {
                const t = foes[i % foes.length];
                lob(w, u, s, t.x, t.y, i * 0.08, { chain, kind: 'homing', targetId: t.id, aoe: 30, tag: 'jw_chain', visual: 'ghoststone' });
            });
        },
        diyu(w, u) {
            const t = w.densest('enemy', 90, u.x, u.y, 420) ?? focus(w, u, 420);
            if (!t) return;
            const chain = w.newChain();
            takeStones(w, u).forEach((s, i) => {
                const p = scatter(w, t.x, t.y, 70);
                lob(w, u, s, p.x, p.y, i * 0.08, { chain, aoe: 50, tag: 'jw_lava' });
            });
        },
    },
    projHooks: {
        jw_lava(w, p) {
            w.zone({ side: 'hero', srcId: p.srcId, x: p.x, y: p.y, r: 50, dur: 4, dps: p.dmg * 0.35, slowPct: 0.3, visual: 'lava', color: 0xc8502a, chain: p.chain });
        },
        // 饿鬼道：砸死的敌人也变成遗石，立刻飞向下一个残血
        jw_chain(w, p) {
            const u = w.get(p.srcId);
            if (!u) return;
            const n = (p.data.n ?? 0);
            if (n >= EGUI_CHAIN_CAP) return;
            // 落点附近这一下砸死的敌人，各自化成一颗遗石，飞向下一个残血
            const fresh = w.units.filter(e => e.side === 'enemy' && e.dead && !e.vars.jwUsed && Math.hypot(e.x - p.x, e.y - p.y) <= p.aoe + e.r + 4);
            for (const dead of fresh) {
                dead.vars.jwUsed = 1;
                const next = w.query(dead.x, dead.y, 420, 'enemy').sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp)[0];
                if (!next) return;
                w.projectile({
                    side: 'hero', srcId: u.id, x: dead.x, y: dead.y, tx: next.x, ty: next.y, targetId: next.id, speed: 560,
                    kind: 'homing', dmg: stoneDmg(u, { atk: u.atk, color: 0 }), aoe: 30, tag: 'jw_chain', visual: 'ghoststone',
                    color: 0x5fd39a, chain: p.chain, data: { n: n + 1, atk: u.atk },
                });
            }
        },
    },
    // 本命「遗石」：任何英雄阵亡时，衔起一颗带那位英雄颜色的遗石
    onAnyDeath(w, u, dead) {
        if (dead.kind !== 'hero') return;
        const def = w.heroDefs[dead.defId];
        stones(w, u).push({ atk: dead.atk, color: def.color });
        w.fx('stone+', dead.x, dead.y, { x2: u.x, y2: u.y, color: def.color });
    },
    onDeath(w, u) {
        // 她自己的死也会变成一颗遗石
        stones(w, u).push({ atk: u.atk, color: JINGWEI.color });
    },
};
