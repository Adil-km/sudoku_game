import React, { useState, useEffect } from 'react';
import type { LayaAgentStatus } from '../types';
import { layaService } from '../services/layaService';

interface LayaPanelProps {
  isGameWon: boolean;
}

export const LayaPanel: React.FC<LayaPanelProps> = ({ isGameWon }) => {
  const [status, setStatus] = useState<LayaAgentStatus>(() => layaService.getStatus());

  useEffect(() => {
    const unsubscribe = layaService.subscribe((newStatus) => {
      setStatus(newStatus);
    });
    return unsubscribe;
  }, []);

  const handleToggleAutoPlay = () => {
    if (status.isAutoPlaying) {
      layaService.stopAutoPlay();
    } else {
      layaService.startAutoPlay();
    }
  };

  const handleReconnect = async () => {
    await layaService.checkHealth();
  };

  const {
    isOnline,
    isAutoPlaying,
    lastDecision,
    movesCount,
    filledCount,
    totalCells,
    error,
  } = status;

  const progressPercent = totalCells > 0 ? Math.round((filledCount / totalCells) * 100) : 0;

  return (
    <div className="laya-panel-container">
      {/* Header bar */}
      <div className="laya-header">
        <div className="laya-title-group">
          <div className="laya-badge-icon">
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
            </svg>
          </div>
          <div>
            <div className="laya-title">Laya Decision AI</div>
          </div>
        </div>
      </div>

      <div className="laya-content">
        {/* Progress Tracker */}
        <div className="laya-progress-card">
          <div className="progress-label-row">
            <span className="progress-title">Puzzle Progress</span>
            <span className="progress-stats">
              {filledCount} / {totalCells} cells ({progressPercent}%)
            </span>
          </div>
          <div className="progress-track">
            <div
              className="progress-fill"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          <div className="progress-meta-row">
            <span className="meta-badge">Moves: <strong>{movesCount}</strong></span>
            {lastDecision && (
              <span className="meta-badge">
                Inference: <strong>{lastDecision.latencyMs}ms</strong>
              </span>
            )}
            <span className="meta-badge">Model: <code>laya-rl-agent</code></span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="laya-actions-row">
          <button
            type="button"
            className={`laya-btn ${isAutoPlaying ? 'laya-btn-stop' : 'laya-btn-auto'}`}
            onClick={handleToggleAutoPlay}
            disabled={!isOnline || isGameWon}
            title={
              isAutoPlaying
                ? 'Pause Laya solver'
                : 'Let Laya autonomously play and solve the puzzle at maximum speed'
            }
          >
            {isAutoPlaying ? (
              <>
                <span className="btn-icon">⏸</span> Pause AI
              </>
            ) : (
              <>
                <span className="btn-icon">▶</span> Laya Auto-Play
              </>
            )}
          </button>
        </div>

        {/* Error notice */}
        {error && (
          <div className="laya-error-banner">
            <span>{error}</span>
            <button type="button" className="laya-retry-btn" onClick={handleReconnect}>
              Retry
            </button>
          </div>
        )}

        {/* Latest Decision Card */}
        {lastDecision ? (
          <div className="laya-decision-card">
            {/* Decision Spotlight */}
            <div className="spotlight-header">
              <div className="spotlight-cell">
                <span className="cell-coord-badge">
                  Row {lastDecision.row + 1}, Col {lastDecision.col + 1}
                </span>
                {lastDecision.boxIndex && (
                  <span className="cell-box-badge">Box {lastDecision.boxIndex}</span>
                )}
              </div>
              <div className="spotlight-action">
                <span className="spotlight-label">Placed:</span>
                <span className="spotlight-value">{lastDecision.value}</span>
              </div>
            </div>

            {/* Performance & Confidence (without Candidates card) */}
            <div className="decision-metrics-grid">
              <div className="metric-box">
                <span className="metric-label">Confidence</span>
                <span className="metric-val confidence-val">
                  {Math.round(lastDecision.confidence * 100)}%
                </span>
              </div>
              <div className="metric-box">
                <span className="metric-label">Server Latency</span>
                <span className="metric-val">{lastDecision.latencyMs} ms</span>
              </div>
            </div>

            {/* Candidate Probability Distribution */}
            {lastDecision.probabilities && (
              <div className="decision-probs">
                <div className="probs-label">Laya Model Probabilities:</div>
                <div className="probs-list">
                  {Object.entries(lastDecision.probabilities).map(([cand, prob]) => {
                    const isChosen = Number(cand) === lastDecision.value;
                    const percentage = Math.round(prob * 100);
                    return (
                      <div key={cand} className={`prob-row ${isChosen ? 'chosen' : ''}`}>
                        <span className="prob-digit">{cand}</span>
                        <div className="prob-bar-track">
                          <div
                            className="prob-bar-fill"
                            style={{ width: `${Math.max(percentage, 5)}%` }}
                          />
                        </div>
                        <span className="prob-percent">{percentage}%</span>
                        {isChosen && <span className="chosen-checkmark">✓</span>}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Constraint Context */}
            <div className="constraints-section">
              <div className="constraints-label">Local Constraint Context:</div>
              <div className="constraints-tags">
                <span className="c-tag">
                  Row digits: [{lastDecision.rowValues?.join(', ') || 'none'}]
                </span>
                <span className="c-tag">
                  Col digits: [{lastDecision.colValues?.join(', ') || 'none'}]
                </span>
              </div>
            </div>

            <div className="decision-reasoning">{lastDecision.reasoning}</div>
          </div>
        ) : (
          <div className="laya-idle-card">
            <div className="idle-icon">💡</div>
            <div className="idle-text">
              Click <strong>▶ Auto-Play</strong> to let Laya make high-speed decisions.
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
