import type { HeroDef } from '../defs';
import type { Projectile, Unit } from '../types';
import type { World } from '../world';
import { dir, strongest } from './common';

const SOUL_HEAL = 0.03;
const SOUL_SHIELD = 0.03;
const SOUL_SHIELD_CAP = 0.4;
const MARK_TIME = 4;

function seal(w: World, u: Unit, r: number, t: number, mark: boolean): void {
    w.fx('seal', u.x, u.y, { r, color: 0xf2c84b });
    for (const e of w.query(u.x, u.y, r, 'enemy')) {
        w.stun(e, t);
        w.damage(u, e, u.atk, { tag: 'skill' });
        if (mark) e.vars.zkMark = w.time + MARK_TIME;
    }
}

// 魂火飞到钟馗身上才生效
function soulHit(w: World, p: Projectile, hit: Unit | null): void {
    const u = w.get(p.targetId);
    if (!u || u.dead || u !== hit) return;
    const k = p.data.mul ?? 1;
    w.heal(u, u, u.maxHp * SOUL_HEAL * k);
    w.addShield(u, u.maxHp * SOUL_SHIELD * k, SOUL_SHIELD_CAP);
}

export const ZHONGKUI: HeroDef = {
    id: 'zhongkui', name: '钟馗', nature: 'diyu', role: 'tank', color: 0x3a6a5a,
    hp: 1800, atk: 35, atkCd: 1.1, range: 52, speed: 95, r: 21, blockCap: 4, manaPerHit: 12,
    passiveName: '啖鬼',
    skillNames: { ren: '镇鬼符', tian: '天罗金网', xiuluo: '斩鬼', chusheng: '小鬼抱腿', egui: '摄魂符', diyu: '鬼门开' },
    projHooks: { zk_soul: soulHit },
    cast: {
        ren(w, u) { seal(w, u, 140, 2, false); },
        tian(w, u) {
            w.zone({ side: 'hero', srcId: u.id, x: u.x, y: u.y - 60, r: 170, dur: 5, slowPct: 0.4, vulnPct: 0.3, visual: 'goldnet', color: 0xf2c84b });
        },
        xiuluo(w, u) {
            const t = strongest(w, u, 260);
            if (!t) return;
            const d = dir(u.x, u.y, t.x, t.y);
            w.dash(u, t.x - d.x * (t.r + u.r), t.y - d.y * (t.r + u.r), {
                speed: 750, onEnd: () => {
                    if (t.dead) return;
                    w.fx('bigseal', t.x, t.y, { r: t.r + 10, color: 0xf2c84b, dur: 3 });
                    w.stun(t, 3);
                    for (let i = 0; i < 4; i++) w.schedule(0.25 * i, () => { if (!u.dead && !t.dead) w.damage(u, t, u.atk * 1.5, { tag: 'skill' }); });
                },
            });
        },
        chusheng(w, u) {
            const foes = w.query(u.x, u.y, 260, 'enemy').sort((a, b) => Math.hypot(a.x - u.x, a.y - u.y) - Math.hypot(b.x - u.x, b.y - u.y)).slice(0, 3);
            for (const e of foes) {
                const g = w.spawnSummon(u, { defId: 'imp', name: '小鬼', x: e.x, y: e.y + e.r + 8, hp: u.maxHp * 0.2, atk: u.atk * 0.3, life: 6, r: 10 });
                w.root(e, 4);
                e.engage = g.id;
                g.target = e.id;
            }
        },
        egui(w, u) { seal(w, u, 140, 2, true); },
        diyu(w, u) {
            w.zone({ side: 'hero', srcId: u.id, x: u.x, y: u.y - 40, r: 190, dur: 5, pull: 70, dps: u.atk * 0.8, visual: 'ghostgate', color: 0x8a3cc8 });
        },
    },
    // 本命「啖鬼」：场上任何单位死亡都冒出魂火，钟馗吸收后回血、加护盾
    onAnyDeath(w, u, dead) {
        if (dead === u || dead.kind === 'summon') return;
        const marked = (dead.vars.zkMark ?? 0) > w.time;
        w.projectile({
            side: 'hero', srcId: u.id, x: dead.x, y: dead.y, targetId: u.id, tx: u.x, ty: u.y, speed: 380, kind: 'homing',
            dmg: 0, tag: 'zk_soul', visual: marked ? 'soul2' : 'soul', color: 0x7fe0ff, data: { mul: marked ? 2 : 1 },
        });
    },
};
