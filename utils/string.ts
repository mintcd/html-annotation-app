export function escapeAttrValue(value: string): string {
  const esc = (globalThis as unknown as { CSS?: { escape?: (s: string) => string } }).CSS?.escape;
  return esc ? esc(value) : value.replace(/["\\]/g, "\\$&");
}

export function buildKMPTable(pattern: string): number[] {
  const m = pattern.length;
  const lps = new Array<number>(m).fill(0);
  for (let i = 1, len = 0; i < m;) {
    if (pattern[i] === pattern[len]) {
      lps[i++] = ++len;
    } else if (len) {
      len = lps[len - 1];
    } else {
      lps[i++] = 0;
    }
  }
  return lps;
}