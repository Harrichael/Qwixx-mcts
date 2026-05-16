import { useState, useCallback, useEffect, useRef } from "react";
import { ROWS, ROW_BY_COLOR, SCORE_MAP, rollAll } from "./constants";
import { blank, doMark, score, isOver2, canMark, syncLocks, countX } from "./game";
import { liveStats, resetLive, applyPassive, mctsPassive, mctsWhite, mctsColor } from "./mcts";
import type {
  Color,
  Dice,
  GameState,
  MctsConfig,
  MctsResult,
  Move,
  Phase,
  Player,
  Row,
  WinProb,
} from "./types";
import Die from "./components/Die";
import Cell from "./components/Cell";
import Slider from "./components/Slider";

const PRESETS = {
  defaults: { activeSims: 10000, colorSims: 3000, passiveSims: 4000, ucbC: 1.41 },
  max: { activeSims: 50000, colorSims: 20000, passiveSims: 15000, ucbC: 1.2 },
  easy: { activeSims: 1000, colorSims: 500, passiveSims: 500, ucbC: 2.0 },
} satisfies Record<string, Omit<MctsConfig, "manual">>;

export default function Qwixx() {
  const [pSt, setPSt] = useState<GameState>(blank);
  const [aiSt, setAiSt] = useState<GameState>(blank);
  const [dice, setDice] = useState<Dice | null>(null);
  const [activePlayer, setActivePlayer] = useState<Player>("human");
  const [phase, setPhase] = useState<Phase>("roll");
  const [usedW, setUsedW] = useState(false);
  const [usedC, setUsedC] = useState(false);
  const [rolling, setRolling] = useState(false);
  const [rollAnim, setRollAnim] = useState<Dice | null>(null);
  const [over, setOver] = useState(false);
  const [showRules, setShowRules] = useState(false);
  const [showCfg, setShowCfg] = useState(false);
  const [aiHL, setAiHL] = useState<Move | null>(null);
  const [aiLog, setAiLog] = useState<string[]>([]);
  const [turn, setTurn] = useState(0);
  const [winProb, setWinProb] = useState<WinProb | null>(null);
  const [cfg, setCfg] = useState<MctsConfig>({
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
  const aiDiceR = useRef<Dice | null>(null);
  const aiMidR = useRef<GameState | null>(null);
  const hasStarted = useRef<boolean>(false);
  const aiPendingR = useRef<Promise<MctsResult> | null>(null);
  const aiResultR = useRef<MctsResult | null>(null);

  const addLog = (t: number, msg: string) => setAiLog((p) => [...p.slice(-7), `T${t}: ${msg}`]);
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

  const nextTurn = useCallback((p: GameState, a: GameState) => {
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
  const isWO = (c: Color, i: number): boolean =>
    phase === "p_white" && !!dice && ROW_BY_COLOR[c].numbers[i] === ws && canMark(pSt, c, i);
  const isCO = (c: Color, i: number): boolean => {
    if (phase !== "p_color" || !dice) return false;
    const su = [dice.w1 + dice[c], dice.w2 + dice[c]];
    return su.includes(ROW_BY_COLOR[c].numbers[i]) && canMark(pSt, c, i);
  };
  const isPO = (c: Color, i: number): boolean =>
    phase === "p_passive_white" &&
    !!dice &&
    ROW_BY_COLOR[c].numbers[i] === ws &&
    canMark(pSt, c, i);
  // Color preview only in non-manual mode
  const isCP = (c: Color, i: number): boolean => {
    if (manual || phase !== "p_white" || !dice) return false;
    const su = [dice.w1 + dice[c], dice.w2 + dice[c]];
    return su.includes(ROW_BY_COLOR[c].numbers[i]) && canMark(pSt, c, i);
  };

  // ── AI background ──
  const startAI = (fn: () => Promise<MctsResult>) => {
    aiResultR.current = null;
    const p = fn();
    aiPendingR.current = p;
    p.then((r) => {
      aiResultR.current = r;
    });
  };

  type RevealResult = { p: GameState; ai: GameState };
  // Reveal AI move: show highlight on OLD state, wait, then commit
  const revealAI = useCallback(
    async (
      latestP: GameState,
      latestAI: GameState,
      prefix: string,
      thenFn?: (sp: GameState, nai: GameState) => RevealResult
    ): Promise<RevealResult | null> => {
      let result = aiResultR.current;
      if (!result) {
        setPhase("ai_thinking");
        result = await aiPendingR.current!;
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
    (fd: Dice) => {
      const s = cfgR.current;
      startAI(() => mctsPassive(aiSt, pSt, fd.w1 + fd.w2, s.passiveSims, s.ucbC));
      setPhase("p_white");
    },
    [aiSt, pSt]
  );

  const startAITurn = useCallback(
    (fd: Dice) => {
      aiDiceR.current = fd;
      const s = cfgR.current;
      startAI(() => mctsWhite(aiSt, pSt, fd.w1 + fd.w2, s.activeSims, s.ucbC));
      setPhase("p_passive_white");
    },
    [aiSt, pSt]
  );

  const doAIColor = useCallback(
    async (latestP: GameState) => {
      const s = cfgR.current;
      const midAI = aiMidR.current || aiSt;
      const fd = aiDiceR.current;
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
        finalAI = { ...midAI, penalties: midAI.penalties + 1 };
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
    async (latestP: GameState) => {
      const res = await revealAI(latestP, aiSt, "active(w)");
      if (!res) return;
      aiMidR.current = res.ai;
      doAIColor(res.p);
    },
    [aiSt, revealAI, doAIColor]
  );

  const handleMark = (c: Color, i: number) => {
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
    const ns: GameState = !usedW && !usedC ? { ...pSt, penalties: pSt.penalties + 1 } : pSt;
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
      case "done":
        return { text: "", color: "#fff" };
      default: {
        const _exhaustive: never = phase;
        return _exhaustive;
      }
    }
  })();

  /* ═══════════════════════════════════════════
     RENDER — Row and Board inline but using memo'd Cell
     ═══════════════════════════════════════════ */
  const renderRow = (row: Row, state: GameState, isAI: boolean) => {
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
          {SCORE_MAP[countX(state.marked[row.color]) + (state.marked[row.color][10] ? 1 : 0)] || 0}
        </div>
      </div>
    );
  };

  const renderBoard = (state: GameState, label: string, isAI: boolean, active: boolean) => {
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
            <span style={{ color: "#64748b", fontSize: 9, fontFamily: "monospace" }}>
              v{__APP_VERSION__}
            </span>
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
              onClick={() => setCfg({ ...cfg, ...PRESETS.defaults })}
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
              onClick={() => setCfg({ ...cfg, ...PRESETS.max })}
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
              onClick={() => setCfg({ ...cfg, ...PRESETS.easy })}
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
