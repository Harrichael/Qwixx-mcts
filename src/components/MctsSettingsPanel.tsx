import { memo } from "react";
import Slider from "./Slider";
import type { MctsConfig } from "../types";

const PRESETS = {
  defaults: { activeSims: 10000, colorSims: 3000, passiveSims: 4000, ucbC: 1.41 },
  max: { activeSims: 50000, colorSims: 20000, passiveSims: 15000, ucbC: 1.2 },
  easy: { activeSims: 1000, colorSims: 500, passiveSims: 500, ucbC: 2.0 },
} satisfies Record<string, Omit<MctsConfig, "manual" | "numAI">>;

interface MctsSettingsPanelProps {
  cfg: MctsConfig;
  onChange: (next: MctsConfig) => void;
  currentGameNumAI: number;
}

const MctsSettingsPanel = memo(({ cfg, onChange, currentGameNumAI }: MctsSettingsPanelProps) => {
  const numAIChanged = cfg.numAI !== currentGameNumAI;
  return (
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
        <span style={{ color: "#c4b5fd", fontWeight: 700, fontSize: 12 }}>⚙️ MCTS Settings</span>
        <span style={{ color: "#64748b", fontSize: 9, fontFamily: "monospace" }}>
          v{__APP_VERSION__}
        </span>
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "6px 0",
          borderBottom: "1px solid rgba(255,255,255,0.08)",
        }}
      >
        <Slider
          label="AI players"
          desc={numAIChanged ? "↺ takes effect on Restart" : "Number of AI opponents"}
          value={cfg.numAI}
          min={1}
          max={4}
          step={1}
          onChange={(v) => onChange({ ...cfg, numAI: v })}
        />
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
          onClick={() => onChange({ ...cfg, manual: !cfg.manual })}
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
        onChange={(v) => onChange({ ...cfg, activeSims: v })}
      />
      <Slider
        label="Color sims"
        desc="Color phase sims"
        value={cfg.colorSims}
        min={500}
        max={50000}
        step={500}
        onChange={(v) => onChange({ ...cfg, colorSims: v })}
      />
      <Slider
        label="Passive sims"
        desc="Passive phase sims"
        value={cfg.passiveSims}
        min={500}
        max={20000}
        step={500}
        onChange={(v) => onChange({ ...cfg, passiveSims: v })}
      />
      <Slider
        label="UCB-C"
        desc="Exploration (higher = more)"
        value={cfg.ucbC}
        min={0.5}
        max={5}
        step={0.1}
        onChange={(v) => onChange({ ...cfg, ucbC: v })}
      />
      <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
        <button
          onClick={() => onChange({ ...cfg, ...PRESETS.defaults })}
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
          onClick={() => onChange({ ...cfg, ...PRESETS.max })}
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
          onClick={() => onChange({ ...cfg, ...PRESETS.easy })}
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
  );
});

export default MctsSettingsPanel;
