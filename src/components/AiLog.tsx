import { memo } from "react";

interface AiLogProps {
  entries: string[];
}

const AiLog = memo(({ entries }: AiLogProps) => {
  if (entries.length === 0) return null;
  return (
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
      <div style={{ color: "#a78bfa", fontSize: 10, fontWeight: 700, marginBottom: 2 }}>🤖 AI log</div>
      {entries.map((entry, i) => (
        <div key={i} style={{ color: "#94a3b8", fontSize: 10, lineHeight: 1.4 }}>
          {entry}
        </div>
      ))}
    </div>
  );
});

export default AiLog;
