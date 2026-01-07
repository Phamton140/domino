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

        // 1. INFERENCE ENGINE (Structure Analysis)
        const centerPiece = board[0];
        let leftVal = centerPiece.piece[0];
        let rightVal = centerPiece.piece[1];

        const leftChain: { piece: Piece, matchVal: number }[] = [];
        const rightChain: { piece: Piece, matchVal: number }[] = [];

        // Helper check for valid piece data
        const isValid = (p: Piece) => Array.isArray(p) && p.length === 2;

        for (let i = 1; i < board.length; i++) {
            const p = board[i].piece;
            if (!isValid(p)) continue; // Skip bad data

            if (p[0] === leftVal || p[1] === leftVal) {
                leftChain.push({ piece: p, matchVal: leftVal });
                leftVal = (p[0] === leftVal) ? p[1] : p[0];
            } else if (p[0] === rightVal || p[1] === rightVal) {
                rightChain.push({ piece: p, matchVal: rightVal });
                rightVal = (p[0] === rightVal) ? p[1] : p[0];
            } else {
                rightChain.push({ piece: p, matchVal: rightVal });
            }
        }

        // 2. LAYOUT ENGINE
        const GAP = 2;
        const LIMIT_X = 500;
        const ROW_HEIGHT = 55; // Tight stacking

        const results: any[] = [];

        // A. Center Piece
        const centerIsDouble = centerPiece.piece[0] === centerPiece.piece[1];
        const centerW = centerIsDouble ? 30 : 60;
        const centerH = centerIsDouble ? 60 : 30;

        results.push({
            piece: centerPiece.piece,
            x: -centerW / 2,
            y: -centerH / 2,
            width: centerW,
            height: centerH,
            isDouble: centerIsDouble
        });

        // B. Chain Layout Helper
        const layoutChain = (chain: any[], initialX: number, initialY: number, initialDir: number) => {
            let curX = initialX;
            let curY = initialY;
            let dir = initialDir;

            chain.forEach((item) => {
                const { piece, matchVal } = item;
                const isDouble = piece[0] === piece[1];
                const w = isDouble ? 30 : 60;
                const h = isDouble ? 60 : 30;

                // Smart Flip Orientation
                let p0 = piece[0];
                let p1 = piece[1];
                let renderValues = piece;

                if (dir === 1) {
                    // Moving Right: Connect to Left
                    renderValues = (p0 === matchVal) ? [p0, p1] : [p1, p0];
                } else {
                    // Moving Left: Connect to Right
                    renderValues = (p1 === matchVal) ? [p0, p1] : [p1, p0];
                }

                // Turn Detection
                // Look ahead: Where would the FAR edge be if we continued?
                let potentialFarEdgeX = (dir === 1)
                    ? curX + GAP + w
                    : curX - GAP - w;

                let turn = false;
                if (dir === 1 && potentialFarEdgeX > LIMIT_X) turn = true;
                if (dir === -1 && potentialFarEdgeX < -LIMIT_X) turn = true;

                if (turn) {
                    // FOLD LOGIC
                    // 1. Move Down
                    curY += ROW_HEIGHT;
                    // 2. Reverse Direction
                    dir *= -1;
                    // 3. Do NOT jump X. 
                    // The new piece will be placed relative to 'curX' using the NEW direction.
                    // This naturally places it "inwards" (folding back).
                }

                // Place Piece
                let pieceX = 0;
                if (dir === 1) {
                    // Growing Right
                    pieceX = curX + GAP;
                    curX = pieceX + w; // New Tail
                } else {
                    // Growing Left
                    pieceX = curX - GAP - w; // Top-Left of piece
                    curX = pieceX; // New Tail (Left edge)
                }

                results.push({
                    piece: renderValues,
                    x: pieceX,
                    y: curY - (h / 2),
                    width: w,
                    height: h,
                    isDouble
                });
            });
        };

        layoutChain(rightChain, centerW / 2, 0, 1);
        layoutChain(leftChain, -centerW / 2, 0, -1);

        return results;
    }, [board]);

    // AUTO-ZOOM ENGINE
    const layoutInfo = useMemo(() => {
        if (positionedPieces.length === 0) return null;

        // 1. Calculate Bounding Box of all pieces
        let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
        positionedPieces.forEach(p => {
            if (p.x < minX) minX = p.x;
            if (p.x + p.width > maxX) maxX = p.x + p.width;
            if (p.y < minY) minY = p.y;
            if (p.y + p.height > maxY) maxY = p.y + p.height;
        });

        const bbWidth = maxX - minX;
        const bbHeight = maxY - minY;
        const bbCenterX = minX + bbWidth / 2;
        const bbCenterY = minY + bbHeight / 2;

        // 2. Calculate Scale to fit in 'dim' (Container)
        // asymmetric margins to account for UI
        const TOP_MARGIN = 100;
        const BOTTOM_MARGIN = 220; // Player Hand area
        const SIDE_MARGIN = 80;    // Side players

        // Ensure avail dims are positive
        const availW = Math.max(100, dim.w - SIDE_MARGIN * 2);
        const availH = Math.max(100, dim.h - (TOP_MARGIN + BOTTOM_MARGIN));

        // Safe division check
        const scaleX = bbWidth > 0 ? availW / bbWidth : 1;
        const scaleY = bbHeight > 0 ? availH / bbHeight : 1;

        // Clamp scale to avoid huge pieces on start or tiny ones
        // max 1.5 (150%), min 0.1
        let scale = Math.min(scaleX, scaleY);
        scale = Math.min(Math.max(scale, 0.35), 1.2);

        // 3. Center Logic
        // We want the visual center of the BB (bbCenterX, bbCenterY) to be at the center of the container (dim.w/2, dim.h/2)
        // CSS Transform: translate(ScreenCenter) scale(s) translate(-BBCenter)

        // Bias center upwards (42% height) to avoid bottom heavy UI
        const screenCX = dim.w > 0 ? dim.w / 2 : 400;
        const screenCY = dim.h > 0 ? (dim.h * 0.42) : 300;

        return {
            transform: `translate(${screenCX}px, ${screenCY}px) scale(${scale}) translate(${-bbCenterX}px, ${-bbCenterY}px)`,
            debug: { scale, bbWidth, bbHeight, pieces: positionedPieces.length, dimW: dim.w, dimH: dim.h }
        };

    }, [positionedPieces, dim]);

    if (board.length === 0) return <div className="domino-board empty">Esperando salida...</div>;

    return (
        <div className="domino-board" ref={containerRef}>
            {/* DEBUG OVERLAY - Remove after verification */}
            {/* <div style={{ position: 'absolute', top: 0, right: 0, color: 'lime', background: 'rgba(0,0,0,0.7)', padding: '5px', fontSize: '10px', zIndex: 9999 }}>
                Pieces: {layoutInfo?.debug.pieces} <br/>
                Scale: {layoutInfo?.debug.scale.toFixed(2)} <br/>
                Dim: {layoutInfo?.debug.dimW}x{layoutInfo?.debug.dimH}
            </div> */}

            <div className="pieces-layer" style={{ transform: layoutInfo?.transform }}>
                {positionedPieces.map((item, i) => (
                    <div
                        key={i}
                        className="piece-wrapper"
                        style={{
                            transform: `translate(${item.x}px, ${item.y}px)`,
                            width: item.width,
                            height: item.height
                        }}
                    >
                        <DominoPiece
                            values={item.piece}
                            orientation={item.isDouble ? "vertical" : "horizontal"}
                            size="small"
                            disabled
                        />
                    </div>
                ))}
            </div>
        </div>
    );
};
