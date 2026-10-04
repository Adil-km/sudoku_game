# AI & Programmatic Integration Guide

This guide details how AI agents, LLMs, automated solvers, or external scripts can connect to the Sudoku game and interact with it seamlessly without modifying or breaking existing game mechanics.

---

## 1. Integration Architecture

The game provides two integration surfaces:

1. **Browser Runtime Interface (`window.gameController`)**: An interface exposed on the global `window` object when the game is mounted. Any in-browser script, browser subagent, or extension can inspect game state and play moves directly.
2. **Headless Engine Modules (`src/sudoku/`)**: Pure TypeScript/JavaScript modules that can be imported into backend services, CLI runners, or test suites without rendering the React UI.

---

## 2. Browser API: `window.gameController`

Once the web application loads, `window.gameController` is available globally. Its TypeScript interface is defined in `src/types.ts`.

### Methods

#### `getState(): GameSnapshot`
Returns an immutable snapshot of the current game state:

```typescript
const state = window.gameController.getState();
console.log(state);
/*
{
  gridSize: 9,              // 4 | 6 | 9
  board: number[][],        // Current cell values (0 = empty, 1..N = filled)
  initialBoard: number[][], // Given puzzle clues (0 = empty, 1..N = immutable clue)
  selectedCell: { row: number, col: number } | null,
  isWon: boolean,           // true when puzzle is solved
  timer: number             // elapsed seconds
}
*/
```

#### `setCell(row: number, col: number, num: number): boolean`
Places a digit (`1` to `gridSize`) at the specified coordinates (`0`-indexed).
- **Returns**: `true` if the placement was applied; `false` if coordinates are out of bounds, target cell is a given clue, or the game is already won.
- **Side effects**: Updates the board, sets `selectedCell` to `(row, col)`, and automatically triggers victory evaluation.

```typescript
const success = window.gameController.setCell(0, 2, 4);
```

#### `selectCell(row: number, col: number): void`
Sets visual focus and highlights to cell `(row, col)`.

```typescript
window.gameController.selectCell(1, 3);
```

#### `inputNumber(num: number): boolean`
Inputs a number into the currently selected cell.

```typescript
window.gameController.inputNumber(5);
```

#### `clearCell(row?: number, col?: number): boolean`
Erases player input at `(row, col)` (or at `selectedCell` if arguments are omitted).
- **Protection**: Never erases given clues. Returns `false` if target is given or already empty.

```typescript
window.gameController.clearCell(0, 2);
```

#### `newGame(size?: 4 | 6 | 9): void`
Resets the timer and generates a brand-new valid puzzle of the specified size (or current size if omitted).

```typescript
window.gameController.newGame(9); // 4, 6, or 9
```

#### `getValidCandidates(row: number, col: number): number[]`
Returns an array of candidate digits `1..N` that can legally be placed at `(row, col)` without violating row, column, or subgrid rules.
- If cell is already filled, returns `[]`.

```typescript
const candidates = window.gameController.getValidCandidates(0, 1);
// e.g., [2, 5, 8]
```

---

## 3. Headless Engine Modules

If an agent needs to solve puzzles offline, simulate games, or evaluate boards without browser DOM, import directly from `src/sudoku/`:

```typescript
import { generateSudoku, solveSudoku } from './src/sudoku/generator';
import { isBoardSolved, isValidPlacement, getValidCandidates } from './src/sudoku/validator';
import { GRID_CONFIGS } from './src/sudoku/config';

// 1. Generate puzzle
const { puzzle, solution } = generateSudoku(9);

// 2. Validate move legality
const legal = isValidPlacement(puzzle, 0, 0, 5, GRID_CONFIGS[9]);

// 3. Check win condition
const solved = isBoardSolved(puzzle, GRID_CONFIGS[9]);
```

---

## 4. LLM / AI Agent Integration Examples

### Example A: In-Browser LLM Solver Loop
An agent script (e.g. running in browser console, puppeteer, or tampermonkey) can read the board, construct a prompt, query the LLM, and execute the move:

