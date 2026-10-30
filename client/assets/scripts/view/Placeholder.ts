// 占位图集：运行时生成一张贴图，所有占位形状共用，保证战场精灵能合批。
// 仅用于接入与压测阶段，正式角色/特效资源到位后替换，不作为正式画面。
import { ImageAsset, Rect, Size, SpriteFrame, Texture2D, Vec2 } from 'cc';

const S = 128;

export interface PlaceholderFrames {
    disc: SpriteFrame;   // 实心圆（单位身体、阴影）
    ring: SpriteFrame;   // 圆环（施法圈、范围、祭坛）
    glow: SpriteFrame;   // 柔光（弹丸、命中）
    white: SpriteFrame;  // 纯白方块（血条、线段）
    bolt: SpriteFrame;   // 横向长弹（直线弹丸）
}

let cached: PlaceholderFrames | null = null;

export function placeholderFrames(): PlaceholderFrames {
    if (cached) return cached;
    const data = new Uint8Array(S * S * 4);
    const put = (x: number, y: number, a: number) => {
        const i = (y * S + x) * 4;
        data[i] = data[i + 1] = data[i + 2] = 255;
        data[i + 3] = Math.max(0, Math.min(255, Math.round(a * 255)));
    };
    // 每块区域内画形状，a 为 0..1 的不透明度
    const region = (ox: number, oy: number, w: number, h: number, f: (u: number, v: number) => number) => {
        for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) put(ox + x, oy + y, f((x + 0.5) / w * 2 - 1, (y + 0.5) / h * 2 - 1));
    };
    const edge = (d: number, r: number, soft: number) => Math.max(0, Math.min(1, (r - d) / soft));
    region(0, 0, 64, 64, (u, v) => edge(Math.hypot(u, v), 0.94, 0.06));
    region(64, 0, 64, 64, (u, v) => { const d = Math.hypot(u, v); return Math.min(edge(d, 0.94, 0.06), edge(-d, -0.8, 0.06)); });
    region(0, 64, 64, 64, (u, v) => { const d = Math.min(1, Math.hypot(u, v)); return (1 - d) * (1 - d); });
    region(64, 64, 8, 8, () => 1);
    region(64, 80, 48, 16, (u, v) => edge(Math.hypot(u, v * 2.2), 0.95, 0.12));

    const img = new ImageAsset({ _data: data, _compressed: false, width: S, height: S, format: Texture2D.PixelFormat.RGBA8888 });
    const tex = new Texture2D();
    tex.image = img;
    tex.setFilters(Texture2D.Filter.LINEAR, Texture2D.Filter.LINEAR);
    const frame = (x: number, y: number, w: number, h: number) => {
        const sf = new SpriteFrame();
        sf.reset({ texture: tex, rect: new Rect(x, y, w, h), originalSize: new Size(w, h), offset: new Vec2(0, 0), isRotate: false });
        sf.packable = false;
        return sf;
    };
    cached = {
        disc: frame(0, 0, 64, 64),
        ring: frame(64, 0, 64, 64),
        glow: frame(0, 64, 64, 64),
        white: frame(66, 66, 4, 4),
        bolt: frame(64, 80, 48, 16),
    };
    return cached;
}
