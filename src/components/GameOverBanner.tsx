import { memo } from "react";

interface PlayerResult {
  label: string;
  score: number;
  isHuman: boolean;
}

interface GameOverBannerProps {
  results: PlayerResult[];
  onRestart: () => void;
}

const GameOverBanner = memo(({ results, onRestart }: GameOverBannerProps) => {
  const sorted = [...results].sort((a, b) => b.score - a.score);
  const topScore = sorted[0].score;
  const winners = sorted.filter((r) => r.score === topScore);
  const humanIsWinner = winners.some((r) => r.isHuman);
  const isTie = winners.length > 1;

  let headline: string;
  let textColor: string;
  let bgColor: string;
  let borderColor: string;
  if (isTie) {
    headline = "Tie!";
    textColor = "#fff";
    bgColor = "rgba(255,255,255,0.06)";
    borderColor = "rgba(255,255,255,0.15)";
  } else if (humanIsWinner) {
    headline = "You Win! 🎉";
    textColor = "#34d399";
    bgColor = "rgba(34,197,94,0.1)";
    borderColor = "rgba(34,197,94,0.25)";
  } else {
    headline = `${winners[0].label} Wins! 🤖`;
    textColor = "#c4b5fd";
    bgColor = "rgba(139,92,246,0.1)";
    borderColor = "rgba(139,92,246,0.25)";
  }

  return (
    <div
      style={{
        marginTop: 12,
        textAlign: "center",
        background: bgColor,
        borderRadius: 12,
        padding: 16,
        border: `1px solid ${borderColor}`,
      }}
    >
      <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 4, color: textColor }}>
        {headline}
      </div>
      <div style={{ color: "#cbd5e1", fontSize: 13, marginBottom: 8 }}>
        {sorted.map((r) => `${r.label}: ${r.score}`).join(" — ")}
      </div>
      <button
        onClick={onRestart}
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
  );
});

export default GameOverBanner;
