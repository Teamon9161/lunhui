// 调试观察器：用浏览器 canvas 画战斗模拟，验证手感和数值。正式画面在 Cocos 里做，这里只是开发工具。
import { Run } from '../../assets/scripts/battle/run';
import { Battle, AFFIXES, ENEMY_DEFS, newHeroState } from '../../assets/scripts/battle/battle';
import type { BattleResult, StationType } from '../../assets/scripts/battle/battle';
import { FIELD, TICK } from '../../assets/scripts/battle/world';
import { HEROES } from '../../assets/scripts/battle/heroes/index';
import { DAO_DEFS, DIYU_AURA_R } from '../../assets/scripts/battle/dao';
import { DAOS } from '../../assets/scripts/battle/types';
import type { BattleEvent, Dao, Unit } from '../../assets/scripts/battle/types';
import { CHAPTER_BOSSES } from '../../assets/scripts/battle/bosses';

const TEAM = ['zhongkui', 'nezha', 'wukong', 'jingwei', 'tangseng'];
const $ = (id: string) => document.getElementById(id)!;
const canvas = $('field') as HTMLCanvasElement;
const ctx = canvas.getContext('2d')!;
canvas.width = FIELD.W;
canvas.height = FIELD.H;

const hex = (c: number, a = 1) => `rgba(${(c >> 16) & 255},${(c >> 8) & 255},${c & 255},${a})`;

let run: Run | null = null;
let battle: Battle | null = null;
let speed = 1;
let paused = false;
let acc = 0;
let last = performance.now();
let lastResult: BattleResult | null = null;

interface Floater { text: string; x: number; y: number; t: number; dur: number; color: string; size: number; vy: number }
interface Fx { name: string; x: number; y: number; x2?: number; y2?: number; r: number; color: number; t: number; dur: number; unit?: number }
const floaters: Floater[] = [];
const fxs: Fx[] = [];
const flash = new Map<number, number>();
const trails = new Map<number, { x: number; y: number }[]>();
let banner: { text: string; t: number; color: string } | null = null;

function float(text: string, x: number, y: number, color: string, size = 18, dur = 0.9, vy = -50): void {
    if (floaters.length > 120) floaters.shift();
    floaters.push({ text, x: x + (Math.random() - 0.5) * 16, y, t: 0, dur, color, size, vy });
}

function handle(ev: BattleEvent[]): void {
    const w = battle!.world;
    // 同一帧同一目标的伤害合并
    const merged = new Map<number, { amount: number; x: number; y: number; big: boolean; shield: boolean }>();
    for (const e of ev) {
        switch (e.type) {
            case 'damage': {
                const m = merged.get(e.target);
                if (m) { m.amount += e.amount; m.big ||= e.big; }
                else merged.set(e.target, { amount: e.amount, x: e.x, y: e.y, big: e.big, shield: e.shield });
                flash.set(e.target, 0.1);
                break;
            }
            case 'heal': float('+' + e.amount, e.x, e.y - 20, '#7be07b', 15); break;
            case 'cast': {
                const u = w.get(e.unit)!;
                float(`${e.skill}`, e.x, e.y - 50, hex(DAO_DEFS[e.dao].color), 22, 1.4, -30);
                fxs.push({ name: 'castring', x: u.x, y: u.y, r: 40, color: DAO_DEFS[e.dao].color, t: 0, dur: 0.4 });
                break;
            }
            case 'reincarnate': {
                const u = w.get(e.unit)!;
                float(`转世·${DAO_DEFS[e.to].name}${e.gained ? ` ${e.shiShu}世` : ''}`, u.x, u.y - 40, hex(DAO_DEFS[e.to].color), 20, 2, -20);
                break;
            }
            case 'death': if (e.kind === 'hero') fxs.push({ name: 'soulrise', x: e.x, y: e.y, r: 30, color: 0xffffff, t: 0, dur: 1 }); break;
            case 'revive': fxs.push({ name: 'castring', x: e.x, y: e.y, r: 50, color: 0xffe08a, t: 0, dur: 0.6 }); break;
            case 'chain': banner = { text: `连锁 ×${e.n}`, t: 1.2, color: '#ff7050' }; break;
            case 'text': float(e.text, e.x, e.y, hex(e.color), 24, 1.8, -20); break;
            case 'wave': banner = { text: `第 ${e.index}/${e.total} 波`, t: 1.2, color: '#e8dcc0' }; break;
            case 'fx': fxs.push({ name: e.name, x: e.x, y: e.y, x2: e.x2, y2: e.y2, r: e.r ?? 40, color: e.color ?? 0xffffff, t: 0, dur: e.dur ?? 0.45, unit: e.unit }); break;
            case 'end': onBattleEnd(); break;
        }
    }
    for (const [id, m] of merged) {
        const u = w.get(id);
        const hero = u?.side === 'hero';
        const color = hero ? '#ff6060' : m.shield ? '#cfe8ff' : m.big ? '#ffd040' : '#ffffff';
        float(String(m.amount), m.x, m.y - (u?.r ?? 10) - 6, color, m.big ? 24 : 16);
    }
    if (fxs.length > 200) fxs.splice(0, fxs.length - 200);
}