```javascript
async function playNextAIMove() {
  const controller = window.gameController;
  if (!controller) throw new Error("Game not loaded");

  const state = controller.getState();
  if (state.isWon) {
    console.log("Puzzle already completed!");
    return;
  }

  // 1. Find empty cells and candidates
  const emptyCells = [];
  for (let r = 0; r < state.gridSize; r++) {
    for (let c = 0; c < state.gridSize; c++) {
      if (state.board[r][c] === 0) {
        const candidates = controller.getValidCandidates(r, c);
        emptyCells.push({ row: r, col: c, candidates });
      }
    }
  }

  // 2. Format board for LLM prompt
  const prompt = {
    gridSize: state.gridSize,
    board: state.board,
    emptyCellOptions: emptyCells.slice(0, 5) // Send candidates to guide LLM
  };

  // 3. Call LLM endpoint (mocked or actual fetch)
  const response = await fetch('/api/llm-suggest-move', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(prompt)
  });
  const { row, col, value } = await response.json();

  // 4. Safely apply the move
  const played = controller.setCell(row, col, value);
  console.log(`AI played (${row}, ${col}) = ${value}, success: ${played}`);
}
```

### Example B: Non-Deterministic / Heuristic Agent Helper
An agent can implement single-candidate deductions (naked singles) instantly, and prompt an LLM only for branch choices:

```javascript
function findNakedSingle() {
  const { gridSize, board } = window.gameController.getState();
  for (let r = 0; r < gridSize; r++) {
    for (let c = 0; c < gridSize; c++) {
      if (board[r][c] === 0) {
        const candidates = window.gameController.getValidCandidates(r, c);
        if (candidates.length === 1) {
          return { row: r, col: c, value: candidates[0] };
        }
      }
    }
  }
  return null;
}

// Auto-fill single candidate or query model
const single = findNakedSingle();
if (single) {
  window.gameController.setCell(single.row, single.col, single.value);
}
```

---

## 5. Rules for Safe Integration (Do Not Break)

1. **Always use `setCell()` or `inputNumber()`**: Never attempt to directly mutate `state.board` objects; `getState()` returns clones to maintain immutability.
2. **Respect `initialBoard`**: Cells where `initialBoard[r][c] !== 0` are immutable clues. Calls to `setCell()` or `clearCell()` on these coordinates will safely return `false`.
3. **0-Indexed Coordinates**: Rows and columns are always `0` to `gridSize - 1`.
4. **Grid Dimensions**:
   - **4×4**: digits `1..4`, subgrid boxes are $2 \times 2$.
   - **6×6**: digits `1..6`, subgrid boxes are $2 \times 3$ (2 rows, 3 columns).
   - **9×9**: digits `1..9`, subgrid boxes are $3 \times 3$.
5. **No Visual Intrusion**: UI components (`Board`, `Cell`, `Keypad`, `Header`) do not depend on external controller consumers and remain fully functional for manual human gameplay simultaneously.

---

## 6. Laya Local Decision API Integration (`http://127.0.0.1:8000`)

The game integrates directly with the **Laya Local Decision API** server running on port `8000`.

### Architectural Overview

1. **Proxy Routing (`/laya-api`)**:
   - The Vite development server proxies requests from `/laya-api/*` to `http://127.0.0.1:8000/*` to avoid browser cross-origin (CORS) preflight restrictions.
   - If running headless outside the browser, client scripts can also connect directly to `http://127.0.0.1:8000`.

2. **Laya Decision Model (`laya-rl-agent`)**:
   - For each turn, empty cells are prioritized using Minimum Remaining Values (MRV).
   - Valid candidate digits are computed with `getValidCandidates(r, c)`.
   - When evaluating candidates, a typed `choice` question is dispatched to `POST /predict`:
     ```json
     {
       "state": "Sudoku 9x9 grid. Row 2, Col 4. Candidates: [2, 5, 8]. Existing row digits: [1, 3, 4, 7, 9].",
       "questions": {
         "chosen_digit": {
           "type": "choice",
           "instructions": "Which valid candidate number should be placed into row 2, col 4?",
           "criteria": {
             "2": "Candidate 2",
             "5": "Candidate 5",
             "8": "Candidate 8"
           }
         }
       }
     }
     ```
   - Laya returns the selected `choice`, candidate `probabilities`, `confidence`, and `latency_ms`.
   - The move is dispatched via `window.gameController.setCell(row, col, value)`.

3. **Global Browser API (`window.layaAgent`)**:
   In addition to the interactive UI panel, the Laya agent is exposed on `window`:

   - `await window.layaAgent.playStep()`: Evaluates the board with Laya and plays one step.
   - `window.layaAgent.startAutoPlay(speedMs?: number)`: Begins autonomous solving loop.
   - `window.layaAgent.stopAutoPlay()`: Pauses or stops autonomous play.
   - `window.layaAgent.isAutoPlaying()`: Returns boolean status.
   - `window.layaAgent.getStatus()`: Returns current telemetry, model name, confidence, and latency.
   - `await window.layaAgent.checkHealth()`: Pings `/health` and returns CPU thread & readiness info.
