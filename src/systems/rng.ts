/** 시드 고정 난수 (mulberry32). 테스트·시뮬레이션·일일 도전에서 재현 가능하게 주입한다. */
export interface Rng {
  next(): number;
}

export function createRng(seed: number): Rng {
  let s = seed >>> 0;
  return {
    next(): number {
      s = (s + 0x6d2b79f5) >>> 0;
      let t = s;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    },
  };
}

export function randInt(rng: Rng, maxExclusive: number): number {
  return Math.floor(rng.next() * maxExclusive);
}

export function pickOne<T>(rng: Rng, items: readonly T[]): T {
  if (items.length === 0) throw new Error('pickOne: 빈 배열');
  return items[randInt(rng, items.length)];
}

export function shuffled<T>(rng: Rng, items: readonly T[]): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = randInt(rng, i + 1);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** 가중치 무작위. 가중치 합이 0이면 undefined */
export function weightedPick<T>(rng: Rng, entries: readonly (readonly [T, number])[]): T | undefined {
  const total = entries.reduce((s, [, w]) => s + Math.max(0, w), 0);
  if (total <= 0) return undefined;
  let r = rng.next() * total;
  for (const [item, w] of entries) {
    r -= Math.max(0, w);
    if (r < 0) return item;
  }
  return entries[entries.length - 1][0];
}
