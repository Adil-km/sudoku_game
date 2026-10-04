import React, { useState, useEffect } from 'react';
import type { LayaAgentStatus } from '../types';
import { layaService } from '../services/layaService';

interface LayaPanelProps {
  isGameWon: boolean;
}

export const LayaPanel: React.FC<LayaPanelProps> = ({ isGameWon }) => {
  const [status, setStatus] = useState<LayaAgentStatus>(() => layaService.getStatus());
  const [speed, setSpeed] = useState<number>(600);
  const [isExpanded, setIsExpanded] = useState<boolean>(true);

  useEffect(() => {
    const unsubscribe = layaService.subscribe((newStatus) => {
      setStatus(newStatus);
    });
    return unsubscribe;
  }, []);

  const handleStep = async () => {
    if (status.isThinking || status.isAutoPlaying || isGameWon) return;
    await layaService.playStep();
  };

  const handleToggleAutoPlay = () => {
    if (status.isAutoPlaying) {
      layaService.stopAutoPlay();
    } else {
      layaService.startAutoPlay(speed);
    }
  };

  const handleChangeSpeed = (newSpeed: number) => {
    setSpeed(newSpeed);
    layaService.setSpeed(newSpeed);
  };

  const handleReconnect = async () => {
    await layaService.checkHealth();
  };

  const { isOnline, isThinking, isAutoPlaying, health, lastDecision, error } = status;

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
            <div className="laya-title">Laya Local AI</div>
            <div className="laya-subtitle">
              {isOnline
                ? `Ready • ${health?.threads || 8} Threads (${health?.device || 'CPU'})`
                : 'Connecting to port 8000...'}
            </div>
          </div>
        </div>

        <div className="laya-header-actions">
          <span className={`laya-status-pill ${isOnline ? 'online' : 'offline'}`}>
            <span className="laya-status-dot" />
            {isOnline ? 'Online' : 'Offline'}
          </span>
          <button
            type="button"
            className="laya-toggle-btn"
            onClick={() => setIsExpanded((prev) => !prev)}
            title={isExpanded ? 'Collapse panel' : 'Expand panel'}
            aria-label="Toggle Laya details"
          >
            {isExpanded ? '▲' : '▼'}
          </button>
        </div>
      </div>

      {isExpanded && (
        <div className="laya-content">
          {/* Action Buttons */}
          <div className="laya-actions-row">
            <button
              type="button"
              className="laya-btn laya-btn-step"
              onClick={handleStep}
              disabled={!isOnline || isThinking || isAutoPlaying || isGameWon}
              title="Let Laya evaluate the board and make 1 move"
            >
              {isThinking && !isAutoPlaying ? (
                <>
                  <span className="laya-spinner" /> Thinking...
                </>
              ) : (
                <>
                  <span className="btn-icon">⚡</span> Step
                </>
              )}
            </button>

            <button
              type="button"
              className={`laya-btn ${isAutoPlaying ? 'laya-btn-stop' : 'laya-btn-auto'}`}
              onClick={handleToggleAutoPlay}
              disabled={!isOnline || isGameWon}
              title={isAutoPlaying ? 'Pause Laya solver' : 'Let Laya autonomously play and solve the puzzle'}
            >
              {isAutoPlaying ? (
                <>
                  <span className="btn-icon">⏸</span> Pause AI
                </>
              ) : (
                <>
                  <span className="btn-icon">▶</span> Auto-Play
                </>
              )}
            </button>

            <div className="laya-speed-group">
              <button
                type="button"
                className={`speed-chip ${speed === 600 ? 'active' : ''}`}
                onClick={() => handleChangeSpeed(600)}
                title="Normal speed (~600ms)"
              >
                1x
              </button>
              <button
                type="button"
                className={`speed-chip ${speed === 200 ? 'active' : ''}`}
                onClick={() => handleChangeSpeed(200)}
                title="Fast speed (~200ms)"
              >
                2x
              </button>
            </div>
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

          {/* Live Decision Card */}
          {lastDecision && (
            <div className="laya-decision-card">
              <div className="decision-header">
                <span className="decision-target">
                  Placed <strong>{lastDecision.value}</strong> at Row {lastDecision.row + 1}, Col{' '}
                  {lastDecision.col + 1}
                </span>
                <span className="decision-latency">{lastDecision.latencyMs}ms</span>
              </div>

              <div className="decision-meta">
                <span className="meta-item">
                  Confidence: <strong>{Math.round(lastDecision.confidence * 100)}%</strong>
                </span>
                <span className="meta-item">
                  Model: <code>{lastDecision.model}</code>
                </span>
              </div>

              {lastDecision.probabilities && (
                <div className="decision-probs">
                  <div className="probs-label">Laya Candidate Probabilities:</div>
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
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="decision-reasoning">{lastDecision.reasoning}</div>
            </div>
          )}

          {!lastDecision && isOnline && (
            <div className="laya-idle-hint">
              Click <strong>Step</strong> to execute one decision or <strong>Auto-Play</strong> to let
              Laya solve the puzzle.
            </div>
          )}
        </div>
      )}
    </div>
  );
};
