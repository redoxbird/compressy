// Pure-Deno image header parser — reads width/height from file headers
// without spawning any subprocess (no console window flash, fast).
// Supports JPEG, PNG, WebP, AVIF (HEIF/ISOBMFF).

const MAX_HEADER = 64 * 1024; // enough for AVIF meta boxes

function be16(b: Uint8Array, o: number): number {
  return (b[o] << 8) | b[o + 1];
}
function be32(b: Uint8Array, o: number): number {
  return ((b[o] << 24) >>> 0) | (b[o + 1] << 16) | (b[o + 2] << 8) | b[o + 3];
}

function parseJpeg(b: Uint8Array): { w: number; h: number } | null {
  // SOI
  if (b[0] !== 0xff || b[1] !== 0xd8) return null;
  let o = 2;
  while (o + 4 <= b.length) {
    if (b[o] !== 0xff) { o++; continue; }
    const marker = b[o + 1];
    if (marker === 0xd8 || (marker >= 0xd0 && marker <= 0xd7) || marker === 0x01) {
      o += 2;
      continue;
    }
    const len = be16(b, o + 2);
    if (len < 2) return null;
    // SOF markers carry dims
    if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
      if (o + 9 > b.length) return null;
      return { h: be16(b, o + 5), w: be16(b, o + 7) };
    }
    o += 2 + len;
  }
  return null;
}

function parsePng(b: Uint8Array): { w: number; h: number } | null {
  if (b.length < 24) return null;
  if (b[0] !== 0x89 || b[1] !== 0x50 || b[2] !== 0x4e || b[3] !== 0x47) return null;
  if (be32(b, 12) !== 0x49484452) return null; // IHDR
  return { w: be32(b, 16), h: be32(b, 20) };
}

function parseWebp(b: Uint8Array): { w: number; h: number } | null {
  if (b.length < 30) return null;
  if (b[0] !== 0x52 || b[1] !== 0x49 || b[2] !== 0x46 || b[3] !== 0x46) return null; // RIFF
  if (b[8] !== 0x57 || b[9] !== 0x45 || b[10] !== 0x42 || b[11] !== 0x50) return null; // WEBP
  const four = String.fromCharCode(b[12], b[13], b[14], b[15]);
  if (four === "VP8 ") {
    if (b.length < 26) return null;
    return { w: be16(b, 26) & 0x3fff, h: be16(b, 28) & 0x3fff };
  }
  if (four === "VP8L") {
    if (b.length < 25) return null;
    const bits = b[21] | (b[22] << 8) | (b[23] << 16) | (b[24] << 24);
    return { w: (bits & 0x3fff) + 1, h: ((bits >> 14) & 0x3fff) + 1 };
  }
  if (four === "VP8X") {
    if (b.length < 30) return null;
    return { w: 1 + (b[24] | (b[25] << 8) | (b[26] << 16)), h: 1 + (b[27] | (b[28] << 8) | (b[29] << 16)) };
  }
  return null;
}

function parseAvif(b: Uint8Array): { w: number; h: number } | null {
  // ISOBMFF walk. `meta` is a fullbox: 4 bytes version/flags precede children.
  // `ispe` (image spatial extents) is a fullbox: version/flags(4) width(4) height(4).
  let o = 0;
  while (o + 8 <= b.length) {
    const size = be32(b, o);
    const type = String.fromCharCode(b[o + 4], b[o + 5], b[o + 6], b[o + 7]);
    if (size === 1) {
      if (o + 16 > b.length) break;
      const size64 = (be32(b, o + 8) * 0x100000000) + be32(b, o + 12);
      if (size64 < 16) break;
      o += size64;
      continue;
    }
    if (size < 8) break;
    const boxEnd = Math.min(o + size, b.length);
    if (type === "ispe") {
      // fullbox: 4 bytes version/flags, then width/height at o+12/o+16
      if (o + 20 <= b.length) {
        const w = be32(b, o + 12);
        const h = be32(b, o + 16);
        if (w > 0 && h > 0) return { w, h };
      }
      return null;
    }
    if (["meta", "moov", "trak", "mdia", "minf", "stbl", "stsd", "iprp", "ipco", "moof", "traf"].includes(type)) {
      // Container: `meta` is a fullbox (4 bytes version/flags before children);
      // the others are plain boxes (children at o+8).
      const childStart = type === "meta" ? o + 12 : o + 8;
      if (childStart + 8 <= boxEnd) {
        const inner = b.subarray(childStart, boxEnd);
        const r = parseAvif(inner);
        if (r) return r;
      }
    }
    o += size;
  }
  return null;
}

export function imageDimsFromHeader(path: string): { w: number; h: number } | null {
  let f: Deno.FsFile;
  try {
    f = Deno.openSync(path, { read: true });
  } catch {
    return null;
  }
  try {
    const buf = new Uint8Array(MAX_HEADER);
    const n = f.readSync(buf);
    if (n === null) return null;
    const b = buf.subarray(0, n);
    // Detect by magic
    if (b[0] === 0xff && b[1] === 0xd8) return parseJpeg(b);
    if (b[0] === 0x89 && b[1] === 0x50) return parsePng(b);
    if (b[0] === 0x52 && b[1] === 0x49) return parseWebp(b);
    // AVIF/HEIF: ftyp box at start
    if (b.length >= 12 && String.fromCharCode(b[4], b[5], b[6], b[7]) === "ftyp") {
      const brand = String.fromCharCode(b[8], b[9], b[10], b[11]);
      if (brand.startsWith("avif") || brand.startsWith("avis") || brand.startsWith("heic") || brand.startsWith("heix")) {
        return parseAvif(b);
      }
    }
    return null;
  } finally {
    f.close();
  }
}
