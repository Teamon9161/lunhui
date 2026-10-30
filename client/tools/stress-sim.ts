// 纯逻辑压测：只跑战斗核心，不含渲染。用法：bun tools/stress-sim.ts [秒数]
import { StressBattle } from '../assets/scripts/bench/stress';

const seconds = Number(process.argv[2] ?? 60);
const s = new StressBattle();
const times: number[] = [];
let units = 0, bullets = 0;
for (let i = 0; i < seconds * 30; i++) {
    const t0 = performance.now();
    s.step();
    times.push(performance.now() - t0);
    s.world.drainEvents();
    if (i >= 150) { units += s.liveUnits; bullets += s.liveBullets; }
}
const warm = times.slice(150).sort((a, b) => a - b);
const pct = (p: number) => warm[Math.min(warm.length - 1, Math.floor(warm.length * p))].toFixed(3);
const avg = warm.reduce((a, b) => a + b, 0) / warm.length;
const n = warm.length;
console.log(`逻辑步 ${n} 次（跳过前 5 秒）：平均 ${avg.toFixed(3)}ms  P95 ${pct(0.95)}ms  P99 ${pct(0.99)}ms  最大 ${warm[n - 1].toFixed(3)}ms`);
console.log(`平均活动单位 ${(units / n).toFixed(1)}，活动弹丸 ${(bullets / n).toFixed(1)}`);
