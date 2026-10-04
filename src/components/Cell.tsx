import React from 'react';

interface CellProps {
  row: number;
  col: number;
  value: number;
  isGiven: boolean;
  isSelected: boolean;
  isRelated: boolean;
  isSameValue: boolean;
  isThickRight: boolean;
  isThickBottom: boolean;
  isInWrongColumn?: boolean;
  isWrongCell?: boolean;
  onSelect: (row: number, col: number) => void;
}

export const Cell: React.FC<CellProps> = ({
  row,
  col,
  value,
  isGiven,
  isSelected,
  isRelated,
  isSameValue,
  isThickRight,
  isThickBottom,
  isInWrongColumn,
  isWrongCell,
  onSelect,
}) => {
  const classNames = [
    'sudoku-cell',
    isInWrongColumn ? 'wrong-column' : '',
    isWrongCell ? 'wrong-cell' : '',
    isSelected ? 'selected' : '',
    !isSelected && isSameValue && value !== 0 ? 'same-value' : '',
    !isSelected && !isSameValue && isRelated ? 'related' : '',
    isGiven ? 'given' : 'player-entry',
    isThickRight ? 'border-right-thick' : '',
    isThickBottom ? 'border-bottom-thick' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <button
      type="button"
      className={classNames}
      onClick={() => onSelect(row, col)}
      data-row={row}
      data-col={col}
      data-value={value}
      aria-label={`Cell row ${row + 1}, column ${col + 1}${value ? `, value ${value}` : ', empty'}${isGiven ? ', given' : ''}${isInWrongColumn ? ', in wrong column' : ''}`}
    >
      {value !== 0 ? value : ''}
    </button>
  );
};
