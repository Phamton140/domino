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
    const isDragging = useRef(false);
    const startX = useRef(0);
    const scrollLeft = useRef(0);

    // Auto-scroll to end when board changes
    useEffect(() => {
        if (scrollContainerRef.current) {
            const container = scrollContainerRef.current;
            // Smoothly scroll to the very end on new piece (or centered if preferred)
            container.scrollTo({
                left: container.scrollWidth,
                behavior: 'smooth'
            });
        }
    }, [board.length]); // Only trigger on board length change

    // Mouse Events
    const handleMouseDown = (e: React.MouseEvent) => {
        if (!scrollContainerRef.current) return;
        isDragging.current = true;
        startX.current = e.pageX - scrollContainerRef.current.offsetLeft;
        scrollLeft.current = scrollContainerRef.current.scrollLeft;
    };

    const handleMouseLeave = () => {
        isDragging.current = false;
    };

    const handleMouseUp = () => {
        isDragging.current = false;
    };

    const handleMouseMove = (e: React.MouseEvent) => {
        if (!isDragging.current || !scrollContainerRef.current) return;
        e.preventDefault();
        const x = e.pageX - scrollContainerRef.current.offsetLeft;
        const walk = (x - startX.current) * 1.5; // Scroll-fast multiplier
        scrollContainerRef.current.scrollLeft = scrollLeft.current - walk;
    };

    // Touch Events (Mobile)
    const handleTouchStart = (e: React.TouchEvent) => {
        if (!scrollContainerRef.current) return;
        isDragging.current = true;
        startX.current = e.touches[0].pageX - scrollContainerRef.current.offsetLeft;
        scrollLeft.current = scrollContainerRef.current.scrollLeft;
    };

    const handleTouchMove = (e: React.TouchEvent) => {
        if (!isDragging.current || !scrollContainerRef.current) return;
        // Don't prevent default blindly? It might stop other gestures. 
        // But for panning we probably want to own the gesture.
        const x = e.touches[0].pageX - scrollContainerRef.current.offsetLeft;
        const walk = (x - startX.current) * 1.5;
        scrollContainerRef.current.scrollLeft = scrollLeft.current - walk;
    };

    const handleTouchEnd = () => {
        isDragging.current = false;
    };

    if (board.length === 0) {
        return (
            <div className="domino-board empty">
                <div className="empty-message">Esperando jugada inicial...</div>
            </div>
        );
    }

    return (
        <div
            className="domino-board"
            ref={scrollContainerRef}
            onMouseDown={handleMouseDown}
            onMouseLeave={handleMouseLeave}
            onMouseUp={handleMouseUp}
            onMouseMove={handleMouseMove}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
        >
            <div className="pieces-container">
                {board.map((item, i) => {
                    const isDouble = item.piece[0] === item.piece[1];
                    return (
                        <DominoPiece
                            key={i}
                            values={item.piece}
                            orientation={isDouble ? "vertical" : "horizontal"}
                            size="small"
                            disabled
                            className="board-piece"
                        />
                    );
                })}
            </div>
        </div>
    );
};
