export type GridSize = 4 | 6 | 9;

export interface GridConfig {
  size: GridSize;
  boxRows: number;
  boxCols: number;
  minClues: number;
  maxClues: number;
}

export interface CellCoord {
  row: number;
  col: number;
}

export interface CellState {
  row: number;
  col: number;
  value: number;
  isGiven: boolean;
  isSelected: boolean;
  isRelated: boolean;
  isSameValue: boolean;
}

export interface GameSnapshot {
  gridSize: GridSize;
  board: number[][];
  initialBoard: number[][];
  selectedCell: CellCoord | null;
  isWon: boolean;
  timer: number;
}

export interface GameController {
  getState: () => GameSnapshot;
  selectCell: (row: number, col: number) => void;
  inputNumber: (num: number) => boolean;
  setCell: (row: number, col: number, num: number) => boolean;
  clearCell: (row?: number, col?: number) => boolean;
  newGame: (size?: GridSize) => void;
  getValidCandidates: (row: number, col: number) => number[];
}

declare global {
  interface Window {
    gameController?: GameController;
  }
}
