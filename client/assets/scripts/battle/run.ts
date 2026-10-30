import { Rng } from './rng';
import { AFFIX_IDS, Battle, newHeroState } from './battle';
import type { BattleConfig, BattleResult, StationType } from './battle';
import { CHAPTER_BOSSES } from './bosses';
import type { HeroState } from './types';

// 一局：3 章 × 8 站。战斗体验版只保留战斗站，第 7 站休整修坛，养成以后再加。
export const CHAPTERS = 3;
export const STATIONS = 8;
const ALTAR_MAX = 1000;
const REST_HEAL = 200;

export interface Station { chapter: number; station: number; type: StationType | 'rest' }

export class Run {
    readonly rng: Rng;
    readonly heroes: HeroState[];
    readonly bossOf: Record<number, { boss: string[]; affixes: string[] }> = {};
    readonly stations: Station[] = [];
    index = 0;
    altarHp = ALTAR_MAX;
    readonly altarMax = ALTAR_MAX;
    results: BattleResult[] = [];

    constructor(seed: number, team: string[]) {
        this.rng = new Rng(seed);
        this.heroes = team.map(newHeroState);
        for (let c = 1; c <= CHAPTERS; c++) {
            // 开章就公布首领和词缀（第三章两个）
            const boss = this.rng.pick(CHAPTER_BOSSES[c]);
            const affixes: string[] = [];
            while (affixes.length < (c === 3 ? 2 : 1)) {
                const a = this.rng.pick(AFFIX_IDS);
                if (!affixes.includes(a)) affixes.push(a);
            }
            this.bossOf[c] = { boss, affixes };
            for (let s = 1; s <= STATIONS; s++) {
                const type: Station['type'] = s === 8 ? 'boss' : s === 7 ? 'rest' : s === 1 ? 'normal' : this.rng.chance(12 / 57) ? 'elite' : 'normal';
                this.stations.push({ chapter: c, station: s, type });
            }
        }
    }

    get current(): Station | undefined {
        return this.stations[this.index];
    }

    get over(): boolean {
        return this.index >= this.stations.length || this.altarHp <= 0;
    }

    // 休整站直接结算；战斗站返回一场 Battle，打完调用 finish
    next(): Battle | null {
        const st = this.current;
        if (!st) return null;
        if (st.type === 'rest') {
            this.altarHp = Math.min(this.altarMax, this.altarHp + REST_HEAL);
            this.index++;
            return null;
        }
        const cfg: BattleConfig = {
            seed: this.rng.int(2 ** 31), chapter: st.chapter, station: st.station, type: st.type,
            altarHp: this.altarHp, altarMaxHp: this.altarMax,
        };
        if (st.type === 'boss') {
            cfg.boss = this.bossOf[st.chapter].boss;
            cfg.affixes = this.bossOf[st.chapter].affixes;
        }
        return new Battle(cfg, this.heroes);
    }

    finish(b: Battle): BattleResult {
        const r = b.result();
        this.results.push(r);
        this.altarHp = r.win ? r.altarHp : 0;
        this.index++;
        return r;
    }
}
