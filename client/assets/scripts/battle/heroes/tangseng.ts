import type { HeroDef } from '../defs';
import type { Unit } from '../types';
import { DAOS } from '../types';
import type { World } from '../world';
import { FIELD } from '../world';
import { allies, dir, strongest } from './common';

const BUDDHA_PER_SHI = 0.03;
const BUDDHA_GUARANTEE = 10;
const BUDDHA_HEAL = 0.015; // 每秒，全队最大生命

function teamShield(w: World, u: Unit, pct: number): void {
    for (const h of allies(w)) {
        w.addShield(h, h.maxHp * pct);
        w.fx('shield', h.x, h.y, { unit: h.id, color: 0xf2c84b, r: h.r + 8 });
    }
}

export const TANGSENG: HeroDef = {
    id: 'tangseng', name: '唐僧', nature: 'tian', role: 'support', color: 0xe8b04a,
    hp: 720, atk: 18, atkCd: 1.2, range: 220, speed: 105, r: 15, blockCap: 1, manaPerHit: 20,
    shot: { speed: 460, visual: 'bead', kind: 'homing', aoe: 0 },
    taunt: 200,
    passiveName: '十世金蝉',
    skillNames: { ren: '金光罩', tian: '诵经', xiuluo: '当头棒喝', chusheng: '白龙马', egui: '放焰口', diyu: '超度' },
    cast: {
        ren(w, u) { teamShield(w, u, 0.2); },
        tian(w, u) {
            teamShield(w, u, 0.12);
            for (let i = 1; i <= 5; i++) {
                w.schedule(i, () => {
                    if (u.dead) return;
                    for (const h of allies(w)) w.heal(u, h, h.maxHp * 0.03);
                });
            }
            w.fx('chant', u.x, u.y, { r: 260, color: 0xf2c84b, dur: 5 });
        },
        xiuluo(w, u) {
            const t = strongest(w, u, 260);
            if (!t) return;
            const d = dir(u.x, u.y, t.x, t.y);
            w.dash(u, t.x - d.x * (t.r + u.r), t.y - d.y * (t.r + u.r), {
                speed: 700, onEnd: () => {
                    if (t.dead) return;
                    w.fx('bonk', t.x, t.y, { r: 40, color: 0xf2c84b });
                    w.stun(t, 2);
                    w.damage(u, t, u.atk * 4, { tag: 'skill' });
                    // 唐僧肉：周围敌人全来打他
                    for (const e of w.query(u.x, u.y, 250, 'enemy')) {
                        if (e.ai === 'melee') e.engage = u.id;
                        else e.target = u.id;
                    }
                },
            });
        },
        chusheng(w, u) {
            const t = w.densest('enemy', 90, u.x, u.y, 320);
            teamShield(w, u, 0.08);
            if (!t) return;
            const sx = u.x, sy = u.y;
            const chain = w.newChain();
            w.fx('horse', u.x, u.y, { unit: u.id, color: 0xffffff, dur: 1.2 });
            w.dash(u, t.x, t.y, {
                speed: 650, dmg: u.atk * 3, width: 40, knock: 60, chain,
                onEnd: () => w.dash(u, sx, sy, { speed: 650, dmg: u.atk * 3, width: 40, knock: 60, chain }),
            });
        },
        egui(w, u) {
            w.fx('offering', u.x, u.y, { r: 170, color: 0x5fd39a });
            for (const e of w.query(u.x, u.y, 170, 'enemy')) w.stun(e, 2);
            for (const h of allies(w)) if (h.dao === 'egui') w.heal(u, h, h.maxHp);
        },
        diyu(w, u) {
            const waiting = w.heroes().filter(h => h.dead && h !== u).sort((a, b) => b.reviveT - a.reviveT)[0];
            if (waiting) {
                waiting.reviveT = 0;
                w.fx('salvation', FIELD.ALTAR_X, FIELD.ALTAR_Y - 60, { color: 0xf2c84b });
            } else {
                teamShield(w, u, 0.2);
            }
        },
    },
    onAttack(w, u) {
        // 念珠打人时顺手给血最少的队友一点回复
        const low = allies(w).sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp)[0];
        if (low && low.hp < low.maxHp) w.heal(u, low, u.atk * 0.8);
    },
    // 本命「十世金蝉」：每次转世有概率成佛，世数越多概率越高，第 10 世必定成佛
    onReincarnate(w, u) {
        if (u.buddha) return;
        const diedInTian = DAOS[u.vars.prevDao ?? 0] === 'tian';
        const p = u.shiShu >= BUDDHA_GUARANTEE ? 1 : BUDDHA_PER_SHI * u.shiShu * (diedInTian ? 2 : 1);
        if (!w.rng.chance(p)) return;
        u.buddha = true;
        const st = w.heroStates.get(u.id);
        if (st) st.buddha = true;
        w.text('成佛', u.x, u.y - 40, 0xf2c84b);
    },
    onTick(w, u, dt) {
        if (!u.buddha) return;
        u.vars.buddhaAcc = (u.vars.buddhaAcc ?? 0) + dt;
        if (u.vars.buddhaAcc < 1) return;
        u.vars.buddhaAcc -= 1;
        for (const h of allies(w)) w.heal(u, h, h.maxHp * BUDDHA_HEAL);
    },
};
