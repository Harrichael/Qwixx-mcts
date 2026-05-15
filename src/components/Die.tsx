import { memo } from "react";

const Die = memo(({ value, bg, size = 42, spin, selected, onClick }) => (
  <div
    onClick={onClick}
    style={{
      width: size,
      height: size,
      borderRadius: 9,
      background: bg,
      color: "#fff",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      fontSize: size * 0.46,
      fontWeight: 800,
      fontFamily: "inherit",
      boxShadow: selected
        ? `0 0 16px ${bg}, 0 0 4px #fff`
        : spin
          ? "none"
          : `0 3px 8px ${bg}55, inset 0 1px 0 rgba(255,255,255,0.3)`,
      transform: spin
        ? `rotate(${((value * 37) % 30) - 15}deg)`
        : selected
          ? "scale(1.15)"
          : "none",
      border: selected ? "3px solid #fff" : "2px solid rgba(255,255,255,0.2)",
      cursor: onClick ? "pointer" : "default",
      transition: "transform 0.15s, box-shadow 0.15s",
    }}
  >
    {value}
  </div>
));

export default Die;
