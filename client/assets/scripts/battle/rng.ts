// 定种随机：sfc32。战斗里所有随机都必须走这里，保证同种子同结果。
export class Rng {
    private a: number;
    private b: number;
    private c: number;
    private d: number;

    constructor(seed: number) {
        this.a = 0x9e3779b9;
        this.b = 0x243f6a88;
        this.c = 0xb7e15162;
        this.d = seed >>> 0;
        for (let i = 0; i < 12; i++) this.next();
    }

    next(): number {
        let { a, b, c, d } = this;
        const t = (((a + b) | 0) + d) | 0;
        d = (d + 1) | 0;
        a = b ^ (b >>> 9);
        b = (c + (c << 3)) | 0;
        c = (c << 21) | (c >>> 11);
        c = (c + t) | 0;
        this.a = a; this.b = b; this.c = c; this.d = d;
        return (t >>> 0) / 4294967296;
    }

    range(lo: number, hi: number): number {
        return lo + (hi - lo) * this.next();
    }

    int(n: number): number {
        return Math.floor(this.next() * n);
    }

    chance(p: number): boolean {
        return this.next() < p;
    }

    pick<T>(arr: readonly T[]): T {
        return arr[this.int(arr.length)];
    }

    weighted<T>(items: readonly T[], weight: (t: T) => number): T {
        let total = 0;
        for (const it of items) total += weight(it);
        let r = this.next() * total;
        for (const it of items) {
            r -= weight(it);
            if (r < 0) return it;
        }
        return items[items.length - 1];
    }
}
