import React, { useState, useEffect, useCallback, useRef } from 'react';
import type { GridSize, CellCoord, GameController } from './types';
import { GRID_CONFIGS } from './sudoku/config';
import { generateSudoku, cloneBoard } from './sudoku/generator';
import { isBoardSolved, getValidCandidates } from './sudoku/validator';
import { Header } from './components/Header';
import { Controls } from './components/Controls';
import { Board } from './components/Board';
import { Keypad } from './components/Keypad';
import { WinModal } from './components/WinModal';

interface GameStateData {
  puzzle: number[][];
  board: number[][];
  solution: number[][];
  selectedCell: CellCoord | null;
}

function initGameForSize(size: GridSize): GameStateData {
  const { puzzle, solution } = generateSudoku(size);
  let firstEmpty: CellCoord | null = null;
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (puzzle[r][c] === 0) {
        firstEmpty = { row: r, col: c };
        break;
      }
    }
    if (firstEmpty) break;
  }

  return {
    puzzle,
    board: cloneBoard(puzzle),
    solution,
    selectedCell: firstEmpty || { row: 0, col: 0 },
  };
}

export const App: React.FC = () => {
  const [gridSize, setGridSize] = useState<GridSize>(9);
  const [gameState, setGameState] = useState<GameStateData>(() => initGameForSize(9));
  const [timer, setTimer] = useState<number>(0);
  const [isWon, setIsWon] = useState<boolean>(false);

  const gameStateRef = useRef(gameState);
  const gridSizeRef = useRef(gridSize);
  const isWonRef = useRef(isWon);
  const timerRef = useRef(timer);

  useEffect(() => {
    gameStateRef.current = gameState;
    gridSizeRef.current = gridSize;
    isWonRef.current = isWon;
    timerRef.current = timer;
  }, [gameState, gridSize, isWon, timer]);

  const { puzzle, board, selectedCell } = gameState;

  // Start new game
  const startNewGame = useCallback((size: GridSize) => {
    setGridSize(size);
    setGameState(initGameForSize(size));
    setTimer(0);
    setIsWon(false);
  }, []);

  // Timer counter
  useEffect(() => {
    if (isWon) return;

    const interval = setInterval(() => {
      setTimer((prev) => prev + 1);
    }, 1000);

    return () => clearInterval(interval);
  }, [isWon]);

  // Set cell directly by row and column
  const handleSetCell = useCallback(
    (row: number, col: number, num: number): boolean => {
      if (isWonRef.current) return false;
      const current = gameStateRef.current;
      const size = gridSizeRef.current;
      if (row < 0 || row >= size || col < 0 || col >= size) return false;
      if (current.puzzle[row][col] !== 0) return false;
      if (num < 1 || num > size) return false;

      const newBoard = cloneBoard(current.board);
      newBoard[row][col] = num;
      setGameState((prev) => ({
        ...prev,
        board: newBoard,
        selectedCell: { row, col },
      }));

      if (isBoardSolved(newBoard, GRID_CONFIGS[size])) {
        setIsWon(true);
      }
      return true;
    },
    []
  );

  // Handle cell number input at currently selected cell
  const handleInputNumber = useCallback(
    (num: number): boolean => {
      const current = gameStateRef.current;
      if (!current.selectedCell) return false;
      return handleSetCell(current.selectedCell.row, current.selectedCell.col, num);
    },
    [handleSetCell]
  );

  // Handle cell clear
  const handleClearCell = useCallback((targetRow?: number, targetCol?: number): boolean => {
    if (isWonRef.current) return false;
    const current = gameStateRef.current;
    const size = gridSizeRef.current;
    const row = targetRow ?? current.selectedCell?.row;
    const col = targetCol ?? current.selectedCell?.col;
    if (row === undefined || col === undefined) return false;
    if (row < 0 || row >= size || col < 0 || col >= size) return false;
    if (current.puzzle[row][col] !== 0) return false;

    if (current.board[row][col] !== 0) {
      const newBoard = cloneBoard(current.board);
      newBoard[row][col] = 0;
      setGameState((prev) => ({
        ...prev,
        board: newBoard,
        selectedCell: { row, col },
      }));
      return true;
    }
    return false;
  }, []);

  // Handle cell selection
  const handleSelectCell = useCallback((row: number, col: number) => {
    setGameState((prev) => ({ ...prev, selectedCell: { row, col } }));
  }, []);

  // Handle grid size change
  const handleChangeGridSize = useCallback(
    (newSize: GridSize) => {
      if (newSize === gridSize) return;
      startNewGame(newSize);
    },
    [gridSize, startNewGame]
  );

  // Expose controller interface on window
  useEffect(() => {
    const controller: GameController = {
      getState: () => ({
        gridSize: gridSizeRef.current,
        board: cloneBoard(gameStateRef.current.board),
        initialBoard: cloneBoard(gameStateRef.current.puzzle),
        selectedCell: gameStateRef.current.selectedCell
          ? { ...gameStateRef.current.selectedCell }
          : null,
        isWon: isWonRef.current,
        timer: timerRef.current,
      }),
      selectCell: (row: number, col: number) => {
        handleSelectCell(row, col);
      },
      inputNumber: (num: number) => {
        return handleInputNumber(num);
      },
      setCell: (row: number, col: number, num: number) => {
        return handleSetCell(row, col, num);
      },
      clearCell: (row?: number, col?: number) => {
        return handleClearCell(row, col);
      },
      newGame: (size?: GridSize) => {
        startNewGame(size ?? gridSizeRef.current);
      },
      getValidCandidates: (row: number, col: number) => {
        const { board } = gameStateRef.current;
        const size = gridSizeRef.current;
        return getValidCandidates(board, row, col, GRID_CONFIGS[size]);
      },
    };

    window.gameController = controller;

    return () => {
      if (window.gameController === controller) {
        delete window.gameController;
      }
    };
  }, [handleSelectCell, handleInputNumber, handleSetCell, handleClearCell, startNewGame]);

  // Keyboard navigation & inputs
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isWon) return;

      // Number input (1 to gridSize)
      if (e.key >= '1' && e.key <= String(gridSize)) {
        e.preventDefault();
        handleInputNumber(parseInt(e.key, 10));
        return;
      }

      // Erase / Clear
      if (e.key === 'Backspace' || e.key === 'Delete' || e.key === '0') {
        e.preventDefault();
        handleClearCell();
        return;
      }

      // Arrow navigation
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'w', 'a', 's', 'd'].includes(e.key)) {
        e.preventDefault();
        setGameState((prev) => {
          if (!prev.selectedCell) {
            return { ...prev, selectedCell: { row: 0, col: 0 } };
          }
          let { row, col } = prev.selectedCell;

          if (e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') {
            row = (row - 1 + gridSize) % gridSize;
          } else if (e.key === 'ArrowDown' || e.key === 's' || e.key === 'S') {
            row = (row + 1) % gridSize;
          } else if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') {
            col = (col - 1 + gridSize) % gridSize;
          } else if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') {
            col = (col + 1) % gridSize;
          }

          return { ...prev, selectedCell: { row, col } };
        });
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [gridSize, isWon, handleInputNumber, handleClearCell]);

  return (
    <div className="game-wrapper">
      <main className="game-card">
        <Header timer={timer} onNewGame={() => startNewGame(gridSize)} />

        <Controls
          gridSize={gridSize}
          onChangeGridSize={handleChangeGridSize}
        />

        <div className="board-area">
          <Board
            gridSize={gridSize}
            board={board}
            initialBoard={puzzle}
            selectedCell={selectedCell}
            onSelectCell={handleSelectCell}
          />
        </div>

        <Keypad
          gridSize={gridSize}
          onInputNumber={handleInputNumber}
          onClear={() => handleClearCell()}
          disabled={
            isWon ||
            !selectedCell ||
            Boolean(puzzle && puzzle[selectedCell.row][selectedCell.col] !== 0)
          }
        />
      </main>

      {isWon && (
        <WinModal
          timeInSeconds={timer}
          gridSize={gridSize}
          onNewGame={() => startNewGame(gridSize)}
        />
      )}
    </div>
  );
};

export default App;
