export const ROWS = [
  {
    color: "red",
    numbers: [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
    bg: "#DC2626",
    bgLight: "#FEE2E2",
    text: "#991B1B",
    accent: "#EF4444",
  },
  {
    color: "yellow",
    numbers: [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
    bg: "#EAB308",
    bgLight: "#FEF9C3",
    text: "#854D0E",
    accent: "#FACC15",
  },
  {
    color: "green",
    numbers: [12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2],
    bg: "#16A34A",
    bgLight: "#DCFCE7",
    text: "#166534",
    accent: "#22C55E",
  },
  {
    color: "blue",
    numbers: [12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2],
    bg: "#2563EB",
    bgLight: "#DBEAFE",
    text: "#1E40AF",
    accent: "#3B82F6",
  },
];
export const COLORS = ["red", "yellow", "green", "blue"];
export const SCORE_MAP = [0, 1, 3, 6, 10, 15, 21, 28, 36, 45, 55, 66, 78];
export const PENALTY_PTS = -5;
export const rollDie = () => Math.floor(Math.random() * 6) + 1;
export const rollAll = () => ({
  w1: rollDie(),
  w2: rollDie(),
  red: rollDie(),
  yellow: rollDie(),
  green: rollDie(),
  blue: rollDie(),
});
