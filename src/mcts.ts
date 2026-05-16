import { COLORS, SCORE_MAP, PENALTY_PTS, rollAll } from "./constants";
import { clone, doMark, score, isGameOver, canMark, wOpts, cOpts, lastIdx, countX } from "./game";
import type {
  ActiveMove,
  Dice,
  GameState,
  LiveStats,
  MctsResult,
  Move,
  RolloutResult,
} from "./types";

interface Stat {
  v: number;
  t: number;
  w: number;
  d: number;
}

function enumActive(s: GameState, d: Dice): ActiveMove[] {
  const ws = d.w1 + d.w2;
  const wO = wOpts(s, ws);
  const combos: ActiveMove[] = [];
  for (const wm of wO) {
    const aw = doMark(s, wm.color, wm.idx);
    const co = cOpts(aw, d);
    if (!co.length) combos.push({ w: wm, c: null });
    else for (const cm of co) combos.push({ w: wm, c: cm });
  }
  for (const cm of cOpts(s, d)) combos.push({ w: null, c: cm });
  combos.push({ w: null, c: null });
  const seen = new Set<string>();
  return combos.filter((m) => {
    const k = `${m.w?.color}:${m.w?.idx},${m.c?.color}:${m.c?.idx}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

function applyActive(s: GameState, m: ActiveMove): GameState {
  let n = s;
  if (m.w) n = doMark(n, m.w.color, m.w.idx);
  if (m.c && canMark(n, m.c.color, m.c.idx)) n = doMark(n, m.c.color, m.c.idx);
  if (!m.w && !m.c) n = { ...n, penalties: n.penalties + 1 };
  return n;
}

export function applyPassive(s: GameState, m: Move | null): GameState {
  return m ? doMark(s, m.color, m.idx) : clone(s);
}

function maxPot(s: GameState): number {
  let t = 0;
  COLORS.forEach((c) => {
    if (s.locked[c]) {
      t += SCORE_MAP[countX(s.marked[c]) + (s.marked[c][10] ? 1 : 0)] || 0;
      return;
    }
    const m = countX(s.marked[c]);
    const l = lastIdx(s.marked[c]);
    const remaining = l === -1 ? 11 : 10 - l;
    const best = Math.min(m + remaining, 11);
    const canLock = best >= 5;
    t += SCORE_MAP[canLock ? best + 1 : best] || 0;
  });
  return t + s.penalties * PENALTY_PTS;
}

function randActive(s: GameState, d: Dice): ActiveMove {
  const m = enumActive(s, d);
  if (m.length <= 1) return m[0] || { w: null, c: null };
  const marking = m.filter((x) => x.w || x.c);
  if (!marking.length || Math.random() > 0.85) return m[Math.floor(Math.random() * m.length)];
  const sc = marking.map((mv) => {
    const af = applyActive(s, mv);
    let r = 0;
    COLORS.forEach((c) => {
      if (af.locked[c]) return;
      const l = lastIdx(af.marked[c]);
      r += l === -1 ? 11 : 10 - l;
    });
    return { mv, r };
  });
  const tot = sc.reduce((acc, x) => acc + x.r + 1, 0);
  let rr = Math.random() * tot;
  for (const { mv, r } of sc) {
    rr -= r + 1;
    if (rr <= 0) return mv;
  }
  return sc[sc.length - 1].mv;
}

function randPassive(s: GameState, ws: number): Move | null {
  const m = wOpts(s, ws);
  if (!m.length) return null;
  if (Math.random() > 0.55) return null;
  if (m.length === 1) return m[0];
  const sc = m.map((mv) => {
    const af = doMark(s, mv.color, mv.idx);
    let r = 0;
    COLORS.forEach((c) => {
      if (af.locked[c]) return;
      const l = lastIdx(af.marked[c]);
      r += l === -1 ? 11 : 10 - l;
    });
    return { mv, r };
  });
  sc.sort((a, b) => b.r - a.r);
  return Math.random() < 0.7 ? sc[0].mv : sc[Math.floor(Math.random() * sc.length)].mv;
}

// firstActiveIdx: 0 = AI ("me"), 1..N = opponents[firstActiveIdx - 1]
function rollout(
  ai: GameState,
  opponents: readonly GameState[],
  firstActiveIdx: number,
  maxT = 18
): RolloutResult {
  let me = clone(ai);
  const opps = opponents.map(clone);
  const totalPlayers = 1 + opps.length;
  let activeIdx = firstActiveIdx % totalPlayers;

  const allStates = (): GameState[] => [me, ...opps];

  for (let t = 0; t < maxT && !isGameOver(allStates()); t++) {
    const d = rollAll();
    const ws = d.w1 + d.w2;

    if (activeIdx === 0) {
      me = applyActive(me, randActive(me, d));
      for (let i = 0; i < opps.length; i++) {
        if (isGameOver(allStates())) break;
        opps[i] = applyPassive(opps[i], randPassive(opps[i], ws));
      }
    } else {
      const oppIdx = activeIdx - 1;
      opps[oppIdx] = applyActive(opps[oppIdx], randActive(opps[oppIdx], d));
      if (!isGameOver(allStates())) {
        me = applyPassive(me, randPassive(me, ws));
      }
      for (let i = 0; i < opps.length; i++) {
        if (i === oppIdx) continue;
        if (isGameOver(allStates())) break;
        opps[i] = applyPassive(opps[i], randPassive(opps[i], ws));
      }
    }
    activeIdx = (activeIdx + 1) % totalPlayers;
  }
  return { ai: score(me), opponents: opps.map(score) };
}

function ucbSel(stats: Stat[], ceil: number[], n: number, C = 1.41): number {
  const deltas = stats.map((s, j) => (s.v ? Math.max(0, ceil[j] - s.t / s.v) : ceil[j]));
  const nf = 50;
  let best = 0;
  let bu = -Infinity;
  for (let j = 0; j < stats.length; j++) {
    if (!stats[j].v) {
      const p = ceil[j] + 1000;
      if (p > bu || bu === -Infinity) {
        bu = p;
        best = j;
      }
      continue;
    }
    const avg = stats[j].t / stats[j].v;
    const us = Math.pow(1 + deltas[j] / nf, 1.5);
    const u = avg + C * Math.sqrt(Math.log(n + 1) / stats[j].v) * us;
    if (u > bu) {
      bu = u;
      best = j;
    }
  }
  return best;
}

function bestI(stats: Stat[]): number {
  let b = 0;
  let ba = -Infinity;
  for (let j = 0; j < stats.length; j++) {
    if (!stats[j].v) continue;
    const a = stats[j].t / stats[j].v;
    if (a > ba) {
      ba = a;
      b = j;
    }
  }
  return b;
}

export const liveStats: LiveStats = { wins: 0, losses: 0, draws: 0, total: 0 };

export function resetLive(): void {
  liveStats.wins = 0;
  liveStats.losses = 0;
  liveStats.draws = 0;
  liveStats.total = 0;
}

// Win = AI strictly beats every opponent.
// Draw = AI ties for top (>= every opponent, == at least one).
// Loss = some opponent beats AI.
function classifyOutcome(myScore: number, oppScores: number[]): "win" | "draw" | "loss" {
  let maxOpp = -Infinity;
  for (const s of oppScores) if (s > maxOpp) maxOpp = s;
  if (myScore > maxOpp) return "win";
  if (myScore === maxOpp) return "draw";
  return "loss";
}

const BATCH = 200;

function mctsAsync(
  moves: (Move | null)[],
  ceil: number[],
  applyFn: (m: Move | null) => GameState,
  opponents: readonly GameState[],
  firstActiveIdx: number,
  iters: number,
  C: number
): Promise<MctsResult> {
  resetLive();
  return new Promise<MctsResult>((resolve) => {
    if (moves.length <= 1) {
      const move = moves[0] ?? null;
      const after = applyFn(move);
      for (let i = 0; i < Math.min(iters, 200); i++) {
        const r = rollout(after, opponents, firstActiveIdx);
        liveStats.total++;
        const outcome = classifyOutcome(r.ai, r.opponents);
        if (outcome === "win") liveStats.wins++;
        else if (outcome === "draw") liveStats.draws++;
        else liveStats.losses++;
      }
      resolve({
        move,
        wins: liveStats.wins,
        losses: liveStats.losses,
        draws: liveStats.draws,
        total: liveStats.total,
      });
      return;
    }
    const stats: Stat[] = moves.map(() => ({ v: 0, t: 0, w: 0, d: 0 }));
    let done = 0;
    function step() {
      const end = Math.min(done + BATCH, iters);
      for (let i = done; i < end; i++) {
        const j = ucbSel(stats, ceil, i, C);
        const after = applyFn(moves[j]);
        const r = rollout(after, opponents, firstActiveIdx);
        stats[j].t += r.ai;
        stats[j].v++;
        const outcome = classifyOutcome(r.ai, r.opponents);
        if (outcome === "win") stats[j].w++;
        else if (outcome === "draw") stats[j].d++;
      }
      done = end;
      const bi = bestI(stats);
      const s = stats[bi];
      liveStats.wins = s.w;
      liveStats.draws = s.d;
      liveStats.losses = s.v - s.w - s.d;
      liveStats.total = s.v;
      if (done >= iters) {
        resolve({
          move: moves[bi],
          wins: s.w,
          losses: s.v - s.w - s.d,
          draws: s.d,
          total: s.v,
        });
      } else {
        setTimeout(step, 0);
      }
    }
    step();
  });
}

export function mctsPassive(
  ai: GameState,
  opponents: readonly GameState[],
  ws: number,
  iters: number,
  C: number
): Promise<MctsResult> {
  const moves: (Move | null)[] = [null, ...wOpts(ai, ws)];
  return mctsAsync(
    moves,
    moves.map((m) => maxPot(applyPassive(ai, m))),
    (m) => applyPassive(ai, m),
    opponents,
    0,
    iters,
    C
  );
}

export function mctsWhite(
  ai: GameState,
  opponents: readonly GameState[],
  ws: number,
  iters: number,
  C: number
): Promise<MctsResult> {
  return mctsPassive(ai, opponents, ws, iters, C);
}

export function mctsColor(
  ai: GameState,
  opponents: readonly GameState[],
  dice: Dice,
  iters: number,
  C: number,
  didWhite = true
): Promise<MctsResult> {
  const co = cOpts(ai, dice);
  const moves: (Move | null)[] = [null, ...co];
  const skipState: GameState = didWhite ? ai : { ...ai, penalties: ai.penalties + 1 };
  return mctsAsync(
    moves,
    moves.map((m) => (m ? maxPot(doMark(ai, m.color, m.idx)) : maxPot(skipState))),
    (m) => (m ? doMark(ai, m.color, m.idx) : skipState),
    opponents,
    1,
    iters,
    C
  );
}
