import { GameState, Player, Piece, RoomConfig } from './types';

export class GameEngine {
    private gameState: GameState;
    private config: RoomConfig;
    private timer: NodeJS.Timeout | null = null;
    private readonly TURN_DURATION: number; // Will be set from config or default to 15000ms
    private onStateChange?: (state: GameState) => void; // Callback for state updates

    private pendingStartBonus?: {
        team: string;
        points: number;
    };

    constructor(players: Player[], config: RoomConfig, onStateChange?: (state: GameState) => void) {
        // Use config turn duration or default to 15 seconds
        this.TURN_DURATION = (config.turnDuration || 15) * 1000;
        this.config = config;
        this.onStateChange = onStateChange;
        this.gameState = {
            board: [],
            players: players,
            currentTurnPlayerId: '',
            turnDeadline: 0,
            consecutivePasses: 0,
            handNumber: 1,
            teamScores: { A: 0, B: 0 }
        };
    }

    // --- Deck ---
    private generateDeck(): Piece[] {
        const deck: Piece[] = [];
        for (let i = 0; i <= 6; i++) {
            for (let j = i; j <= 6; j++) {
                deck.push([i, j]);
            }
        }
        return deck;
    }

    private shuffleDeck(deck: Piece[]): Piece[] {
        for (let i = deck.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [deck[i], deck[j]] = [deck[j], deck[i]];
        }
        return deck;
    }

    // --- Core Loop ---
    public startHand() {
        this.gameState.board = [];
        this.gameState.consecutivePasses = 0;
        this.gameState.handWinnerId = undefined; // Reset hand winner
        this.gameState.winReason = undefined;
        this.pendingStartBonus = undefined; // Reset start bonus logic
        // winnerTeam persists if Match Won? No, if Match Won, we shouldn't be here or we restart match.

        this.gameState.players.forEach(p => {
            p.hand = [];
        });

        let deck = this.shuffleDeck(this.generateDeck());
        this.gameState.players.forEach(p => {
            p.hand = deck.splice(0, 7);
        });

        if (this.gameState.handNumber === 1) {
            // First hand: Double Six starts
            const starter = this.gameState.players.find(p =>
                p.hand.some(bone => bone[0] === 6 && bone[1] === 6)
            );

            let startPlayer = starter;
            if (!startPlayer) {
                for (let d = 5; d >= 0; d--) {
                    startPlayer = this.gameState.players.find(p => p.hand.some(b => b[0] === d && b[1] === d));
                    if (startPlayer) break;
                }
            }
            if (!startPlayer) startPlayer = this.gameState.players[0];

            this.gameState.currentTurnPlayerId = startPlayer.id;
            console.log(`🎯 Primera mano: ${startPlayer.name} tiene el doble-6 y debe jugarlo`);
        } else {
            if (this.lastWinnerId) {
                const winnerStillInGame = this.gameState.players.find(p => p.id === this.lastWinnerId);
                this.gameState.currentTurnPlayerId = winnerStillInGame?.id ?? this.gameState.players[0].id;
            } else {
                this.gameState.currentTurnPlayerId = this.gameState.players[0].id;
            }
        }

        this.startTurnTimer();
    }

    // Internal tracker
    private lastWinnerId?: string;

    private startTurnTimer() {
        // CRITICAL: Clear any existing timer first
        if (this.timer) {
            clearTimeout(this.timer);
            this.timer = null;
        }

        // Fixed duration: 5s rigid limit (Testing)
        const duration = 5000;
        this.gameState.turnDeadline = Date.now() + duration;

        const currentPlayerId = this.gameState.currentTurnPlayerId;
        const currentPlayer = this.getCurrentPlayer();

        this.timer = setTimeout(() => {
            if (this.gameState.currentTurnPlayerId === currentPlayerId) {
                this.handleTimeout();
            }
        }, duration);
    }

    // Extension feature removed
    // public useExtension(playerId: string): boolean { ... }

