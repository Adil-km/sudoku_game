import type { GridConfig } from '../types';

export function isValidPlacement(
  board: number[][],
  row: number,
  col: number,
  num: number,
  config: GridConfig
): boolean {
  const { size, boxRows, boxCols } = config;

  // Check row
  for (let c = 0; c < size; c++) {
    if (c !== col && board[row][c] === num) {
      return false;
    }
  }

  // Check column
  for (let r = 0; r < size; r++) {
    if (r !== row && board[r][col] === num) {
      return false;
    }
  }

  // Check box
  const startRow = Math.floor(row / boxRows) * boxRows;
  const startCol = Math.floor(col / boxCols) * boxCols;

  for (let r = startRow; r < startRow + boxRows; r++) {
    for (let c = startCol; c < startCol + boxCols; c++) {
      if ((r !== row || c !== col) && board[r][c] === num) {
        return false;
      }
    }
  }

  return true;
}

export function isBoardSolved(board: number[][], config: GridConfig): boolean {
  const { size, boxRows, boxCols } = config;

  // Check if fully filled
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (board[r][c] <= 0 || board[r][c] > size) {
        return false;
      }
    }
  }

  // Validate rows
  for (let r = 0; r < size; r++) {
    const seen = new Set<number>();
    for (let c = 0; c < size; c++) {
      const val = board[r][c];
      if (seen.has(val)) return false;
      seen.add(val);
    }
  }

  // Validate columns
  for (let c = 0; c < size; c++) {
    const seen = new Set<number>();
    for (let r = 0; r < size; r++) {
      const val = board[r][c];
      if (seen.has(val)) return false;
      seen.add(val);
    }
  }

  // Validate boxes
  for (let r = 0; r < size; r += boxRows) {
    for (let c = 0; c < size; c += boxCols) {
      const seen = new Set<number>();
      for (let br = 0; br < boxRows; br++) {
        for (let bc = 0; bc < boxCols; bc++) {
          const val = board[r + br][c + bc];
          if (seen.has(val)) return false;
          seen.add(val);
        }
      }
    }
  }

  return true;
}

export function getValidCandidates(
  board: number[][],
  row: number,
  col: number,
  config: GridConfig
): number[] {
  if (board[row][col] !== 0) return [];
  const candidates: number[] = [];
  for (let num = 1; num <= config.size; num++) {
    if (isValidPlacement(board, row, col, num, config)) {
      candidates.push(num);
    }
  }
  return candidates;
}

