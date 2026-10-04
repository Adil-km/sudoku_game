import type { GridConfig, GridSize } from '../types';

export const GRID_CONFIGS: Record<GridSize, GridConfig> = {
  4: {
    size: 4,
    boxRows: 2,
    boxCols: 2,
    minClues: 8,
    maxClues: 10,
  },
  6: {
    size: 6,
    boxRows: 2,
    boxCols: 3,
    minClues: 16,
    maxClues: 18,
  },
  9: {
    size: 9,
    boxRows: 3,
    boxCols: 3,
    minClues: 30,
    maxClues: 34,
  },
};
