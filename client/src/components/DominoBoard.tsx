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

        // 1. Determine Anchor Piece (The "Zero" Point)
        let anchorIndex = -1;

        if (anchorRef.current) {
            anchorIndex = board.findIndex(b =>
                b.piece[0] === anchorRef.current![0] && b.piece[1] === anchorRef.current![1]
            );
        }

        // If not found or not set, pick the middle piece as the stable anchor
        if (anchorIndex === -1) {
            anchorIndex = Math.floor(board.length / 2);
            anchorRef.current = board[anchorIndex].piece;
        }

        const centerPiece = board[anchorIndex];

        // 2. Build Chains relative to Anchor
        const leftChain: { piece: Piece, matchVal: number }[] = [];
        const rightChain: { piece: Piece, matchVal: number }[] = [];

        // Build Right Chain (Indices > Anchor)
        let previousPiece = centerPiece.piece;
        for (let i = anchorIndex + 1; i < board.length; i++) {
            const p = board[i].piece;
            const matchVal = (p[0] === previousPiece[0] || p[0] === previousPiece[1]) ? p[0] : p[1];
            rightChain.push({ piece: p, matchVal });
            previousPiece = p;
        }

        // Build Left Chain (Indices < Anchor)
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

        // Place Anchor Piece at (0,0)
        results.push({
            piece: centerPiece.piece,
            x: -cW / 2, y: -cH / 2,
            width: cW, height: cH,
            orientation: centerIsDouble ? "vertical" : "horizontal",
            isAnchor: true
        });

        const layoutChain = (chain: any[], initX: number, initY: number, dirX: number) => {
            let curX = initX;
            let curY = initY;
            let currentDirX = dirX;
            let state = 0; // 0: Horizontal, 1: Vertical
            let vDirY = (dirX === 1) ? -1 : 1; // Right goes Up, Left goes Down (as per original logic)
            let vCount = 0;
            let vHasDouble = false;
            let lastH = cH;

            chain.forEach((item, index) => {
                const { piece, matchVal } = item;
                const isDouble = piece[0] === piece[1];

                // Trigger turn
                if (state === 0 && index > 0 && (index % MAX_HORIZONTAL === 0) && !isDouble) {
                    state = 1;
                    vCount = 0;
                    vHasDouble = false;
                }

                let w, h;
                const forceVertical = (state === 1);

                if (!forceVertical) {
                    w = isDouble ? 30 : 60;
                    h = isDouble ? 60 : 30;
                } else {
                    w = isDouble ? 60 : 30;
                    h = isDouble ? 30 : 60;
                }

                // Determine Values Orientation
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
                    // Vertical / Turn
                    if (vCount === 0) {
                        // First piece of turn (The Corner)
                        pX = (currentDirX === 1) ? curX : curX - w;

                        const offset = (lastH / 2) + (h / 2);
                        // Original logic for pY:
                        pY = (vDirY === -1) ? curY - offset : curY;
                        // For vDirY=1, pY=curY. This aligns Top of new piece with Center Line? 
                        // Let's trust original Y logic but fix X stability.

                        // Update curY for next piece in stack
                        // If going Up (-1): next piece is above.
                        // If going Down (1): next piece is below.
                        // We need to set curY to the "End" of this piece.
                        curY = (vDirY === -1) ? pY : pY + h;
                    } else {
                        // Subsequent vertical pieces
                        pX = (currentDirX === 1) ? curX : curX - w;
                        pY = (vDirY === -1) ? curY - GAP - h : curY + GAP;
                        curY = (vDirY === -1) ? pY : pY + h;
                    }

                    vCount++;
                    if (isDouble) vHasDouble = true;

                    if (vCount >= (vHasDouble ? 3 : 2)) {
                        state = 0;
                        currentDirX *= -1; // Snake back

                        // Reset cursor for Horizontal
                        curX = pX + (currentDirX === 1 ? w : 0);
                        // Center Y for horizontal line is aligned with the vertical piece center?
                        // Or bottom?
                        // pY is Top-Left equivalent. Center Y is pY + h/2.
                        curY = pY + (h / 2);
                    }
                }

                results.push({
                    piece: renderValues,
                    x: pX, y: pY,
                    width: w, height: h,
                    orientation: (w === 30 || (isDouble && state === 1)) ? "vertical" : "horizontal"
                });
                lastH = h;
            });
        };

        layoutChain(rightChain, cW / 2, 0, 1);
        layoutChain(leftChain, -cW / 2, 0, -1);

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