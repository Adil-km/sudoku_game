import React from 'react';
import type { GridSize } from '../types';

interface KeypadProps {
  gridSize: GridSize;
  onInputNumber: (num: number) => void;
  onClear: () => void;
  disabled?: boolean;
}

export const Keypad: React.FC<KeypadProps> = ({
  gridSize,
  onInputNumber,
  onClear,
  disabled = false,
}) => {
  const numbers = Array.from({ length: gridSize }, (_, i) => i + 1);

  return (
    <div className="keypad-container" id="numpad-controls">
      <div className="keypad-numbers">
        {numbers.map((num) => (
          <button
            key={num}
            type="button"
            className="keypad-btn"
            onClick={() => onInputNumber(num)}
            disabled={disabled}
            aria-label={`Enter ${num}`}
          >
            {num}
          </button>
        ))}
        <button
          type="button"
          className="keypad-btn keypad-btn-erase"
          onClick={onClear}
          disabled={disabled}
          aria-label="Erase number"
        >
          Erase
        </button>
      </div>
    </div>
  );
};
