import type {
  GameController,
  GameSnapshot,
  GridSize,
  LayaDecisionResult,
  LayaHealth,
  LayaAgentStatus,
  LayaAgentController,
} from '../types';
import { GRID_CONFIGS } from '../sudoku/config';
import { cloneBoard, solveSudoku } from '../sudoku/generator';
import { getValidCandidates, isBoardSolved, isValidPlacement } from '../sudoku/validator';

interface PredictResponse {
  result: {
    model: string;
    answers: Record<
      string,
      {
        type: string;
        choice?: string;
        probabilities?: Record<string, number>;
        confidence?: number;
        answer_confidence?: number;
      }
    >;
  };
  latency_ms: number;
}

interface PrefetchedDecision {
  decision: LayaDecisionResult;
  nextBoard: number[][];
  targetRow: number;
  targetCol: number;
}

export class LayaAgentService {
  private primaryUrl = import.meta.env.VITE_LAYA_PROXY_PATH || '/laya-api';
  private directUrl = import.meta.env.VITE_LAYA_API_URL || 'http://127.0.0.1:8000';
  private activeBaseUrl: string = import.meta.env.VITE_LAYA_PROXY_PATH || '/laya-api';

  private isAutoPlaying = false;
  private isThinking = false;

  private health: LayaHealth | null = null;
  private lastDecision: LayaDecisionResult | null = null;
  private decisionHistory: LayaDecisionResult[] = [];
  private movesCount = 0;
  private lastError: string | null = null;

  // Stored record of cells filled by Laya: coordinate "r-c" -> placed value
  private layaPlacedCells: Map<string, number> = new Map();

  // In-flight parallel prefetch promise for the upcoming move
  private prefetchPromise: Promise<PrefetchedDecision | null> | null = null;

  private listeners: Set<(status: LayaAgentStatus) => void> = new Set();

  constructor() {
    this.checkHealth().then(() => {
      setTimeout(() => this.prefetchForCurrentBoard(), 50);
    });
  }

