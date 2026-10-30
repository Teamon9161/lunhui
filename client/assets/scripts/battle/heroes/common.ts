import type { Unit } from '../types';
import type { World } from '../world';
import { FIELD } from '../world';

// 神通常用的选点：先找当前目标，没有就找离自己最近的敌人
export function focus(w: World, u: Unit, maxR = 420): Unit | null {
    const t = w.get(u.target);
    if (w.targetable(t) && t.side !== u.side) return t;
    return w.nearest(u.x, u.y, 'enemy', maxR);
}

export function strongest(w: World, u: Unit, maxR: number): Unit | null {
    let best: Unit | null = null;
    for (const e of w.query(u.x, u.y, maxR, 'enemy')) if (!best || e.maxHp > best.maxHp) best = e;
    return best;
}

export function lowestHp(w: World, u: Unit, maxR: number, n: number, exclude: number[] = []): Unit[] {
    return w.query(u.x, u.y, maxR, 'enemy')
        .filter(e => exclude.indexOf(e.id) < 0)
        .sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp)
        .slice(0, n);
}

export function dir(ax: number, ay: number, bx: number, by: number): { x: number; y: number } {
    const dx = bx - ax, dy = by - ay, d = Math.hypot(dx, dy) || 1;
    return { x: dx / d, y: dy / d };
}

export function clampField(x: number, y: number): { x: number; y: number } {
    return { x: Math.max(20, Math.min(FIELD.W - 20, x)), y: Math.max(FIELD.SPAWN_Y, Math.min(FIELD.H - 20, y)) };
}

export function allies(w: World): Unit[] {
    return w.aliveHeroes();
}