    private handleTimeout() {
        // Double-check we're not in a finished game
        if (this.gameState.winnerTeam) return;

        // Auto-play for ONLY the current player
        const player = this.getCurrentPlayer();
        if (!player) {
            console.log(`⚠️ Timeout error: No current player found`);
            return;
        }

        // Verify this is still their turn
        if (player.id !== this.gameState.currentTurnPlayerId) {
            console.log(`⚠️ Timeout skipped: Player ${player.name} is no longer current`);
            return;
        }

        const validMove = this.findAnyValidMove(player);
        if (validMove) {
            this.placePiece(player.id, validMove.piece, validMove.side);
        } else {
            this.passTurn(player.id);
        }

        if (this.onStateChange) {
            this.onStateChange(this.getState());
        }
    }

    private getCurrentPlayer(): Player | undefined {
        return this.gameState.players.find(p => p.id === this.gameState.currentTurnPlayerId);
    }

    // --- Board Logic ---
    public getOpenEnds(): [number, number] {
        if (this.gameState.board.length === 0) return [-1, -1];
        const head = this.gameState.board[0].piece[0];
        const tail = this.gameState.board[this.gameState.board.length - 1].piece[1];
        return [head, tail];
    }

    public isValidMove(piece: Piece, side: 'head' | 'tail'): boolean {
        const [head, tail] = this.getOpenEnds();
        if (head === -1) {
            // First move of the hand
            if (this.gameState.handNumber === 1) {
                // First hand: Must play double-6 if you have it
                // The starter was chosen because they have it, so this should always be true
                return piece[0] === 6 && piece[1] === 6;
            }
            // Subsequent hands: Any piece is valid for first move
            return true;
        }

        if (side === 'head') {
            return piece[0] === head || piece[1] === head;
        } else {
            return piece[0] === tail || piece[1] === tail;
        }
    }

    private findAnyValidMove(player: Player): { piece: Piece, side: 'head' | 'tail' } | null {
        const [head, tail] = this.getOpenEnds();

        if (head === -1) {
            if (this.gameState.handNumber === 1) {
                const d6 = player.hand.find(p => p[0] === 6 && p[1] === 6);
                return d6 ? { piece: d6, side: 'head' } : null;
            } else {
                if (player.hand.length === 0) return null;
                const randomIdx = Math.floor(Math.random() * player.hand.length);
                return { piece: player.hand[randomIdx], side: 'head' };
            }
        }

        const validMoves: { piece: Piece, side: 'head' | 'tail' }[] = [];

        for (const piece of player.hand) {
            if (piece[0] === head || piece[1] === head) {
                validMoves.push({ piece, side: 'head' });
            }
            if (piece[0] === tail || piece[1] === tail) {
                validMoves.push({ piece, side: 'tail' });
            }
        }

        if (validMoves.length === 0) return null;

        const randomIdx = Math.floor(Math.random() * validMoves.length);
        return validMoves[randomIdx];
    }

