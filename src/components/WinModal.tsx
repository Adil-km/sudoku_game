import React from 'react';

interface WinModalProps {
  timeInSeconds: number;
  gridSize: number;
  onNewGame: () => void;
}

export const WinModal: React.FC<WinModalProps> = ({
  timeInSeconds,
  gridSize,
  onNewGame,
}) => {
  const mins = Math.floor(timeInSeconds / 60);
  const secs = timeInSeconds % 60;
  const timeFormatted = `${mins > 0 ? `${mins}m ` : ''}${secs}s`;

  return (
    <div className="modal-backdrop" id="win-modal" role="dialog" aria-modal="true">
      <div className="modal-card">
        <div className="modal-badge">Solved!</div>
        <h2 className="modal-title">{gridSize}×{gridSize} Sudoku Completed</h2>
        <p className="modal-time">
          Time: <strong>{timeFormatted}</strong>
        </p>
        <button
          id="btn-play-again"
          className="btn-primary"
          onClick={onNewGame}
          autoFocus
        >
          Play Again
        </button>
      </div>
    </div>
  );
};
