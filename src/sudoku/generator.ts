import type { GridConfig, GridSize } from '../types';
import { GRID_CONFIGS } from './config';
import { isValidPlacement } from './validator';

export function createEmptyBoard(size: number): number[][] {
  return Array.from({ length: size }, () => Array(size).fill(0));
}

export function cloneBoard(board: number[][]): number[][] {
  return board.map((row) => [...row]);
}

function shuffle<T>(array: T[]): T[] {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export function solveSudoku(
  board: number[][],
  config: GridConfig,
  randomize = false
): boolean {
  const { size } = config;

  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (board[r][c] === 0) {
        let nums = Array.from({ length: size }, (_, i) => i + 1);
        if (randomize) {
          nums = shuffle(nums);
        }

        for (const num of nums) {
          if (isValidPlacement(board, r, c, num, config)) {
            board[r][c] = num;
            if (solveSudoku(board, config, randomize)) {
              return true;
            }
            board[r][c] = 0;
          }
        }
        return false;
      }
    }
  }

  return true;
}

export function countSolutions(
  board: number[][],
  config: GridConfig,
  limit = 2
): number {
  const { size } = config;
  let count = 0;

  function backtrack(r: number, c: number): boolean {
    if (r === size) {
      count++;
      return count >= limit;
    }

    const nextR = c === size - 1 ? r + 1 : r;
    const nextC = c === size - 1 ? 0 : c + 1;

    if (board[r][c] !== 0) {
      return backtrack(nextR, nextC);
    }

    for (let num = 1; num <= size; num++) {
      if (isValidPlacement(board, r, c, num, config)) {
        board[r][c] = num;
        if (backtrack(nextR, nextC)) {
          board[r][c] = 0;
          return true;
        }
        board[r][c] = 0;
      }
    }

    return false;
  }

  backtrack(0, 0);
  return count;
}

export function generateSudoku(gridSize: GridSize): {
  puzzle: number[][];
  solution: number[][];
} {
  const config = GRID_CONFIGS[gridSize];
  const { size, minClues, maxClues } = config;

  // 1. Generate a complete random solution
  const solution = createEmptyBoard(size);
  solveSudoku(solution, config, true);

  // 2. Clone solution to form the puzzle
  const puzzle = cloneBoard(solution);

  // 3. Create all coordinates and shuffle
  const coords: [number, number][] = [];
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      coords.push([r, c]);
    }
  }
  const shuffledCoords = shuffle(coords);

  const targetClues = Math.floor(
    Math.random() * (maxClues - minClues + 1) + minClues
  );
  let currentClues = size * size;

  // 4. Remove numbers while preserving uniqueness
  for (const [r, c] of shuffledCoords) {
    if (currentClues <= targetClues) {
      break;
    }

    const backup = puzzle[r][c];
    puzzle[r][c] = 0;

    const testBoard = cloneBoard(puzzle);
    if (countSolutions(testBoard, config, 2) === 1) {
      currentClues--;
    } else {
      puzzle[r][c] = backup;
    }
  }

  return { puzzle, solution };
}
