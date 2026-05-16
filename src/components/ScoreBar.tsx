import { memo } from "react";

interface ScoreBarProps {
  humanScore: number;
  leadingAiScore: number;
}

const ScoreBar = memo(({ humanScore, leadingAiScore }: ScoreBarProps) => {
  const total = humanScore + leadingAiScore;
  const humanPct = total > 0 ? (humanScore / total) * 100 : 50;
  return (
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
      <span style={{ color: "#34d399", fontWeight: 700, fontSize: 14 }}>👤{humanScore}</span>
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
            width: `${humanPct}%`,
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
      <span style={{ color: "#a78bfa", fontWeight: 700, fontSize: 14 }}>{leadingAiScore}🤖</span>
    </div>
  );
});

export default ScoreBar;
