// 观察器本地服务：bun tools/serve.ts，每次请求都重新打包，改了模拟层刷新页面即可
import { join } from 'node:path';

const root = join(import.meta.dir, 'viewer');
const port = Number(process.env.PORT ?? 5178);

Bun.serve({
    port,
    async fetch(req) {
        const path = new URL(req.url).pathname;
        if (path === '/viewer.js') {
            const out = await Bun.build({ entrypoints: [join(root, 'main.ts')], target: 'browser' });
            if (!out.success) return new Response(out.logs.map(String).join('\n'), { status: 500 });
            return new Response(await out.outputs[0].text(), { headers: { 'content-type': 'text/javascript; charset=utf-8' } });
        }
        return new Response(Bun.file(join(root, 'index.html')), { headers: { 'content-type': 'text/html; charset=utf-8' } });
    },
});
console.log(`观察器：http://localhost:${port}`);
