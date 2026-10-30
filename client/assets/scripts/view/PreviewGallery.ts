// 动作预览：把一个角色的各个动作按实际游戏尺寸并排循环播放，供试看和反馈。
// 出手动作使用核心定义的前摇/收势时长，与战斗中的节奏一致。
import { Color, Label, Layers, Node, Sprite, UITransform } from 'cc';
import type { ActTiming } from '../battle/defs';
import { AnimPlayer } from './HeroArt';
import type { ArtFrame, HeroArt } from './HeroArt';

const CLIPS: [string, string][] = [['idle', '待机'], ['move', '移动'], ['attack', '普攻'], ['cast', '技能'], ['hit', '受击'], ['die', '阵亡']];
const GAP = 0.6;
const tmp = new Color();

interface Cell { sprite: Sprite; overlay: Sprite; anim: AnimPlayer; name: string; wait: number }

function show(s: Sprite, f: ArtFrame): void {
    if (s.spriteFrame !== f.sf) s.spriteFrame = f.sf;
    const t = s.node.getComponent(UITransform)!;
    t.setContentSize(f.w, f.h);
    t.setAnchorPoint(f.ax, f.ay);
}

export class PreviewGallery {
    readonly root: Node;
    private readonly cells: Cell[] = [];

    constructor(parent: Node, private readonly art: HeroArt, private readonly timing: ActTiming | undefined, title: string, top: number) {
        this.root = new Node('PreviewGallery');
        this.root.layer = Layers.Enum.UI_2D;
        parent.addChild(this.root);
        this.label(title, 0, top, 26, new Color(255, 230, 190, 255));
        CLIPS.forEach(([name, cn], i) => {
            const col = i % 3, row = Math.floor(i / 3);
            const x = (col - 1) * 230, ground = top - 190 - row * 210;
            const n = new Node(name);
            n.layer = Layers.Enum.UI_2D;
            this.root.addChild(n);
            n.addComponent(UITransform);
            const s = n.addComponent(Sprite);
            s.sizeMode = Sprite.SizeMode.CUSTOM;
            s.trim = false;
            n.setPosition(x, ground);
            const on = new Node('Blend');
            on.layer = Layers.Enum.UI_2D;
            n.addChild(on);
            on.addComponent(UITransform);
            const overlay = on.addComponent(Sprite);
            overlay.sizeMode = Sprite.SizeMode.CUSTOM;
            overlay.trim = false;
            this.label(cn, x, ground - 22, 20, new Color(220, 210, 190, 255));
            const cell = { sprite: s, overlay, anim: new AnimPlayer(), name, wait: 0 };
            this.restart(cell);
            this.cells.push(cell);
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
            if (c.anim.done) {
                c.wait += dt;
                if (c.wait >= GAP) this.restart(c);
            } else {
                c.anim.advance(dt);
            }
            show(c.sprite, c.anim.frame()!);
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