    public placePiece(playerId: string, rawPiece: Piece, side: 'head' | 'tail'): boolean {
        // CRITICAL: Verify it's this player's turn
        if (playerId !== this.gameState.currentTurnPlayerId) {
            console.log(`❌ Rejected move from ${playerId} - not their turn (current: ${this.gameState.currentTurnPlayerId})`);
            return false;
        }

        const player = this.gameState.players.find(p => p.id === playerId);
        if (!player) return false;

        const pieceIdx = player.hand.findIndex(p =>
            (p[0] === rawPiece[0] && p[1] === rawPiece[1]) ||
            (p[0] === rawPiece[1] && p[1] === rawPiece[0])
        );
        if (pieceIdx === -1) return false;

        const piece = player.hand[pieceIdx];

        if (this.gameState.board.length === 0) {
            // First piece enforcement
            if (this.gameState.handNumber === 1) {
                // If they have 6-6, valid move logic should have blocked others?
                // Let's re-verify strictness here if we want or trust isValidMove.
                const hasD6 = player.hand.some(p => p[0] === 6 && p[1] === 6);
                if (hasD6 && (piece[0] !== 6 || piece[1] !== 6)) {
                    // Reject non-6-6
                    return false;
                }
            }

            this.gameState.board.push({ piece: piece, isStarter: true, ownerTeam: player.team });
            player.hand.splice(pieceIdx, 1);
            this.gameState.consecutivePasses = 0;

            if (player.hand.length === 0) {
                this.handleWin(player, 'domino');
                return true;
            }
            this.nextTurn();
            return true;
        }

        const [head, tail] = this.getOpenEnds();
        let placedPiece: Piece = [...piece]; // Clone

        // Rule of Right End Priority (Doble Punta):
        // If the piece matches BOTH ends, it MUST be played on the Right End (Tail).
        // Check if piece matches head AND tail (and head != tail, or even if head == tail, right end priority applies)
        const matchesHead = (piece[0] === head || piece[1] === head);
        const matchesTail = (piece[0] === tail || piece[1] === tail);

        if (matchesHead && matchesTail) {
            side = 'tail';
        }

        if (side === 'head') {
            // Connecting to Head value at Index 0 [0]
            if (placedPiece[1] === head) {
                // Alignment OK
            } else if (placedPiece[0] === head) {
                // Flip
                placedPiece = [placedPiece[1], placedPiece[0]];
            } else {
                return false;
            }
            this.gameState.board.unshift({ piece: placedPiece, ownerTeam: player.team });
        } else {
            // Connecting to Tail value at Index Last [1]
            if (placedPiece[0] === tail) {
                // Alignment OK
            } else if (placedPiece[1] === tail) {
                // Flip
                placedPiece = [placedPiece[1], placedPiece[0]];
            } else {
                return false;
            }
            this.gameState.board.push({ piece: placedPiece, ownerTeam: player.team });
        }

        player.hand.splice(pieceIdx, 1);
        this.gameState.consecutivePasses = 0;

        if (this.pendingStartBonus) {
            if (player.team === this.pendingStartBonus.team) {
                this.gameState.teamScores[player.team] += this.pendingStartBonus.points;
            }
            this.pendingStartBonus = undefined;
        }

        if (player.hand.length === 0) {
            const isDouble = piece[0] === piece[1];
            const isCapicua = !isDouble && (head !== -1 && (
                (piece[0] === head && piece[1] === tail) ||
                (piece[1] === head && piece[0] === tail) ||
                (head === tail)
            ));

            this.handleWin(player, 'domino', isCapicua);
            return true;
        }

        this.nextTurn();
        return true;
    }

