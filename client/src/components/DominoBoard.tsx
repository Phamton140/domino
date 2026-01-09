import React, { useMemo, useRef, useState, useEffect } from 'react';
import { DominoPiece } from './DominoPiece';
import type { Piece } from '../types';
import './DominoBoard.css';

interface Props {
    board: { piece: Piece, isStarter?: boolean, ownerTeam?: 'A' | 'B' }[];
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
            // Try to find the same piece by value first (persistence)
            const idx = board.findIndex(b =>
                b.piece[0] === anchorRef.current![0] && b.piece[1] === anchorRef.current![1]
            );
            if (idx !== -1) anchorIndex = idx;
        }

        // If not found or not set, look for explicit "isStarter" flag from server
        if (anchorIndex === -1) {
            const starterIndex = board.findIndex(b => b.isStarter);
            if (starterIndex !== -1) {
                anchorIndex = starterIndex;
            }
        }

        // Ultimate fallback (should rarely happen if isStarter is working)
        if (anchorIndex === -1) {
            anchorIndex = Math.floor(board.length / 2);
        }

        // Update ref for next render consistency
        anchorRef.current = board[anchorIndex].piece;

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

        const results: { piece: Piece; x: number; y: number; width: number; height: number; orientation: "vertical" | "horizontal"; isAnchor?: boolean; ownerTeam?: 'A' | 'B' }[] = [];

        const centerIsDouble = centerPiece.piece[0] === centerPiece.piece[1];
        const cW = centerIsDouble ? 30 : 60;
        const cH = centerIsDouble ? 60 : 30;

        results.push({
            piece: centerPiece.piece,
            x: -cW / 2, y: -cH / 2,
            width: cW, height: cH,
            orientation: centerIsDouble ? "vertical" : "horizontal",
            isAnchor: true,
            ownerTeam: centerPiece.ownerTeam
        });

        const layoutChain = (chain: { piece: Piece, matchVal: number }[], anchorX: number, anchorY: number, chainType: 'left' | 'right') => {
            let lastX = anchorX;
            let lastY = anchorY;
            let lastW = cW;
            let lastH = cH;

            // Initial Directions
            // Right Chain: Right (1,0) -> Up (0,-1) -> Left (-1,0)
            // Left Chain: Left (-1,0) -> Down (0,1) -> Right (1,0)
            let curDirX = chainType === 'right' ? 1 : -1;
            let curDirY = 0;

            let state = 0; // 0: First Horizontal, 1: Vertical, 2: Second Horizontal
            let vTotalCount = 0; // Count ALL pieces in vertical segment

            // Horizontal Counters
            let hMixedCount = 0;
            let hDoubleCount = 0;

            // Track state of previous piece
            let lastState = 0;
            let lastIsDouble = centerIsDouble;
            let lastOrientation = centerIsDouble ? "vertical" : "horizontal";

            // Vertical threshold (dynamic rule)
            let vThreshold = 2;

            // Process chain outward from center (Symmetric Logic for Left/Right)
            chain.forEach((item) => {
                const { piece, matchVal } = item;
                const isDouble = piece[0] === piece[1];

                // --- STATE TRANSITIONS (Turns) ---
                let nextState = state;

                if (state === 0) {
                    // First Horizontal Leg
                    // Update counters
                    if (isDouble) hDoubleCount++;
                    else hMixedCount++;

                    // Turn Condition: Max 5 tiles TOTAL (Mixed + Doubles)
                    // Must respect turn rules (no double pivot)
                    // RELAXATION: If we reached the limit, allow turn even if last was Double (as long as THIS is mixed)
                    if ((hMixedCount + hDoubleCount) >= 5 && !isDouble) {
                        nextState = 1;
                        // Set New Direction based on Chain Type
                        if (chainType === 'right') {
                            curDirX = 0; curDirY = -1; // UP
                        } else {
                            curDirX = 0; curDirY = 1;  // DOWN
                        }

                        // Rule: If Horizontal ended strictly on a Double (previous piece),
                        // the Vertical leg MUST be shorter (1 tile) instead of 2.
                        // "Si la ultima ficha de la horizontal es un doble... debe doblar luego de la primera vertical"
                        // lastIsDouble tracks the piece BEFORE the current Pivot.
                        vThreshold = lastIsDouble ? 1 : 2;

                        // Reset counters for next state
                        vTotalCount = 0;
                    }
                } else if (state === 1) {
                    // Vertical Leg
                    vTotalCount++;

                    // Turn condition: Strictly 'vThreshold' pieces minimum
                    // If the 2nd (or threshold) piece was Double, we STILL turn (user request), 
                    // UNLESS it is another double (handled by !isDouble check).
                    if (vTotalCount >= vThreshold && !isDouble) {
                        nextState = 2;
                        // Set New Direction
                        if (chainType === 'right') {
                            curDirX = -1; curDirY = 0; // LEFT
                        } else {
                            curDirX = 1; curDirY = 0;  // RIGHT
                        }
                        vTotalCount = 0;
                    }
                }
                // state 2 continues indefinitely in the new horizontal direction

                state = nextState;

                // --- ORIENTATION & SIZE ---
                let orientation: "vertical" | "horizontal";
                if (isDouble) {
                    // Doubles are ALWAYS perpendicular
                    orientation = (lastOrientation === "horizontal") ? "vertical" : "horizontal";
                } else {
                    // Normal pieces follow the flow
                    // If moving vertically (state 1), they are vertical. Else horizontal.
                    orientation = (state === 1) ? "vertical" : "horizontal";
                }

                const w = (orientation === "horizontal") ? 60 : 30;
                const h = (orientation === "horizontal") ? 30 : 60;

                // --- POSITION CALCULATION ---
                let pX = 0, pY = 0;
                let renderValues: Piece = [...piece] as Piece;

                // Effective direction depends on state
                // Note: curDirX/Y were updated above upon state entry

                if (state === 1) {
                    // --- VERTICAL PLACEMENT ---
                    if (lastState === 0) {
                        // Just turned from Horizontal -> Vertical (The Corner Piece)
                        // Align with the END of the previous piece (Corner Logic)

                        const dist = (lastW / 2) + GAP + (w / 2);
                        pX = lastX + (dist * (chainType === 'right' ? 1 : -1)); // Slight push out to clear logic? No, just stick to flow
                        // Wait, if we turn UP, we stack on lastY. If we turn Left/Right...

                        // Z-Turn Logic:
                        // Previous was Horizontal. We are now Vertical.
                        // We attach to the "side" of the previous piece if it was Mixed? 
                        // User says: "las Mixtas pueden ser usadas como codos de giro".
                        // Logic:
                        // X position: Align with the end of previous piece
                        pX = lastX + ((lastW / 2 + w / 2 + GAP) * (chainType === 'right' ? 1 : -1));
                        // BUT we want to step back? No, standard flow adds to X.
                        // Actually, for a corner, we usually effectively step X by (lastW/2 - w/2) + GAP?
                        // Let's stick to standard flow:
                        // If we are turning UP (Right Chain), we move Y up. X stays roughly same?

                        // RE-THINK COORDINATES:
                        // If turning UP:
                        // New Y = lastY - (lastH/2 + h/2 + GAP)
                        // New X needs to shift to align corners? 

                        // Let's use standard explicit flow:
                        // If we just entered state 1, this IS the corner piece.
                        // It serves as the transition.
                        // Position it "at the end" of the previous chain, but shifted in Y.

                        // Standard "Next Spot" based on OLD direction would be:
                        // pX = lastX + (dist * oldDirX)
                        // But we want to turn.

                        // SIMPLIFIED APPROACH:
                        // Always calculate "ideal next center" based on CURRENT direction.
                        // But for the FIRST piece of a new direction (the Pivot), we need strict placement relative to previous.

                        // PIVOT CALCULATION (Horizontal -> Vertical)
                        // Use the incoming X direction to offset X slightly (align edges)
                        // Use the new Y direction to displace Y

                        const incomingDirX = (chainType === 'right') ? 1 : -1;

                        // X: Align Center-to-Center? No, End-to-Side?
                        // If previous was Double, we wouldn't be here (constraint).
                        // Previous was Mixed Horizontal.
                        // Connect to its "end".

                        // Actually, if we turn UP, we want the piece to sit ON TOP of the end of the previous one?
                        // Or adjacent?
                        // "Gira hacia arriba". visually L shape.

                        // Let's place it at:
                        // X: Same as previous X + (incomingDir * (lastW/2 - w/2)) ?? To align edges?
                        // Let's just place it "at the end" in X, and displaced in Y.

                        // X = lastX + (incomingDirX * (lastW/2 + w/2 + GAP)) -> This is straight line.
                        // To turn, we want X to be: lastX + (incomingDirX * (lastW/2 - w/2))  (Align outer edge? or inner?)
                        // User said: "Mixta... conectada por uno de sus lados laterales"

                        // Let's try: Align Centers in X (roughly), displace in Y.
                        // X: lastX + (incomingDirX * (lastW/2 - w/2)) 
                        // Y: lastY + (curDirY * (lastH/2 + h/2 + GAP))

                        pX = lastX + (incomingDirX * (lastW / 2 - w / 2));
                        pY = lastY + (curDirY * (lastH / 2 + h / 2 + GAP));

                        // Offset correction if needed?
                    } else {
                        // Continued Vertical or Double in Vertical
                        const dist = (lastH / 2) + GAP + (h / 2);
                        pY = lastY + (dist * curDirY);
                        pX = lastX;
                    }

                    if (curDirY === 1) renderValues = (piece[0] === matchVal) ? [piece[0], piece[1]] : [piece[1], piece[0]];
                    else renderValues = (piece[1] === matchVal) ? [piece[0], piece[1]] : [piece[1], piece[0]];

                } else if (state === 2) {
                    // --- SECOND HORIZONTAL (Return/Fold) ---
                    if (lastState === 1) {
                        // Pivot Vertical -> Horizontal
                        // Incoming Y direction.
                        // New X direction.

                        const incomingDirY = (chainType === 'right') ? -1 : 1;

                        // Y: Align with "end" of vertical piece involved in turn?
                        // Y = lastY + (incomingDirY * (lastH/2 - h/2))
                        // X = lastX + (curDirX * (lastW/2 + w/2 + GAP))

                        pY = lastY + (incomingDirY * (lastH / 2 - h / 2));
                        pX = lastX + (curDirX * (lastW / 2 + w / 2 + GAP));

                    } else {
                        // Standard Horizontal
                        const dist = (lastW / 2) + GAP + (w / 2);
                        pX = lastX + (dist * curDirX);
                        pY = lastY;
                    }

                    if (curDirX === 1) renderValues = (piece[0] === matchVal) ? [piece[0], piece[1]] : [piece[1], piece[0]];
                    else renderValues = (piece[1] === matchVal) ? [piece[0], piece[1]] : [piece[1], piece[0]];

                } else {
                    // --- FIRST HORIZONTAL (Standard) ---
                    const dist = (lastW / 2) + GAP + (w / 2);
                    pX = lastX + (dist * curDirX);
                    pY = lastY;

                    if (curDirX === 1) renderValues = (piece[0] === matchVal) ? [piece[0], piece[1]] : [piece[1], piece[0]];
                    else renderValues = (piece[1] === matchVal) ? [piece[0], piece[1]] : [piece[1], piece[0]];
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
                lastState = state;
                lastIsDouble = isDouble;
                lastOrientation = orientation;
            });
        };

        layoutChain(rightChain, 0, 0, 'right');
        layoutChain(leftChain, 0, 0, 'left');

        return results;
    }, [board]);

    const [viewState, setViewState] = useState({ x: 0, y: 0, scale: 1.0, isDragging: false, startX: 0, startY: 0 });
    const [initialized, setInitialized] = useState(false);

    useEffect(() => {
        if (board.length > 0 && !initialized && dim.w > 0) {
            // Heuristic for mobile: 
            // - Shift CENTER LEFT (40% width) to allow more space for right-growth
            // - Shift UP (30% height) to avoid bottom player hand [Fixes clipping]
            const isMobile = dim.w < 1000;
            setViewState(prev => ({
                ...prev,
                x: isMobile ? dim.w * 0.4 : dim.w / 2,
                y: isMobile ? dim.h * 0.3 : dim.h * 0.45,
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
                            <DominoPiece
                                values={item.piece}
                                orientation={item.orientation}
                                size="medium"
                                disabled
                                className={`${item.isAnchor ? 'starter-piece' : ''} ${item.ownerTeam ? `starter-team-${item.ownerTeam}` : ''}`}
                            />
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};