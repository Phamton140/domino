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
        // The 'board' array is ordered Head -> Tail.
        // To stabilize the view, we pick the middle element as the "Visual Anchor".
        const midIndex = Math.floor(board.length / 2);
        const centerPiece = board[midIndex];

        // We will build two chains radiating OUT from the center piece.
        // Left Chain: mid-1 -> 0 (Head)
        // Right Chain: mid+1 -> End (Tail)

        const leftChain: { piece: Piece, matchVal: number }[] = [];
        const rightChain: { piece: Piece, matchVal: number }[] = [];

        // --- Build Right Chain (Center -> Tail) ---
        // matchVal for the first right piece is the value it shares with Center.
        let currentMatchVal_Right = undefined;
        // We look at the Right side of CenterPiece to define "matchVal" for the next one?
        // Actually, we can just trace connections.

        let previousPiece = centerPiece.piece;

        // Right side loop
        for (let i = midIndex + 1; i < board.length; i++) {
            const p = board[i].piece;
            // Find which value connects to the previous piece
            // Common value between previousPiece and p
            // NOTE: In a valid domino chain, there IS exactly one matching value (unless duplicate double error).
            // But we need to know WHICH end of 'previousPiece' is the exposed one.
            // This is hard without full state tracking. 
            // EASIER: The 'board' array is Head->Tail. 
            // So board[i] connects to board[i-1].
            // We just need to find the common value.

            const matchVal = (p[0] === previousPiece[0] || p[0] === previousPiece[1]) ? p[0] : p[1];
            // Wait, what if both match? (e.g. [1,1] connecting to [1,1]). matchVal is 1.

            rightChain.push({ piece: p, matchVal: matchVal });
            previousPiece = p;
        }

        // --- Build Left Chain (Center -> Head) ---
        // We walk BACKWARDS from Center.
        previousPiece = centerPiece.piece;

        for (let i = midIndex - 1; i >= 0; i--) {
            const p = board[i].piece;
            // board[i] connects to board[i+1] (which is 'previousPiece' in this loop)
            const matchVal = (p[0] === previousPiece[0] || p[0] === previousPiece[1]) ? p[0] : p[1];

            leftChain.push({ piece: p, matchVal: matchVal });
            previousPiece = p;
        }

        // 2. LAYOUT ENGINE
        const GAP = 2;
        const LIMIT_X = 500;
        const MAX_HORIZONTAL_PIECES = 6; // Fold after 6 pieces per side (approx 12-13 total width)

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
            let state = 0; // 0 = Horizontal, 1 = Vertical One, 2 = Vertical Two

            // Turn Direction: Right Chain turns UP (-1), Left Chain turns DOWN (+1)
            const verticalDir = -initialDir;

            // Track the Center X of the vertical column to ensure perfect stacking
            let verticalCenterX = 0;

            chain.forEach((item, index) => {
                const { piece, matchVal } = item;
                const isDouble = piece[0] === piece[1];

                // Determine Dimensions
                let w, h;
                const isVerticalFlow = (state === 1 || state === 2);

                if (isVerticalFlow) {
                    w = isDouble ? 60 : 30; // Double is Horizontal(60) in Vertical Flow
                    h = isDouble ? 30 : 60;
                } else {
                    w = isDouble ? 30 : 60; // Standard Horizontal Flow
                    h = isDouble ? 60 : 30;
                }

                // Check Bounds / Trigger Turn if in State 0
                if (state === 0) {
                    let potentialFarEdgeX = (dir === 1) ? curX + GAP + w : curX - GAP - w;
                    // Add tolerance for Doubles at the edge
                    const hitLimit = (dir === 1 && potentialFarEdgeX > LIMIT_X) || (dir === -1 && potentialFarEdgeX < -LIMIT_X);

                    // Trigger Turn if Hit Pixel Limit OR Hit Piece Count Limit
                    if (hitLimit || index >= MAX_HORIZONTAL_PIECES) {
                        state = 1; // Start Turn
                        // Recalculate dims for Vertical Flow since we switched state
                        if (isDouble) { w = 60; h = 30; } else { w = 30; h = 60; }
                    }
                }

                // Smart Flip Orientation Logic
                let p0 = piece[0];
                let p1 = piece[1];
                let renderValues = piece;

                // Connection Logic
                if (state === 0) {
                    if (dir === 1) renderValues = (p0 === matchVal) ? [p0, p1] : [p1, p0];
                    else renderValues = (p1 === matchVal) ? [p0, p1] : [p1, p0];
                } else if (state === 1) {
                    if (verticalDir === 1) { // Down
                        renderValues = (p0 === matchVal) ? [p0, p1] : [p1, p0];
                    } else { // Up
                        renderValues = (p1 === matchVal) ? [p0, p1] : [p1, p0];
                    }
                } else if (state === 2) {
                    if (verticalDir === 1) { // Down
                        renderValues = (p0 === matchVal) ? [p0, p1] : [p1, p0];
                    } else { // Up
                        renderValues = (p1 === matchVal) ? [p0, p1] : [p1, p0];
                    }
                }

                // POSITION CALCULATION
                let pieceX = 0;
                let pieceY = 0;

                if (state === 0) {
                    // --- STATE 0: HORIZONTAL ---
                    if (dir === 1) { // Moving Right
                        pieceX = curX + GAP;
                        curX = pieceX + w; // New Tail
                    } else { // Moving Left
                        pieceX = curX - GAP - w;
                        curX = pieceX; // New Tail
                    }
                    pieceY = curY - (h / 2);

                } else if (state === 1) {
                    // --- STATE 1: FIRST VERTICAL ---
                    if (dir === 1) {
                        pieceX = curX + GAP;
                        pieceY = curY - (h / 2);
                    } else {
                        pieceX = curX - GAP - w;
                        pieceY = curY - (h / 2);
                    }

                    // ALIGNMENT FIX (15px Offset)
                    if (!isDouble) {
                        if (verticalDir === 1) pieceY += 15; // Shift Down
                        else pieceY -= 15; // Shift Up
                    }

                    // Store Center X for next piece to stack correctly
                    verticalCenterX = pieceX + (w / 2);

                    // Update Pointers for V2
                    if (verticalDir === 1) { // Down
                        curY = pieceY + h; // Bottom Edge
                    } else { // Up
                        curY = pieceY; // Top Edge
                    }
                    // curX is not used for V2 X-pos anymore, verticalCenterX is.
                    state = 2;

                } else if (state === 2) {
                    // --- STATE 2: SECOND VERTICAL ---
                    // Center-Align with V1 using verticalCenterX
                    pieceX = verticalCenterX - (w / 2);

                    if (verticalDir === 1) { // Down
                        pieceY = curY + GAP;
                        curY = pieceY + h;
                    } else { // Up
                        pieceY = curY - GAP - h;
                        curY = pieceY;
                    }

                    // Prepare for Horizontal Return
                    state = 0;
                    dir *= -1; // Reverse X direction

                    // Reset curY for the new horizontal row (Step Logic)
                    if (verticalDir === 1) curY = pieceY + h + 15;
                    else curY = pieceY - 15;

                    // Reset curX for H-piece (Start from the "Side" of the vertical stack)
                    // If going Right, start from Right Edge of Stack.
                    // If going Left, start from Left Edge of Stack.
                    // Stack Center is verticalCenterX. 
                    if (dir === 1) { // Now moving Right
                        curX = verticalCenterX + (w / 2); // Right Edge? 
                        // No, w is current piece width. 
                        // We want to emerge from the stack. The horizontal piece starts "outside".
                        // Wait, if V2 was wider (Double), we start from ITS edge.
                        curX = pieceX + w;
                    } else { // Now moving Left
                        curX = pieceX;
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
                    // Determine explicit orientation for renderer
                    // w=30 -> Vertical. w=60 -> Horizontal.
                    orientation: (w === 30) ? "vertical" : "horizontal"
                });
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

    // Wheel Zoom (Optional, but good for manual control)
    const handleWheel = (e: React.WheelEvent) => {
        // e.preventDefault(); // React synthetic events can't prevent default passive wheel
        const delta = -e.deltaY * 0.001;
        setViewState(prev => ({
            ...prev,
            scale: Math.min(Math.max(prev.scale + delta, 0.4), 2.0)
        }));
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
            onWheel={handleWheel}
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
                            size="small"
                            disabled
                        />
                    </div>
                ))}
            </div>
        </div>
    );
};
