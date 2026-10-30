// 动作样板展示：单个英雄对着不会还手的木桩反复普攻和施法，用真实战斗核心驱动，
// 所以出手节奏、弹道和落点与正式战斗一致。不依赖 cc。
import { World } from '../battle/world';
import { HEROES } from '../battle/heroes/index';
import { ENEMY_DEFS, newHeroState } from '../battle/battle';
import type { Unit } from '../battle/types';

const DUMMY_HP = 1e7;

export class Showcase {
    readonly world: World;
    readonly hero: Unit;
    private readonly dummies: Unit[] = [];

    constructor(heroId: string, seed = 7) {
        const w = new World({ seed, heroDefs: HEROES, enemyDefs: ENEMY_DEFS, altarHp: 1e9 });
        this.world = w;
        this.hero = w.spawnHero(HEROES[heroId], newHeroState(heroId), 360, 940);
        // 约每三次普攻放一次技能，便于反复观看
        this.hero.manaPerHit = Math.ceil(this.hero.manaMax / 3);
        for (const [x, y] of [[270, 650], [360, 620], [450, 650]]) {
            const d = w.spawnEnemy('boar', x, y);
            d.ai = 'none';
            d.maxHp = d.hp = DUMMY_HP;
            this.dummies.push(d);
        }
        w.tickHooks.push(() => {
            for (const d of this.dummies) {
                d.hp = DUMMY_HP;
                d.kx = d.ky = 0;
            }
        });
    }

    step(): void {
        this.world.step();
    }
}
