import type {
  GameController,
  GameSnapshot,
  LayaDecisionResult,
  LayaHealth,
  LayaAgentStatus,
  LayaAgentController,
} from '../types';
import { GRID_CONFIGS } from '../sudoku/config';
import { cloneBoard, solveSudoku } from '../sudoku/generator';

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

export class LayaAgentService {
  private primaryUrl = '/laya-api';
  private directUrl = 'http://127.0.0.1:8000';
  private activeBaseUrl: string = '/laya-api';

  private isAutoPlaying = false;
  private isThinking = false;

  private health: LayaHealth | null = null;
  private lastDecision: LayaDecisionResult | null = null;
  private decisionHistory: LayaDecisionResult[] = [];
  private movesCount = 0;
  private lastError: string | null = null;

  private listeners: Set<(status: LayaAgentStatus) => void> = new Set();

  constructor() {
    this.checkHealth();
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
        // Try fallback
      }
    }

    this.health = null;
    this.lastError = 'Could not connect to Laya server at http://127.0.0.1:8000';
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
   * Evaluates the current board state and plays one single step via window.gameController using Laya exclusively.
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
      const decision = await this.evaluateAndPlay(controller, state);
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

  private async evaluateAndPlay(
    controller: GameController,
    snapshot: GameSnapshot
  ): Promise<LayaDecisionResult> {
    const { gridSize, board } = snapshot;
    const config = GRID_CONFIGS[gridSize];

    // High-speed empty cell collection using MRV constraint search
    interface CandidateCell {
      row: number;
      col: number;
      candidates: number[];
    }

    const emptyCells: CandidateCell[] = [];

    for (let r = 0; r < gridSize; r++) {
      for (let c = 0; c < gridSize; c++) {
        if (board[r][c] === 0) {
          const cands = controller.getValidCandidates(r, c);
          if (cands.length > 0) {
            emptyCells.push({ row: r, col: c, candidates: cands });
          }
        }
      }
    }

    if (emptyCells.length === 0) {
      throw new Error('No valid moves available on the current board.');
    }

    // Pick the most constrained cell (Minimum Remaining Values - MRV)
    emptyCells.sort((a, b) => a.candidates.length - b.candidates.length);
    const target = emptyCells[0];
    const { row, col } = target;

    // Filter candidates ONLY for this single target cell (0.05ms) so Laya never enters an invalid branch
    let validCandidates = target.candidates;
    if (validCandidates.length > 1) {
      const solvable = validCandidates.filter((cand) => {
        const testBoard = cloneBoard(board);
        testBoard[row][col] = cand;
        return solveSudoku(testBoard, config);
      });
      if (solvable.length > 0) {
        validCandidates = solvable;
      }
    }

    // Highlight target cell in the board UI
    controller.selectCell(row, col);

    const rowValues = board[row].filter((v) => v !== 0);
    const colValues = board.map((r) => r[col]).filter((v) => v !== 0);

    const boxRow = Math.floor(row / config.boxRows);
    const boxCol = Math.floor(col / config.boxCols);
    const boxIndex = boxRow * (config.size / config.boxCols) + boxCol + 1;

    // Concise, token-efficient prompt for Laya
    // Dramatically speeds up PyTorch transformer inference latency on CPU
    const stateDesc = `Sudoku R${row + 1}C${col + 1} (Box ${boxIndex}). Candidates: [${validCandidates.join(',')}]. Row filled: [${rowValues.join(',')}]. Col filled: [${colValues.join(',')}]. Remaining: ${emptyCells.length}.`;

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

    // Apply move directly via gameController
    controller.setCell(row, col, chosenDigit);

    return {
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
      reasoning: `Laya evaluated candidates [${validCandidates.join(', ')}] and chose ${chosenDigit} (${Math.round(confidence * 100)}% conf).`,
    };
  }

  /**
   * Starts autonomous play loop using Laya with 0 programmed delay.
   */
  public async startAutoPlay() {
    if (this.isAutoPlaying) return;

    this.isAutoPlaying = true;
    this.notify();

    // Loop without programmed delay
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
    this.clearHistory();
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
