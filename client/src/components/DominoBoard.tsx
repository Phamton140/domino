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

        const midIndex = Math.floor(board.length / 2);
        const centerPiece = board[midIndex];

        const leftChain: { piece: Piece, matchVal: number }[] = [];
        const rightChain: { piece: Piece, matchVal: number }[] = [];

        let previousPiece = centerPiece.piece;
        for (let i = midIndex + 1; i < board.length; i++) {
            const p = board[i].piece;
            const matchVal = (p[0] === previousPiece[0] || p[0] === previousPiece[1]) ? p[0] : p[1];
            rightChain.push({ piece: p, matchVal });
            previousPiece = p;
        }

        previousPiece = centerPiece.piece;
        for (let i = midIndex - 1; i >= 0; i--) {
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
            orientation: centerIsDouble ? "vertical" : "horizontal"
        });

        const layoutChain = (chain: any[], initX: number, initY: number, dirX: number) => {
            let curX = initX;
            let curY = initY;
            let currentDirX = dirX;
            let state = 0;
            let vDirY = (dirX === 1) ? -1 : 1;
            let vCount = 0;
            let vHasDouble = false;
            let lastH = cH;

            chain.forEach((item, index) => {
                const { piece, matchVal } = item;
                const isDouble = piece[0] === piece[1];

                if (state === 0 && index >= MAX_HORIZONTAL && !isDouble) {
                    state = 1;
                    vCount = 0;
                    vHasDouble = false;
                }

                let w, h;
                if (state === 0) {
                    w = isDouble ? 30 : 60; h = isDouble ? 60 : 30;
                } else {
                    w = isDouble ? 60 : 30; h = isDouble ? 30 : 60;
                }

                let renderValues: Piece = [...piece];
                if (state === 0) {
                    if (currentDirX === 1) renderValues = (piece[0] === matchVal) ? [piece[0], piece[1]] : [piece[1], piece[0]];
                    else renderValues = (piece[1] === matchVal) ? [piece[0], piece[1]] : [piece[1], piece[0]];
                } else {
                    if (vDirY === -1) renderValues = (piece[1] === matchVal) ? [piece[0], piece[1]] : [piece[1], piece[0]];
                    else renderValues = (piece[0] === matchVal) ? [piece[0], piece[1]] : [piece[1], piece[0]];
                }

                let pX = 0, pY = 0;
                if (state === 0) {
                    pX = (currentDirX === 1) ? curX + GAP : curX - GAP - w;
                    pY = curY - (h / 2);
                    curX = (currentDirX === 1) ? pX + w : pX;
                } else {
                    if (vCount === 0) {
                        // FIX OVERLAP: Place Vertical piece OUTSIDE the current horizontal chain.
                        // If moving Right (dir=1), curX is the Right Edge. Place at curX.
                        // If moving Left (dir=-1), curX is the Left Edge. Place at curX - w.
                        pX = (currentDirX === 1) ? curX : curX - w;

                        const offset = (lastH / 2) + (h / 2);
                        pY = (vDirY === -1) ? curY - offset : curY;
                    } else {
                        // Stack subsequent vertical pieces aligned with the first one
                        pX = (currentDirX === 1) ? curX : curX - w; // Maintain X alignment
                        // Actually, for stack, X should match the PREVIOUS vertical piece's X.
                        // Since we didn't update curX for vertical steps, we need to track the "Vertical Column X".
                        // Use a variable or infer from previous loop?
                        // SIMPLER: In this scope, 'curX' hasn't changed since entering State 1.
                        // So the same logic 'curX' or 'curX - w' applies if we want them stacked vertically.
                        // Wait, if dir=1, pX=curX. If we keep pX=curX, they stack perfectly.
                        pX = (currentDirX === 1) ? curX : curX - w;

                        pY = (vDirY === -1) ? curY - GAP - h : curY + GAP;
                    }
                    curY = (vDirY === -1) ? pY : pY + h;
                    vCount++;
                    if (isDouble) vHasDouble = true;

                    if (vCount >= (vHasDouble ? 3 : 2)) {
                        state = 0;
                        currentDirX *= -1;
                        curX = pX + (currentDirX === 1 ? w : 0);
                        curY = pY + (h / 2);
                    }
                }

                results.push({ piece: renderValues, x: pX, y: pY, width: w, height: h, orientation: (w === 30 ? "vertical" : "horizontal") });
                lastH = h;
            });
        };

        layoutChain(rightChain, cW / 2, 0, 1);
        layoutChain(leftChain, -cW / 2, 0, -1);
        return results;
    }, [board]);

    const [viewState, setViewState] = useState({ x: 0, y: 0, scale: 1.0, isDragging: false, startX: 0, startY: 0 });
    const [initialized, setInitialized] = useState(false);

    // Initial Center Calculation (Run Only Once or on Resize if desired, here just once to lock)
    useEffect(() => {
        if (board.length > 0 && !initialized && dim.w > 0) {
            // Start centered perfectly on screen as requested
            setViewState(prev => ({
                ...prev,
                x: dim.w / 2,
                y: dim.h * 0.45, // Optical Center
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
                {positionedPieces.map((item, i) => (
                    <div key={i} className="piece-wrapper" style={{ transform: `translate(${item.x}px, ${item.y}px)`, width: item.width, height: item.height }}>
                        <DominoPiece values={item.piece} orientation={item.orientation} size="medium" disabled />
                    </div>
                ))}
            </div>
        </div>
    );
};