import { COLORS, ROWS, SCORE_MAP, PENALTY_PTS } from "./constants";

export const clone = (s) => ({
  marked: Object.fromEntries(COLORS.map((c) => [c, [...s.marked[c]]])),
  locked: { ...s.locked },
  penalties: s.penalties,
});
export const blank = () => ({
  marked: Object.fromEntries(COLORS.map((c) => [c, Array(11).fill(false)])),
  locked: Object.fromEntries(COLORS.map((c) => [c, false])),
  penalties: 0,
});
export function lastIdx(a) {
  for (let i = 10; i >= 0; i--) if (a[i]) return i;
  return -1;
}
export function countX(a) {
  return a.filter(Boolean).length;
}
export function canMark(s, c, i) {
  if (s.locked[c] || s.marked[c][i]) return false;
  if (i <= lastIdx(s.marked[c])) return false;
  if (i === 10 && countX(s.marked[c]) < 5) return false;
  return true;
}
export function doMark(s, c, i) {
  const n = clone(s);
  n.marked[c][i] = true;
  if (i === 10) n.locked[c] = true;
  return n;
}
export function score(s) {
  let t = 0;
  COLORS.forEach((c) => {
    let n = countX(s.marked[c]);
    if (s.locked[c]) n++;
    t += SCORE_MAP[n] || 0;
  });
  return t + s.penalties * PENALTY_PTS;
}
export function isOver2(a, b) {
  if (a.penalties >= 4 || b.penalties >= 4) return true;
  return COLORS.filter((c) => a.locked[c] || b.locked[c]).length >= 2;
}
export function wOpts(s, ws) {
  const o = [];
  COLORS.forEach((c) => {
    ROWS.find((r) => r.color === c).numbers.forEach((n, i) => {
      if (n === ws && canMark(s, c, i)) o.push({ color: c, idx: i });
    });
  });
  return o;
}
export function cOpts(s, d) {
  const o = [];
  COLORS.forEach((c) => {
    const su = [d.w1 + d[c], d.w2 + d[c]];
    ROWS.find((r) => r.color === c).numbers.forEach((n, i) => {
      if (su.includes(n) && canMark(s, c, i)) o.push({ color: c, idx: i });
    });
  });
  return o;
}
export function syncLocks(src, dst) {
  let ch = false;
  COLORS.forEach((c) => {
    if (src.locked[c] && !dst.locked[c]) ch = true;
  });
  if (!ch) return dst;
  const d = clone(dst);
  COLORS.forEach((c) => {
    if (src.locked[c]) d.locked[c] = true;
  });
  return d;
}
