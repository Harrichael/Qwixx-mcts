import { memo } from "react";

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

export default Cell;
