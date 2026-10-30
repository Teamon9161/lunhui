import type { Dao, Role, Unit, Projectile } from './types';
import type { World } from './world';

export interface ActTiming {
    attack?: [number, number];
    cast?: [number, number];
}

export interface HeroDef {
    id: string;
    name: string;
    nature: Dao;
    role: Role;
    color: number;
    hp: number;
    atk: number;
    atkCd: number;
    range: number;
    speed: number;
    r: number;
    blockCap: number;
    manaPerHit: number;
    // 普攻弹道，没有就是近战即时命中
    shot?: { speed: number; visual: string; kind: 'homing' | 'lob'; aoe: number };
    reviveMul?: number;
    // 出手时序（秒）：[前摇, 收势]。没有则立即结算（旧行为）。前摇随攻速缩短
    timing?: ActTiming;
    // 嘲讽半径：敌人在这个范围内优先打他（唐僧肉）
    taunt?: number;
    skillNames: Record<Dao, string>;
    passiveName: string;
    cast: Record<Dao, (w: World, u: Unit) => void>;
    // 弹道命中回调，按 projectile.tag 分派
    projHooks?: Record<string, ProjectileHook>;
    onSpawn?(w: World, u: Unit): void;
    onAttack?(w: World, u: Unit, target: Unit): void;
    onDeath?(w: World, u: Unit, killer: Unit | null): void;
    onRevive?(w: World, u: Unit, deathX: number, deathY: number): void;
    // 场上任何单位死亡（含敌人、含其他英雄）
    onAnyDeath?(w: World, u: Unit, dead: Unit, killer: Unit | null): void;
    onReincarnate?(w: World, u: Unit): void;
    onTick?(w: World, u: Unit, dt: number): void;
    // 自定义复活位置
    revivePos?(w: World, u: Unit, deathX: number, deathY: number): { x: number; y: number } | null;
}

export interface EnemyDef {
    id: string;
    name: string;
    kind: 'minion' | 'elite' | 'boss';
    color: number;
    hp: number;
    atk: number;
    atkCd: number;
    range: number;
    speed: number;
    r: number;
    ranged: boolean;
    mass?: number;
    shot?: { speed: number; visual: string; kind: 'homing' | 'lob'; aoe: number };
    timing?: ActTiming;
    ai?: 'melee' | 'ranged' | 'boss' | 'hound' | 'rush';
    onSpawn?(w: World, u: Unit): void;
    onTick?(w: World, u: Unit, dt: number): void;
    onDeath?(w: World, u: Unit, killer: Unit | null): void;
    onAttack?(w: World, u: Unit, target: Unit): void;
    // 被打时（还没扣血），可改写伤害
    onDamaged?(w: World, u: Unit, amount: number, src: Unit | null): number;
    // 杀死英雄时
    onKillHero?(w: World, u: Unit, hero: Unit): void;
}

export type ProjectileHook = (w: World, p: Projectile, hit: Unit | null) => void;
