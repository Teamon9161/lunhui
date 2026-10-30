import type { HeroDef } from '../defs';
import type { Unit } from '../types';
import type { World } from '../world';
import { dir, focus, lowestHp, strongest } from './common';

const HAIR_MAX = 12;
const HAIR_PER_MONKEY = 3;
const MONKEY_MAX = 4;

function smashLine(w: World, u: Unit, len: number, dmgMul: number, chain: number): { x0: number; y0: number; x1: number; y1: number } | null {
    const t = focus(w, u, 360);
    if (!t) return null;
    const d = dir(u.x, u.y, t.x, t.y);
    const x1 = u.x + d.x * len, y1 = u.y + d.y * len;
    w.fx('staff', u.x, u.y, { x2: x1, y2: y1, r: 34, color: 0xf2c84b });
    for (const e of w.queryLine(u.x, u.y, x1, y1, 34, 'enemy')) w.damage(u, e, u.atk * dmgMul, { tag: 'skill', chain });
    return { x0: u.x, y0: u.y, x1, y1 };
}

function spawnMonkeys(w: World, u: Unit, n: number, life: number, defId: string): Unit[] {
    const out: Unit[] = [];
    for (let i = 0; i < n; i++) {
        const a = (Math.PI * 2 * i) / n;
        out.push(w.spawnSummon(u, {
            defId, name: '小猴', x: u.x + Math.cos(a) * 30, y: u.y + Math.sin(a) * 30, hp: u.maxHp * 0.15,
            atk: u.atk * 0.35, life, r: 10, speed: 190, range: 26, atkCd: 0.6,
        }));
    }
    return out;
}

export const WUKONG: HeroDef = {
    id: 'wukong', name: '孙悟空', nature: 'xiuluo', role: 'melee', color: 0xf2c84b,
    hp: 1000, atk: 55, atkCd: 0.75, range: 52, speed: 130, r: 17, blockCap: 2, manaPerHit: 11,
    passiveName: '毫毛分身',
    skillNames: { ren: '如意金箍棒', tian: '棒落九天', xiuluo: '狂棒乱舞', chusheng: '群猴扛棒', egui: '勾魂棒', diyu: '裂地火沟' },
    cast: {
        ren(w, u) {
            w.schedule(0.2, () => { if (!u.dead) smashLine(w, u, 270, 3, w.newChain()); });
        },
        tian(w, u) {
            const chain = w.newChain();
            const pool = w.enemies().filter(e => e.y > 0);
            for (let i = 0; i < 5; i++) {
                const t = pool.length ? pool[w.rng.int(pool.length)] : null;
                const x = t ? t.x : w.rng.range(80, 640), y = t ? t.y : w.rng.range(200, 700);
                w.schedule(0.15 * i, () => {
                    if (u.dead) return;
                    w.fx('staffdrop', x, y, { r: 70, color: 0xf2c84b });
                    for (const e of w.query(x, y, 70, 'enemy')) w.damage(u, e, u.atk * 2.2, { tag: 'skill', chain });
                });
            }
        },
        xiuluo(w, u) {
            const t = strongest(w, u, 260) ?? focus(w, u);
            if (!t) return;
            const chain = w.newChain();
            const slam = (k: number) => {
                if (u.dead) return;
                w.fx('slam', u.x, u.y - 10, { r: 90, color: 0xd8382c });
                for (const e of w.query(u.x, u.y, 90, 'enemy')) {
                    w.damage(u, e, u.atk * 1.8, { tag: 'skill', chain });
                    w.knock(e, u.x, u.y, 40);
                }
                if (k < 2) w.schedule(0.3, () => slam(k + 1));
            };
            const d = dir(u.x, u.y, t.x, t.y);
            w.dash(u, t.x - d.x * (t.r + 10), t.y - d.y * (t.r + 10), { speed: 800, onEnd: () => slam(0) });
        },
        chusheng(w, u) {
            const chain = w.newChain();
            for (const m of spawnMonkeys(w, u, 4, 5, 'monkey')) {
                const t = w.nearest(m.x, m.y, 'enemy', 300);
                if (!t) continue;
                w.schedule(0.25, () => {
                    w.fx('staffdrop', t.x, t.y, { r: 50, color: 0xf2c84b });
                    for (const e of w.query(t.x, t.y, 50, 'enemy')) w.damage(u, e, u.atk * 1.2, { tag: 'skill', chain });
                });
            }
        },
        egui(w, u) {
            const chain = w.newChain();
            const targets = lowestHp(w, u, 380, 3);
            targets.forEach((t, i) => w.schedule(0.25 * i, () => {
                if (u.dead || t.dead) return;
                w.fx('hook', u.x, u.y, { x2: t.x, y2: t.y, color: 0x5fd39a });
                w.damage(u, t, u.atk * 2.5, { tag: 'skill', chain });
                if (t.dead) {
                    w.heal(u, u, u.maxHp * 0.1);
                    u.mana = Math.min(u.manaMax, u.mana + 35);
                }
            }));
        },
        diyu(w, u) {
            w.schedule(0.2, () => {
                if (u.dead) return;
                const chain = w.newChain();
                const s = smashLine(w, u, 300, 2, chain);
                if (s) w.zone({ side: 'hero', srcId: u.id, x: s.x0, y: s.y0, x2: s.x1, y2: s.y1, line: true, r: 30, dur: 6, dps: u.atk, visual: 'firetrench', color: 0x8a3cc8, chain });
            });
        },
    },
    // 本命「毫毛分身」：普攻攒毫毛，阵亡时吹出小猴子，一直打到他复活
    onAttack(w, u) {
        u.vars.hair = Math.min(HAIR_MAX, (u.vars.hair ?? 0) + 1);
    },
    onDeath(w, u) {
        const n = Math.min(MONKEY_MAX, Math.floor((u.vars.hair ?? 0) / HAIR_PER_MONKEY));
        u.vars.hair = 0;
        if (n <= 0) return;
        w.fx('hairblow', u.x, u.y, { r: 60, color: 0xf2c84b });
        spawnMonkeys(w, u, n, u.reviveT, 'hair');
    },
    onRevive(w, u) {
        w.removeSummons(u, 'hair');
    },
};
