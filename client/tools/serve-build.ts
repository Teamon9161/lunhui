// 正式工程网页包的本地服务：bun tools/serve-build.ts，提供 build/web-mobile。
// 先用 Creator 构建 web-mobile（见 docs/cocos-client.md），这里只做静态文件服务。
import { join, normalize } from 'node:path';

const root = join(import.meta.dir, '..', 'build', 'web-mobile');
const port = Number(process.env.PORT ?? 5180);

Bun.serve({
    port,
    async fetch(req) {
        let path = decodeURIComponent(new URL(req.url).pathname);
        if (path.endsWith('/')) path += 'index.html';
        const file = Bun.file(join(root, normalize(path).replace(/^[/\\]+/, '')));
        if (!(await file.exists())) return new Response('not found', { status: 404 });
        return new Response(file, { headers: { 'cache-control': 'no-store' } });
    },
});
console.log(`Cocos 网页包：http://localhost:${port}`);
