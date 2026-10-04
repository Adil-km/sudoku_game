import React, { useMemo } from 'react';
import type { CellCoord, GridSize } from '../types';
import { GRID_CONFIGS } from '../sudoku/config';
import { Cell } from './Cell';

interface BoardProps {
  gridSize: GridSize;
  board: number[][] | null;
  initialBoard: number[][] | null;
  selectedCell: CellCoord | null;
  onSelectCell: (row: number, col: number) => void;
  solution?: number[][] | null;
}

export const Board: React.FC<BoardProps> = ({
  gridSize,
  board,
  initialBoard,
  selectedCell,
  onSelectCell,
  solution,
}) => {
  const config = GRID_CONFIGS[gridSize];
  const { boxRows, boxCols } = config;

  // Compute wrong columns and wrong cells (conflicts or solution mismatches)
  const { wrongCols, wrongCells } = useMemo(() => {
    const cols = new Set<number>();
    const cells = new Set<string>();

    if (!board) {
      return { wrongCols: cols, wrongCells: cells };
    }

    for (let c = 0; c < gridSize; c++) {
      let isColWrong = false;
      const seenInCol = new Map<number, number>(); // value -> row index

      for (let r = 0; r < gridSize; r++) {
        const val = board[r][c];
        if (val !== 0) {
          // 1. Duplicate number in this column
          if (seenInCol.has(val)) {
            isColWrong = true;
            cells.add(`${r}-${c}`);
            cells.add(`${seenInCol.get(val)}-${c}`);
          } else {
            seenInCol.set(val, r);
          }

          // 2. Value violates the puzzle solution
          if (solution && solution[r] && solution[r][c] !== 0 && val !== solution[r][c]) {
            isColWrong = true;
            cells.add(`${r}-${c}`);
          }
        }
      }

      if (isColWrong) {
        cols.add(c);
      }
    }

    return { wrongCols: cols, wrongCells: cells };
  }, [board, gridSize, solution]);

  if (!board || !initialBoard) {
    return <div className="board-loading">Generating puzzle...</div>;
  }


  const selectedValue =
    selectedCell && board[selectedCell.row]
      ? (board[selectedCell.row]?.[selectedCell.col] ?? 0)
      : 0;

  const selectedBoxR = selectedCell
    ? Math.floor(selectedCell.row / boxRows)
    : -1;
  const selectedBoxC = selectedCell
    ? Math.floor(selectedCell.col / boxCols)
    : -1;

  return (
    <div
      className={`board-container grid-${gridSize}`}
      style={{
        '--grid-size': gridSize,
      } as React.CSSProperties}
      id="sudoku-board"
    >
      {board.map((rowArr, r) =>
        rowArr.map((val, c) => {
          const isGiven = initialBoard[r][c] !== 0;
          const isSelected =
            selectedCell !== null &&
            selectedCell.row === r &&
            selectedCell.col === c;

          const inSameRow = selectedCell !== null && selectedCell.row === r;
          const inSameCol = selectedCell !== null && selectedCell.col === c;
          const inSameBox =
            selectedCell !== null &&
            Math.floor(r / boxRows) === selectedBoxR &&
            Math.floor(c / boxCols) === selectedBoxC;

          const isRelated = inSameRow || inSameCol || inSameBox;
          const isSameValue =
            selectedValue !== 0 && val === selectedValue;

          const isThickRight = (c + 1) % boxCols === 0 && c !== gridSize - 1;
          const isThickBottom = (r + 1) % boxRows === 0 && r !== gridSize - 1;

          const isInWrongColumn = wrongCols.has(c);
          const isWrongCell = wrongCells.has(`${r}-${c}`);

          return (
            <Cell
              key={`${r}-${c}`}
              row={r}
              col={c}
              value={val}
              isGiven={isGiven}
              isSelected={isSelected}
              isRelated={isRelated}
              isSameValue={isSameValue}
              isThickRight={isThickRight}
              isThickBottom={isThickBottom}
              isInWrongColumn={isInWrongColumn}
              isWrongCell={isWrongCell}
              onSelect={onSelectCell}
            />
          );
        })
      )}
    </div>
  );
};
