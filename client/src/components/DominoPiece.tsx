import React from 'react';
import './DominoPiece.css';

interface Props {
    values: [number, number];
    size?: 'small' | 'medium' | 'large';
    orientation?: 'horizontal' | 'vertical';
    onClick?: () => void;
    onSelection?: (index: 0 | 1) => void;
    selectionMode?: boolean;
    disabled?: boolean;
    className?: string; // Add className prop for extra styling if needed
}

export const DominoPiece: React.FC<Props> = ({
    values,
    size = 'medium',
    orientation = 'vertical',
    onClick,
    onSelection,
    selectionMode,
    disabled,
    className = ''
}) => {
    const handleHalfClick = (e: React.MouseEvent, index: 0 | 1) => {
        if (selectionMode && onSelection) {
            e.stopPropagation(); // Stop bubbling to main onClick
            onSelection(index);
        }
    };

    const dots = (val: number, index: 0 | 1) => {
        return (
            <div
                className={`half val-${val} ${selectionMode ? 'selection-target' : ''}`}
                onClick={(e) => handleHalfClick(e, index)}
            >
                {Array.from({ length: val }).map((_, i) => (
                    <span key={i} className="dot"></span>
                ))}
            </div>
        );
    };

    return (
        <div
            className={`domino-piece ${size} ${orientation} ${disabled ? 'disabled' : ''} ${className} ${selectionMode ? 'selection-mode' : ''}`}
            onClick={(!disabled && !selectionMode) ? onClick : undefined}
        >
            {dots(values[0], 0)}
            <div className="line"></div>
            {dots(values[1], 1)}
        </div>
    );
};
