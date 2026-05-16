import { memo } from "react";
import Cell from "./Cell";
import { SCORE_MAP } from "../constants";
import { countX } from "../game";
import type { Color, GameState, Row } from "../types";

interface BoardRowProps {
  row: Row;
  state: GameState;
  highlight: { color: Color; idx: number } | null;
  onCellClick: ((color: Color, idx: number) => void) | null;
  isOption: ((color: Color, idx: number) => boolean) | null;
  isPreview: ((color: Color, idx: number) => boolean) | null;
}

const BoardRow = memo(
  ({ row, state, highlight, onCellClick, isOption, isPreview }: BoardRowProps) => {
    const locked = state.locked[row.color];
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 2,
          background: locked ? "rgba(255,255,255,0.02)" : "rgba(255,255,255,0.04)",
          borderRadius: 9,
          padding: "3px 5px",
          border: `1.5px solid ${locked ? "rgba(255,255,255,0.03)" : row.bg + "22"}`,
          opacity: locked ? 0.35 : 1,
        }}
      >
        <div
          style={{ width: 5, minHeight: 28, borderRadius: 3, background: row.bg, flexShrink: 0 }}
        />
        <div style={{ display: "flex", gap: 1.5, flex: 1, justifyContent: "center" }}>
          {row.numbers.map((num, idx) => {
            const marked = state.marked[row.color][idx];
            const isHighlighted = !!highlight && highlight.color === row.color && highlight.idx === idx;
            const isOpt = isOption ? isOption(row.color, idx) : false;
            const isPrev = !isOpt && !marked && isPreview ? isPreview(row.color, idx) : false;
            return (
              <Cell
                key={idx}
                num={num}
                idx={idx}
                marked={marked}
                opt={isOpt}
                preview={isPrev}
                hl={isHighlighted}
                bg={row.bg}
                bgLight={row.bgLight}
                text={row.text}
                locked={false}
                onClick={() => onCellClick && onCellClick(row.color, idx)}
              />
            );
          })}
          <div
            style={{
              width: 30,
              height: 30,
              borderRadius: 6,
              fontSize: locked ? 13 : 10,
              fontWeight: 700,
              border: locked ? `2px solid ${row.bg}` : "1px dashed rgba(255,255,255,0.12)",
              background: locked ? row.bg : "rgba(255,255,255,0.02)",
              color: locked ? "#fff" : "rgba(255,255,255,0.2)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontFamily: "inherit",
            }}
          >
            {locked ? "✕" : "🔒"}
          </div>
        </div>
        <div
          style={{
            minWidth: 26,
            textAlign: "center",
            color: row.accent,
            fontSize: 11,
            fontWeight: 700,
            background: "rgba(0,0,0,0.2)",
            borderRadius: 5,
            padding: "2px 1px",
          }}
        >
          {SCORE_MAP[countX(state.marked[row.color]) + (state.marked[row.color][10] ? 1 : 0)] || 0}
        </div>
      </div>
    );
  }
);

export default BoardRow;
