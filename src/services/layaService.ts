import type {
  GameController,
  GameSnapshot,
  LayaDecisionResult,
  LayaHealth,
  LayaAgentStatus,
  LayaAgentController,
} from '../types';

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
  private autoPlayTimer: ReturnType<typeof setTimeout> | null = null;
  private speed = 600; // ms delay between moves

  private health: LayaHealth | null = null;
  private lastDecision: LayaDecisionResult | null = null;
  private lastError: string | null = null;

  // History stack for backtracking: { row, col, triedValues: number[] }
  private moveHistory: Array<{ row: number; col: number; value: number }> = [];

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
    return {
      isOnline: Boolean(this.health?.ready),
      isThinking: this.isThinking,
      isAutoPlaying: this.isAutoPlaying,
      health: this.health,
      lastDecision: this.lastDecision,
      error: this.lastError,
      speed: this.speed,
    };
  }

  public setSpeed(speedMs: number) {
    this.speed = Math.max(100, speedMs);
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
        // Try fallback endpoint
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
   * Evaluates the current board state and plays one single step via window.gameController
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
      this.isThinking = false;
      this.notify();

      // Check if board was solved with this move
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
    const { gridSize, board, initialBoard } = snapshot;

    // 1. Gather all empty cells and their candidates
    interface EmptyCell {
      row: number;
      col: number;
      candidates: number[];
    }

    const emptyCells: EmptyCell[] = [];
    for (let r = 0; r < gridSize; r++) {
      for (let c = 0; c < gridSize; c++) {
        if (board[r][c] === 0) {
          const candidates = controller.getValidCandidates(r, c);
          emptyCells.push({ row: r, col: c, candidates });
        }
      }
    }

    if (emptyCells.length === 0) {
      throw new Error('No empty cells remaining to play.');
    }

    // Check for contradiction (empty cell with 0 candidates) -> Need backtracking
    const deadEndCell = emptyCells.find((c) => c.candidates.length === 0);
    if (deadEndCell) {
      // Backtrack: Undo last speculative AI move
      if (this.moveHistory.length > 0) {
        const lastMove = this.moveHistory.pop()!;
        controller.clearCell(lastMove.row, lastMove.col);
        return {
          row: lastMove.row,
          col: lastMove.col,
          value: 0,
          candidates: [],
          confidence: 1.0,
          latencyMs: 1,
          model: 'laya-backtracker',
          reasoning: `Contradiction detected at (${deadEndCell.row + 1}, ${deadEndCell.col + 1}). Backtracked and cleared (${lastMove.row + 1}, ${lastMove.col + 1}).`,
        };
      } else {
        throw new Error(`Contradiction at row ${deadEndCell.row + 1}, col ${deadEndCell.col + 1} with no prior AI moves to undo.`);
      }
    }

    // 2. Minimum Remaining Values (MRV) heuristic:
    // Sort cells by candidate count ascending
    emptyCells.sort((a, b) => a.candidates.length - b.candidates.length);

    const targetCell = emptyCells[0];
    const { row, col, candidates } = targetCell;

    // Visual selection in the UI
    controller.selectCell(row, col);

    // If naked single (exactly 1 candidate)
    if (candidates.length === 1) {
      const chosenValue = candidates[0];
      const startTime = performance.now();

      // Quick confirmation with Laya to maintain full AI integration telemetry
      let latencyMs = 0;
      let model = 'laya-rl-agent';
      let confidence = 1.0;

      try {
        const stateDesc = `Sudoku ${gridSize}x${gridSize}. Cell at row ${row + 1}, column ${col + 1} has single valid candidate: ${chosenValue}.`;
        const questions = {
          chosen_digit: {
            type: 'choice',
            instructions: `Confirm placement of digit ${chosenValue} at row ${row + 1}, column ${col + 1}.`,
            criteria: {
              [String(chosenValue)]: `Candidate digit ${chosenValue}`,
            },
          },
        };
        const layaRes = await this.callPredict(stateDesc, questions);
        latencyMs = Math.round(layaRes.latency_ms);
        model = layaRes.result.model || 'laya-rl-agent';
        confidence = layaRes.result.answers.chosen_digit?.confidence ?? 1.0;
      } catch {
        latencyMs = Math.round(performance.now() - startTime);
      }

      controller.setCell(row, col, chosenValue);
      if (initialBoard[row][col] === 0) {
        this.moveHistory.push({ row, col, value: chosenValue });
      }

      return {
        row,
        col,
        value: chosenValue,
        candidates,
        confidence,
        latencyMs,
        model,
        reasoning: `Naked single: only candidate ${chosenValue} satisfies constraints at (${row + 1}, ${col + 1}).`,
        isNakedSingle: true,
      };
    }

    // 3. Multiple candidates: Query Laya's Decision API
    const rowValues = board[row].filter((v) => v !== 0);
    const colValues = board.map((r) => r[col]).filter((v) => v !== 0);

    const criteriaObj: Record<string, string> = {};
    candidates.forEach((cand) => {
      criteriaObj[String(cand)] = `Candidate ${cand} (valid for row ${row + 1}, col ${col + 1})`;
    });

    const promptState = `Sudoku ${gridSize}x${gridSize} grid. Evaluating cell at row ${row + 1}, column ${col + 1}.
Available valid candidates: [${candidates.join(', ')}].
Row ${row + 1} filled digits: [${rowValues.join(', ')}].
Col ${col + 1} filled digits: [${colValues.join(', ')}].
Remaining empty cells: ${emptyCells.length}.
Select the most promising candidate digit to place in this cell.`;

    const questions = {
      chosen_digit: {
        type: 'choice',
        instructions: `Which digit from [${candidates.join(', ')}] should be placed in row ${row + 1}, col ${col + 1}?`,
        criteria: criteriaObj,
      },
    };

    const layaRes = await this.callPredict(promptState, questions);
    const ans = layaRes.result.answers.chosen_digit;

    let chosenDigit = candidates[0];
    if (ans?.choice && candidates.includes(Number(ans.choice))) {
      chosenDigit = Number(ans.choice);
    } else if (ans?.probabilities) {
      // Pick valid candidate with highest probability
      let maxP = -1;
      for (const cand of candidates) {
        const p = ans.probabilities[String(cand)] ?? 0;
        if (p > maxP) {
          maxP = p;
          chosenDigit = cand;
        }
      }
    }

    const latencyMs = Math.round(layaRes.latency_ms);
    const model = layaRes.result.model || 'laya-rl-agent';
    const confidence = ans?.confidence ?? ans?.answer_confidence ?? 0.85;

    // Apply move through safe GameController API
    controller.setCell(row, col, chosenDigit);
    if (initialBoard[row][col] === 0) {
      this.moveHistory.push({ row, col, value: chosenDigit });
    }

    return {
      row,
      col,
      value: chosenDigit,
      candidates,
      confidence,
      probabilities: ans?.probabilities,
      latencyMs,
      model,
      reasoning: `Laya evaluated candidates [${candidates.join(', ')}] and selected ${chosenDigit} with ${Math.round(confidence * 100)}% confidence.`,
    };
  }

  public startAutoPlay(speedMs?: number) {
    if (speedMs) {
      this.setSpeed(speedMs);
    }
    if (this.isAutoPlaying) return;

    this.isAutoPlaying = true;
    this.notify();

    const stepLoop = async () => {
      if (!this.isAutoPlaying) return;

      const result = await this.playStep();
      if (!result || !this.isAutoPlaying) {
        this.stopAutoPlay();
        return;
      }

      const controller = window.gameController;
      if (controller?.getState().isWon) {
        this.stopAutoPlay();
        return;
      }

      this.autoPlayTimer = setTimeout(stepLoop, this.speed);
    };

    stepLoop();
  }

  public stopAutoPlay() {
    this.isAutoPlaying = false;
    if (this.autoPlayTimer) {
      clearTimeout(this.autoPlayTimer);
      this.autoPlayTimer = null;
    }
    this.notify();
  }

  public resetMoveHistory() {
    this.moveHistory = [];
  }

  public createController(): LayaAgentController {
    return {
      checkHealth: () => this.checkHealth(),
      playStep: () => this.playStep(),
      startAutoPlay: (speedMs?: number) => this.startAutoPlay(speedMs),
      stopAutoPlay: () => this.stopAutoPlay(),
      isAutoPlaying: () => this.isAutoPlaying,
      getStatus: () => this.getStatus(),
      subscribe: (listener: (status: LayaAgentStatus) => void) => this.subscribe(listener),
    };
  }
}

export const layaService = new LayaAgentService();
