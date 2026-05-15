import { COLORS, SCORE_MAP, PENALTY_PTS, rollAll } from "./constants";
import { clone, doMark, score, isOver2, canMark, wOpts, cOpts, lastIdx, countX } from "./game";

function enumActive(s, d) {
  const ws = d.w1 + d.w2,
    wO = wOpts(s, ws),
    combos = [];
  for (const wm of wO) {
    const aw = doMark(s, wm.color, wm.idx),
      co = cOpts(aw, d);
    if (!co.length) combos.push({ w: wm, c: null });
    else for (const cm of co) combos.push({ w: wm, c: cm });
  }
  for (const cm of cOpts(s, d)) combos.push({ w: null, c: cm });
  combos.push({ w: null, c: null });
  const seen = new Set();
  return combos.filter((m) => {
    const k = `${m.w?.color}:${m.w?.idx},${m.c?.color}:${m.c?.idx}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}
function applyActive(s, m) {
  let n = clone(s);
  if (m.w) n = doMark(n, m.w.color, m.w.idx);
  if (m.c && canMark(n, m.c.color, m.c.idx)) n = doMark(n, m.c.color, m.c.idx);
  if (!m.w && !m.c) n.penalties++;
  return n;
}
export function applyPassive(s, m) {
  return m ? doMark(s, m.color, m.idx) : clone(s);
}
function maxPot(s) {
  let t = 0;
  COLORS.forEach((c) => {
    if (s.locked[c]) {
      t += SCORE_MAP[countX(s.marked[c]) + 1] || 0;
      return;
    }
    const m = countX(s.marked[c]),
      l = lastIdx(s.marked[c]),
      remaining = l === -1 ? 11 : 10 - l,
      best = Math.min(m + remaining, 11),
      canLock = best >= 5;
    t += SCORE_MAP[canLock ? best + 1 : best] || 0;
  });
  return t + s.penalties * PENALTY_PTS;
}

function randActive(s, d) {
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
  const tot = sc.reduce((s, x) => s + x.r + 1, 0);
  let rr = Math.random() * tot;
  for (const { mv, r } of sc) {
    rr -= r + 1;
    if (rr <= 0) return mv;
  }
  return sc[sc.length - 1].mv;
}
function randPassive(s, ws) {
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

function rollout(ai, opp, aiActive, maxT = 18) {
  let a = clone(ai),
    o = clone(opp),
    who = aiActive;
  for (let t = 0; t < maxT && !isOver2(a, o); t++) {
    const d = rollAll(),
      ws = d.w1 + d.w2;
    if (who) {
      a = applyActive(a, randActive(a, d));
      if (!isOver2(a, o)) o = applyPassive(o, randPassive(o, ws));
    } else {
      o = applyActive(o, randActive(o, d));
      if (!isOver2(a, o)) a = applyPassive(a, randPassive(a, ws));
    }
    who = !who;
  }
  return { ai: score(a), opp: score(o) };
}

function ucbSel(stats, ceil, n, C = 1.41) {
  const deltas = stats.map((s, j) => (s.v ? Math.max(0, ceil[j] - s.t / s.v) : ceil[j]));
  const nf = 50;
  let best = 0,
    bu = -Infinity;
  for (let j = 0; j < stats.length; j++) {
    if (!stats[j].v) {
      const p = ceil[j] + 1000;
      if (p > bu || bu === -Infinity) {
        bu = p;
        best = j;
      }
      continue;
    }
    const avg = stats[j].t / stats[j].v,
      us = Math.pow(1 + deltas[j] / nf, 1.5);
    const u = avg + C * Math.sqrt(Math.log(n + 1) / stats[j].v) * us;
    if (u > bu) {
      bu = u;
      best = j;
    }
  }
  return best;
}
function bestI(stats) {
  let b = 0,
    ba = -Infinity;
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

export const liveStats = { wins: 0, losses: 0, draws: 0, total: 0 };
export function resetLive() {
  liveStats.wins = 0;
  liveStats.losses = 0;
  liveStats.draws = 0;
  liveStats.total = 0;
}
const BATCH = 200;

function mctsAsync(moves, ceil, applyFn, oppSt, aiActive, iters, C) {
  resetLive();
  return new Promise((resolve) => {
    if (moves.length <= 1) {
      const move = moves[0] || null,
        after = applyFn(move);
      for (let i = 0; i < Math.min(iters, 200); i++) {
        const r = rollout(after, oppSt, aiActive);
        liveStats.total++;
        if (r.ai > r.opp) liveStats.wins++;
        else if (r.ai === r.opp) liveStats.draws++;
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
    const stats = moves.map(() => ({ v: 0, t: 0, w: 0, d: 0 }));
    let done = 0;
    function step() {
      const end = Math.min(done + BATCH, iters);
      for (let i = done; i < end; i++) {
        const j = ucbSel(stats, ceil, i, C),
          after = applyFn(moves[j]),
          r = rollout(after, oppSt, aiActive);
        stats[j].t += r.ai;
        stats[j].v++;
        if (r.ai > r.opp) stats[j].w++;
        else if (r.ai === r.opp) stats[j].d++;
      }
      done = end;
      const bi = bestI(stats),
        s = stats[bi];
      liveStats.wins = s.w;
      liveStats.draws = s.d;
      liveStats.losses = s.v - s.w - s.d;
      liveStats.total = s.v;
      if (done >= iters)
        resolve({ move: moves[bi], wins: s.w, losses: s.v - s.w - s.d, draws: s.d, total: s.v });
      else setTimeout(step, 0);
    }
    step();
  });
}
export function mctsPassive(ai, opp, ws, iters, C) {
  const moves = [null, ...wOpts(ai, ws)];
  return mctsAsync(
    moves,
    moves.map((m) => maxPot(applyPassive(ai, m))),
    (m) => applyPassive(ai, m),
    opp,
    true,
    iters,
    C
  );
}
export function mctsWhite(ai, opp, ws, iters, C) {
  return mctsPassive(ai, opp, ws, iters, C);
}
export function mctsColor(ai, opp, dice, iters, C, didWhite = true) {
  const co = cOpts(ai, dice),
    moves = [null, ...co];
  return mctsAsync(
    moves,
    moves.map((m) => {
      if (m) return maxPot(doMark(ai, m.color, m.idx));
      const n = clone(ai);
      if (!didWhite) n.penalties++;
      return maxPot(n);
    }),
    (m) => {
      if (m) return doMark(ai, m.color, m.idx);
      const n = clone(ai);
      if (!didWhite) n.penalties++;
      return n;
    },
    opp,
    false,
    iters,
    C
  );
}
