// 帧耗时记录：整帧间隔、逻辑耗时、表现层耗时、长帧、渲染批次、内存。
// 结果同时写到 globalThis.__lunhuiPerf，方便在浏览器或设备调试时读出原始数据。
import { director } from 'cc';

const WINDOW = 600;
const LONG_FRAME_MS = 33.4;

export const now: () => number = typeof performance !== 'undefined' && performance.now
    ? () => performance.now()
    : () => Date.now();

export interface PerfReport {
    mode: string;
    seconds: number;
    fps: number;
    frameAvg: number;
    frameP95: number;
    frameP99: number;
    frameMax: number;
    longFrames: number;
    logicAvg: number;
    logicMax: number;
    viewAvg: number;
    drawCalls: number;
    units: number;
    bullets: number;
    heapMB: number;
    speed: number;
}

export class PerfMonitor {
    private readonly frames = new Float64Array(WINDOW);
    private readonly logic = new Float64Array(WINDOW);
    private readonly view = new Float64Array(WINDOW);
    private readonly scratch = new Float64Array(WINDOW);
    private idx = 0;
    private count = 0;
    private last = 0;
    private longFrames = 0;
    private startT = 0;
    mode = '';

    reset(mode: string): void {
        this.idx = 0;
        this.count = 0;
        this.last = 0;
        this.longFrames = 0;
        this.startT = now();
        this.mode = mode;
    }

    // 每帧调用一次，传入本帧逻辑与表现耗时（毫秒）
    frame(logicMs: number, viewMs: number): void {
        const t = now();
        if (this.last > 0) {
            const ft = t - this.last;
            this.frames[this.idx] = ft;
            this.logic[this.idx] = logicMs;
            this.view[this.idx] = viewMs;
            this.idx = (this.idx + 1) % WINDOW;
            if (this.count < WINDOW) this.count++;
            if (ft > LONG_FRAME_MS) this.longFrames++;
        }
        this.last = t;
    }

    report(units: number, bullets: number, speed: number): PerfReport {
        const n = this.count;
        const s = this.scratch.subarray(0, n);
        let sum = 0, lsum = 0, lmax = 0, vsum = 0;
        for (let i = 0; i < n; i++) {
            s[i] = this.frames[i];
            sum += this.frames[i];
            lsum += this.logic[i];
            vsum += this.view[i];
            if (this.logic[i] > lmax) lmax = this.logic[i];
        }
        s.sort();
        const pct = (p: number) => (n ? s[Math.min(n - 1, Math.floor(n * p))] : 0);
        const avg = n ? sum / n : 0;
        const mem = (globalThis as { performance?: { memory?: { usedJSHeapSize: number } } }).performance?.memory;
        const device = director.root?.device;
        const r: PerfReport = {
            mode: this.mode,
            seconds: (now() - this.startT) / 1000,
            fps: avg > 0 ? 1000 / avg : 0,
            frameAvg: avg,
            frameP95: pct(0.95),
            frameP99: pct(0.99),
            frameMax: n ? s[n - 1] : 0,
            longFrames: this.longFrames,
            logicAvg: n ? lsum / n : 0,
            logicMax: lmax,
            viewAvg: n ? vsum / n : 0,
            drawCalls: device ? device.numDrawCalls : 0,
            units,
            bullets,
            heapMB: mem ? mem.usedJSHeapSize / 1048576 : 0,
            speed,
        };
        (globalThis as { __lunhuiPerf?: PerfReport }).__lunhuiPerf = r;
        return r;
    }
}

export function formatReport(r: PerfReport): string {
    const f = (v: number, d = 1) => v.toFixed(d);
    return [
        `${r.mode} ×${r.speed}  ${f(r.seconds, 0)}s  FPS ${f(r.fps)}`,
        `帧 均${f(r.frameAvg)} P95 ${f(r.frameP95)} P99 ${f(r.frameP99)} 最大${f(r.frameMax)}ms  长帧${r.longFrames}`,
        `逻辑 均${f(r.logicAvg, 2)} 峰${f(r.logicMax)}ms  表现 均${f(r.viewAvg, 2)}ms`,
        `单位${r.units} 弹丸${r.bullets} 批次${r.drawCalls}${r.heapMB ? `  堆${f(r.heapMB, 0)}MB` : ''}`,
    ].join('\n');
}
