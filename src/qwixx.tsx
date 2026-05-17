import { Fragment, useState, useCallback, useEffect, useRef, useMemo } from "react";
import { ROW_BY_COLOR, rollAll } from "./constants";
import { blank, doMark, score, isGameOver, canMark, syncLocksAll } from "./game";
import { liveStats, resetLive, applyPassive, mctsPassive, mctsWhite, mctsColor } from "./mcts";
import type {
  Color,
  Dice,
  GameState,
  MctsConfig,
  MctsResult,
  Phase,
  WinProb,
} from "./types";
import Die from "./components/Die";
import Board from "./components/Board";
import RulesPanel from "./components/RulesPanel";
import MctsSettingsPanel from "./components/MctsSettingsPanel";
import AiLog from "./components/AiLog";
import GameOverBanner from "./components/GameOverBanner";
import ScoreBar from "./components/ScoreBar";
import WinProbBar from "./components/WinProbBar";

const DEFAULT_CFG: MctsConfig = {
  activeSims: 10000,
  colorSims: 3000,
  passiveSims: 4000,
  ucbC: 1.41,
  manual: false,
  numAI: 1,
};

const aiLabel = (idx: number, total: number): string => (total === 1 ? "MCTS AI" : `AI ${idx + 1}`);

export default function Qwixx() {
  const [cfg, setCfg] = useState<MctsConfig>(DEFAULT_CFG);
  const cfgR = useRef(cfg);
  cfgR.current = cfg;

  // Game state: index 0 = human, 1..N = AI[i-1]
  const [humanState, setHumanState] = useState<GameState>(blank);
  const [aiStates, setAiStates] = useState<GameState[]>(() => Array.from({ length: cfg.numAI }, blank));

  const [dice, setDice] = useState<Dice | null>(null);
  const [activeIdx, setActiveIdx] = useState<number>(0);
  const [phase, setPhase] = useState<Phase>("roll");
  const [usedW, setUsedW] = useState(false);
  const [usedC, setUsedC] = useState(false);
  const [rolling, setRolling] = useState(false);
  const [rollAnim, setRollAnim] = useState<Dice | null>(null);
  const [over, setOver] = useState(false);
  const [showRules, setShowRules] = useState(false);
  const [showCfg, setShowCfg] = useState(false);
  const [aiHL, setAiHL] = useState<{ aiIndex: number; color: Color; idx: number } | null>(null);
  const [aiLog, setAiLog] = useState<string[]>([]);
  const [turn, setTurn] = useState(0);
  const [winProb, setWinProb] = useState<WinProb | null>(null);

  const numAI = aiStates.length;
  const totalPlayers = 1 + numAI;
  const isHumanActive = activeIdx === 0;
  const activeAiIdx = isHumanActive ? -1 : activeIdx - 1;
  const ws = dice ? dice.w1 + dice.w2 : null;
  const humanScore = score(humanState);
  const aiScores = useMemo(() => aiStates.map(score), [aiStates]);
  const leadingAiScore = aiScores.length ? Math.max(...aiScores) : 0;
  const displayedDice = rollAnim || dice;

  // Refs: per-AI pending MCTS computation + result
  const aiPendingR = useRef<(Promise<MctsResult> | null)[]>([]);
  const aiResultR = useRef<(MctsResult | null)[]>([]);
  const activeAiDiceR = useRef<Dice | null>(null);
  const activeAiMidR = useRef<GameState | null>(null);
  const activeAiPlayedWhiteR = useRef<boolean>(false);
  const hasStarted = useRef<boolean>(false);

  // Keep MCTS ref arrays sized to numAI
  useEffect(() => {
    while (aiPendingR.current.length < numAI) aiPendingR.current.push(null);
    while (aiResultR.current.length < numAI) aiResultR.current.push(null);
    aiPendingR.current.length = numAI;
    aiResultR.current.length = numAI;
  }, [numAI]);

  const addLog = (t: number, msg: string) => setAiLog((p) => [...p.slice(-7), `T${t}: ${msg}`]);
  const endGame = () => {
    setOver(true);
    setPhase("done");
  };

  // ── Poll liveStats — most-recently-running MCTS feeds the winProb bar ──
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

  const nextTurn = useCallback(
    (humanNext: GameState, aiStatesNext: GameState[]) => {
      if (isGameOver([humanNext, ...aiStatesNext])) {
        setOver(true);
        setPhase("done");
        return;
      }
      setActiveIdx((prev) => (prev + 1) % totalPlayers);
      setDice(null);
      setAiHL(null);
      setPhase("roll");
      setTurn((t) => t + 1);
      setUsedW(false);
      setUsedC(false);
    },
    [totalPlayers]
  );

  // ── Human cell-state predicates ──
  const manual = cfg.manual;
  const isWO = (c: Color, i: number): boolean =>
    phase === "p_white" && !!dice && ROW_BY_COLOR[c].numbers[i] === ws && canMark(humanState, c, i);
  const isCO = (c: Color, i: number): boolean => {
    if (phase !== "p_color" || !dice) return false;
    const su = [dice.w1 + dice[c], dice.w2 + dice[c]];
    return su.includes(ROW_BY_COLOR[c].numbers[i]) && canMark(humanState, c, i);
  };
  const isPO = (c: Color, i: number): boolean =>
    phase === "p_passive_white" &&
    !!dice &&
    ROW_BY_COLOR[c].numbers[i] === ws &&
    canMark(humanState, c, i);
  const isCP = (c: Color, i: number): boolean => {
    if (manual || phase !== "p_white" || !dice) return false;
    const su = [dice.w1 + dice[c], dice.w2 + dice[c]];
    return su.includes(ROW_BY_COLOR[c].numbers[i]) && canMark(humanState, c, i);
  };

  const humanIsOption = (c: Color, i: number) => isWO(c, i) || isCO(c, i) || isPO(c, i);
  const humanIsPreview = (c: Color, i: number) => isCP(c, i);

  // ── Spawn an MCTS computation for a specific AI; store its promise + eventual result ──
  const startAi = (aiIndex: number, fn: () => Promise<MctsResult>) => {
    aiResultR.current[aiIndex] = null;
    const p = fn();
    aiPendingR.current[aiIndex] = p;
    p.then((r) => {
      aiResultR.current[aiIndex] = r;
    });
  };

  // Opponents list for AI[aiIndex] = everyone else (human + other AIs)
  const opponentsFor = (aiIndex: number, hSt: GameState, aSts: GameState[]): GameState[] => {
    const opps: GameState[] = [hSt];
    aSts.forEach((s, i) => {
      if (i !== aiIndex) opps.push(s);
    });
    return opps;
  };

  // ── Reveal one AI's passive move (used when AI is non-active) ──
  type RevealResult = { human: GameState; ais: GameState[] };
  const revealPassiveAi = useCallback(
    async (
      aiIndex: number,
      latestHuman: GameState,
      latestAis: GameState[],
      prefix: string
    ): Promise<RevealResult | null> => {
      let result = aiResultR.current[aiIndex];
      if (!result) {
        setPhase("ai_thinking");
        result = await aiPendingR.current[aiIndex]!;
      }
      aiPendingR.current[aiIndex] = null;
      aiResultR.current[aiIndex] = null;
      const move = result.move;
      const newAi = move ? applyPassive(latestAis[aiIndex], move) : latestAis[aiIndex];

      if (move) {
        const r = ROW_BY_COLOR[move.color];
        addLog(turn + 1, `${aiLabel(aiIndex, numAI)} ${prefix}: ${r.numbers[move.idx]} ${move.color}`);
        setAiHL({ aiIndex, color: move.color, idx: move.idx });
        setPhase("ai_show");
        await new Promise((r) => setTimeout(r, 800));
        setAiHL(null);
        const merged = [...latestAis];
        merged[aiIndex] = newAi;
        setAiStates(merged);
        latestAis = merged;
      } else {
        addLog(turn + 1, `${aiLabel(aiIndex, numAI)} ${prefix}: skip`);
      }

      // Sync locks across everyone
      const synced = syncLocksAll([latestHuman, ...latestAis]);
      const newHuman = synced[0];
      const newAis = synced.slice(1);
      if (newHuman !== latestHuman) setHumanState(newHuman);
      if (newAis.some((s, i) => s !== latestAis[i])) setAiStates(newAis);
      if (result.total > 0)
        setWinProb({
          aiWin: result.wins / result.total,
          draw: result.draws / result.total,
          humanWin: result.losses / result.total,
        });
      if (isGameOver([newHuman, ...newAis])) {
        endGame();
        return null;
      }
      return { human: newHuman, ais: newAis };
    },
    [turn, numAI]
  );

  // Reveal passives for every AI in `passiveAis` sequentially.
  const revealPassivesSequentially = useCallback(
    async (
      passiveAis: number[],
      startHuman: GameState,
      startAis: GameState[]
    ): Promise<RevealResult | null> => {
      let curHuman = startHuman;
      let curAis = startAis;
      for (const aiIndex of passiveAis) {
        const res = await revealPassiveAi(aiIndex, curHuman, curAis, "passive");
        if (!res) return null;
        curHuman = res.human;
        curAis = res.ais;
      }
      return { human: curHuman, ais: curAis };
    },
    [revealPassiveAi]
  );

  // ── Kick off MCTS for everyone non-active at the start of a roll ──
  const startHumanTurnMcts = useCallback(
    (fd: Dice) => {
      const s = cfgR.current;
      // Every AI computes its passive move
      aiStates.forEach((aiSt, i) => {
        const opps = opponentsFor(i, humanState, aiStates);
        startAi(i, () => mctsPassive(aiSt, opps, fd.w1 + fd.w2, s.passiveSims, s.ucbC));
      });
      setPhase("p_white");
    },
    [aiStates, humanState]
  );

  const startAiTurnMcts = useCallback(
    (fd: Dice, activeAi: number) => {
      activeAiDiceR.current = fd;
      activeAiMidR.current = null;
      activeAiPlayedWhiteR.current = false;
      const s = cfgR.current;
      const activeOpps = opponentsFor(activeAi, humanState, aiStates);
      startAi(activeAi, () => mctsWhite(aiStates[activeAi], activeOpps, fd.w1 + fd.w2, s.activeSims, s.ucbC));
      // Other AIs compute passive
      aiStates.forEach((aiSt, i) => {
        if (i === activeAi) return;
        const opps = opponentsFor(i, humanState, aiStates);
        startAi(i, () => mctsPassive(aiSt, opps, fd.w1 + fd.w2, s.passiveSims, s.ucbC));
      });
      setPhase("p_passive_white");
    },
    [aiStates, humanState]
  );

  // ── Reveal active AI's white move (no animation skip for now) ──
  const revealActiveAiWhite = useCallback(
    async (
      activeAi: number,
      latestHuman: GameState,
      latestAis: GameState[]
    ): Promise<RevealResult | null> => {
      let result = aiResultR.current[activeAi];
      if (!result) {
        setPhase("ai_thinking");
        result = await aiPendingR.current[activeAi]!;
      }
      aiPendingR.current[activeAi] = null;
      aiResultR.current[activeAi] = null;
      const move = result.move;
      activeAiPlayedWhiteR.current = !!move;
      const newAi = move ? applyPassive(latestAis[activeAi], move) : latestAis[activeAi];

      if (move) {
        const r = ROW_BY_COLOR[move.color];
        addLog(turn + 1, `${aiLabel(activeAi, numAI)} active(w): ${r.numbers[move.idx]} ${move.color}`);
        setAiHL({ aiIndex: activeAi, color: move.color, idx: move.idx });
        setPhase("ai_show");
        await new Promise((r) => setTimeout(r, 800));
        setAiHL(null);
        const merged = [...latestAis];
        merged[activeAi] = newAi;
        setAiStates(merged);
        latestAis = merged;
      } else {
        addLog(turn + 1, `${aiLabel(activeAi, numAI)} active(w): skip`);
      }
      const synced = syncLocksAll([latestHuman, ...latestAis]);
      const newHuman = synced[0];
      const newAis = synced.slice(1);
      if (newHuman !== latestHuman) setHumanState(newHuman);
      if (newAis.some((s, i) => s !== latestAis[i])) setAiStates(newAis);
      if (result.total > 0)
        setWinProb({
          aiWin: result.wins / result.total,
          draw: result.draws / result.total,
          humanWin: result.losses / result.total,
        });
      if (isGameOver([newHuman, ...newAis])) {
        endGame();
        return null;
      }
      return { human: newHuman, ais: newAis };
    },
    [turn, numAI]
  );

  // ── Active AI color phase ──
  const doActiveAiColor = useCallback(
    async (activeAi: number, latestHuman: GameState, latestAis: GameState[]) => {
      const s = cfgR.current;
      const midAi = activeAiMidR.current || latestAis[activeAi];
      const fd = activeAiDiceR.current;
      if (!fd) {
        nextTurn(latestHuman, latestAis);
        return;
      }
      setPhase("ai_thinking");
      const didW = activeAiPlayedWhiteR.current;
      const opps = opponentsFor(activeAi, latestHuman, latestAis);
      const result = await mctsColor(midAi, opps, fd, s.colorSims, s.ucbC, didW);
      const move = result.move;
      let finalAi = midAi;

      if (move) {
        finalAi = doMark(midAi, move.color, move.idx);
        const r = ROW_BY_COLOR[move.color];
        addLog(turn + 1, `${aiLabel(activeAi, numAI)} active(c): ${r.numbers[move.idx]} ${move.color}`);
        setAiHL({ aiIndex: activeAi, color: move.color, idx: move.idx });
        setPhase("ai_show");
        await new Promise((r) => setTimeout(r, 800));
        setAiHL(null);
      } else if (!didW) {
        finalAi = { ...midAi, penalties: midAi.penalties + 1 };
        addLog(turn + 1, `${aiLabel(activeAi, numAI)} active: skip(−5)`);
      }

      const mergedAis = [...latestAis];
      mergedAis[activeAi] = finalAi;
      const synced = syncLocksAll([latestHuman, ...mergedAis]);
      const newHuman = synced[0];
      const newAis = synced.slice(1);
      setAiStates(newAis);
      if (newHuman !== latestHuman) setHumanState(newHuman);
      if (result.total > 0)
        setWinProb({
          aiWin: result.wins / result.total,
          draw: result.draws / result.total,
          humanWin: result.losses / result.total,
        });
      if (isGameOver([newHuman, ...newAis])) {
        endGame();
        return;
      }
      activeAiMidR.current = null;
      nextTurn(newHuman, newAis);
    },
    [turn, numAI, nextTurn]
  );

  // After the human plays their passive (or skips) on an AI's active turn:
  // reveal active AI's white, then other AIs' passive, then active AI's color.
  const finishAiActiveTurn = useCallback(
    async (activeAi: number, latestHuman: GameState, latestAis: GameState[]) => {
      const whiteRes = await revealActiveAiWhite(activeAi, latestHuman, latestAis);
      if (!whiteRes) return;
      activeAiMidR.current = whiteRes.ais[activeAi];
      // Reveal each other AI's passive
      const otherAis = whiteRes.ais.map((_, i) => i).filter((i) => i !== activeAi);
      const passiveRes = await revealPassivesSequentially(otherAis, whiteRes.human, whiteRes.ais);
      if (!passiveRes) return;
      doActiveAiColor(activeAi, passiveRes.human, passiveRes.ais);
    },
    [revealActiveAiWhite, revealPassivesSequentially, doActiveAiColor]
  );

  // ── Human action handlers ──
  const handleMark = (c: Color, i: number) => {
    if (over) return;
    if (isWO(c, i)) {
      const newHuman = doMark(humanState, c, i);
      const synced = syncLocksAll([newHuman, ...aiStates]);
      const sHuman = synced[0];
      const sAis = synced.slice(1);
      setHumanState(sHuman);
      setAiStates(sAis);
      setUsedW(true);
      if (isGameOver([sHuman, ...sAis])) {
        endGame();
        return;
      }
      // Reveal each AI's passive move
      const allAiIndices = sAis.map((_, idx) => idx);
      revealPassivesSequentially(allAiIndices, sHuman, sAis).then((res) => {
        if (res) setPhase("p_color");
      });
    } else if (isCO(c, i)) {
      const newHuman = doMark(humanState, c, i);
      const synced = syncLocksAll([newHuman, ...aiStates]);
      const sHuman = synced[0];
      const sAis = synced.slice(1);
      setHumanState(sHuman);
      setAiStates(sAis);
      setUsedC(true);
      if (isGameOver([sHuman, ...sAis])) {
        endGame();
        return;
      }
      nextTurn(sHuman, sAis);
    } else if (isPO(c, i)) {
      const newHuman = doMark(humanState, c, i);
      const synced = syncLocksAll([newHuman, ...aiStates]);
      const sHuman = synced[0];
      const sAis = synced.slice(1);
      setHumanState(sHuman);
      setAiStates(sAis);
      if (isGameOver([sHuman, ...sAis])) {
        endGame();
        return;
      }
      if (activeAiIdx >= 0) finishAiActiveTurn(activeAiIdx, sHuman, sAis);
    }
  };

  const skipW = () => {
    const allAiIndices = aiStates.map((_, idx) => idx);
    revealPassivesSequentially(allAiIndices, humanState, aiStates).then((res) => {
      if (res) setPhase("p_color");
    });
  };
  const skipC = () => {
    const newHuman: GameState =
      !usedW && !usedC ? { ...humanState, penalties: humanState.penalties + 1 } : humanState;
    setHumanState(newHuman);
    if (isGameOver([newHuman, ...aiStates])) {
      endGame();
      return;
    }
    nextTurn(newHuman, aiStates);
  };
  const skipP = () => {
    if (activeAiIdx >= 0) finishAiActiveTurn(activeAiIdx, humanState, aiStates);
  };

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
        if (isHumanActive) startHumanTurnMcts(fd);
        else startAiTurnMcts(fd, activeAiIdx);
      }
    }, 80);
  }, [isHumanActive, activeAiIdx, rolling, startHumanTurnMcts, startAiTurnMcts]);

  useEffect(() => {
    if (phase === "roll" && !isHumanActive && !rolling && !over && hasStarted.current) {
      const t = setTimeout(handleRoll, 600);
      return () => clearTimeout(t);
    }
    if (phase !== "roll") hasStarted.current = true;
  }, [phase, isHumanActive, rolling, over, handleRoll]);

  const restart = () => {
    setHumanState(blank());
    setAiStates(Array.from({ length: cfg.numAI }, blank));
    setDice(null);
    setPhase("roll");
    setActiveIdx(0);
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
    aiPendingR.current = Array.from<Promise<MctsResult> | null>({ length: cfg.numAI }).fill(null);
    aiResultR.current = Array.from<MctsResult | null>({ length: cfg.numAI }).fill(null);
    activeAiDiceR.current = null;
    activeAiMidR.current = null;
    activeAiPlayedWhiteR.current = false;
  };

  const activeLabel = isHumanActive ? "You" : aiLabel(activeAiIdx, numAI);
  const phaseInfo = (() => {
    switch (phase) {
      case "roll":
        return {
          text: isHumanActive ? "Your turn — roll!" : `🤖 ${activeLabel} rolling...`,
          color: isHumanActive ? "#34d399" : "#a78bfa",
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

  const gameOverResults = useMemo(
    () => [
      { label: "You", score: humanScore, isHuman: true },
      ...aiStates.map((s, i) => ({ label: aiLabel(i, numAI), score: score(s), isHuman: false })),
    ],
    [humanScore, aiStates, numAI]
  );

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

      {showCfg && <MctsSettingsPanel cfg={cfg} onChange={setCfg} currentGameNumAI={numAI} />}
      {showRules && <RulesPanel />}

      <div style={{ marginBottom: 8, width: "100%", maxWidth: 400 }}>
        <ScoreBar humanScore={humanScore} leadingAiScore={leadingAiScore} />
        {winProb && <WinProbBar prob={winProb} />}
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
        {displayedDice ? (
          <>
            <div style={{ display: "flex", gap: 5, flexWrap: "wrap", justifyContent: "center" }}>
              <Die value={displayedDice.w1} bg="#78716c" spin={rolling} />
              <Die value={displayedDice.w2} bg="#78716c" spin={rolling} />
              <Die value={displayedDice.red} bg="#DC2626" spin={rolling} />
              <Die value={displayedDice.yellow} bg="#CA8A04" spin={rolling} />
              <Die value={displayedDice.green} bg="#16A34A" spin={rolling} />
              <Die value={displayedDice.blue} bg="#2563EB" spin={rolling} />
            </div>
            {!rolling && dice && (
              <div style={{ color: "#94a3b8", fontSize: 10 }}>
                White: <strong style={{ color: "#fff" }}>{ws}</strong>
              </div>
            )}
          </>
        ) : (
          <div style={{ color: "#64748b", fontSize: 12 }}>
            {turn === 0 ? "Roll to start!" : isHumanActive ? "Your turn — roll!" : `${activeLabel}'s turn...`}
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
          {phase === "roll" && !over && isHumanActive && (
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
                color: phaseInfo.color,
                fontSize: 11,
                fontWeight: 600,
                animation: phase === "ai_thinking" ? "throb 1s infinite" : "none",
              }}
            >
              {phaseInfo.text}
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

      <Board
        state={humanState}
        label="You"
        isAI={false}
        active={isHumanActive && phase !== "roll" && phase !== "done"}
        highlight={null}
        onCellClick={handleMark}
        isOption={humanIsOption}
        isPreview={humanIsPreview}
      />
      <div
        style={{
          width: "80%",
          maxWidth: 400,
          height: 1,
          background: "rgba(255,255,255,0.08)",
          margin: "6px 0",
        }}
      />
      {aiStates.map((aiSt, i) => (
        <Fragment key={i}>
          <Board
            state={aiSt}
            label={aiLabel(i, numAI)}
            isAI={true}
            active={activeAiIdx === i && phase !== "roll" && phase !== "done"}
            highlight={aiHL && aiHL.aiIndex === i ? { color: aiHL.color, idx: aiHL.idx } : null}
            onCellClick={null}
            isOption={null}
            isPreview={null}
          />
          {i < aiStates.length - 1 && (
            <div
              style={{
                width: "80%",
                maxWidth: 400,
                height: 1,
                background: "rgba(255,255,255,0.08)",
                margin: "6px 0",
              }}
            />
          )}
        </Fragment>
      ))}

      <AiLog entries={aiLog} />

      {over && <GameOverBanner results={gameOverResults} onRestart={restart} />}

      <style>{`
        @keyframes pulse{0%,100%{transform:scale(1)}50%{transform:scale(1.07)}}
        @keyframes throb{0%,100%{opacity:1}50%{opacity:0.4}}
        @keyframes subtlePulse{0%,100%{opacity:0.7}50%{opacity:1}}
        button:hover:not(:disabled){filter:brightness(1.1)}
      `}</style>
    </div>
  );
}
