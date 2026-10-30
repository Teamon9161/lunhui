// 打印动作样板中英雄的出手事件和弹丸生成时刻，用于核对前摇与结算对齐。
// 用法：bun tools/showcase-trace.ts [英雄] [秒数]
import { Showcase } from '../assets/scripts/bench/showcase';

const hero = process.argv[2] ?? 'jingwei';
const seconds = Number(process.argv[3] ?? 6);
const s = new Showcase(hero);
const seen = new Set<number>();
for (let i = 0; i < seconds * 30; i++) {
    s.step();
    for (const e of s.world.drainEvents()) {
        if (e.type === 'act' && e.unit === s.hero.id) console.log(`${s.world.time.toFixed(3)} act ${e.act} 前摇${e.windup.toFixed(2)} 全长${e.dur.toFixed(2)}`);
    }
    for (const p of s.world.projectiles) {
        if (p.srcId === s.hero.id && !seen.has(p.id)) { seen.add(p.id); console.log(`${s.world.time.toFixed(3)}   弹丸 ${p.visual} ${p.kind}`); }
    }
}
