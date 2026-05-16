import type { Color } from "./constants";
export type { Color };

export interface Row {
  color: Color;
  numbers: readonly number[];
  bg: string;
  bgLight: string;
  text: string;
  accent: string;
}

export type Dice = { w1: number; w2: number } & Record<Color, number>;

export interface GameState {
  readonly marked: Readonly<Record<Color, readonly boolean[]>>;
  readonly locked: Readonly<Record<Color, boolean>>;
  readonly penalties: number;
}

export interface Move {
  color: Color;
  idx: number;
}

export interface ActiveMove {
  w: Move | null;
  c: Move | null;
}

export interface RolloutResult {
  ai: number;
  opponents: number[];
}

export interface MctsResult {
  move: Move | null;
  wins: number;
  losses: number;
  draws: number;
  total: number;
}

export interface LiveStats {
  wins: number;
  losses: number;
  draws: number;
  total: number;
}

export type Phase =
  | "roll"
  | "p_white"
  | "p_color"
  | "p_passive_white"
  | "ai_thinking"
  | "ai_show"
  | "done";

export type Player = "human" | "ai";

// activeIndex 0 = human, 1..N = AI players[index - 1]
export type ActiveIndex = number;

export interface WinProb {
  aiWin: number;
  draw: number;
  humanWin: number;
}

export interface AiHighlight {
  aiIndex: number;
  color: Color;
  idx: number;
}

export interface MctsConfig {
  activeSims: number;
  colorSims: number;
  passiveSims: number;
  ucbC: number;
  manual: boolean;
  numAI: number;
}
