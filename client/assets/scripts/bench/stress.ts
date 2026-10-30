// 压测战斗：用真实战斗核心维持指定数量的活动单位和弹丸，供表现层测帧耗时。
// 不依赖 cc，可在 bun 下跑纯逻辑耗时；画面压测由 Cocos 场景加载同一套配置。
import { World, FIELD } from '../battle/world';
import { HEROES } from '../battle/heroes/index';
import { ENEMY_DEFS, newHeroState } from '../battle/battle';
import { CHAPTER_POOL } from '../battle/enemies';
import type { Side, Unit } from '../battle/types';

export interface StressConfig {
    seed: number;
    units: number;
    bullets: number;
}

export const STRESS_DEFAULT: StressConfig = { seed: 20261030, units: 150, bullets: 400 };

const HERO_IDS = ['zhongkui', 'nezha', 'wukong', 'jingwei', 'tangseng'];
const ENEMY_IDS = Array.from(new Set(Object.values(CHAPTER_POOL).flat().map(p => p.id)));
// 每帧补充上限，避免一次性生成造成不真实的尖峰
const SPAWN_PER_TICK = 8;
const SHOTS_PER_TICK = 40;

export class StressBattle {
    readonly world: World;
    readonly config: StressConfig;
    liveUnits = 0;
    liveBullets = 0;

    constructor(config: StressConfig = STRESS_DEFAULT) {
        this.config = config;
        this.world = new World({ seed: config.seed, heroDefs: HEROES, enemyDefs: ENEMY_DEFS, altarHp: 1e9 });
        // 两排各五名英雄
        HERO_IDS.forEach((id, i) => {
            this.world.spawnHero(HEROES[id], newHeroState(id), (FIELD.W * (i + 1)) / 6, FIELD.LINE_Y + 90);
            this.world.spawnHero(HEROES[id], newHeroState(id), (FIELD.W * (i + 1.5)) / 6.5, FIELD.LINE_Y + 320);
        });
        this.world.tickHooks.push(() => this.control());
    }

    private control(): void {
        const w = this.world;
        let units = 0;
        const shooters: Unit[] = [];
        for (const u of w.units) {
            if (u.dead || u.kind === 'altar') continue;
            units++;
            shooters.push(u);
        }
        for (let i = 0; i < SPAWN_PER_TICK && units < this.config.units; i++, units++) {
            w.spawnEnemy(w.rng.pick(ENEMY_IDS), w.rng.range(40, FIELD.W - 40), FIELD.SPAWN_Y);
        }
        let bullets = 0;
        for (const p of w.projectiles) if (!p.dead) bullets++;
        for (let i = 0; i < SHOTS_PER_TICK && bullets < this.config.bullets && shooters.length; i++, bullets++) {
            const src = w.rng.pick(shooters);
            const side: Side = src.side;
            // 直线穿透弹：英雄向上、敌人向下，造成少量真实伤害
            const ty = side === 'hero' ? FIELD.SPAWN_Y - 40 : FIELD.H + 40;
            w.projectile({
                side, srcId: src.id, x: src.x, y: src.y, kind: 'line', speed: w.rng.range(380, 620),
                tx: w.rng.range(0, FIELD.W), ty, dmg: src.atk * 0.15, tag: 'stress', visual: 'dot',
                color: side === 'hero' ? 0xffd27a : 0xc86aff,
            });
        }
        this.liveUnits = units;
        this.liveBullets = bullets;
    }

    step(): void {
        this.world.step();
    }
}