    public passTurn(playerId: string) {
        if (playerId !== this.gameState.currentTurnPlayerId) return;

        const player = this.getCurrentPlayer();
        if (player && this.findAnyValidMove(player)) return;

        if (this.timer) {
            clearTimeout(this.timer);
            this.timer = null;
        }

        if (this.pendingStartBonus) {
            this.pendingStartBonus = undefined;
        } else if (this.gameState.board.length === 1) {
            const startPiece = this.gameState.board[0];
            const isDouble = startPiece.piece[0] === startPiece.piece[1];
            const points = isDouble ? 30 : 60;

            this.pendingStartBonus = {
                team: startPiece.ownerTeam || 'A',
                points: points
            };
        }

        this.gameState.consecutivePasses++;

        if (this.onStateChange) {
            this.onStateChange(this.getState());
        }

        setTimeout(() => {
            if (this.gameState.consecutivePasses === 3) {
                const currentPlayer = this.getCurrentPlayer();

                if (currentPlayer && this.findAnyValidMove(currentPlayer)) {
                    const teamScore = this.gameState.teamScores[currentPlayer.team as 'A' | 'B'];

                    if (teamScore >= 170) {
                        this.gameState.consecutivePasses = 0;
                        this.startTurnTimer();
                        if (this.onStateChange) this.onStateChange(this.getState());
                        return;
                    }

                    const teamPlayers = this.gameState.players.filter(p => p.team === currentPlayer.team);
                    teamPlayers.forEach(p => p.score += 30);

                    // Notify about Pase Redondo
                    if (this.onStateChange) {
                        this.onStateChange(this.getState());
                    }

                    console.log(`📢 +30 Pase Redondo for Team ${currentPlayer.team}`);

                    // Reset consecutive passes
                    this.gameState.consecutivePasses = 0;

                    // Turn stays with current player, restart timer
                    this.startTurnTimer();
                    // Broadcast update again (turn starts)
                    if (this.onStateChange) this.onStateChange(this.getState());
                    return;
                } else {
                    // Current player also can't play - this will be a Tranque on next pass
                    console.log(`⚠️ Not a Pase Redondo - current player also can't play (Tranque incoming)`);
                    // Continue to next player to complete the Tranque
                }
            }

            if (this.gameState.consecutivePasses === 4) {
                this.handleTranque();
                if (this.onStateChange) {
                    this.onStateChange(this.getState());
                }
                return;
            }

            this.nextTurn();

            if (this.onStateChange) {
                this.onStateChange(this.getState());
            }

        }, 2500);
    }

    private nextTurn() {
        if (this.gameState.winnerTeam) return;

        const currentIdx = this.gameState.players.findIndex(p => p.id === this.gameState.currentTurnPlayerId);
        const nextIdx = (currentIdx + 1) % this.gameState.players.length;
        this.gameState.currentTurnPlayerId = this.gameState.players[nextIdx].id;

        this.startTurnTimer();
    }

    private handleWin(winner: Player, type: 'domino' | 'tranque', isCapicua: boolean = false) {
        this.gameState.handWinnerId = winner.id;

        const totalTable = this.gameState.players.reduce((sum, p) => sum + this.sumHand(p.hand), 0);

        let bonus = 0;
        if (type === 'domino' && isCapicua) {
            bonus = 30;
            this.gameState.winReason = 'capicua';
        } else {
            this.gameState.winReason = type;
        }

        // Update Score - Add points to ALL team members
        // Update Score - Add points to TEAM SCORES
        const teamPlayers = this.gameState.players.filter(p => p.team === winner.team);
        const pointsToAdd = totalTable + bonus;

        this.gameState.teamScores[winner.team] += pointsToAdd;

        this.gameState.handPoints = pointsToAdd;

        winner.score += pointsToAdd;

        const teamScore = this.gameState.teamScores[winner.team];
        if (teamScore >= 200) {
            this.gameState.winnerTeam = winner.team;
        } else {
            this.lastWinnerId = winner.id;
            this.gameState.handNumber++;
        }

        if (this.timer) {
            clearTimeout(this.timer);
            this.timer = null;
        }
    }

    private handleTranque() {
        if (this.timer) clearTimeout(this.timer);

        const currentIdx = this.gameState.players.findIndex(p => p.id === this.gameState.currentTurnPlayerId);

        const trancadorIdx = (currentIdx - 4 + this.gameState.players.length) % this.gameState.players.length;
        const trancador = this.gameState.players[trancadorIdx];

        const opponentIdx = (trancadorIdx + 1) % this.gameState.players.length;
        const opponent = this.gameState.players[opponentIdx];

        const scoreA = this.sumHand(trancador.hand);
        const scoreB = this.sumHand(opponent.hand);

        let winner: Player;
        if (scoreA < scoreB) {
            winner = trancador;
        } else if (scoreB < scoreA) {
            winner = opponent;
        } else {
            winner = opponent;
        }

        this.handleWin(winner, 'tranque');
    }

    private sumHand(hand: Piece[]): number {
        return hand.reduce((sum, p) => sum + p[0] + p[1], 0);
    }

    public getState(): GameState {
        return this.gameState;
    }
}
