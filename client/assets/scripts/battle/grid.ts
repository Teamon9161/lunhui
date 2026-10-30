// 空间哈希：单位都是圆，范围查询和挤开都走这里，不用物理引擎。
export interface Circle {
    id: number;
    x: number;
    y: number;
    r: number;
}

export class SpatialHash<T extends Circle> {
    private cells = new Map<number, T[]>();
    private pool: T[][] = [];

    constructor(private readonly cellSize: number) {}

    private key(cx: number, cy: number): number {
        return (cx + 512) * 4096 + (cy + 512);
    }

    clear(): void {
        for (const list of this.cells.values()) {
            list.length = 0;
            this.pool.push(list);
        }
        this.cells.clear();
    }

    insert(item: T): void {
        const cs = this.cellSize;
        const x0 = Math.floor((item.x - item.r) / cs), x1 = Math.floor((item.x + item.r) / cs);
        const y0 = Math.floor((item.y - item.r) / cs), y1 = Math.floor((item.y + item.r) / cs);
        for (let cx = x0; cx <= x1; cx++) {
            for (let cy = y0; cy <= y1; cy++) {
                const k = this.key(cx, cy);
                let list = this.cells.get(k);
                if (!list) {
                    list = this.pool.pop() ?? [];
                    this.cells.set(k, list);
                }
                list.push(item);
            }
        }
    }

    // out 复用以免每帧分配；跨格的单位已去重。
    query(x: number, y: number, radius: number, out: T[]): T[] {
        out.length = 0;
        const cs = this.cellSize;
        const x0 = Math.floor((x - radius) / cs), x1 = Math.floor((x + radius) / cs);
        const y0 = Math.floor((y - radius) / cs), y1 = Math.floor((y + radius) / cs);
        for (let cx = x0; cx <= x1; cx++) {
            for (let cy = y0; cy <= y1; cy++) {
                const list = this.cells.get(this.key(cx, cy));
                if (!list) continue;
                for (const it of list) {
                    const dx = it.x - x, dy = it.y - y, rr = radius + it.r;
                    if (dx * dx + dy * dy <= rr * rr && out.indexOf(it) < 0) out.push(it);
                }
            }
        }
        return out;
    }
}
