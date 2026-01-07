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
        const midIndex = Math.floor(board.length / 2);
        const centerPiece = board[midIndex];

        const leftChain: { piece: Piece, matchVal: number }[] = [];
        const rightChain: { piece: Piece, matchVal: number }[] = [];

        // --- Build Right Chain (Center -> Tail) ---
        let previousPiece = centerPiece.piece;
        for (let i = midIndex + 1; i < board.length; i++) {
            const p = board[i].piece;
            const matchVal = (p[0] === previousPiece[0] || p[0] === previousPiece[1]) ? p[0] : p[1];
            rightChain.push({ piece: p, matchVal: matchVal });
            previousPiece = p;
        }

        // --- Build Left Chain (Center -> Head) ---
        previousPiece = centerPiece.piece;
        for (let i = midIndex - 1; i >= 0; i--) {
            const p = board[i].piece;
            const matchVal = (p[0] === previousPiece[0] || p[0] === previousPiece[1]) ? p[0] : p[1];
            leftChain.push({ piece: p, matchVal: matchVal });
            previousPiece = p;
        }

        // 2. LAYOUT ENGINE
        const GAP = 2;
        const LIMIT_X = 350; // Tighter limit to avoid hitting players
        const MAX_HORIZONTAL_PIECES = 4; // Fold after 5th piece (Index 4)

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
            isDouble: centerIsDouble,
            orientation: centerIsDouble ? "vertical" : "horizontal"
        });

        // B. Chain Layout Helper (State Machine for Z-Turn)
        const layoutChain = (chain: any[], initialX: number, initialY: number, initialDir: number) => {
            let curX = initialX;
            let curY = initialY;
            let dir = initialDir; // 1 = Right, -1 = Left
            let state = 0; // 0 = Horizontal, 1 = Vertical

            // Turn Direction: Right Chain turns UP (-1), Left Chain turns DOWN (+1)
            const verticalDir = -initialDir;

            // Track vertical stack state
            let verticalCenterX = 0;
            let verticalStackCount = 0;
            let verticalHasDouble = false;

            // Previous piece dimensions for connection calculation
            let prevW = 0;
            let prevH = centerH; // Start with center piece dims (Initial H)

            chain.forEach((item, index) => {
                const { piece, matchVal } = item;
                const isDouble = piece[0] === piece[1];

                // --- 1. DETERMINE DIMENSIONS ---
                let w, h;
                const isVerticalFlow = (state === 1);

                if (isVerticalFlow) {
                    w = isDouble ? 60 : 30; // Double is Horizontal(60) in Vertical Flow
                    h = isDouble ? 30 : 60;
                } else {
                    w = isDouble ? 30 : 60; // Standard Horizontal Flow
                    h = isDouble ? 60 : 30;
                }

                // --- 2. SWITCH TO VERTICAL CHECK ---
                if (state === 0) {
                    let potentialFarEdgeX = (dir === 1) ? curX + GAP + w : curX - GAP - w;
                    // Add tolerance for Doubles at the edge
                    const hitLimit = (dir === 1 && potentialFarEdgeX > LIMIT_X) || (dir === -1 && potentialFarEdgeX < -LIMIT_X);

                    const readyToTurn = (hitLimit || index >= MAX_HORIZONTAL_PIECES);
                    const forceTurn = (index >= MAX_HORIZONTAL_PIECES + 1);

                    if ((readyToTurn && !isDouble) || forceTurn) {
                        state = 1; // Enter Vertical Mode
                        verticalStackCount = 0;
                        verticalHasDouble = false;

                        // Correct dims for the new vertical orientation
                        if (isDouble) { w = 60; h = 30; } else { w = 30; h = 60; }
                    }
                }

                // --- 3. CONNECTION LOGIC (Match Values) ---
                let p0 = piece[0];
                let p1 = piece[1];
                let renderValues = piece;

                if (state === 0) {
                    if (dir === 1) renderValues = (p0 === matchVal) ? [p0, p1] : [p1, p0];
                    else renderValues = (p1 === matchVal) ? [p0, p1] : [p1, p0];
                } else {
                    if (verticalDir === 1) { // Down
                        renderValues = (p0 === matchVal) ? [p0, p1] : [p1, p0];
                    } else { // Up
                        renderValues = (p1 === matchVal) ? [p0, p1] : [p1, p0];
                    }
                }

                // --- 4. POSITION CALCULATION ---
                let pieceX = 0;
                let pieceY = 0;

                if (state === 0) {
                    // --- HORIZONTAL PLACEMENT ---
                    if (dir === 1) { // Right
                        pieceX = curX + GAP;
                        curX = pieceX + w;
                    } else { // Left
                        pieceX = curX - GAP - w;
                        curX = pieceX;
                    }
                    pieceY = curY - (h / 2);

                } else {
                    // --- VERTICAL PLACEMENT ---
                    // A. First Vertical Piece (Corner)
                    if (verticalStackCount === 0) {
                        // Align X: Flush with the End of the Horizontal Chain
                        // Remove GAP for Side Connection (Flush L-Turn)
                        if (dir === 1) {
                            pieceX = curX;
                        } else {
                            pieceX = curX - w;
                        }

                        pieceY = curY - (h / 2); // Start at Axis Y

                        // ALIGNMENT FIX: Edge-to-Edge with Offset
                        // Offset = (PrevHeight/2 + CurrHeight/2)
                        const offset = (prevH / 2) + (h / 2);

                        if (verticalDir === 1) pieceY += offset; // Shift Down
                        else pieceY -= offset; // Shift Up

                        verticalCenterX = pieceX + (w / 2);
                    }
                    // B. Subsequent Vertical Pieces
                    else {
                        pieceX = verticalCenterX - (w / 2);

                        // Stack relative to previous vertical curY
                        if (verticalDir === 1) { // Down
                            pieceY = curY + GAP;
                        } else { // Up
                            pieceY = curY - GAP - h;
                        }
                    }

                    // Update Vertical Boundaries (curY becomes the EDGE)
                    if (verticalDir === 1) { // Down
                        curY = pieceY + h;
                    } else { // Up
                        curY = pieceY;
                    }

                    // Update Stack Stats
                    verticalStackCount++;
                    if (isDouble) verticalHasDouble = true;

                    // CHECK EXIT CONDITION (Return to Horizontal)
                    // Rule: 2 pieces normally. 3 pieces if stack contains a double.
                    const limit = verticalHasDouble ? 3 : 2;

                    if (verticalStackCount >= limit) {
                        state = 0;
                        dir *= -1; // Reverse Direction

                        // Step Out Logic:
                        if (verticalDir === 1) curY += 15;
                        else curY -= 15;

                        // Reset X to emerge correctly from the Vertical Stack
                        if (dir === 1) {
                            curX = pieceX + w; // Start Right of Vertical
                        } else {
                            curX = pieceX; // Start Left of Vertical
                        }
                    }
                }

                // Push Result
                results.push({
                    piece: renderValues,
                    x: pieceX,
                    y: pieceY,
                    width: w,
                    height: h,
                    isDouble,
                    orientation: (w === 30) ? "vertical" : "horizontal"
                });

                prevW = w;
                prevH = h;
            });
        };

        layoutChain(rightChain, centerW / 2, 0, 1);
        layoutChain(leftChain, -centerW / 2, 0, -1);

        return results;
    }, [board]);

    // 3. MANUAL BOARD NAVIGATION (Pan & Zoom Lock)
    // User requested "No Resize" and "No Jumps". 
    // We lock scale and position, enabling Drag-to-Pan.
    // SCALE FIX: Set to 1.0 to match Hand Piece Size exactly.
    const [viewState, setViewState] = useState({ x: 0, y: 0, scale: 1.0, isDragging: false, startX: 0, startY: 0 });
    const [initialized, setInitialized] = useState(false);

    // Initial Center Calculation (Run Only Once)
    useEffect(() => {
        if (board.length > 0 && !initialized && dim.w > 0) {
            // Start centered perfectly on screen as requested
            setViewState(prev => ({
                ...prev,
                x: dim.w / 2,
                y: dim.h * 0.45, // Optical Center (slightly higher to accommodate Player Hand)
                scale: 1.0 // Ensure forced 1:1 scale on init
            }));
            setInitialized(true);
        }
    }, [dim, board.length, initialized]);

    // Drag Handlers
    const handleMouseDown = (e: React.MouseEvent) => {
        setViewState(prev => ({ ...prev, isDragging: true, startX: e.clientX - prev.x, startY: e.clientY - prev.y }));
    };

    const handleMouseMove = (e: React.MouseEvent) => {
        if (!viewState.isDragging) return;
        setViewState(prev => ({
            ...prev,
            x: e.clientX - prev.startX,
            y: e.clientY - prev.startY
        }));
    };

    const handleMouseUp = () => {
        setViewState(prev => ({ ...prev, isDragging: false }));
    };

    const handleMouseLeave = () => {
        if (viewState.isDragging) setViewState(prev => ({ ...prev, isDragging: false }));
    };

    if (board.length === 0) return <div className="domino-board empty">Esperando salida...</div>;

    return (
        <div
            className="domino-board"
            ref={containerRef}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseLeave}
            style={{ cursor: viewState.isDragging ? 'grabbing' : 'grab' }}
        >
            <div className="pieces-layer" style={{
                transform: `translate(${viewState.x}px, ${viewState.y}px) scale(${viewState.scale})`
            }}>
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
                            orientation={item.orientation}
                            size="medium"
                            disabled
                        />
                    </div>
                ))}
            </div>
        </div>
    );
};
