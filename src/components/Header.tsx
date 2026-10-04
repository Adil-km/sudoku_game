import React from 'react';

interface HeaderProps {
  timer: number;
  onNewGame: () => void;
}

export const Header: React.FC<HeaderProps> = ({ timer, onNewGame }) => {
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <header className="header" id="game-header">
      <div className="header-left">
        <h1 className="game-title">Sudoku</h1>
      </div>
      <div className="header-right">
        <div className="timer-badge" id="timer-display" aria-label="Game timer">
          <span className="timer-icon">⏱</span>
          <span className="timer-value">{formatTime(timer)}</span>
        </div>
        <button
          id="btn-new-game"
          className="btn-secondary"
          onClick={onNewGame}
          aria-label="Start new game"
        >
          New Game
        </button>
      </div>
    </header>
  );
};