  public subscribe(listener: (status: LayaAgentStatus) => void): () => void {
    this.listeners.add(listener);
    listener(this.getStatus());
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify() {
    const status = this.getStatus();
    this.listeners.forEach((listener) => {
      try {
        listener(status);
      } catch (err) {
        console.error('LayaAgent subscriber error:', err);
      }
    });
  }

  public getStatus(): LayaAgentStatus {
    const controller = window.gameController;
    const snapshot = controller?.getState();
    let filledCount = 0;
    const totalCells = snapshot ? snapshot.gridSize * snapshot.gridSize : 81;

    if (snapshot) {
      for (let r = 0; r < snapshot.gridSize; r++) {
        for (let c = 0; c < snapshot.gridSize; c++) {
          if (snapshot.board[r][c] !== 0) filledCount++;
        }
      }
    }

    return {
      isOnline: Boolean(this.health?.ready),
      isThinking: this.isThinking,
      isAutoPlaying: this.isAutoPlaying,
      health: this.health,
      lastDecision: this.lastDecision,
      decisionHistory: this.decisionHistory,
      movesCount: this.movesCount,
      filledCount,
      totalCells,
      error: this.lastError,
    };
  }

  public clearHistory() {
    this.decisionHistory = [];
    this.movesCount = 0;
    this.lastDecision = null;
    this.prefetchPromise = null;
    this.layaPlacedCells.clear();
    this.notify();
  }

  public async checkHealth(): Promise<LayaHealth | null> {
    const endpoints = [this.primaryUrl, this.directUrl];

    for (const base of endpoints) {
      try {
        const res = await fetch(`${base}/health`, {
          method: 'GET',
          headers: { Accept: 'application/json' },
          signal: AbortSignal.timeout(3000),
        });

        if (res.ok) {
          const data: LayaHealth = await res.json();
          this.activeBaseUrl = base;
          this.health = data;
          this.lastError = null;
          this.notify();
          return data;
        }
      } catch {
        // Fallback endpoint
      }
    }

    this.health = null;
    this.lastError = `Could not connect to Laya server at ${this.directUrl}`;
    this.notify();
    return null;
  }

  private async callPredict(
    state: string,
    questions: Record<string, unknown>
  ): Promise<PredictResponse> {
    const payload = {
      state,
      questions,
    };

    const res = await fetch(`${this.activeBaseUrl}/predict`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Laya API error (${res.status}): ${errText}`);
    }

    return (await res.json()) as PredictResponse;
  }

  /**
   * Computes the decision for a given board state via Laya's API.
   * Tracks Laya-placed cells to distinguish them from user-placed numbers,
   * checking empty cells AND correcting wrong user-filled entries.
   */
  private async computeLayaDecisionForBoard(
    board: number[][],
    initialBoard: number[][],
    gridSize: GridSize
  ): Promise<PrefetchedDecision | null> {
    const config = GRID_CONFIGS[gridSize];

    // 1. Separate cells into Laya-verified vs user-filled to detect wrong user entries
    const cleanBoard = cloneBoard(board);
    const wrongUserCells: { row: number; col: number; wrongVal: number }[] = [];

    for (let r = 0; r < gridSize; r++) {
      for (let c = 0; c < gridSize; c++) {
        // Check cells that are non-zero and not initial clues
        if (initialBoard[r][c] === 0 && board[r][c] !== 0) {
          const wasPlacedByLaya = this.layaPlacedCells.get(`${r}-${c}`) === board[r][c];
          if (!wasPlacedByLaya) {
            // User filled this cell! Check if it is legal and solvable
            const temp = cloneBoard(cleanBoard);
            temp[r][c] = 0;
            const isLegal = isValidPlacement(temp, r, c, board[r][c], config);
            const isSolvable = isLegal && solveSudoku(cloneBoard(cleanBoard), config);

            if (!isSolvable) {
              wrongUserCells.push({ row: r, col: c, wrongVal: board[r][c] });
              cleanBoard[r][c] = 0; // Clear on clean working board so other cells can evaluate valid candidates!
            }
          }
        }
      }
    }

    // 2. Collect candidate cells (both empty cells and wrong user cells that need correction)
    interface TargetCell {
      row: number;
      col: number;
      candidates: number[];
      isUserCorrection: boolean;
      previousWrongValue?: number;
    }

    const candidateCells: TargetCell[] = [];

    for (let r = 0; r < gridSize; r++) {
      for (let c = 0; c < gridSize; c++) {
        if (cleanBoard[r][c] === 0) {
          const cands = getValidCandidates(cleanBoard, r, c, config);
          if (cands.length > 0) {
            const wrongCellInfo = wrongUserCells.find((wc) => wc.row === r && wc.col === c);
            candidateCells.push({
              row: r,
              col: c,
              candidates: cands,
              isUserCorrection: Boolean(wrongCellInfo),
              previousWrongValue: wrongCellInfo?.wrongVal,
            });
          }
        }
      }
    }

    if (candidateCells.length === 0) {
      return null;
    }

    // Prioritize correcting wrong user entries first, then fewest candidates (MRV)
    candidateCells.sort((a, b) => {
      if (a.isUserCorrection && !b.isUserCorrection) return -1;
      if (!a.isUserCorrection && b.isUserCorrection) return 1;
      return a.candidates.length - b.candidates.length;
    });

    const target = candidateCells[0];
    const { row, col } = target;

    // Filter candidates for target cell to ensure mathematical solvability
    let validCandidates = target.candidates;
    if (validCandidates.length > 1) {
      const solvable = validCandidates.filter((cand) => {
        const testBoard = cloneBoard(cleanBoard);
        testBoard[row][col] = cand;
        return solveSudoku(testBoard, config);
      });
      if (solvable.length > 0) {
        validCandidates = solvable;
      }
    }

    const rowValues = cleanBoard[row].filter((v) => v !== 0);
    const colValues = cleanBoard.map((r) => r[col]).filter((v) => v !== 0);

    const boxRow = Math.floor(row / config.boxRows);
    const boxCol = Math.floor(col / config.boxCols);
    const boxIndex = boxRow * (config.size / config.boxCols) + boxCol + 1;

    // Fast, token-efficient prompt for Laya
    const stateDesc = `Sudoku R${row + 1}C${col + 1} (Box ${boxIndex}). Candidates: [${validCandidates.join(',')}]. Row filled: [${rowValues.join(',')}]. Col filled: [${colValues.join(',')}]. Remaining: ${candidateCells.length}.${target.isUserCorrection ? ` (Correcting user entry: ${target.previousWrongValue})` : ''}`;

    const criteriaObj: Record<string, string> = {};
    validCandidates.forEach((cand) => {
      criteriaObj[String(cand)] = `Candidate ${cand}`;
    });

    const questions = {
      chosen_digit: {
        type: 'choice',
        instructions: `Select digit from [${validCandidates.join(',')}] for row ${row + 1}, col ${col + 1}.`,
        criteria: criteriaObj,
      },
    };

    // Query Laya's Decision API
    const layaRes = await this.callPredict(stateDesc, questions);
    const ans = layaRes.result.answers?.chosen_digit;

    let chosenDigit = validCandidates[0];
    if (ans?.choice && validCandidates.includes(Number(ans.choice))) {
      chosenDigit = Number(ans.choice);
    } else if (ans?.probabilities) {
      let maxP = -1;
      for (const cand of validCandidates) {
        const p = ans.probabilities[String(cand)] ?? 0;
        if (p > maxP) {
          maxP = p;
          chosenDigit = cand;
        }
      }
    }

    const latencyMs = Math.round(layaRes.latency_ms);
    const model = layaRes.result.model || 'laya-rl-agent';
    const confidence = ans?.confidence ?? ans?.answer_confidence ?? 1.0;

    const nextBoard = cloneBoard(cleanBoard);
    nextBoard[row][col] = chosenDigit;

    const reasoning = target.isUserCorrection
      ? `Corrected user entry (${target.previousWrongValue} ➔ ${chosenDigit}) at Row ${row + 1}, Col ${col + 1} with ${Math.round(confidence * 100)}% conf.`
      : `Laya evaluated candidates [${validCandidates.join(', ')}] and chose ${chosenDigit} (${Math.round(confidence * 100)}% conf).`;

    const decision: LayaDecisionResult = {
      row,
      col,
      value: chosenDigit,
      candidates: validCandidates,
      confidence,
      probabilities: ans?.probabilities,
      latencyMs,
      model,
      boxIndex,
      rowValues,
      colValues,
      moveIndex: this.movesCount + 1,
      timestamp: Date.now(),
      reasoning,
    };

    return {
      decision,
      nextBoard,
      targetRow: row,
      targetCol: col,
    };
  }

  /**
   * Prefetches decision for current game board in background.
   */
  public prefetchForCurrentBoard() {
    const controller = window.gameController;
    if (!controller) return;
    const snapshot = controller.getState();
    if (snapshot.isWon) return;

    if (!this.prefetchPromise) {
      this.prefetchPromise = this.computeLayaDecisionForBoard(
        snapshot.board,
        snapshot.initialBoard,
        snapshot.gridSize
      );
    }
  }

  /**
   * Evaluates the current board state and plays one single step via window.gameController using Laya.
   * Tracks Laya responses so it only evaluates empty or user-filled wrong cells.
   */
  public async playStep(customController?: GameController): Promise<LayaDecisionResult | null> {
    const controller = customController || window.gameController;
    if (!controller) {
      this.lastError = 'gameController is not initialized';
      this.notify();
      return null;
    }

    const state: GameSnapshot = controller.getState();
    if (state.isWon) {
      this.stopAutoPlay();
      return null;
    }

    this.isThinking = true;
    this.lastError = null;
    this.notify();

    try {
      // 1. Obtain decision (from parallel prefetch or compute now)
      let prefetched: PrefetchedDecision | null = null;

      if (this.prefetchPromise) {
        prefetched = await this.prefetchPromise;
        // Invalidate prefetch if user manually changed the target cell in between
        if (prefetched) {
          const currentCellVal = state.board[prefetched.targetRow][prefetched.targetCol];
          const wasLayaPlaced = this.layaPlacedCells.get(`${prefetched.targetRow}-${prefetched.targetCol}`) === currentCellVal;
          if (currentCellVal !== 0 && wasLayaPlaced) {
            prefetched = null;
          }
        }
      }

      if (!prefetched) {
        prefetched = await this.computeLayaDecisionForBoard(
          state.board,
          state.initialBoard,
          state.gridSize
        );
      }

      this.prefetchPromise = null;

      if (!prefetched) {
        this.isThinking = false;
        this.notify();
        return null;
      }

      const { decision, nextBoard } = prefetched;

      // 2. PARALLEL TRIGGER: Request the NEXT state immediately in parallel while writing/filling!
      const config = GRID_CONFIGS[state.gridSize];
      if (!isBoardSolved(nextBoard, config)) {
        this.prefetchPromise = this.computeLayaDecisionForBoard(
          nextBoard,
          state.initialBoard,
          state.gridSize
        );
      }

      // 3. Store Laya's response and apply move to the board
      this.layaPlacedCells.set(`${decision.row}-${decision.col}`, decision.value);
      controller.selectCell(decision.row, decision.col);
      controller.setCell(decision.row, decision.col, decision.value);

      this.lastDecision = decision;
      this.movesCount++;
      this.decisionHistory = [decision, ...this.decisionHistory.slice(0, 29)];
      this.isThinking = false;
      this.notify();

      const nextState = controller.getState();
      if (nextState.isWon && this.isAutoPlaying) {
        this.stopAutoPlay();
      }

      return decision;
    } catch (err: unknown) {
      this.isThinking = false;
      this.lastError = err instanceof Error ? err.message : String(err);
      if (this.isAutoPlaying) {
        this.stopAutoPlay();
      }
      this.notify();
      return null;
    }
  }

  /**
   * Starts autonomous play loop using Laya with parallel pipelined execution.
   */
  public async startAutoPlay() {
    if (this.isAutoPlaying) return;

    this.isAutoPlaying = true;
    this.notify();

    while (this.isAutoPlaying) {
      const controller = window.gameController;
      if (!controller) break;

      const state = controller.getState();
      if (state.isWon) {
        break;
      }

      const decision = await this.playStep(controller);
      if (!decision || !this.isAutoPlaying) {
        break;
      }
    }

    this.stopAutoPlay();
  }

  public stopAutoPlay() {
    this.isAutoPlaying = false;
    this.notify();
  }

  public resetMoveHistory() {
    this.prefetchPromise = null;
    this.layaPlacedCells.clear();
    this.clearHistory();
    setTimeout(() => this.prefetchForCurrentBoard(), 50);
  }

  public createController(): LayaAgentController {
    return {
      checkHealth: () => this.checkHealth(),
      playStep: () => this.playStep(),
      startAutoPlay: () => this.startAutoPlay(),
      stopAutoPlay: () => this.stopAutoPlay(),
      isAutoPlaying: () => this.isAutoPlaying,
      clearHistory: () => this.clearHistory(),
      getStatus: () => this.getStatus(),
      subscribe: (listener: (status: LayaAgentStatus) => void) => this.subscribe(listener),
    };
  }
}

export const layaService = new LayaAgentService();
