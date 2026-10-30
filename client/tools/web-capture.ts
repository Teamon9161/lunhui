// 用本机 Edge/Chrome 无头模式打开 Cocos 网页包，等待后截图并读出 __lunhuiPerf。
// 用法：bun tools/web-capture.ts <url> <输出png> [等待秒数]
// 仅用于开发期 PC 侧检查；结果不代表手机性能。
import { spawn } from 'node:child_process';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const [url, out, waitArg] = process.argv.slice(2);
if (!url || !out) throw new Error('用法：bun tools/web-capture.ts <url> <输出png> [等待秒数]');
const waitS = Number(waitArg ?? 15);
const browser = process.env.BROWSER ?? 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const port = 9333;
const proc = spawn(browser, [
    '--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${mkdtempSync(join(tmpdir(), 'lunhui-cap-'))}`,
    '--window-size=540,1170', '--no-first-run', '--disable-background-timer-throttling', '--disable-renderer-backgrounding',
    'about:blank',
], { stdio: 'ignore' });

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));
let target: { webSocketDebuggerUrl: string } | undefined;
for (let i = 0; i < 50 && !target; i++) {
    await sleep(200);
    try {
        const list = await (await fetch(`http://127.0.0.1:${port}/json`)).json() as { type: string; webSocketDebuggerUrl: string }[];
        target = list.find(t => t.type === 'page');
    } catch { /* 浏览器尚未就绪 */ }
}
if (!target) throw new Error('无法连接浏览器调试端口');

const ws = new WebSocket(target.webSocketDebuggerUrl);
await new Promise(r => ws.addEventListener('open', r, { once: true }));
let seq = 0;
const pending = new Map<number, (v: unknown) => void>();
ws.addEventListener('message', ev => {
    const msg = JSON.parse(String(ev.data));
    if (msg.id && pending.has(msg.id)) { pending.get(msg.id)!(msg.result ?? msg.error); pending.delete(msg.id); }
    if (msg.method === 'Runtime.exceptionThrown') console.log('页面异常：', msg.params.exceptionDetails?.exception?.description ?? msg.params.exceptionDetails?.text);
    if (msg.method === 'Runtime.consoleAPICalled' && msg.params.type === 'error') console.log('console.error：', msg.params.args.map((a: { value?: unknown; description?: string }) => a.value ?? a.description).join(' '));
});
const send = (method: string, params: object = {}) => new Promise<any>(r => { const id = ++seq; pending.set(id, r); ws.send(JSON.stringify({ id, method, params })); });

await send('Runtime.enable');
await send('Page.enable');
await send('Page.navigate', { url });
await sleep(waitS * 1000);
if (process.env.EVAL) {
    const r = await send('Runtime.evaluate', { expression: process.env.EVAL, awaitPromise: true, returnByValue: true });
    console.log('EVAL：', JSON.stringify(r?.result?.value ?? r?.exceptionDetails ?? r));
}
const perf = await send('Runtime.evaluate', { expression: 'JSON.stringify(globalThis.__lunhuiPerf ?? null)', returnByValue: true });
console.log(perf?.result?.value ?? perf);
const shot = await send('Page.captureScreenshot', { format: 'png' });
writeFileSync(out, Buffer.from(shot.data, 'base64'));
console.log('截图：' + out);
// SHOTS=n：再连续截 n 张（间隔 SHOT_MS 毫秒），存到 <输出>-seq/，用于拼动图
const shots = Number(process.env.SHOTS ?? 0);
if (shots > 0) {
    const dir = out.replace(/\.png$/, '') + '-seq';
    mkdirSync(dir, { recursive: true });
    const gap = Number(process.env.SHOT_MS ?? 50);
    for (let i = 0; i < shots; i++) {
        const t = Date.now();
        const s = await send('Page.captureScreenshot', { format: 'png' });
        writeFileSync(join(dir, `${String(i).padStart(3, '0')}.png`), Buffer.from(s.data, 'base64'));
        await sleep(Math.max(0, gap - (Date.now() - t)));
    }
    console.log(`序列：${dir}（${shots} 张）`);
}
ws.close();
proc.kill();
process.exit(0);
