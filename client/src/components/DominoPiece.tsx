import React from 'react';
import './DominoPiece.css';

interface Props {
    values: [number, number];
    size?: 'small' | 'medium' | 'large';
    orientation?: 'horizontal' | 'vertical';
    onClick?: () => void;
    disabled?: boolean;
    className?: string; // Add className prop for extra styling if needed
}

export const DominoPiece: React.FC<Props> = ({
    values,
    size = 'medium',
    orientation = 'vertical',
    onClick,
    disabled,
    className = ''
}) => {
    const dots = (val: number) => {
        return (
            <div className={`half val-${val}`}>
                {Array.from({ length: val }).map((_, i) => (
                    <span key={i} className="dot"></span>
                ))}
            </div>
        );
    };

    return (
        <div
            className={`domino-piece ${size} ${orientation} ${disabled ? 'disabled' : ''} ${className}`}
            onClick={!disabled ? onClick : undefined}
        >
            {dots(values[0])}
            <div className="line"></div>
            {dots(values[1])}
        </div>
    );
};
