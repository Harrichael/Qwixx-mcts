import { useState, useCallback, useEffect, useRef, memo } from "react";

/* ═══════════════════════════════════════════
   CONSTANTS
   ═══════════════════════════════════════════ */
const ROWS = [
  {
    color: "red",
    numbers: [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
    bg: "#DC2626",
    bgLight: "#FEE2E2",
    text: "#991B1B",
    accent: "#EF4444",
  },
  {
    color: "yellow",
    numbers: [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
    bg: "#EAB308",
    bgLight: "#FEF9C3",
    text: "#854D0E",
    accent: "#FACC15",
  },
  {
    color: "green",
    numbers: [12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2],
    bg: "#16A34A",
    bgLight: "#DCFCE7",
    text: "#166534",
    accent: "#22C55E",
  },
  {
    color: "blue",
    numbers: [12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2],
    bg: "#2563EB",
    bgLight: "#DBEAFE",
    text: "#1E40AF",
    accent: "#3B82F6",
  },
];
const COLORS = ["red", "yellow", "green", "blue"];
const SCORE_MAP = [0, 1, 3, 6, 10, 15, 21, 28, 36, 45, 55, 66, 78];
const PENALTY_PTS = -5;
const rollDie = () => Math.floor(Math.random() * 6) + 1;
const rollAll = () => ({
  w1: rollDie(),
  w2: rollDie(),
  red: rollDie(),
  yellow: rollDie(),
  green: rollDie(),
  blue: rollDie(),
});

/* ═══════════════════════════════════════════
   PURE GAME LOGIC
   ═══════════════════════════════════════════ */
const clone = (s) => ({
  marked: Object.fromEntries(COLORS.map((c) => [c, [...s.marked[c]]])),
  locked: { ...s.locked },
  penalties: s.penalties,
});
const blank = () => ({
  marked: Object.fromEntries(COLORS.map((c) => [c, Array(11).fill(false)])),
  locked: Object.fromEntries(COLORS.map((c) => [c, false])),
  penalties: 0,
});
function lastIdx(a) {
  for (let i = 10; i >= 0; i--) if (a[i]) return i;
  return -1;
}
function countX(a) {
  return a.filter(Boolean).length;
}
function canMark(s, c, i) {
  if (s.locked[c] || s.marked[c][i]) return false;
  if (i <= lastIdx(s.marked[c])) return false;
  if (i === 10 && countX(s.marked[c]) < 5) return false;
  return true;
}
function doMark(s, c, i) {
  const n = clone(s);
  n.marked[c][i] = true;
  if (i === 10) n.locked[c] = true;
  return n;
}
function score(s) {
  let t = 0;
  COLORS.forEach((c) => {
    let n = countX(s.marked[c]);
    if (s.locked[c]) n++;
    t += SCORE_MAP[n] || 0;
  });
  return t + s.penalties * PENALTY_PTS;
}
function isOver2(a, b) {
  if (a.penalties >= 4 || b.penalties >= 4) return true;
  return COLORS.filter((c) => a.locked[c] || b.locked[c]).length >= 2;
}
function wOpts(s, ws) {
  const o = [];
  COLORS.forEach((c) => {
    ROWS.find((r) => r.color === c).numbers.forEach((n, i) => {
      if (n === ws && canMark(s, c, i)) o.push({ color: c, idx: i });
    });
  });
  return o;
}
function cOpts(s, d) {
  const o = [];
  COLORS.forEach((c) => {
    const su = [d.w1 + d[c], d.w2 + d[c]];
    ROWS.find((r) => r.color === c).numbers.forEach((n, i) => {
      if (su.includes(n) && canMark(s, c, i)) o.push({ color: c, idx: i });
    });
  });
  return o;
}
function syncLocks(src, dst) {
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

/* ═══════════════════════════════════════════
   MCTS ENGINE
   ═══════════════════════════════════════════ */
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
function applyPassive(s, m) {
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

const liveStats = { wins: 0, losses: 0, draws: 0, total: 0 };
function resetLive() {
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
function mctsPassive(ai, opp, ws, iters, C) {
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
function mctsWhite(ai, opp, ws, iters, C) {
  return mctsPassive(ai, opp, ws, iters, C);
}
function mctsColor(ai, opp, dice, iters, C, didWhite = true) {
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

/* ═══════════════════════════════════════════
   STABLE DISPLAY COMPONENTS (outside main component, memo'd)
   ═══════════════════════════════════════════ */
const Die = memo(({ value, bg, size = 42, spin, selected, onClick }) => (
  <div
    onClick={onClick}
    style={{
      width: size,
      height: size,
      borderRadius: 9,
      background: bg,
      color: "#fff",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      fontSize: size * 0.46,
      fontWeight: 800,
      fontFamily: "inherit",
      boxShadow: selected
        ? `0 0 16px ${bg}, 0 0 4px #fff`
        : spin
          ? "none"
          : `0 3px 8px ${bg}55, inset 0 1px 0 rgba(255,255,255,0.3)`,
      transform: spin
        ? `rotate(${((value * 37) % 30) - 15}deg)`
        : selected
          ? "scale(1.15)"
          : "none",
      border: selected ? "3px solid #fff" : "2px solid rgba(255,255,255,0.2)",
      cursor: onClick ? "pointer" : "default",
      transition: "transform 0.15s, box-shadow 0.15s",
    }}
  >
    {value}
  </div>
));

const Cell = memo(({ num, idx, marked, opt, preview, hl, bg, bgLight, text, locked, onClick }) => {
  if (locked)
    return (
      <div
        key={idx}
        style={{
          width: 30,
          height: 30,
          borderRadius: 6,
          fontSize: 11,
          fontWeight: 700,
          border: "1px solid rgba(255,255,255,0.05)",
          background: "rgba(255,255,255,0.03)",
          color: "#4b5563",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "inherit",
        }}
      >
        {marked ? "✕" : num}
      </div>
    );
  return (
    <button
      onClick={onClick}
      disabled={!opt}
      style={{
        width: 30,
        height: 30,
        borderRadius: 6,
        fontSize: 11,
        fontWeight: 700,
        border: hl
          ? `2px solid #c4b5fd`
          : opt
            ? `2px solid ${bg}`
            : preview
              ? `1px dashed ${bg}66`
              : marked
                ? `2px solid transparent`
                : "1px solid rgba(255,255,255,0.05)",
        background: hl
          ? "#7c3aed"
          : marked
            ? bg
            : opt
              ? bgLight
              : preview
                ? `${bg}11`
                : "rgba(255,255,255,0.03)",
        color: hl || marked ? "#fff" : opt ? text : preview ? `${bg}99` : "#4b5563",
        cursor: opt ? "pointer" : "default",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "inherit",
        padding: 0,
        boxShadow: hl ? "0 0 12px rgba(139,92,246,0.5)" : opt ? `0 0 8px ${bg}33` : "none",
        animation: opt ? "pulse 1.2s infinite" : "none",
        position: "relative",
      }}
    >
      {marked || hl ? "✕" : num}
    </button>
  );
});

const Slider = memo(({ label, desc, value, min, max, step, onChange }) => (
  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
    <div style={{ minWidth: 100, fontSize: 10 }}>
      <div style={{ color: "#e2e8f0", fontWeight: 600 }}>{label}</div>
      <div style={{ color: "#64748b", fontSize: 9 }}>{desc}</div>
    </div>
    <input
      type="range"
      min={min}
      max={max}
      step={step}
      value={value}
      onChange={(e) => onChange(Number(e.target.value))}
      style={{ flex: 1, accentColor: "#8b5cf6", height: 4 }}
    />
    <span
      style={{
        minWidth: 44,
        textAlign: "right",
        color: "#a78bfa",
        fontWeight: 700,
        fontSize: 11,
        fontFamily: "monospace",
      }}
    >
      {Number.isInteger(value) ? value : value.toFixed(2)}
    </span>
  </div>
));

/* ═══════════════════════════════════════════
   MAIN COMPONENT
   ═══════════════════════════════════════════ */
export default function Qwixx() {
  const [pSt, setPSt] = useState(blank);
  const [aiSt, setAiSt] = useState(blank);
  const [dice, setDice] = useState(null);
  const [activePlayer, setActivePlayer] = useState("human");
  const [phase, setPhase] = useState("roll");
  const [usedW, setUsedW] = useState(false);
  const [usedC, setUsedC] = useState(false);
  const [rolling, setRolling] = useState(false);
  const [rollAnim, setRollAnim] = useState(null);
  const [over, setOver] = useState(false);
  const [showRules, setShowRules] = useState(false);
  const [showCfg, setShowCfg] = useState(false);
  const [aiHL, setAiHL] = useState(null);
  const [aiLog, setAiLog] = useState([]);
  const [turn, setTurn] = useState(0);
  const [winProb, setWinProb] = useState(null);
  const [cfg, setCfg] = useState({
    activeSims: 10000,
    colorSims: 3000,
    passiveSims: 4000,
    ucbC: 1.41,
    manual: false,
  });
  const cfgR = useRef(cfg);
  cfgR.current = cfg;

  const ws = dice ? dice.w1 + dice.w2 : null;
  const pSc = score(pSt),
    aSc = score(aiSt);
  const isHA = activePlayer === "human";
  const dd = rollAnim || dice;
  const aiDiceR = useRef(null),
    aiMidR = useRef(null),
    hasStarted = useRef(false);
  const aiPendingR = useRef(null),
    aiResultR = useRef(null);

  const addLog = (t, msg) => setAiLog((p) => [...p.slice(-7), `T${t}: ${msg}`]);
  const endGame = () => {
    setOver(true);
    setPhase("done");
  };

  // ── Poll liveStats ──
  const lastProbRef = useRef("");
  useEffect(() => {
    const iv = setInterval(() => {
      if (liveStats.total > 0) {
        const key = `${liveStats.wins},${liveStats.draws},${liveStats.total}`;
        if (key !== lastProbRef.current) {
          lastProbRef.current = key;
          setWinProb({
            aiWin: liveStats.wins / liveStats.total,
            draw: liveStats.draws / liveStats.total,
            humanWin: liveStats.losses / liveStats.total,
          });
        }
      }
    }, 250);
    return () => clearInterval(iv);
  }, []);

  const nextTurn = useCallback((p, a) => {
    if (isOver2(p, a)) {
      setOver(true);
      setPhase("done");
      return;
    }
    setActivePlayer((prev) => (prev === "human" ? "ai" : "human"));
    setDice(null);
    setAiHL(null);
    setPhase("roll");
    setTurn((t) => t + 1);
    setUsedW(false);
    setUsedC(false);
  }, []);

  // ── Option checks ──
  const manual = cfg.manual;
  // In manual mode: white options still highlighted (sum is obvious), color options still highlighted
  // The only difference: no color preview during white phase
  const isWO = (c, i) =>
    phase === "p_white" &&
    dice &&
    ROWS.find((r) => r.color === c).numbers[i] === ws &&
    canMark(pSt, c, i);
  const isCO = (c, i) => {
    if (phase !== "p_color" || !dice) return false;
    const row = ROWS.find((r) => r.color === c),
      su = [dice.w1 + dice[c], dice.w2 + dice[c]];
    return su.includes(row.numbers[i]) && canMark(pSt, c, i);
  };
  const isPO = (c, i) =>
    phase === "p_passive_white" &&
    dice &&
    ROWS.find((r) => r.color === c).numbers[i] === ws &&
    canMark(pSt, c, i);
  // Color preview only in non-manual mode
  const isCP = (c, i) => {
    if (manual || phase !== "p_white" || !dice) return false;
    const row = ROWS.find((r) => r.color === c),
      su = [dice.w1 + dice[c], dice.w2 + dice[c]];
    return su.includes(row.numbers[i]) && canMark(pSt, c, i);
  };

  // ── AI background ──
  const startAI = (fn) => {
    aiResultR.current = null;
    const p = fn();
    aiPendingR.current = p;
    p.then((r) => {
      aiResultR.current = r;
    });
  };

  // Reveal AI move: show highlight on OLD state, wait, then commit
  const revealAI = useCallback(
    async (latestP, latestAI, prefix, thenFn) => {
      let result = aiResultR.current;
      if (!result) {
        setPhase("ai_thinking");
        result = await aiPendingR.current;
      }
      aiPendingR.current = null;
      aiResultR.current = null;
      const move = result.move;
      const newAI = move ? applyPassive(latestAI, move) : latestAI;

      if (move) {
        const r = ROWS.find((x) => x.color === move.color);
        addLog(turn + 1, `${prefix}: ${r.numbers[move.idx]} ${move.color}`);
        // Phase 1: highlight on OLD board (cell not yet marked)
        setAiHL({ color: move.color, idx: move.idx });
        setPhase("ai_show");
        await new Promise((r) => setTimeout(r, 800));
        // Phase 2: commit mark + clear highlight in one batch
        setAiHL(null);
        setAiSt(newAI);
      } else {
        addLog(turn + 1, `${prefix}: skip`);
      }

      // Sync locks + win prob (no extra setAiSt call)
      const sp = syncLocks(newAI, latestP);
      if (sp !== latestP) setPSt(sp);
      if (result.total > 0)
        setWinProb({
          aiWin: result.wins / result.total,
          draw: result.draws / result.total,
          humanWin: result.losses / result.total,
        });
      if (isOver2(sp, newAI)) {
        endGame();
        return null;
      }
      if (thenFn) return thenFn(sp, newAI);
      return { p: sp, ai: newAI };
    },
    [turn]
  );

  const startHuman = useCallback(
    (fd) => {
      const s = cfgR.current;
      startAI(() => mctsPassive(aiSt, pSt, fd.w1 + fd.w2, s.passiveSims, s.ucbC));
      setPhase("p_white");
    },
    [aiSt, pSt]
  );

  const startAITurn = useCallback(
    (fd) => {
      aiDiceR.current = fd;
      const s = cfgR.current;
      startAI(() => mctsWhite(aiSt, pSt, fd.w1 + fd.w2, s.activeSims, s.ucbC));
      setPhase("p_passive_white");
    },
    [aiSt, pSt]
  );

  const doAIColor = useCallback(
    async (latestP) => {
      const s = cfgR.current,
        midAI = aiMidR.current || aiSt,
        fd = aiDiceR.current;
      if (!fd) {
        nextTurn(latestP, midAI);
        return;
      }
      setPhase("ai_thinking");
      const didW = midAI !== aiSt;
      const result = await mctsColor(midAI, latestP, fd, s.colorSims, s.ucbC, didW);
      const move = result.move;
      let finalAI = midAI;

      if (move) {
        finalAI = doMark(midAI, move.color, move.idx);
        const r = ROWS.find((x) => x.color === move.color);
        addLog(turn + 1, `active(c): ${r.numbers[move.idx]} ${move.color}`);
        setAiHL({ color: move.color, idx: move.idx });
        setPhase("ai_show");
        await new Promise((r) => setTimeout(r, 800));
        setAiHL(null);
        setAiSt(finalAI);
      } else if (!didW) {
        finalAI = clone(midAI);
        finalAI.penalties++;
        addLog(turn + 1, "active: skip(−5)");
        setAiSt(finalAI);
      }

      const sp = syncLocks(finalAI, latestP);
      if (sp !== latestP) setPSt(sp);
      if (result.total > 0)
        setWinProb({
          aiWin: result.wins / result.total,
          draw: result.draws / result.total,
          humanWin: result.losses / result.total,
        });
      if (isOver2(sp, finalAI)) {
        endGame();
        return;
      }
      nextTurn(sp, finalAI);
    },
    [aiSt, turn, nextTurn]
  );

  const finishPassive = useCallback(
    async (latestP) => {
      const res = await revealAI(latestP, aiSt, "active(w)");
      if (!res) return;
      aiMidR.current = res.ai;
      doAIColor(res.p);
    },
    [aiSt, revealAI, doAIColor]
  );

  const handleMark = (c, i) => {
    if (over) return;
    if (isWO(c, i)) {
      const ns = doMark(pSt, c, i),
        sa = syncLocks(ns, aiSt);
      setPSt(ns);
      if (sa !== aiSt) setAiSt(sa);
      setUsedW(true);
      if (isOver2(ns, sa)) {
        endGame();
        return;
      }
      revealAI(ns, sa, "passive", (sp, nai) => {
        setPhase("p_color");
        return { p: sp, ai: nai };
      });
    } else if (isCO(c, i)) {
      const ns = doMark(pSt, c, i),
        sa = syncLocks(ns, aiSt);
      setPSt(ns);
      if (sa !== aiSt) setAiSt(sa);
      setUsedC(true);
      if (isOver2(ns, sa)) {
        endGame();
        return;
      }
      nextTurn(ns, sa);
    } else if (isPO(c, i)) {
      const ns = doMark(pSt, c, i),
        sa = syncLocks(ns, aiSt);
      setPSt(ns);
      if (sa !== aiSt) setAiSt(sa);
      if (isOver2(ns, sa)) {
        endGame();
        return;
      }
      finishPassive(ns);
    }
  };
  const skipW = () =>
    revealAI(pSt, aiSt, "passive", (sp, nai) => {
      setPhase("p_color");
      return { p: sp, ai: nai };
    });
  const skipC = () => {
    let ns = clone(pSt);
    if (!usedW && !usedC) ns.penalties++;
    setPSt(ns);
    if (isOver2(ns, aiSt)) {
      endGame();
      return;
    }
    nextTurn(ns, aiSt);
  };
  const skipP = () => finishPassive(pSt);

  const handleRoll = useCallback(() => {
    if (rolling) return;
    setRolling(true);
    setUsedW(false);
    setUsedC(false);
    let count = 0;
    const iv = setInterval(() => {
      setRollAnim(rollAll());
      if (++count > 8) {
        clearInterval(iv);
        const fd = rollAll();
        setDice(fd);
        setRollAnim(null);
        setRolling(false);
        if (activePlayer === "human") startHuman(fd);
        else startAITurn(fd);
      }
    }, 80);
  }, [activePlayer, rolling, startHuman, startAITurn]);

  useEffect(() => {
    if (phase === "roll" && activePlayer === "ai" && !rolling && !over && hasStarted.current) {
      const t = setTimeout(handleRoll, 600);
      return () => clearTimeout(t);
    }
    if (phase !== "roll") hasStarted.current = true;
  }, [phase, activePlayer, rolling, over, handleRoll]);

  const restart = () => {
    setPSt(blank());
    setAiSt(blank());
    setDice(null);
    setPhase("roll");
    setActivePlayer("human");
    setUsedW(false);
    setUsedC(false);
    setRolling(false);
    setOver(false);
    setAiHL(null);
    setAiLog([]);
    setTurn(0);
    setWinProb(null);
    hasStarted.current = false;
    resetLive();
    aiPendingR.current = null;
    aiResultR.current = null;
    aiDiceR.current = null;
    aiMidR.current = null;
  };

  const pi = (() => {
    switch (phase) {
      case "roll":
        return {
          text: isHA ? "Your turn — roll!" : "🤖 AI rolling...",
          color: isHA ? "#34d399" : "#a78bfa",
        };
      case "p_white":
        return { text: `White: mark ${ws} on any row`, color: "#fbbf24" };
      case "p_color":
        return { text: "Color: mark a white+color combo", color: "#34d399" };
      case "p_passive_white":
        return { text: `Passive: you may mark ${ws}`, color: "#f472b6" };
      case "ai_thinking":
        return { text: "🤖 AI thinking...", color: "#c4b5fd" };
      case "ai_show":
        return { text: "🤖 AI played!", color: "#c4b5fd" };
      default:
        return { text: "", color: "#fff" };
    }
  })();

  /* ═══════════════════════════════════════════
     RENDER — Row and Board inline but using memo'd Cell
     ═══════════════════════════════════════════ */
  const renderRow = (row, state, isAI) => {
    const lk = state.locked[row.color];
    return (
      <div
        key={row.color}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 2,
          background: lk ? "rgba(255,255,255,0.02)" : "rgba(255,255,255,0.04)",
          borderRadius: 9,
          padding: "3px 5px",
          border: `1.5px solid ${lk ? "rgba(255,255,255,0.03)" : row.bg + "22"}`,
          opacity: lk ? 0.35 : 1,
        }}
      >
        <div
          style={{ width: 5, minHeight: 28, borderRadius: 3, background: row.bg, flexShrink: 0 }}
        />
        <div style={{ display: "flex", gap: 1.5, flex: 1, justifyContent: "center" }}>
          {row.numbers.map((num, idx) => {
            const mk = state.marked[row.color][idx];
            const hl = isAI && aiHL && aiHL.color === row.color && aiHL.idx === idx;
            let opt = false,
              prev = false;
            if (!isAI) {
              opt = isWO(row.color, idx) || isCO(row.color, idx) || isPO(row.color, idx);
              if (!opt && !mk) prev = isCP(row.color, idx);
            }
            return (
              <Cell
                key={idx}
                num={num}
                idx={idx}
                marked={mk}
                opt={opt}
                preview={prev}
                hl={hl}
                bg={row.bg}
                bgLight={row.bgLight}
                text={row.text}
                locked={false}
                onClick={() => !isAI && handleMark(row.color, idx)}
              />
            );
          })}
          {/* Lock cell */}
          <div
            style={{
              width: 30,
              height: 30,
              borderRadius: 6,
              fontSize: lk ? 13 : 10,
              fontWeight: 700,
              border: lk ? `2px solid ${row.bg}` : "1px dashed rgba(255,255,255,0.12)",
              background: lk ? row.bg : "rgba(255,255,255,0.02)",
              color: lk ? "#fff" : "rgba(255,255,255,0.2)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontFamily: "inherit",
            }}
          >
            {lk ? "✕" : "🔒"}
          </div>
        </div>
        <div
          style={{
            minWidth: 26,
            textAlign: "center",
            color: row.accent,
            fontSize: 11,
            fontWeight: 700,
            background: "rgba(0,0,0,0.2)",
            borderRadius: 5,
            padding: "2px 1px",
          }}
        >
          {SCORE_MAP[countX(state.marked[row.color]) + (state.locked[row.color] ? 1 : 0)] || 0}
        </div>
      </div>
    );
  };

  const renderBoard = (state, label, isAI, active) => {
    const ac = isAI ? "#8b5cf6" : "#22c55e",
      al = isAI ? "rgba(139,92,246," : "rgba(34,197,94,";
    return (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 3,
          width: "100%",
          maxWidth: 540,
          background: active ? `${al}0.08)` : "transparent",
          borderRadius: 12,
          padding: "6px 4px",
          border: active ? `1px solid ${al}0.25)` : "1px solid rgba(255,255,255,0.04)",
          borderLeft: active ? `3px solid ${ac}` : "3px solid transparent",
          boxShadow: active ? `0 0 20px ${al}0.12)` : "none",
          transition: "all 0.4s",
          opacity: active ? 1 : 0.6,
          transform: active ? "scale(1)" : "scale(0.985)",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            padding: "0 6px",
            marginBottom: 1,
          }}
        >
          <span
            style={{
              color: isAI ? "#a78bfa" : "#34d399",
              fontSize: 13,
              fontWeight: 700,
              display: "flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            {isAI ? "🤖" : "👤"} {label}
            {active && (
              <span
                style={{
                  fontSize: 8,
                  color: ac,
                  fontWeight: 600,
                  background: `${al}0.15)`,
                  padding: "1px 6px",
                  borderRadius: 8,
                  animation: "subtlePulse 2s ease-in-out infinite",
                }}
              >
                ACTIVE
              </span>
            )}
          </span>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ color: "#64748b", fontSize: 10 }}>
              {[0, 1, 2, 3].map((i) => (
                <span
                  key={i}
                  style={{
                    display: "inline-block",
                    width: 14,
                    height: 14,
                    lineHeight: "14px",
                    textAlign: "center",
                    borderRadius: 3,
                    marginLeft: 2,
                    fontSize: 9,
                    background: i < state.penalties ? "#EF4444" : "rgba(255,255,255,0.06)",
                    color: i < state.penalties ? "#fff" : "#475569",
                    fontWeight: 700,
                  }}
                >
                  {i < state.penalties ? "✕" : ""}
                </span>
              ))}
            </span>
            <span style={{ color: "#fff", fontSize: 14, fontWeight: 800 }}>{score(state)}</span>
          </div>
        </div>
        {ROWS.map((row) => renderRow(row, state, isAI))}
      </div>
    );
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "linear-gradient(145deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)",
        fontFamily: "'Fredoka', 'Nunito', sans-serif",
        padding: "12px 6px",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
      }}
    >
      <link
        href="https://fonts.googleapis.com/css2?family=Fredoka:wght@400;500;600;700&display=swap"
        rel="stylesheet"
      />

      <div style={{ textAlign: "center", marginBottom: 6 }}>
        <h1
          style={{
            fontSize: 30,
            fontWeight: 700,
            margin: 0,
            letterSpacing: 5,
            background: "linear-gradient(90deg, #EF4444, #EAB308, #22C55E, #3B82F6)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
          }}
        >
          QWIXX
        </h1>
        <div style={{ color: "#64748b", fontSize: 10, marginTop: 1 }}>vs MCTS AI</div>
        <div style={{ display: "flex", gap: 6, justifyContent: "center", marginTop: 3 }}>
          <button
            onClick={() => setShowRules(!showRules)}
            style={{
              background: "rgba(255,255,255,0.08)",
              border: "1px solid rgba(255,255,255,0.12)",
              color: "#94a3b8",
              borderRadius: 14,
              padding: "2px 10px",
              fontSize: 10,
              cursor: "pointer",
              fontFamily: "inherit",
            }}
          >
            {showRules ? "Hide" : "Rules"}
          </button>
          <button
            onClick={restart}
            style={{
              background: "rgba(239,68,68,0.15)",
              border: "1px solid rgba(239,68,68,0.25)",
              color: "#f87171",
              borderRadius: 14,
              padding: "2px 10px",
              fontSize: 10,
              cursor: "pointer",
              fontFamily: "inherit",
            }}
          >
            ↺ Restart
          </button>
          <button
            onClick={() => setShowCfg(!showCfg)}
            style={{
              background: showCfg ? "rgba(139,92,246,0.25)" : "rgba(255,255,255,0.08)",
              border: showCfg
                ? "1px solid rgba(139,92,246,0.4)"
                : "1px solid rgba(255,255,255,0.12)",
              color: showCfg ? "#c4b5fd" : "#94a3b8",
              borderRadius: 14,
              padding: "2px 10px",
              fontSize: 10,
              cursor: "pointer",
              fontFamily: "inherit",
            }}
          >
            ⚙️ AI
          </button>
        </div>
      </div>

      {showCfg && (
        <div
          style={{
            background: "rgba(139,92,246,0.08)",
            borderRadius: 10,
            padding: 14,
            maxWidth: 480,
            marginBottom: 10,
            color: "#cbd5e1",
            fontSize: 11,
            lineHeight: 1.8,
            border: "1px solid rgba(139,92,246,0.2)",
            width: "100%",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 8,
            }}
          >
            <span style={{ color: "#c4b5fd", fontWeight: 700, fontSize: 12 }}>
              ⚙️ MCTS Settings
            </span>
            <span style={{ color: "#64748b", fontSize: 9, fontFamily: "monospace" }}>v0.2</span>
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              marginBottom: 8,
              padding: "6px 0",
              borderBottom: "1px solid rgba(255,255,255,0.08)",
            }}
          >
            <div style={{ flex: 1, fontSize: 10 }}>
              <div style={{ color: "#e2e8f0", fontWeight: 600 }}>Manual mode</div>
              <div style={{ color: "#64748b", fontSize: 9 }}>
                No color preview hints during white phase
              </div>
            </div>
            <button
              onClick={() => setCfg({ ...cfg, manual: !cfg.manual })}
              style={{
                width: 44,
                height: 24,
                borderRadius: 12,
                border: "none",
                cursor: "pointer",
                background: cfg.manual ? "#8b5cf6" : "rgba(255,255,255,0.15)",
                position: "relative",
                transition: "background 0.2s",
              }}
            >
              <div
                style={{
                  width: 18,
                  height: 18,
                  borderRadius: 9,
                  background: "#fff",
                  position: "absolute",
                  top: 3,
                  left: cfg.manual ? 23 : 3,
                  transition: "left 0.2s",
                }}
              />
            </button>
          </div>
          <Slider
            label="Active sims"
            desc="White phase sims"
            value={cfg.activeSims}
            min={500}
            max={50000}
            step={500}
            onChange={(v) => setCfg({ ...cfg, activeSims: v })}
          />
          <Slider
            label="Color sims"
            desc="Color phase sims"
            value={cfg.colorSims}
            min={500}
            max={50000}
            step={500}
            onChange={(v) => setCfg({ ...cfg, colorSims: v })}
          />
          <Slider
            label="Passive sims"
            desc="Passive phase sims"
            value={cfg.passiveSims}
            min={500}
            max={20000}
            step={500}
            onChange={(v) => setCfg({ ...cfg, passiveSims: v })}
          />
          <Slider
            label="UCB-C"
            desc="Exploration (higher = more)"
            value={cfg.ucbC}
            min={0.5}
            max={5}
            step={0.1}
            onChange={(v) => setCfg({ ...cfg, ucbC: v })}
          />
          <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
            <button
              onClick={() =>
                setCfg({ activeSims: 10000, colorSims: 3000, passiveSims: 4000, ucbC: 1.41 })
              }
              style={{
                background: "rgba(255,255,255,0.06)",
                border: "1px solid rgba(255,255,255,0.1)",
                color: "#94a3b8",
                borderRadius: 8,
                padding: "3px 10px",
                fontSize: 9,
                cursor: "pointer",
                fontFamily: "inherit",
              }}
            >
              Defaults
            </button>
            <button
              onClick={() =>
                setCfg({ activeSims: 50000, colorSims: 20000, passiveSims: 15000, ucbC: 1.2 })
              }
              style={{
                background: "rgba(239,68,68,0.12)",
                border: "1px solid rgba(239,68,68,0.2)",
                color: "#f87171",
                borderRadius: 8,
                padding: "3px 10px",
                fontSize: 9,
                cursor: "pointer",
                fontFamily: "inherit",
              }}
            >
              🔥 Max
            </button>
            <button
              onClick={() =>
                setCfg({ activeSims: 1000, colorSims: 500, passiveSims: 500, ucbC: 2.0 })
              }
              style={{
                background: "rgba(34,197,94,0.12)",
                border: "1px solid rgba(34,197,94,0.2)",
                color: "#34d399",
                borderRadius: 8,
                padding: "3px 10px",
                fontSize: 9,
                cursor: "pointer",
                fontFamily: "inherit",
              }}
            >
              😴 Easy
            </button>
          </div>
        </div>
      )}

      {showRules && (
        <div
          style={{
            background: "rgba(255,255,255,0.07)",
            borderRadius: 10,
            padding: 12,
            maxWidth: 480,
            marginBottom: 10,
            color: "#cbd5e1",
            fontSize: 11,
            lineHeight: 1.5,
            border: "1px solid rgba(255,255,255,0.1)",
          }}
        >
          <p style={{ margin: "0 0 5px" }}>
            <strong style={{ color: "#fff" }}>Active turn:</strong> Roll → ALL players may use white
            sum → only active player may also use white+color combo. Penalty if active player marks
            nothing.
          </p>
          <p style={{ margin: "0 0 5px" }}>
            <strong style={{ color: "#fff" }}>Passive:</strong> When the AI rolls, you still get to
            use the white dice sum!
          </p>
          <p style={{ margin: "0 0 5px" }}>
            <strong style={{ color: "#fff" }}>Rules:</strong> Left→right only. 5+ marks to lock last
            number. Locking adds a bonus ✕ to scoring. Locks apply to both players. Game ends: 2
            locked rows or 4 penalties.
          </p>
          <p style={{ margin: 0 }}>
            <strong style={{ color: "#fff" }}>Scoring:</strong> 1✕=1, 2✕=3, 3✕=6, 4✕=10, 5✕=15,
            6✕=21, 7✕=28, 8✕=36, 9✕=45, 10✕=55, 11✕=66, 12✕=78
          </p>
        </div>
      )}

      <div style={{ marginBottom: 8, width: "100%", maxWidth: 400 }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            background: "rgba(255,255,255,0.05)",
            borderRadius: 8,
            padding: "5px 14px",
            border: "1px solid rgba(255,255,255,0.08)",
          }}
        >
          <span style={{ color: "#34d399", fontWeight: 700, fontSize: 14 }}>👤{pSc}</span>
          <div
            style={{
              flex: 1,
              height: 5,
              background: "rgba(255,255,255,0.08)",
              borderRadius: 3,
              overflow: "hidden",
              display: "flex",
            }}
          >
            <div
              style={{
                width: `${pSc + aSc > 0 ? (pSc / (pSc + aSc)) * 100 : 50}%`,
                background: "linear-gradient(90deg,#34d399,#22c55e)",
                borderRadius: 3,
                transition: "width 0.5s",
              }}
            />
            <div
              style={{
                flex: 1,
                background: "linear-gradient(90deg,#8b5cf6,#a78bfa)",
                borderRadius: 3,
              }}
            />
          </div>
          <span style={{ color: "#a78bfa", fontWeight: 700, fontSize: 14 }}>{aSc}🤖</span>
        </div>
        {winProb && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 4,
              marginTop: 4,
              padding: "0 4px",
            }}
          >
            <span style={{ color: "#34d399", fontSize: 9, fontWeight: 600, minWidth: 36 }}>
              {Math.round(winProb.humanWin * 100)}%
            </span>
            <div
              style={{
                flex: 1,
                height: 4,
                borderRadius: 2,
                overflow: "hidden",
                display: "flex",
                background: "rgba(255,255,255,0.06)",
              }}
            >
              <div
                style={{
                  width: `${winProb.humanWin * 100}%`,
                  background: "#22c55e",
                  transition: "width 0.3s ease",
                }}
              />
              <div
                style={{
                  width: `${winProb.draw * 100}%`,
                  background: "#64748b",
                  transition: "width 0.3s ease",
                }}
              />
              <div
                style={{
                  width: `${winProb.aiWin * 100}%`,
                  background: "#8b5cf6",
                  transition: "width 0.3s ease",
                }}
              />
            </div>
            <span
              style={{
                color: "#a78bfa",
                fontSize: 9,
                fontWeight: 600,
                minWidth: 36,
                textAlign: "right",
              }}
            >
              {Math.round(winProb.aiWin * 100)}%
            </span>
          </div>
        )}
      </div>

      <div
        style={{
          background: "rgba(255,255,255,0.05)",
          borderRadius: 12,
          padding: "8px 14px",
          marginBottom: 8,
          border: "1px solid rgba(255,255,255,0.08)",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 6,
        }}
      >
        {dd ? (
          <>
            <div style={{ display: "flex", gap: 5, flexWrap: "wrap", justifyContent: "center" }}>
              <Die value={dd.w1} bg="#78716c" spin={rolling} />
              <Die value={dd.w2} bg="#78716c" spin={rolling} />
              <Die value={dd.red} bg="#DC2626" spin={rolling} />
              <Die value={dd.yellow} bg="#CA8A04" spin={rolling} />
              <Die value={dd.green} bg="#16A34A" spin={rolling} />
              <Die value={dd.blue} bg="#2563EB" spin={rolling} />
            </div>
            {!rolling && dice && (
              <div style={{ color: "#94a3b8", fontSize: 10 }}>
                White: <strong style={{ color: "#fff" }}>{ws}</strong>
              </div>
            )}
          </>
        ) : (
          <div style={{ color: "#64748b", fontSize: 12 }}>
            {turn === 0 ? "Roll to start!" : isHA ? "Your turn — roll!" : "AI's turn..."}
          </div>
        )}
        <div
          style={{
            display: "flex",
            gap: 5,
            flexWrap: "wrap",
            justifyContent: "center",
            alignItems: "center",
          }}
        >
          {phase === "roll" && !over && isHA && (
            <button
              onClick={handleRoll}
              disabled={rolling}
              style={{
                background: "linear-gradient(135deg,#22c55e,#16a34a)",
                color: "#fff",
                border: "none",
                borderRadius: 9,
                padding: "7px 20px",
                fontSize: 14,
                fontWeight: 700,
                cursor: "pointer",
                fontFamily: "inherit",
                boxShadow: "0 3px 12px rgba(34,197,94,0.4)",
                opacity: rolling ? 0.6 : 1,
              }}
            >
              🎲 Roll
            </button>
          )}
          {phase !== "roll" && phase !== "done" && (
            <div
              style={{
                background: "rgba(255,255,255,0.1)",
                borderRadius: 6,
                padding: "4px 10px",
                color: pi.color,
                fontSize: 11,
                fontWeight: 600,
                animation: phase === "ai_thinking" ? "throb 1s infinite" : "none",
              }}
            >
              {pi.text}
            </div>
          )}
          {phase === "p_white" && (
            <button
              onClick={skipW}
              style={{
                background: "rgba(255,255,255,0.06)",
                color: "#94a3b8",
                border: "1px solid rgba(255,255,255,0.12)",
                borderRadius: 6,
                padding: "4px 12px",
                fontSize: 11,
                cursor: "pointer",
                fontFamily: "inherit",
              }}
            >
              Skip
            </button>
          )}
          {phase === "p_color" && (
            <button
              onClick={skipC}
              style={{
                background: "rgba(255,255,255,0.06)",
                color: "#94a3b8",
                border: "1px solid rgba(255,255,255,0.12)",
                borderRadius: 6,
                padding: "4px 12px",
                fontSize: 11,
                cursor: "pointer",
                fontFamily: "inherit",
              }}
            >
              Skip{!usedW ? " ⚠️" : ""}
            </button>
          )}
          {phase === "p_passive_white" && (
            <button
              onClick={skipP}
              style={{
                background: "rgba(255,255,255,0.06)",
                color: "#94a3b8",
                border: "1px solid rgba(255,255,255,0.12)",
                borderRadius: 6,
                padding: "4px 12px",
                fontSize: 11,
                cursor: "pointer",
                fontFamily: "inherit",
              }}
            >
              Skip
            </button>
          )}
        </div>
      </div>

      {renderBoard(pSt, "You", false, isHA && phase !== "roll" && phase !== "done")}
      <div
        style={{
          width: "80%",
          maxWidth: 400,
          height: 1,
          background: "rgba(255,255,255,0.08)",
          margin: "6px 0",
        }}
      />
      {renderBoard(aiSt, "MCTS AI", true, !isHA && phase !== "roll" && phase !== "done")}

      {aiLog.length > 0 && (
        <div
          style={{
            marginTop: 6,
            width: "100%",
            maxWidth: 540,
            background: "rgba(139,92,246,0.05)",
            borderRadius: 8,
            padding: "6px 10px",
            border: "1px solid rgba(139,92,246,0.1)",
          }}
        >
          <div style={{ color: "#a78bfa", fontSize: 10, fontWeight: 700, marginBottom: 2 }}>
            🤖 AI log
          </div>
          {aiLog.map((e, i) => (
            <div key={i} style={{ color: "#94a3b8", fontSize: 10, lineHeight: 1.4 }}>
              {e}
            </div>
          ))}
        </div>
      )}

      {over && (
        <div
          style={{
            marginTop: 12,
            textAlign: "center",
            background:
              pSc > aSc
                ? "rgba(34,197,94,0.1)"
                : pSc < aSc
                  ? "rgba(139,92,246,0.1)"
                  : "rgba(255,255,255,0.06)",
            borderRadius: 12,
            padding: 16,
            border: `1px solid ${pSc > aSc ? "rgba(34,197,94,0.25)" : pSc < aSc ? "rgba(139,92,246,0.25)" : "rgba(255,255,255,0.15)"}`,
          }}
        >
          <div
            style={{
              fontSize: 20,
              fontWeight: 700,
              marginBottom: 4,
              color: pSc > aSc ? "#34d399" : pSc < aSc ? "#c4b5fd" : "#fff",
            }}
          >
            {pSc > aSc ? "You Win! 🎉" : pSc < aSc ? "AI Wins! 🤖" : "Tie!"}
          </div>
          <div style={{ color: "#cbd5e1", fontSize: 13, marginBottom: 8 }}>
            You: {pSc} — AI: {aSc}
          </div>
          <button
            onClick={restart}
            style={{
              background: "linear-gradient(135deg,#8B5CF6,#6D28D9)",
              color: "#fff",
              border: "none",
              borderRadius: 9,
              padding: "7px 20px",
              fontSize: 14,
              fontWeight: 700,
              cursor: "pointer",
              fontFamily: "inherit",
              boxShadow: "0 3px 12px rgba(139,92,246,0.4)",
            }}
          >
            Play Again
          </button>
        </div>
      )}

      <style>{`
        @keyframes pulse{0%,100%{transform:scale(1)}50%{transform:scale(1.07)}}
        @keyframes throb{0%,100%{opacity:1}50%{opacity:0.4}}
        @keyframes subtlePulse{0%,100%{opacity:0.7}50%{opacity:1}}
        button:hover:not(:disabled){filter:brightness(1.1)}
      `}</style>
    </div>
  );
}