function onBattleEnd(): void {
    if (!battle) return;
    if (run) lastResult = run.finish(battle);
    else lastResult = battle.result();
    renderReport();
    renderRunInfo();
}

// ---------- 画 ----------

function drawField(): void {
    ctx.fillStyle = '#2b2620';
    ctx.fillRect(0, 0, FIELD.W, FIELD.H);
    ctx.fillStyle = '#3a2f2a';
    ctx.fillRect(0, 0, FIELD.W, FIELD.LINE_Y);
    ctx.strokeStyle = 'rgba(232,220,192,0.5)';
    ctx.setLineDash([12, 10]);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, FIELD.LINE_Y);
    ctx.lineTo(FIELD.W, FIELD.LINE_Y);
    ctx.stroke();
    ctx.setLineDash([]);
    if (!battle) return;
    // 阵位与追击圈
    for (const h of battle.world.heroes()) {
        ctx.strokeStyle = 'rgba(232,220,192,0.12)';
        ctx.setLineDash([4, 6]);
        ctx.beginPath();
        ctx.arc(h.anchorX, h.anchorY, Math.min(h.leash, 600), 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
    }
}

function drawZones(): void {
    for (const z of battle!.world.zones) {
        if (z.dead) continue;
        const a = 0.22 * Math.min(1, (z.dur - z.t) / 0.5);
        ctx.fillStyle = hex(z.color, a);
        ctx.strokeStyle = hex(z.color, a * 2);
        if (z.line) {
            ctx.lineWidth = z.r * 2;
            ctx.lineCap = 'round';
            ctx.strokeStyle = hex(z.color, a);
            ctx.beginPath(); ctx.moveTo(z.x, z.y); ctx.lineTo(z.x2, z.y2); ctx.stroke();
            ctx.lineCap = 'butt';
        } else {
            ctx.lineWidth = 2;
            ctx.beginPath(); ctx.arc(z.x, z.y, z.r, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        }
    }
}

function bar(x: number, y: number, w: number, pct: number, color: string, h = 4): void {
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(x - w / 2, y, w, h);
    ctx.fillStyle = color;
    ctx.fillRect(x - w / 2, y, w * Math.max(0, Math.min(1, pct)), h);
}

function drawUnit(u: Unit, time: number): void {
    const w = battle!.world;
    if (u.dead && u.kind !== 'hero') return;
    if (u.kind === 'altar') {
        ctx.fillStyle = '#6a5a48';
        ctx.beginPath(); ctx.arc(u.x, u.y, u.r, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = '#f2c84b'; ctx.lineWidth = 3; ctx.stroke();
        ctx.fillStyle = '#f2c84b'; ctx.font = 'bold 20px sans-serif'; ctx.textAlign = 'center';
        ctx.fillText('坛', u.x, u.y + 7);
        bar(u.x, u.y + u.r + 8, 120, u.hp / u.maxHp, '#f2c84b', 6);
        return;
    }
    if (u.kind === 'hero' && u.dead) {
        ctx.fillStyle = 'rgba(255,255,255,0.5)';
        ctx.font = '14px sans-serif'; ctx.textAlign = 'center';
        ctx.fillText(`${u.name} ${u.reviveT.toFixed(1)}s`, u.vars.deathX ?? u.x, (u.vars.deathY ?? u.y));
        return;
    }
    const hero = u.kind === 'hero';
    const def = hero ? HEROES[u.defId] : undefined;
    const edef = u.side === 'enemy' ? ENEMY_DEFS[u.defId] : undefined;
    const base = def?.color ?? edef?.color ?? (u.side === 'hero' ? 0xc8b890 : 0x888888);
    let alpha = u.st.untargetable > 0 && !u.buddha ? 0.35 : 1;
    let yOff = 0;
    if (hero && u.dao === 'egui') { alpha = 0.6; yOff = -6 + Math.sin(time * 4 + u.id) * 3; }
    const y = u.y + yOff;

    if (hero && u.dao === 'diyu') {
        ctx.strokeStyle = hex(0x8a3cc8, 0.35 + 0.15 * Math.sin(time * 6));
        ctx.lineWidth = 3;
        ctx.beginPath(); ctx.arc(u.x, u.y, DIYU_AURA_R, 0, Math.PI * 2); ctx.stroke();
    }
    if (hero && u.dao === 'xiuluo') {
        const tr = trails.get(u.id) ?? [];
        tr.push({ x: u.x, y: u.y });
        if (tr.length > 8) tr.shift();
        trails.set(u.id, tr);
        tr.forEach((p, i) => { ctx.fillStyle = hex(0xd8382c, (i / tr.length) * 0.3); ctx.beginPath(); ctx.arc(p.x, p.y, u.r * 0.9, 0, Math.PI * 2); ctx.fill(); });
    }
    if (u.buddha) {
        ctx.fillStyle = hex(0xf2c84b, 0.25);
        ctx.beginPath(); ctx.arc(u.x, y, u.r + 18, 0, Math.PI * 2); ctx.fill();
    }

    ctx.globalAlpha = alpha;
    const fl = flash.get(u.id) ?? 0;
    ctx.fillStyle = fl > 0 ? '#ffffff' : hex(base);
    ctx.beginPath(); ctx.arc(u.x, y, u.r, 0, Math.PI * 2); ctx.fill();
    ctx.lineWidth = hero ? 3 : u.kind === 'boss' ? 4 : 2;
    ctx.strokeStyle = hero ? hex(DAO_DEFS[u.dao].color) : u.kind === 'boss' ? '#ff5040' : u.kind === 'elite' ? '#ffb040' : '#1a1410';
    ctx.stroke();
    // 朝向
    ctx.fillStyle = '#1a1410';
    ctx.beginPath(); ctx.arc(u.x + u.facing * u.r * 0.45, y - u.r * 0.2, Math.max(2, u.r * 0.14), 0, Math.PI * 2); ctx.fill();
    if (hero || u.kind === 'boss' || u.kind === 'elite') {
        ctx.fillStyle = '#fff';
        ctx.font = `bold ${hero ? 14 : 13}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.fillText(u.name.slice(0, hero ? 2 : 4), u.x, y - u.r - 14);
    }
    ctx.globalAlpha = 1;

    if (hero && u.dao === 'tian' && !u.buddha) {
        ctx.strokeStyle = '#f2c84b'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.ellipse(u.x, y - u.r - 6, u.r * 0.7, 4, 0, 0, Math.PI * 2); ctx.stroke();
    }
    if (u.st.stun > 0) { ctx.fillStyle = '#ffe060'; ctx.font = '14px sans-serif'; ctx.fillText('✦✦', u.x, y - u.r - (hero ? 28 : 4)); }
    if (u.st.root > 0) { ctx.strokeStyle = '#e8e0f0'; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(u.x, y, u.r + 4, 0, Math.PI * 2); ctx.stroke(); }
    if ((u.vars.markUntil ?? 0) > w.time) { ctx.fillStyle = '#c070ff'; ctx.font = 'bold 13px sans-serif'; ctx.fillText('勾', u.x + u.r, y - u.r); }

    if (u.kind === 'summon') { bar(u.x, y + u.r + 2, 20, u.hp / u.maxHp, '#9ad070', 2); return; }
    const bw = hero ? 44 : u.kind === 'boss' ? 90 : u.kind === 'elite' ? 50 : 26;
    bar(u.x, y + u.r + 3, bw, u.hp / u.maxHp, hero ? '#5fd35f' : '#e04040', hero || u.kind === 'boss' ? 5 : 3);
    if (u.shield > 0) bar(u.x, y + u.r + 3, bw, u.shield / u.maxHp, 'rgba(220,235,255,0.9)', 2);
    if (hero) {
        bar(u.x, y + u.r + 9, bw, u.mana / u.manaMax, '#4a9ae8', 3);
        const stones = battle!.world.heroStates.get(u.id)?.stones.length ?? 0;
        if (stones) { ctx.fillStyle = '#c8c0b0'; ctx.font = '12px sans-serif'; ctx.fillText(`石×${stones}`, u.x, y + u.r + 26); }
        if ((u.vars.hair ?? 0) >= 3) { ctx.fillStyle = '#f2c84b'; ctx.font = '12px sans-serif'; ctx.fillText(`毛${u.vars.hair}`, u.x, y + u.r + 26); }
    }
}

const PROJ_COLORS: Record<string, string> = { arrow: '#e8d8b0', chain: '#9090a0', bolt: '#a0c0ff', soul: '#7fe0ff', soul2: '#b0f0ff' };

function drawProjectiles(): void {
    for (const p of battle!.world.projectiles) {
        if (p.dead) continue;
        let y = p.y;
        if (p.kind === 'lob') y -= Math.sin(Math.min(1, p.t / p.dur) * Math.PI) * 60;
        ctx.fillStyle = PROJ_COLORS[p.visual] ?? hex(p.color);
        const r = p.visual === 'ring' ? 8 : p.visual.includes('stone') || p.visual === 'meteor' ? 7 : p.visual === 'soul' || p.visual === 'soul2' ? 5 : 4;
        if (p.visual === 'ring') {
            ctx.strokeStyle = '#f2c84b'; ctx.lineWidth = 3;
            ctx.beginPath(); ctx.arc(p.x, y, r, 0, Math.PI * 2); ctx.stroke();
        } else {
            ctx.beginPath(); ctx.arc(p.x, y, r, 0, Math.PI * 2); ctx.fill();
        }
    }
}

function drawFx(dt: number): void {
    const w = battle!.world;
    for (let i = fxs.length - 1; i >= 0; i--) {
        const f = fxs[i];
        f.t += dt;
        if (f.t >= f.dur) { fxs.splice(i, 1); continue; }
        const k = f.t / f.dur;
        const a = 1 - k;
        let x = f.x, y = f.y;
        if (f.unit) { const u = w.get(f.unit); if (u && !u.dead) { x = u.x; y = u.y; } }
        if (f.name === 'warn' || f.name === 'warnline') {
            ctx.strokeStyle = hex(f.color, 0.8); ctx.fillStyle = hex(f.color, 0.15 + 0.15 * k); ctx.lineWidth = 2;
            if (f.name === 'warn') { ctx.beginPath(); ctx.arc(x, y, f.r, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); }
            else { ctx.lineWidth = f.r * 2; ctx.strokeStyle = hex(f.color, 0.18 + 0.2 * k); ctx.beginPath(); ctx.moveTo(f.x, f.y); ctx.lineTo(f.x2!, f.y2!); ctx.stroke(); }
            continue;
        }
        if (f.x2 !== undefined && f.y2 !== undefined && !f.name.startsWith('zone')) {
            ctx.strokeStyle = hex(f.color, a); ctx.lineWidth = Math.max(3, (f.r ?? 10) * (f.name === 'staff' || f.name === 'swordsweep' || f.name === 'eyebeam' ? 1.2 : 0.2));
            ctx.beginPath(); ctx.moveTo(f.x, f.y); ctx.lineTo(f.x2, f.y2); ctx.stroke();
            continue;
        }
        if (f.name.startsWith('zone')) continue;
        if (f.name === 'soulrise') {
            ctx.fillStyle = hex(0xffffff, a * 0.6);
            ctx.beginPath(); ctx.arc(x, y - k * 60, 10, 0, Math.PI * 2); ctx.fill();
            continue;
        }
        if (f.name === 'lotus' || f.name === 'web' || f.name === 'soulmark' || f.name === 'burrow' || f.name === 'chant' || f.name === 'horse' || f.name === 'bigseal') {
            ctx.strokeStyle = hex(f.color, 0.6); ctx.lineWidth = 2;
            ctx.beginPath(); ctx.arc(x, y, f.r || 20, 0, Math.PI * 2); ctx.stroke();
            continue;
        }
        ctx.strokeStyle = hex(f.color, a); ctx.fillStyle = hex(f.color, a * 0.25); ctx.lineWidth = 3;
        ctx.beginPath(); ctx.arc(x, y, f.r * (0.4 + 0.6 * k), 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    }
}

function drawFloaters(dt: number): void {
    ctx.textAlign = 'center';
    for (let i = floaters.length - 1; i >= 0; i--) {
        const f = floaters[i];
        f.t += dt;
        if (f.t >= f.dur) { floaters.splice(i, 1); continue; }
        f.y += f.vy * dt;
        const pop = f.t < 0.1 ? 1 + (0.1 - f.t) * 4 : 1;
        ctx.globalAlpha = Math.min(1, (f.dur - f.t) / 0.3);
        ctx.font = `bold ${Math.round(f.size * pop)}px sans-serif`;
        ctx.lineWidth = 3; ctx.strokeStyle = '#1a1410';
        ctx.strokeText(f.text, f.x, f.y);
        ctx.fillStyle = f.color;
        ctx.fillText(f.text, f.x, f.y);
    }
    ctx.globalAlpha = 1;
    if (banner) {
        banner.t -= dt;
        if (banner.t <= 0) banner = null;
        else {
            ctx.font = 'bold 44px sans-serif'; ctx.textAlign = 'center';
            ctx.lineWidth = 5; ctx.strokeStyle = '#1a1410';
            ctx.strokeText(banner.text, FIELD.W / 2, 420);
            ctx.fillStyle = banner.color; ctx.fillText(banner.text, FIELD.W / 2, 420);
        }
    }
}

function render(dt: number): void {
    drawField();
    if (!battle) return;
    const w = battle.world;
    for (const [id, t] of flash) { if (t - dt <= 0) flash.delete(id); else flash.set(id, t - dt); }
    drawZones();
    const sorted = w.units.slice().sort((a, b) => a.y - b.y);
    for (const u of sorted) drawUnit(u, w.time);
    drawProjectiles();
    drawFx(dt);
    drawFloaters(dt);
    ctx.fillStyle = '#e8dcc0'; ctx.font = '16px sans-serif'; ctx.textAlign = 'left';
    ctx.fillText(`${w.time.toFixed(1)}s  敌 ${w.enemies().length}`, 12, FIELD.H - 14);
}

// ---------- 面板 ----------

function renderRunInfo(): void {
    const el = $('runinfo');
    if (!run) { el.textContent = '单场试玩'; return; }
    const st = run.current;
    const b = st ? run.bossOf[st.chapter] : null;
    el.innerHTML = st
        ? `第${st.chapter}章 第${st.station}站 · ${{ normal: '战斗', elite: '精英', boss: '首领', rest: '休整' }[st.type]}　法坛 ${run.altarHp}/${run.altarMax}<br>本章首领：${b!.boss.map(id => ENEMY_DEFS[id].name).join('·')}（${b!.affixes.map(a => AFFIXES[a]).join('、')}）`
        : run.altarHp > 0 ? '通关！' : `失败：法坛被毁（第${run.stations[run.index]?.chapter}章）`;
}

function renderHeroes(): void {
    const el = $('heroes');
    if (!battle) { el.innerHTML = ''; return; }
    const rows = battle.world.heroes().map(h => {
        const st = battle!.world.heroStates.get(h.id)!;
        const opts = DAOS.map(d => `<option value="${d}" ${d === h.dao ? 'selected' : ''}>${DAO_DEFS[d].name}</option>`).join('');
        return `<div class="hero"><b style="color:${hex(HEROES[h.defId].color)}">${h.name}</b> ${st.shiShu}世${h.buddha ? '·佛' : ''}
            <select data-id="${h.id}">${opts}</select>
            <button data-cast="${h.id}">放神通</button></div>`;
    });
    el.innerHTML = rows.join('');
    el.querySelectorAll('select').forEach(s => s.addEventListener('change', () => {
        const u = battle!.world.get(Number(s.dataset.id))!;
        u.dao = s.value as Dao;
        battle!.world.heroStates.get(u.id)!.dao = u.dao;
        battle!.world.applyHeroStats(u);
    }));
    el.querySelectorAll('button[data-cast]').forEach(b => b.addEventListener('click', () => {
        const u = battle!.world.get(Number((b as HTMLElement).dataset.cast))!;
        if (!u.dead) battle!.world.cast(u);
    }));
}

function renderReport(): void {
    const el = $('report');
    if (!lastResult) { el.innerHTML = ''; return; }
    const s = lastResult.stats;
    const total = Object.values(s.dmg).reduce((a, b) => a + b, 0) || 1;
    const rows = TEAM.map(id => `<tr><td>${HEROES[id].name}</td><td>${Math.round(s.dmg[id] ?? 0)}（${Math.round((100 * (s.dmg[id] ?? 0)) / total)}%）</td><td>${s.kills[id] ?? 0}</td><td>${s.casts[id] ?? 0}</td><td>${Math.round(s.heal[id] ?? 0)}</td><td>${s.deaths[id] ?? 0}</td></tr>`).join('');
    el.innerHTML = `<b>${lastResult.win ? '胜利' : '失败'}</b> ${lastResult.time.toFixed(1)} 秒，最长连锁 ${s.maxChain}
        <table><tr><th></th><th>伤害</th><th>击杀</th><th>神通</th><th>治疗</th><th>阵亡</th></tr>${rows}</table>`;
}

function startRun(): void {
    run = new Run(Number(($('seed') as HTMLInputElement).value) || Date.now() % 100000, TEAM);
    lastResult = null;
    nextBattle();
}

function nextBattle(): void {
    if (run) {
        while (!run.over && run.current?.type === 'rest') run.next();
        if (run.over) { battle = null; renderRunInfo(); return; }
        renderRunInfo();
        battle = run.next();
    }
    floaters.length = 0; fxs.length = 0; trails.clear();
    renderHeroes();
    renderReport();
}

function startSingle(): void {
    run = null;
    const chapter = Number(($('chapter') as HTMLSelectElement).value);
    const type = ($('type') as HTMLSelectElement).value as StationType;
    const bossSel = ($('boss') as HTMLSelectElement).value;
    const affix = ($('affix') as HTMLSelectElement).value;
    const team = TEAM.map(newHeroState);
    battle = new Battle({
        seed: Number(($('seed') as HTMLInputElement).value) || 1, chapter, station: Number(($('station') as HTMLInputElement).value) || 1,
        type, boss: type === 'boss' ? bossSel.split(',') : undefined, affixes: affix ? [affix] : [], altarHp: 1000, altarMaxHp: 1000,
    }, team);
    lastResult = null;
    floaters.length = 0; fxs.length = 0; trails.clear();
    renderRunInfo();
    renderHeroes();
    renderReport();
}

function fillBossSelect(): void {
    const ch = Number(($('chapter') as HTMLSelectElement).value);
    ($('boss') as HTMLSelectElement).innerHTML = CHAPTER_BOSSES[ch].map(ids => `<option value="${ids.join(',')}">${ids.map(id => ENEMY_DEFS[id].name).join('·')}</option>`).join('');
}

($('affix') as HTMLSelectElement).innerHTML = '<option value="">无词缀</option>' + Object.entries(AFFIXES).map(([k, v]) => `<option value="${k}">${v}</option>`).join('');
$('chapter').addEventListener('change', fillBossSelect);
fillBossSelect();
$('newrun').addEventListener('click', startRun);
$('single').addEventListener('click', startSingle);
$('next').addEventListener('click', () => { if (run && battle?.world.over) nextBattle(); });
$('pause').addEventListener('click', () => { paused = !paused; $('pause').textContent = paused ? '继续' : '暂停'; });
document.querySelectorAll('button[data-speed]').forEach(b => b.addEventListener('click', () => { speed = Number((b as HTMLElement).dataset.speed); }));

let heroPanelT = 0;
function frame(now: number): void {
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    if (battle && !paused && !battle.world.over) {
        acc += dt * speed;
        while (acc >= TICK) {
            acc -= TICK;
            battle.step();
            handle(battle.world.drainEvents());
            if (battle.world.over) { acc = 0; break; }
        }
    }
    render(paused ? 0 : dt * Math.min(speed, 2));
    heroPanelT -= dt;
    if (heroPanelT <= 0 && battle) {
        heroPanelT = 0.5;
        // 只刷新世数，不打断下拉框
        battle.world.heroes().forEach(h => {
            const sel = document.querySelector(`select[data-id="${h.id}"]`) as HTMLSelectElement | null;
            if (sel && document.activeElement !== sel) sel.value = h.dao;
            const b = sel?.previousSibling as Text | null;
            if (b) b.textContent = ` ${h.shiShu}世${h.buddha ? '·佛' : ''} `;
        });
    }
    requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
startRun();
