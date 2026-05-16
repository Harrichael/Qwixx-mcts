import { memo } from "react";
import BoardRow from "./BoardRow";
import { ROWS } from "../constants";
import { score } from "../game";
import type { Color, GameState } from "../types";

interface BoardProps {
  state: GameState;
  label: string;
  isAI: boolean;
  active: boolean;
  highlight: { color: Color; idx: number } | null;
  onCellClick: ((color: Color, idx: number) => void) | null;
  isOption: ((color: Color, idx: number) => boolean) | null;
  isPreview: ((color: Color, idx: number) => boolean) | null;
}

const Board = memo(
  ({
    state,
    label,
    isAI,
    active,
    highlight,
    onCellClick,
    isOption,
    isPreview,
  }: BoardProps) => {
    const accentColor = isAI ? "#8b5cf6" : "#22c55e";
    const accentRgbPrefix = isAI ? "rgba(139,92,246," : "rgba(34,197,94,";
    return (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 3,
          width: "100%",
          maxWidth: 540,
          background: active ? `${accentRgbPrefix}0.08)` : "transparent",
          borderRadius: 12,
          padding: "6px 4px",
          border: active
            ? `1px solid ${accentRgbPrefix}0.25)`
            : "1px solid rgba(255,255,255,0.04)",
          borderLeft: active ? `3px solid ${accentColor}` : "3px solid transparent",
          boxShadow: active ? `0 0 20px ${accentRgbPrefix}0.12)` : "none",
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
                  color: accentColor,
                  fontWeight: 600,
                  background: `${accentRgbPrefix}0.15)`,
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
        {ROWS.map((row) => (
          <BoardRow
            key={row.color}
            row={row}
            state={state}
            highlight={highlight}
            onCellClick={onCellClick}
            isOption={isOption}
            isPreview={isPreview}
          />
        ))}
      </div>
    );
  }
);

export default Board;
