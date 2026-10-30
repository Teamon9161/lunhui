// 机器人模拟：bun tools/sim.ts [局数] [起始种子]
import { Run } from '../assets/scripts/battle/run';
import { ENEMY_DEFS } from '../assets/scripts/battle/battle';

const TEAM = ['zhongkui', 'nezha', 'wukong', 'jingwei', 'tangseng'];
const runs = Number(process.argv[2] ?? 20);
const seed0 = Number(process.argv[3] ?? 1);

let wins = 0;
const diedAt: Record<string, number> = {};
const dmg: Record<string, number> = {};
const casts: Record<string, number> = {};
const deaths: Record<string, number> = {};
let battles = 0, battleTime = 0, maxChain = 0, buddhas = 0;
const bossWin: Record<string, [number, number]> = {};

for (let i = 0; i < runs; i++) {
    const run = new Run(seed0 + i, TEAM);
    while (!run.over) {
        const st = run.current!;
        const b = run.next();
        if (!b) continue;
        for (let t = 0; t < 240 * 30 && !b.world.over; t++) b.step();
        if (!b.world.over) b.world.finish(false);
        const r = run.finish(b);
        battles++;
        battleTime += r.time;
        maxChain = Math.max(maxChain, r.stats.maxChain);
        for (const [k, v] of Object.entries(r.stats.dmg)) dmg[k] = (dmg[k] ?? 0) + v;
        for (const [k, v] of Object.entries(r.stats.casts)) casts[k] = (casts[k] ?? 0) + v;
        for (const [k, v] of Object.entries(r.stats.deaths)) deaths[k] = (deaths[k] ?? 0) + v;
        if (st.type === 'boss') {
            const name = run.bossOf[st.chapter].boss.map(id => ENEMY_DEFS[id].name).join('·');
            bossWin[name] ??= [0, 0];
            bossWin[name][1]++;
            if (r.win) bossWin[name][0]++;
        }
        if (!r.win) diedAt[`${st.chapter}-${st.station}`] = (diedAt[`${st.chapter}-${st.station}`] ?? 0) + 1;
    }
    if (run.altarHp > 0) wins++;
    if (run.heroes.some(h => h.buddha)) buddhas++;
    const hs = run.heroes.map(h => `${h.heroId}:${h.shiShu}世/${h.dao}${h.buddha ? '/佛' : ''}`).join(' ');
    console.log(`#${seed0 + i} ${run.altarHp > 0 ? '胜' : '败'} 到 ${run.current ? `${run.current.chapter}-${run.current.station}` : '通关'} 法坛${run.altarHp} ${hs}`);
}

const totalDmg = Object.values(dmg).reduce((a, b) => a + b, 0) || 1;
console.log(`\n胜率 ${wins}/${runs}  场均 ${(battleTime / battles).toFixed(1)} 秒  最长连锁 ${maxChain}  成佛局 ${buddhas}`);
console.log('输在：', diedAt);
console.log('首领胜/场：', bossWin);
for (const id of TEAM) {
    console.log(`${id.padEnd(9)} 伤害占比 ${((100 * (dmg[id] ?? 0)) / totalDmg).toFixed(1)}%  神通/场 ${((casts[id] ?? 0) / battles).toFixed(1)}  阵亡/场 ${((deaths[id] ?? 0) / battles).toFixed(2)}`);
}
