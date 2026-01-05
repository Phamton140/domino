import React, { useEffect, useRef } from 'react';
import { DominoPiece } from './DominoPiece';
import type { Piece } from '../types';
import './DominoBoard.css';

interface BoardItem {
    piece: Piece;
}

interface Props {
    board: BoardItem[];
}

export const DominoBoard: React.FC<Props> = ({ board }) => {
    const scrollContainerRef = useRef<HTMLDivElement>(null);

    // Auto-scroll to center/end when board changes
    useEffect(() => {
        if (scrollContainerRef.current) {
            // Auto-scroll to right
            const container = scrollContainerRef.current;
            container.scrollLeft = container.scrollWidth;
        }
    }, [board]);

    if (board.length === 0) {
        return (
            <div className="domino-board empty">
                <div className="empty-message">Esperando jugada inicial...</div>
            </div>
        );
    }

    return (
        <div className="domino-board" ref={scrollContainerRef}>
            <div className="pieces-container">
                {board.map((item, i) => {
                    const isDouble = item.piece[0] === item.piece[1];
                    return (
                        <DominoPiece
                            key={i}
                            values={item.piece}
                            orientation={isDouble ? "vertical" : "horizontal"}
                            disabled
                            className="board-piece"
                        />
                    );
                })}
            </div>
        </div>
    );
};
