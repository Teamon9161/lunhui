// 角色逐帧动画资源：一张图集 + anims.json（由 art/tools/prepare_frames.py 生成）。
// 一个角色的动作帧和专属特效帧放在同一张图集里，保证同一角色的绘制能合批。
import { JsonAsset, Rect, Size, SpriteFrame, Texture2D, Vec2, resources } from 'cc';

export interface ArtFrame {
    sf: SpriteFrame;
    w: number;   // 设计尺寸
    h: number;
    ax: number;  // 锚点在帧内的比例（0..1），y 从下往上
    ay: number;
}

export interface ArtClip {
    frames: ArtFrame[];
    loop: boolean;
    hold: boolean;
    durations: number[];
    // 循环动作的帧间淡入时长（秒），用来柔化逐帧重绘的细节差异；0 为硬切
    blend: number;
    // 出手类动作：第 release 帧离手；pre/post 为前摇段和收势段各帧的时长占比
    release?: number;
    pre?: number[];
    post?: number[];
    // 出手点：离手帧里手的位置（设计像素，x 沿朝向，y 向上，相对脚底）
    muzzle?: [number, number];
}

interface AnimsJson {
    pixelsPerUnit: number;
    frames: Record<string, { x: number; y: number; w: number; h: number; ax: number; ay: number }>;
    anims: Record<string, { frames: string[]; loop?: boolean; hold?: boolean; durations?: number[]; blend?: number; release?: number; pre?: number[]; post?: number[]; muzzle?: [number, number] }>;
}

export class HeroArt {
    readonly clips = new Map<string, ArtClip>();

    constructor(tex: Texture2D, data: AnimsJson) {
        const ppu = data.pixelsPerUnit;
        const frames = new Map<string, ArtFrame>();
        for (const [name, f] of Object.entries(data.frames)) {
            const sf = new SpriteFrame();
            sf.reset({ texture: tex, rect: new Rect(f.x, f.y, f.w, f.h), originalSize: new Size(f.w, f.h), offset: new Vec2(0, 0), isRotate: false });
            sf.packable = false;
            frames.set(name, { sf, w: f.w / ppu, h: f.h / ppu, ax: f.ax / f.w, ay: 1 - f.ay / f.h });
        }
        for (const [name, a] of Object.entries(data.anims)) {
            const list = a.frames.map(n => frames.get(n)!);
            this.clips.set(name, {
                frames: list,
                loop: !!a.loop,
                hold: !!a.hold,
                durations: a.durations ?? list.map(() => 0.1),
                blend: a.blend ?? 0,
                release: a.release,
                pre: a.pre,
                post: a.post,
                muzzle: a.muzzle,
            });
        }
    }

    clip(name: string): ArtClip | undefined {
        return this.clips.get(name);
    }

    static load(dir: string): Promise<HeroArt> {
        const tex = new Promise<Texture2D>((ok, fail) => resources.load(`${dir}/atlas/texture`, Texture2D, (e, t) => (e ? fail(e) : ok(t))));
        const json = new Promise<JsonAsset>((ok, fail) => resources.load(`${dir}/anims`, JsonAsset, (e, j) => (e ? fail(e) : ok(j))));
        return Promise.all([tex, json]).then(([t, j]) => new HeroArt(t, j.json as AnimsJson));
    }
}

// 播放器：按模拟时间推进。出手动作按核心给出的前摇/收势时长分配各帧，保证离手帧落在结算时刻。
export class AnimPlayer {
    clip: ArtClip | null = null;
    name = '';
    // next() 的结果，复用以免每帧分配
    readonly upcoming = { frame: null as ArtFrame | null, k: 0 };
    t = 0;
    private durs: number[] = [];
    private total = 0;

    play(name: string, clip: ArtClip, windup = 0, recover = 0): void {
        this.clip = clip;
        this.name = name;
        this.t = 0;
        const n = clip.frames.length;
        if (clip.release !== undefined && clip.pre && clip.post && windup > 0) {
            this.durs = [];
            for (let i = 0; i < clip.release; i++) this.durs.push(windup * clip.pre[i]);
            for (let i = clip.release; i < n; i++) this.durs.push(recover * clip.post[i - clip.release]);
        } else {
            this.durs = clip.durations.slice(0, n);
        }
        this.total = 0;
        for (const d of this.durs) this.total += d;
    }

    // 切换到循环动作；已在播同名动作时不重置
    loop(name: string, clip: ArtClip): void {
        if (this.name !== name) this.play(name, clip);
    }

    get done(): boolean {
        return !!this.clip && !this.clip.loop && this.t >= this.total;
    }

    advance(dt: number): void {
        this.t += dt;
    }

    // 循环动作在当前帧末尾淡入下一帧：返回 upcoming（frame 为空表示此刻不需要叠加）
    next(): { frame: ArtFrame | null; k: number } {
        const up = this.upcoming;
        up.frame = null;
        up.k = 0;
        const c = this.clip;
        if (!c || !c.loop || c.blend <= 0 || this.total <= 0) return up;
        const t = this.t % this.total;
        let acc = 0;
        for (let i = 0; i < this.durs.length; i++) {
            acc += this.durs[i];
            if (t >= acc) continue;
            const left = acc - t;
            if (left < c.blend) {
                const nf = c.frames[(i + 1) % c.frames.length];
                if (nf !== c.frames[i]) {
                    const k = 1 - left / c.blend;
                    up.frame = nf;
                    up.k = k * k * (3 - 2 * k);
                }
            }
            break;
        }
        return up;
    }

    frame(): ArtFrame | null {
        const c = this.clip;
        if (!c) return null;
        let t = this.t;
        if (c.loop && this.total > 0) t %= this.total;
        let acc = 0;
        for (let i = 0; i < this.durs.length; i++) {
            acc += this.durs[i];
            if (t < acc) return c.frames[i];
        }
        return c.frames[c.frames.length - 1];
    }
}
