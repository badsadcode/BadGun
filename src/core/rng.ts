/**
 * Deterministic random numbers.
 *
 * Every generator decision draws from a *named stream* derived from the
 * recipe seed. A stream's sequence depends only on (seed, stream name), so
 * changing one component's parameters never reshuffles another component.
 * Example: tweaking the stock does not change the barrel length.
 */

/** FNV-1a 32-bit hash of a string. Stable across platforms. */
export function hashString(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Small, fast, well-distributed PRNG (mulberry32). */
export class Rng {
  private state: number;

  constructor(seed: number) {
    this.state = seed >>> 0;
  }

  /** Create an independent stream for a named purpose. */
  static stream(seed: number | string, name: string): Rng {
    return new Rng(hashString(`${seed}::${name}`));
  }

  /** Uniform float in [0, 1). */
  next(): number {
    let t = (this.state = (this.state + 0x6d2b79f5) >>> 0);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /** Uniform float in [min, max). */
  range(min: number, max: number): number {
    return min + (max - min) * this.next();
  }

  /** Uniform integer in [min, max] (inclusive). */
  int(min: number, max: number): number {
    return Math.floor(this.range(min, max + 1));
  }

  /** True with probability p. */
  chance(p: number): boolean {
    return this.next() < p;
  }

  /** Pick one item uniformly. */
  pick<T>(items: readonly T[]): T {
    return items[Math.floor(this.next() * items.length)];
  }

  /** Pick a key from a { key: weight } table. */
  weighted<K extends string>(table: Partial<Record<K, number>>): K {
    const entries = Object.entries(table) as [K, number][];
    const total = entries.reduce((sum, [, w]) => sum + Math.max(0, w), 0);
    let roll = this.next() * total;
    for (const [key, w] of entries) {
      roll -= Math.max(0, w);
      if (roll < 0) return key;
    }
    return entries[entries.length - 1][0];
  }
}
