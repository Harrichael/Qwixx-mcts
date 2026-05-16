import { COLORS, ROW_BY_COLOR, SCORE_MAP, PENALTY_PTS } from "./constants";
import type { Color, Dice, GameState, Move } from "./types";

const mkColorMap = <T>(fn: (c: Color) => T): Record<Color, T> =>
  Object.fromEntries(COLORS.map((c) => [c, fn(c)])) as Record<Color, T>;

export const clone = (s: GameState): GameState => ({
  marked: mkColorMap((c) => [...s.marked[c]]),
  locked: { ...s.locked },
  penalties: s.penalties,
});

export const blank = (): GameState => ({
  marked: mkColorMap(() => Array(11).fill(false)),
  locked: mkColorMap(() => false),
  penalties: 0,
});

export function lastIdx(a: readonly boolean[]): number {
  for (let i = 10; i >= 0; i--) if (a[i]) return i;
  return -1;
}

export function countX(a: readonly boolean[]): number {
  return a.filter(Boolean).length;
}

export function canMark(s: GameState, c: Color, i: number): boolean {
  if (s.locked[c] || s.marked[c][i]) return false;
  if (i <= lastIdx(s.marked[c])) return false;
  if (i === 10 && countX(s.marked[c]) < 5) return false;
  return true;
}

export function doMark(s: GameState, c: Color, i: number): GameState {
  const newRow = [...s.marked[c]];
  newRow[i] = true;
  return {
    marked: { ...s.marked, [c]: newRow },
    locked: i === 10 ? { ...s.locked, [c]: true } : s.locked,
    penalties: s.penalties,
  };
}

export function score(s: GameState): number {
  let t = 0;
  COLORS.forEach((c) => {
    let n = countX(s.marked[c]);
    if (s.marked[c][10]) n++;
    t += SCORE_MAP[n] || 0;
  });
  return t + s.penalties * PENALTY_PTS;
}

export function isOver2(a: GameState, b: GameState): boolean {
  if (a.penalties >= 4 || b.penalties >= 4) return true;
  return COLORS.filter((c) => a.locked[c] || b.locked[c]).length >= 2;
}

export function isGameOver(allPlayerStates: readonly GameState[]): boolean {
  if (allPlayerStates.some((s) => s.penalties >= 4)) return true;
  return COLORS.filter((c) => allPlayerStates.some((s) => s.locked[c])).length >= 2;
}

// Propagate any color locks present in any state to every state.
export function syncLocksAll(allPlayerStates: readonly GameState[]): GameState[] {
  const lockedAny: Record<Color, boolean> = {} as Record<Color, boolean>;
  let anyLock = false;
  COLORS.forEach((c) => {
    const isLocked = allPlayerStates.some((s) => s.locked[c]);
    lockedAny[c] = isLocked;
    if (isLocked) anyLock = true;
  });
  if (!anyLock) return [...allPlayerStates];
  return allPlayerStates.map((s) => {
    let changed = false;
    COLORS.forEach((c) => {
      if (lockedAny[c] && !s.locked[c]) changed = true;
    });
    if (!changed) return s;
    const newLocked = { ...s.locked };
    COLORS.forEach((c) => {
      if (lockedAny[c]) newLocked[c] = true;
    });
    return { ...s, locked: newLocked };
  });
}

export function wOpts(s: GameState, ws: number): Move[] {
  const o: Move[] = [];
  COLORS.forEach((c) => {
    ROW_BY_COLOR[c].numbers.forEach((n, i) => {
      if (n === ws && canMark(s, c, i)) o.push({ color: c, idx: i });
    });
  });
  return o;
}

export function cOpts(s: GameState, d: Dice): Move[] {
  const o: Move[] = [];
  COLORS.forEach((c) => {
    const su = [d.w1 + d[c], d.w2 + d[c]];
    ROW_BY_COLOR[c].numbers.forEach((n, i) => {
      if (su.includes(n) && canMark(s, c, i)) o.push({ color: c, idx: i });
    });
  });
  return o;
}

export function syncLocks(src: GameState, dst: GameState): GameState {
  let ch = false;
  COLORS.forEach((c) => {
    if (src.locked[c] && !dst.locked[c]) ch = true;
  });
  if (!ch) return dst;
  const newLocked = { ...dst.locked };
  COLORS.forEach((c) => {
    if (src.locked[c]) newLocked[c] = true;
  });
  return { ...dst, locked: newLocked };
}
