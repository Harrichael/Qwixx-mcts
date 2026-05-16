import { memo } from "react";
import type { WinProb } from "../types";

interface WinProbBarProps {
  prob: WinProb;
}

const WinProbBar = memo(({ prob }: WinProbBarProps) => (
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
      {Math.round(prob.humanWin * 100)}%
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
          width: `${prob.humanWin * 100}%`,
          background: "#22c55e",
          transition: "width 0.3s ease",
        }}
      />
      <div
        style={{
          width: `${prob.draw * 100}%`,
          background: "#64748b",
          transition: "width 0.3s ease",
        }}
      />
      <div
        style={{
          width: `${prob.aiWin * 100}%`,
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
      {Math.round(prob.aiWin * 100)}%
    </span>
  </div>
));

export default WinProbBar;
