import type { Dao } from './types';

// 六道的通用规则（站位、选目标、属性）。各英雄神通在每道里怎么变写在英雄文件里。
export interface DaoDef {
    id: Dao;
    name: string;
    color: number;
    // 寿元（场数），局内养成以后用
    life: number;
    hpMul: number;
    atkMul: number;
    atkSpeedMul: number;
    moveMul: number;
    dmgTakenMul: number;
    lifesteal: number;
}

export const DAO_DEFS: Record<Dao, DaoDef> = {
    ren: { id: 'ren', name: '人道', color: 0xd8c8a8, life: 2, hpMul: 1, atkMul: 1, atkSpeedMul: 1, moveMul: 1, dmgTakenMul: 1, lifesteal: 0 },
    tian: { id: 'tian', name: '天道', color: 0xf2c84b, life: 3, hpMul: 1.3, atkMul: 1.3, atkSpeedMul: 1, moveMul: 1, dmgTakenMul: 1, lifesteal: 0 },
    xiuluo: { id: 'xiuluo', name: '修罗', color: 0xd8382c, life: 1, hpMul: 1, atkMul: 1.15, atkSpeedMul: 1, moveMul: 1.15, dmgTakenMul: 1.2, lifesteal: 0 },
    chusheng: { id: 'chusheng', name: '畜生', color: 0x8fb04a, life: 2, hpMul: 1, atkMul: 1, atkSpeedMul: 1.3, moveMul: 1.3, dmgTakenMul: 1, lifesteal: 0 },
    egui: { id: 'egui', name: '饿鬼', color: 0x5fd39a, life: 1, hpMul: 0.9, atkMul: 1.05, atkSpeedMul: 1, moveMul: 1.1, dmgTakenMul: 1, lifesteal: 0.2 },
    diyu: { id: 'diyu', name: '地狱', color: 0x8a3cc8, life: 1, hpMul: 1, atkMul: 1.4, atkSpeedMul: 1, moveMul: 1, dmgTakenMul: 1, lifesteal: 0 },
};

export const XIULUO_LEASH = 220;
export const XIULUO_RAMP_PER_HIT = 0.06;
export const XIULUO_RAMP_MAX = 0.6;
export const EGUI_KILL_HEAL = 0.08;
export const DIYU_AURA_R = 90;
export const DIYU_AURA_DPS = 0.25; // × 攻击
export const DIYU_ALTAR_DRAIN = 4; // 每秒
export const CHUSHENG_PET_ATK = 0.3;
export const CHUSHENG_PET_HP = 0.3;
export const NATURE_WEIGHT = 2;
export const GROWTH_PER_SHI = 0.03;
export const REVIVE_TIME = 6;
