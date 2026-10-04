import React from 'react';
import type { GridSize } from '../types';

interface ControlsProps {
  gridSize: GridSize;
  onChangeGridSize: (size: GridSize) => void;
}

const SIZE_MAP: Record<number, GridSize> = {
  1: 4,
  2: 6,
  3: 9,
};

const VALUE_MAP: Record<GridSize, number> = {
  4: 1,
  6: 2,
  9: 3,
};

export const Controls: React.FC<ControlsProps> = ({ gridSize, onChangeGridSize }) => {
  const currentSliderVal = VALUE_MAP[gridSize] || 3;

  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseInt(e.target.value, 10);
    const newSize = SIZE_MAP[val];
    if (newSize && newSize !== gridSize) {
      onChangeGridSize(newSize);
    }
  };

  return (
    <div className="controls-container" id="game-controls">
      <div className="slider-wrapper">
        <div className="slider-header">
          <span className="slider-label">Grid Size / Difficulty</span>
          <span className="slider-current-badge">{gridSize}×{gridSize}</span>
        </div>
        <div className="slider-track-container">
          <input
            id="grid-size-slider"
            type="range"
            min="1"
            max="3"
            step="1"
            value={currentSliderVal}
            onChange={handleSliderChange}
            className="grid-slider"
            aria-label="Grid size slider"
          />
        </div>
        <div className="slider-ticks">
          <button
            type="button"
            className={`slider-tick ${gridSize === 4 ? 'active' : ''}`}
            onClick={() => onChangeGridSize(4)}
          >
            4×4
          </button>
          <button
            type="button"
            className={`slider-tick ${gridSize === 6 ? 'active' : ''}`}
            onClick={() => onChangeGridSize(6)}
          >
            6×6
          </button>
          <button
            type="button"
            className={`slider-tick ${gridSize === 9 ? 'active' : ''}`}
            onClick={() => onChangeGridSize(9)}
          >
            9×9
          </button>
        </div>
      </div>
    </div>
  );
};
