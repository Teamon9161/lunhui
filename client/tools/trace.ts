// 单场跟踪：bun tools/trace.ts [种子] [章] [站] [类型] [首领]
import { Battle, newHeroState } from '../assets/scripts/battle/battle';
import type { StationType } from '../assets/scripts/battle/battle';

const seed = Number(process.argv[2] ?? 1);
const chapter = Number(process.argv[3] ?? 1);
const station = Number(process.argv[4] ?? 1);
const type = (process.argv[5] ?? 'normal') as StationType;
const boss = process.argv[6] ? process.argv[6].split(',') : undefined;
const team = ['zhongkui', 'nezha', 'wukong', 'jingwei', 'tangseng'].map(newHeroState);
const b = new Battle({ seed, chapter, station, type, boss, affixes: [], altarHp: 1000, altarMaxHp: 1000 }, team);
const w = b.world;
for (let t = 0; t < 240 * 30 && !w.over; t++) {
    b.step();
    for (const e of w.drainEvents()) {
        if (e.type === 'cast') console.log(w.time.toFixed(1), 'cast', w.get(e.unit)!.name, e.dao, e.skill);
        if (e.type === 'death' && e.kind === 'hero') console.log(w.time.toFixed(1), 'death', w.get(e.unit)!.name);
        if (e.type === 'reincarnate') console.log(w.time.toFixed(1), '  → ', e.to, e.shiShu);
        if (e.type === 'wave') console.log(w.time.toFixed(1), 'wave', e.index, '/', e.total);
        if (e.type === 'chain') console.log(w.time.toFixed(1), 'chain', e.n);
        if (e.type === 'text') console.log(w.time.toFixed(1), 'text', e.text);
    }
    if (w.tickN % 150 === 0) {
        const hs = w.heroes().map(h => `${h.name}${h.dead ? '†' : ''}(${Math.round(h.x)},${Math.round(h.y)} hp${Math.round(h.hp)} m${Math.round(h.mana)} t${h.target})`).join(' ');
        const es = w.enemies();
        console.log(`[${w.time.toFixed(0)}s] 敌${es.length} 坛${Math.round(w.altar.hp)} ${hs}`);
        if (es.length) console.log('   ', es.slice(0, 6).map(e => `${e.name}(${Math.round(e.x)},${Math.round(e.y)} hp${Math.round(e.hp)} eng${e.engage} ai${e.ai})`).join(' '));
    }
}
const r = b.result();
console.log(r.win ? '胜' : '败', r.time.toFixed(1), '秒 法坛', r.altarHp, JSON.stringify(r.stats));
