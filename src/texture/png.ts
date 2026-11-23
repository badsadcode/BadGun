/**
 * Minimal, dependency-free PNG encoder (RGBA8), usable in Node and browsers.
 *
 * Compression is a small DEFLATE implementation: LZ77 with hash chains and
 * the fixed Huffman code. Atlas textures are large flat-colored areas, which
 * this compresses very well (a 1024² ID map is typically a few tens of KB).
 */

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(data: Uint8Array, start = 0, end = data.length): number {
  let c = 0xffffffff;
  for (let i = start; i < end; i++) c = CRC_TABLE[(c ^ data[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function adler32(data: Uint8Array): number {
  let a = 1, b = 0;
  for (let i = 0; i < data.length; ) {
    const end = Math.min(i + 5552, data.length);
    for (; i < end; i++) {
      a += data[i];
      b += a;
    }
    a %= 65521;
    b %= 65521;
  }
  return ((b << 16) | a) >>> 0;
}

class BitWriter {
  buf: Uint8Array;
  pos = 0;
  bit = 0;
  cur = 0;
  constructor(capacity: number) {
    this.buf = new Uint8Array(Math.max(1024, capacity));
  }
  /** Write `n` bits of `v`, least significant first (DEFLATE bit order). */
  bits(v: number, n: number): void {
    for (let i = 0; i < n; i++) {
      this.cur |= ((v >>> i) & 1) << this.bit;
      if (++this.bit === 8) this.flushByte();
    }
  }
  /** Write a Huffman code (most significant bit first). */
  code(c: number, n: number): void {
    for (let i = n - 1; i >= 0; i--) {
      this.cur |= ((c >>> i) & 1) << this.bit;
      if (++this.bit === 8) this.flushByte();
    }
  }
  private flushByte(): void {
    if (this.pos >= this.buf.length) {
      const b = new Uint8Array(this.buf.length * 2);
      b.set(this.buf);
      this.buf = b;
    }
    this.buf[this.pos++] = this.cur;
    this.cur = 0;
    this.bit = 0;
  }
  finish(): Uint8Array {
    if (this.bit) this.flushByte();
    return this.buf.subarray(0, this.pos);
  }
}

const LEN_BASE = [3, 4, 5, 6, 7, 8, 9, 10, 11, 13, 15, 17, 19, 23, 27, 31, 35, 43, 51, 59, 67, 83, 99, 115, 131, 163, 195, 227, 258];
const LEN_EXTRA = [0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 2, 2, 2, 2, 3, 3, 3, 3, 4, 4, 4, 4, 5, 5, 5, 5, 0];
const DIST_BASE = [1, 2, 3, 4, 5, 7, 9, 13, 17, 25, 33, 49, 65, 97, 129, 193, 257, 385, 513, 769, 1025, 1537, 2049, 3073, 4097, 6145, 8193, 12289, 16385, 24577];
const DIST_EXTRA = [0, 0, 0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7, 8, 8, 9, 9, 10, 10, 11, 11, 12, 12, 13, 13];

function writeLiteral(w: BitWriter, sym: number): void {
  if (sym < 144) w.code(0x30 + sym, 8);
  else if (sym < 256) w.code(0x190 + sym - 144, 9);
  else if (sym < 280) w.code(sym - 256, 7);
  else w.code(0xc0 + sym - 280, 8);
}

function lastIndexLE(table: number[], v: number): number {
  let i = table.length - 1;
  while (table[i] > v) i--;
  return i;
}

/** Raw DEFLATE stream (one final block, fixed Huffman codes). */
export function deflateRaw(data: Uint8Array): Uint8Array {
  const w = new BitWriter(data.length / 4);
  w.bits(1, 1); // BFINAL
  w.bits(1, 2); // BTYPE = fixed Huffman
  const HASH = 1 << 15, WINDOW = 32768, MAX_CHAIN = 24;
  const head = new Int32Array(HASH).fill(-1);
  const prev = new Int32Array(WINDOW);
  const hash = (i: number) => ((data[i] << 10) ^ (data[i + 1] << 5) ^ data[i + 2]) & (HASH - 1);
  const insert = (i: number) => {
    const h = hash(i);
    prev[i & (WINDOW - 1)] = head[h];
    head[h] = i;
  };
  const n = data.length;
  let i = 0;
  while (i < n) {
    let bestLen = 0, bestDist = 0;
    if (i + 2 < n) {
      let cand = head[hash(i)];
      let chain = MAX_CHAIN;
      const maxLen = Math.min(258, n - i);
      while (cand >= 0 && i - cand <= WINDOW && chain-- > 0) {
        if (data[cand + bestLen] === data[i + bestLen]) {
          let l = 0;
          while (l < maxLen && data[cand + l] === data[i + l]) l++;
          if (l > bestLen) {
            bestLen = l;
            bestDist = i - cand;
            if (l === maxLen) break;
          }
        }
        const next = prev[cand & (WINDOW - 1)];
        if (next >= cand) break;
        cand = next;
      }
    }
    if (bestLen >= 3) {
      const li = lastIndexLE(LEN_BASE, bestLen);
      writeLiteral(w, 257 + li);
      if (LEN_EXTRA[li]) w.bits(bestLen - LEN_BASE[li], LEN_EXTRA[li]);
      const di = lastIndexLE(DIST_BASE, bestDist);
      w.code(di, 5);
      if (DIST_EXTRA[di]) w.bits(bestDist - DIST_BASE[di], DIST_EXTRA[di]);
      const end = i + bestLen;
      for (; i < end; i++) if (i + 2 < n) insert(i);
    } else {
      writeLiteral(w, data[i]);
      if (i + 2 < n) insert(i);
      i++;
    }
  }
  writeLiteral(w, 256);
  return w.finish();
}

/** zlib wrapper around deflateRaw (what PNG's IDAT expects). */
export function zlibDeflate(data: Uint8Array): Uint8Array {
  const raw = deflateRaw(data);
  const out = new Uint8Array(raw.length + 6);
  out[0] = 0x78;
  out[1] = 0x01;
  out.set(raw, 2);
  const a = adler32(data);
  out[raw.length + 2] = a >>> 24;
  out[raw.length + 3] = (a >>> 16) & 0xff;
  out[raw.length + 4] = (a >>> 8) & 0xff;
  out[raw.length + 5] = a & 0xff;
  return out;
}

/** Encode RGBA8 pixels (row-major, top row first) as a PNG file. */
export function encodePNG(rgba: Uint8Array, width: number, height: number): Uint8Array {
  // Every row uses the "Sub" filter: flat color runs become runs of zeros.
  const stride = width * 4;
  const filtered = new Uint8Array((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    const o = y * (stride + 1), r = y * stride;
    filtered[o] = 1;
    for (let x = 0; x < stride; x++) filtered[o + 1 + x] = (rgba[r + x] - (x >= 4 ? rgba[r + x - 4] : 0)) & 0xff;
  }
  const idat = zlibDeflate(filtered);
  const ihdr = new Uint8Array(13);
  const dv = new DataView(ihdr.buffer);
  dv.setUint32(0, width);
  dv.setUint32(4, height);
  ihdr.set([8, 6, 0, 0, 0], 8);
  const chunks = [chunk('IHDR', ihdr), chunk('IDAT', idat), chunk('IEND', new Uint8Array(0))];
  const sig = [137, 80, 78, 71, 13, 10, 26, 10];
  const out = new Uint8Array(8 + chunks.reduce((s, c) => s + c.length, 0));
  out.set(sig);
  let o = 8;
  for (const c of chunks) {
    out.set(c, o);
    o += c.length;
  }
  return out;
}

function chunk(type: string, data: Uint8Array): Uint8Array {
  const out = new Uint8Array(12 + data.length);
  const dv = new DataView(out.buffer);
  dv.setUint32(0, data.length);
  for (let i = 0; i < 4; i++) out[4 + i] = type.charCodeAt(i);
  out.set(data, 8);
  dv.setUint32(8 + data.length, crc32(out, 4, 8 + data.length));
  return out;
}
