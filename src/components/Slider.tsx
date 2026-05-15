import { memo } from "react";

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

export default Slider;
