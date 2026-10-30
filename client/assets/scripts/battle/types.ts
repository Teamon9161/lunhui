import type { Circle } from './grid';

export type Dao = 'ren' | 'tian' | 'xiuluo' | 'chusheng' | 'egui' | 'diyu';
export const DAOS: readonly Dao[] = ['ren', 'tian', 'xiuluo', 'chusheng', 'egui', 'diyu'];

export type Side = 'hero' | 'enemy';
export type UnitKind = 'hero' | 'minion' | 'elite' | 'boss' | 'summon' | 'altar';
export type Role = 'tank' | 'melee' | 'ranged' | 'support';

export interface Status {
    stun: number;
    root: number;
    slow: number;
    slowPct: number;
    vuln: number;
    vulnPct: number;
    burn: number;
    burnDps: number;
    burnSrc: number;
    untargetable: number;
}

export interface Unit extends Circle {
    side: Side;
    kind: UnitKind;
    defId: string;
    name: string;
    hp: number;
    maxHp: number;
    atk: number;
    atkCd: number;
    atkTimer: number;
    range: number;
    speed: number;
    shield: number;
    mana: number;
    manaMax: number;
    manaPerHit: number;
    dead: boolean;
    removed: boolean;
    ranged: boolean;
    mass: number;

    target: number;
    anchorX: number;
    anchorY: number;
    leash: number;
    blockCap: number;
    engagedBy: number;
    engage: number;

    atkSpeedMul: number;
    moveMul: number;
    dmgTakenMul: number;
    lifesteal: number;

    st: Status;
    // 英雄
    dao: Dao;
    shiShu: number;
    reviveT: number;
    buddha: boolean;
    // 召唤物
    ownerId: number;
    expireT: number;
    // 各技能自己的计数，如毫毛、修罗攻速层数
    vars: Record<string, number>;
    // 怪物 AI 与词缀
    ai: string;
    affixes: string[];
    facing: number;
    // 击退速度，每帧衰减
    kx: number;
    ky: number;
    dash: Dash | null;
    // 进行中的出手动作（有前摇的普攻/施法），前摇结束时才结算
    act: Act | null;
    // 表现层用：当前在做什么动作
    anim: 'idle' | 'move' | 'attack' | 'cast' | 'hit' | 'dead';
    animT: number;
}

export interface Act {
    kind: 'attack' | 'cast';
    t: number;
    windup: number;
    recover: number;
    released: boolean;
    targetId: number;
    tx: number;
    ty: number;
}

export interface Dash {
    tx: number;
    ty: number;
    speed: number;
    dmg: number;
    width: number;
    tag: string;
    chain: number;
    knock: number;
    hit: number[];
    onEnd: (() => void) | null;
}

export interface Projectile {
    id: number;
    x: number;
    y: number;
    side: Side;
    srcId: number;
    targetId: number;
    tx: number;
    ty: number;
    speed: number;
    kind: 'homing' | 'line' | 'lob';
    t: number;
    dur: number;
    sx: number;
    sy: number;
    dmg: number;
    aoe: number;
    tag: string;
    visual: string;
    color: number;
    chain: number;
    hit: number[];
    data: Record<string, number>;
    dead: boolean;
}

export interface Zone {
    id: number;
    x: number;
    y: number;
    r: number;
    // 线形区域：从 (x,y) 到 (x2,y2)，宽度 r
    x2: number;
    y2: number;
    line: boolean;
    side: Side;
    srcId: number;
    t: number;
    dur: number;
    tickT: number;
    dps: number;
    slowPct: number;
    pull: number;
    vulnPct: number;
    visual: string;
    color: number;
    chain: number;
    dead: boolean;
}

export type BattleEvent =
    | { type: 'damage'; target: number; amount: number; x: number; y: number; tag: string; shield: boolean; big: boolean }
    | { type: 'heal'; target: number; amount: number; x: number; y: number }
    | { type: 'death'; unit: number; x: number; y: number; kind: UnitKind }
    | { type: 'reincarnate'; unit: number; from: Dao; to: Dao; shiShu: number; gained: boolean }
    | { type: 'revive'; unit: number; x: number; y: number }
    | { type: 'cast'; unit: number; skill: string; dao: Dao; x: number; y: number }
    // 出手动作开始：windup 秒后结算（表现层据此把出手帧对齐到结算时刻），dur 为整个动作时长
    | { type: 'act'; unit: number; act: 'attack' | 'cast'; windup: number; dur: number; tx: number; ty: number }
    // 前摇中被控制打断，未结算
    | { type: 'actCancel'; unit: number }
    | { type: 'chain'; n: number; x: number; y: number }
    | { type: 'fx'; name: string; x: number; y: number; x2?: number; y2?: number; r?: number; color?: number; dur?: number; unit?: number }
    | { type: 'spawn'; unit: number }
    | { type: 'text'; text: string; x: number; y: number; color: number }
    | { type: 'wave'; index: number; total: number }
    | { type: 'end'; win: boolean };

// 跨战斗保留的英雄状态（局内）。
export interface HeroState {
    heroId: string;
    dao: Dao;
    shiShu: number;
    buddha: boolean;
    stones: { atk: number; color: number }[];
}

export interface DamageOpts {
    tag?: string;
    chain?: number;
    noLifesteal?: boolean;
    ignoreShield?: boolean;
    noMana?: boolean;
}
