import type { HeroDef } from '../defs';
import type { Projectile, Unit } from '../types';
import type { World } from '../world';
import { FIELD } from '../world';
import { dir, focus } from './common';

const RING_DMG = 1.6;
const RING_BOUNCE_R = 190;

function throwRing(w: World, u: Unit, from: { x: number; y: number }, target: Unit, bounces: number, chain: number, mode: number): void {
    w.projectile({
        side: 'hero', srcId: u.id, x: from.x, y: from.y, targetId: target.id, tx: target.x, ty: target.y, speed: 720,
        kind: 'homing', dmg: u.atk * RING_DMG, tag: 'nz_ring', visual: 'ring', color: 0xf2c84b, chain,
        data: { bounces, mode },
    });
}

// 乾坤圈命中后找下一个目标；mode 1 = 饿鬼道：只在残血之间跳，每杀一个多跳一次
function ringHit(w: World, p: Projectile, hit: Unit | null): void {
    const u = w.get(p.srcId);
    if (!u || u.dead) return;
    let left = p.data.bounces - 1;
    if (p.data.mode === 1 && hit && hit.dead) left += 1;
    if (left <= 0) return;
    p.hit.push(hit ? hit.id : 0);
    const cands = w.query(p.x, p.y, RING_BOUNCE_R, 'enemy').filter(e => p.hit.indexOf(e.id) < 0);
    let next: Unit | undefined;
    if (p.data.mode === 1) next = cands.filter(e => e.hp / e.maxHp < 0.5).sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp)[0];
    else next = cands.sort((a, b) => Math.hypot(a.x - p.x, a.y - p.y) - Math.hypot(b.x - p.x, b.y - p.y))[0];
    if (!next) return;
    const np = w.projectile({
        side: 'hero', srcId: u.id, x: p.x, y: p.y, targetId: next.id, tx: next.x, ty: next.y, speed: 720, kind: 'homing',
        dmg: p.dmg, tag: 'nz_ring', visual: 'ring', color: p.color, chain: p.chain, data: { bounces: left, mode: p.data.mode },
    });
    np.hit = p.hit.slice(-3);
}

export const NEZHA: HeroDef = {
    id: 'nezha', name: '哪吒', nature: 'tian', role: 'melee', color: 0xe0503a,
    hp: 900, atk: 45, atkCd: 0.8, range: 48, speed: 125, r: 17, blockCap: 2, manaPerHit: 12,
    reviveMul: 0.5,
    passiveName: '莲花化身',
    skillNames: { ren: '乾坤圈', tian: '三圈齐发', xiuluo: '风火轮', chusheng: '混天绫', egui: '索命圈', diyu: '业火莲' },
    projHooks: { nz_ring: ringHit },
    cast: {
        ren(w, u) {
            const t = focus(w, u);
            if (t) throwRing(w, u, u, t, 6, w.newChain(), 0);
        },
        tian(w, u) {
            const ts = w.query(u.x, u.y, 380, 'enemy').sort((a, b) => Math.hypot(a.x - u.x, a.y - u.y) - Math.hypot(b.x - u.x, b.y - u.y));
            const chain = w.newChain();
            for (let i = 0; i < 3 && ts.length; i++) throwRing(w, u, u, ts[i % ts.length], 6, chain, 0);
        },
        xiuluo(w, u) {
            const t = w.densest('enemy', 90, u.x, u.y, 300) ?? focus(w, u);
            if (!t) return;
            const chain = w.newChain();
            const sx = u.x, sy = u.y;
            const d = dir(sx, sy, t.x, t.y);
            const len = Math.min(Math.hypot(t.x - sx, t.y - sy) + 120, 380);
            const ex = sx + d.x * len, ey = Math.max(FIELD.LINE_Y - 30, sy + d.y * len);
            const pass = (ax: number, ay: number, bx: number, by: number, next: (() => void) | null) => {
                w.dash(u, bx, by, { speed: 900, dmg: u.atk * 2, width: 34, tag: 'skill', chain, onEnd: () => {
                    w.zone({ side: 'hero', srcId: u.id, x: ax, y: ay, x2: bx, y2: by, line: true, r: 22, dur: 3, dps: u.atk * 0.8, visual: 'fireline', color: 0xff7a2a, chain });
                    next?.();
                } });
            };
            pass(sx, sy, ex, ey, () => pass(ex, ey, sx, sy, () => pass(sx, sy, ex, ey, null)));
        },
        chusheng(w, u) {
            const fx = u.x + u.facing * 40, fy = u.y - 30;
            w.fx('sash', u.x, u.y, { r: 170, color: 0xd8382c });
            for (const e of w.query(u.x, u.y, 170, 'enemy')) {
                w.pull(e, fx, fy, 150);
                w.stun(e, 1.5);
                w.damage(u, e, u.atk, { tag: 'skill' });
            }
        },
        egui(w, u) {
            const t = w.query(u.x, u.y, 420, 'enemy').sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp)[0];
            if (t) throwRing(w, u, u, t, 4, w.newChain(), 1);
        },
        diyu(w, u) {
            w.zone({ side: 'hero', srcId: u.id, x: u.x, y: u.y, r: 110, dur: 5, dps: u.atk * 1.2, visual: 'lotusfire', color: 0x8a3cc8 });
        },
    },
    // 本命「莲花化身」：在阵亡的地方从莲花里复活，复活时间减半，重生时火莲炸开
    onDeath(w, u) {
        w.fx('lotus', u.x, Math.max(u.y, FIELD.LINE_Y), { unit: u.id, dur: u.reviveT, color: 0xf08aa0 });
    },
    revivePos(w, u, dx, dy) {
        return { x: dx, y: Math.max(dy, FIELD.LINE_Y) };
    },
    onRevive(w, u) {
        w.fx('lotusburst', u.x, u.y, { r: 130, color: 0xff7a2a });
        const chain = w.newChain();
        for (const e of w.query(u.x, u.y, 130, 'enemy')) w.damage(u, e, u.atk * 3, { tag: 'passive', chain });
    },
};
