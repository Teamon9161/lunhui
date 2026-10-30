// 动作审阅：同一批 2~3 个动作按列展示，每一行用不同速率独立循环。
// 预览使用实际游戏尺寸；速率仅影响这一格，不受战斗倍速按钮影响。
import { Color, Label, Layers, Node, Sprite, UITransform } from 'cc';
import type { ActTiming } from '../battle/defs';
import { AnimPlayer } from './HeroArt';
import type { ArtFrame, HeroArt } from './HeroArt';

const FIRST_BATCH: ReadonlyArray<readonly [string, string]> = [
    ['idle', '待机'],
    ['attack', '念珠普攻'],
    ['cast', '诵经施法'],
];
const RATES = [0.25, 0.5, 1];
const GAP = 0.6;
const tmp = new Color();

interface Cell { sprite: Sprite; overlay: Sprite; anim: AnimPlayer; name: string; rate: number; wait: number }

function show(s: Sprite, f: ArtFrame): void {
    if (s.spriteFrame !== f.sf) s.spriteFrame = f.sf;
    const t = s.node.getComponent(UITransform)!;
    t.setContentSize(f.w, f.h);
    t.setAnchorPoint(f.ax, f.ay);
}

export class PreviewGallery {
    readonly root: Node;
    private readonly cells: Cell[] = [];

    constructor(
        parent: Node,
        private readonly art: HeroArt,
        private readonly timing: ActTiming | undefined,
        title: string,
        top: number,
        clips: ReadonlyArray<readonly [string, string]> = FIRST_BATCH,
    ) {
        this.root = new Node('PreviewGallery');
        this.root.layer = Layers.Enum.UI_2D;
        parent.addChild(this.root);
        this.label(title, 0, top, 25, new Color(255, 230, 190, 255));

        // 正在制作中的英雄可以先只有待机，不因其他动作缺失而崩溃。
        const available = clips.filter(([name]) => !!this.art.clip(name)).slice(0, 3);
        available.forEach(([, label], col) => {
            this.label(label, (col - (available.length - 1) / 2) * 218, top - 52, 21, new Color(242, 222, 190, 255));
        });

        RATES.forEach((rate, row) => {
            const ground = top - 202 - row * 232;
            this.label(`${rate}×`, -331, ground + 66, 18, new Color(190, 205, 230, 255));
            available.forEach(([name], col) => {
                const x = (col - (available.length - 1) / 2) * 218;
                const n = new Node(`${name}-${rate}x`);
                n.layer = Layers.Enum.UI_2D;
                this.root.addChild(n);
                n.addComponent(UITransform);
                const sprite = n.addComponent(Sprite);
                sprite.sizeMode = Sprite.SizeMode.CUSTOM;
                sprite.trim = false;
                n.setPosition(x, ground);

                const on = new Node('Blend');
                on.layer = Layers.Enum.UI_2D;
                n.addChild(on);
                on.addComponent(UITransform);
                const overlay = on.addComponent(Sprite);
                overlay.sizeMode = Sprite.SizeMode.CUSTOM;
                overlay.trim = false;

                const cell: Cell = { sprite, overlay, anim: new AnimPlayer(), name, rate, wait: 0 };
                this.restart(cell);
                this.cells.push(cell);
            });
        });
    }

    private label(text: string, x: number, y: number, size: number, color: Color): void {
        const n = new Node('Label');
        n.layer = Layers.Enum.UI_2D;
        this.root.addChild(n);
        n.addComponent(UITransform);
        n.setPosition(x, y);
        const l = n.addComponent(Label);
        l.string = text;
        l.fontSize = size;
        l.lineHeight = size + 4;
        l.cacheMode = Label.CacheMode.CHAR;
        l.color = color;
        l.enableOutline = true;
        l.outlineWidth = 2;
        l.outlineColor = new Color(0, 0, 0, 255);
    }

    private restart(c: Cell): void {
        const clip = this.art.clip(c.name)!;
        const t = c.name === 'attack' ? this.timing?.attack : c.name === 'cast' ? this.timing?.cast : undefined;
        c.anim.play(c.name, clip, t?.[0] ?? 0, t?.[1] ?? 0);
        c.wait = 0;
    }

    update(dt: number): void {
        for (const c of this.cells) {
            const elapsed = Math.min(dt, 0.25) * c.rate;
            if (c.anim.done) {
                c.wait += elapsed;
                if (c.wait >= GAP) this.restart(c);
            } else {
                c.anim.advance(elapsed);
            }
            const frame = c.anim.frame();
            if (!frame) continue;
            show(c.sprite, frame);
            const up = c.anim.next();
            c.overlay.node.active = !!up.frame;
            if (up.frame) {
                show(c.overlay, up.frame);
                c.overlay.color = tmp.set(255, 255, 255, Math.round(255 * up.k));
            }
        }
    }

    set visible(on: boolean) {
        this.root.active = on;
    }
}
