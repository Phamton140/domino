import React, { useMemo, useRef, useState, useEffect } from 'react';
import { DominoPiece } from './DominoPiece';
import type { Piece } from '../types';
import './DominoBoard.css';

interface Props {
    board: { piece: Piece }[];
}

export const DominoBoard: React.FC<Props> = ({ board }) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const [dim, setDim] = useState({ w: 1200, h: 800 });
    const anchorRef = useRef<Piece | null>(null);

    useEffect(() => {
        if (!containerRef.current) return;
        const observer = new ResizeObserver(entries => {
            const { width, height } = entries[0].contentRect;
            setDim({ w: width, h: height });
        });
        observer.observe(containerRef.current);
        return () => observer.disconnect();
    }, []);

    const positionedPieces = useMemo(() => {
        if (board.length === 0) return [];

        let anchorIndex = -1;

        if (anchorRef.current) {
            anchorIndex = board.findIndex(b =>
                b.piece[0] === anchorRef.current![0] && b.piece[1] === anchorRef.current![1]
            );
        }

        if (anchorIndex === -1) {
            anchorIndex = Math.floor(board.length / 2);
            anchorRef.current = board[anchorIndex].piece;
        }

        const centerPiece = board[anchorIndex];

        const leftChain: { piece: Piece, matchVal: number }[] = [];
        const rightChain: { piece: Piece, matchVal: number }[] = [];

        let previousPiece = centerPiece.piece;
        for (let i = anchorIndex + 1; i < board.length; i++) {
            const p = board[i].piece;
            const matchVal = (p[0] === previousPiece[0] || p[0] === previousPiece[1]) ? p[0] : p[1];
            rightChain.push({ piece: p, matchVal });
            previousPiece = p;
        }

        previousPiece = centerPiece.piece;
        for (let i = anchorIndex - 1; i >= 0; i--) {
            const p = board[i].piece;
            const matchVal = (p[0] === previousPiece[0] || p[0] === previousPiece[1]) ? p[0] : p[1];
            leftChain.push({ piece: p, matchVal });
            previousPiece = p;
        }

        const GAP = 2;
        const MAX_HORIZONTAL = 6;
        const results: any[] = [];

        const centerIsDouble = centerPiece.piece[0] === centerPiece.piece[1];
        const cW = centerIsDouble ? 30 : 60;
        const cH = centerIsDouble ? 60 : 30;

        results.push({
            piece: centerPiece.piece,
            x: -cW / 2, y: -cH / 2,
            width: cW, height: cH,
            orientation: centerIsDouble ? "vertical" : "horizontal",
            isAnchor: true
        });

        const layoutChain = (chain: any[], anchorX: number, anchorY: number, initialDirX: number) => {
            let lastX = anchorX;
            let lastY = anchorY;
            let lastW = cW;
            let lastH = cH;

            let curDirX = initialDirX;
            let curDirY = (initialDirX === 1) ? -1 : 1;

            let state = 0; // 0: Horizontal, 1: Vertical
            let vCount = 0;
            let vHasDouble = false;
            let horzCount = 0;

            // Track state of previous piece to handle transitions
            let lastState = 0;
            let lastIsDouble = centerIsDouble;
            let lastOrientation = centerIsDouble ? "vertical" : "horizontal";

            chain.forEach((item, index) => {
                const { piece, matchVal } = item;
                const isDouble = piece[0] === piece[1];

                // Check Turn Condition (Flexible)
                if (state === 0 && horzCount >= MAX_HORIZONTAL && !isDouble) {
                    state = 1;
                    vCount = 0;
                    vHasDouble = false;
                    horzCount = 0;
                }

                // Determine Orientation & Size
                let orientation: string;
                if (isDouble) {
                    // Doubles are ALWAYS perpendicular to the previous piece
                    orientation = (lastOrientation === "horizontal") ? "vertical" : "horizontal";
                } else {
                    // Normal pieces follow the chain state (0=Horizontal, 1=Vertical)
                    orientation = (state === 0) ? "horizontal" : "vertical";
                }

                const w = (orientation === "horizontal") ? 60 : 30;
                const h = (orientation === "horizontal") ? 30 : 60;

                // Calculate Position (Center-to-Center)
                let pX = 0, pY = 0;
                let renderValues = [...piece];
                let thisState = state;

                if (state === 0) {
                    // Horizontal Flow
                    const dist = (lastW / 2) + GAP + (w / 2);
                    pX = lastX + (dist * curDirX);
                    pY = lastY;

                    // Return Offset logic stays same
                    if (lastState === 1 && !lastIsDouble) {
                        pY += (15 * curDirY);
                    }

                    if (curDirX === 1) renderValues = (piece[0] === matchVal) ? [piece[0], piece[1]] : [piece[1], piece[0]];
                    else renderValues = (piece[1] === matchVal) ? [piece[0], piece[1]] : [piece[1], piece[0]];

                    horzCount++;

                } else {
                    // Vertical Flow
                    if (vCount === 0) {
                        // Corner Piece
                        const dist = (lastW / 2) + GAP + (w / 2);
                        pX = lastX + (dist * curDirX);
                        pY = lastY;

                        // Corner Offset Logic
                        // Only apply L-shape offset if BOTH are Normal pieces.
                        // If any is a Double, connect Center-to-Center ("Middle Line").
                        if (!isDouble && !lastIsDouble) {
                            pY += (15 * curDirY);
                        }

                        if (curDirY === 1) renderValues = (piece[0] === matchVal) ? [piece[0], piece[1]] : [piece[1], piece[0]];
                        else renderValues = (piece[1] === matchVal) ? [piece[0], piece[1]] : [piece[1], piece[0]];

                    } else {
                        // Stack Piece
                        const dist = (lastH / 2) + GAP + (h / 2);
                        pX = lastX;
                        pY = lastY + (dist * curDirY);

                        if (curDirY === 1) renderValues = (piece[0] === matchVal) ? [piece[0], piece[1]] : [piece[1], piece[0]];
                        else renderValues = (piece[1] === matchVal) ? [piece[0], piece[1]] : [piece[1], piece[0]];
                    }

                    vCount++;
                    if (isDouble) vHasDouble = true;

                    if (vCount >= (vHasDouble ? 3 : 2)) {
                        state = 0;
                        curDirX *= -1;
                        horzCount = 0;
                    }
                }

                results.push({
                    piece: renderValues,
                    x: pX - (w / 2),
                    y: pY - (h / 2),
                    width: w, height: h,
                    orientation: orientation
                });

                lastX = pX;
                lastY = pY;
                lastW = w;
                lastH = h;
                lastState = thisState;
                lastIsDouble = isDouble;
                lastOrientation = orientation;
            });
        };

        layoutChain(rightChain, 0, 0, 1);
        layoutChain(leftChain, 0, 0, -1);

        return results;
    }, [board]);

    const [viewState, setViewState] = useState({ x: 0, y: 0, scale: 1.0, isDragging: false, startX: 0, startY: 0 });
    const [initialized, setInitialized] = useState(false);

    useEffect(() => {
        if (board.length > 0 && !initialized && dim.w > 0) {
            setViewState(prev => ({
                ...prev,
                x: dim.w / 2,
                y: dim.h * 0.45,
                scale: 1.0
            }));
            setInitialized(true);
        }
    }, [dim, board.length, initialized]);

    const handleMouseDown = (e: React.MouseEvent) => setViewState(p => ({ ...p, isDragging: true, startX: e.clientX - p.x, startY: e.clientY - p.y }));
    const handleMouseMove = (e: React.MouseEvent) => { if (viewState.isDragging) setViewState(p => ({ ...p, x: e.clientX - p.startX, y: e.clientY - p.startY })); };
    const handleMouseUp = () => setViewState(p => ({ ...p, isDragging: false }));

    return (
        <div className="domino-board" ref={containerRef} onMouseDown={handleMouseDown} onMouseMove={handleMouseMove} onMouseUp={handleMouseUp} onMouseLeave={handleMouseUp}>
            <div className="pieces-layer" style={{ transform: `translate(${viewState.x}px, ${viewState.y}px)` }}>
                {positionedPieces.map((item) => (
                    <div key={`${item.piece[0]}-${item.piece[1]}`} className="piece-wrapper" style={{ transform: `translate(${item.x}px, ${item.y}px)`, width: item.width, height: item.height }}>
                        <div className="piece-animator">
                            <DominoPiece values={item.piece} orientation={item.orientation} size="medium" disabled />
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};