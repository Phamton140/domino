import { GameState, Player, Piece, RoomConfig } from './types';

export class GameEngine {
    private gameState: GameState;
    private config: RoomConfig;
    private timer: NodeJS.Timeout | null = null;
    private readonly TURN_DURATION: number; // Will be set from config or default to 15000ms
    private onStateChange?: (state: GameState) => void; // Callback for state updates

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
                // Fallback: Find highest double
                console.log("⚠️ No player has double-6, finding highest double...");
                for (let d = 5; d >= 0; d--) {
                    startPlayer = this.gameState.players.find(p => p.hand.some(b => b[0] === d && b[1] === d));
                    if (startPlayer) {
                        console.log(`🎲 Highest double found: ${d}-${d} with player ${startPlayer.name}`);
                        break;
                    }
                }
            }
            // If still no doubles? unlikely but possible with 2 players (14 tiles).
            if (!startPlayer) startPlayer = this.gameState.players[0]; // Panic fallback

            this.gameState.currentTurnPlayerId = startPlayer.id;
            console.log(`🎯 Primera mano: ${startPlayer.name} tiene el doble-6 y debe jugarlo`);
        } else {
            // Next hands: Previous winner starts (or fallback to first player)
            if (this.lastWinnerId) {
                const winnerStillInGame = this.gameState.players.find(p => p.id === this.lastWinnerId);
                if (winnerStillInGame) {
                    this.gameState.currentTurnPlayerId = this.lastWinnerId;
                    console.log(`🎯 Mano ${this.gameState.handNumber}: ${winnerStillInGame.name} ganó la anterior y empieza`);
                } else {
                    // Winner left? Fallback to first player
                    this.gameState.currentTurnPlayerId = this.gameState.players[0].id;
                }
            } else {
                // Should not happen if hand > 1, but safety fallback
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

        // Store the current player ID to verify in timeout
        const currentPlayerId = this.gameState.currentTurnPlayerId;
        const currentPlayer = this.getCurrentPlayer();

        console.log(`⏱️ Starting timer for ${currentPlayer?.name}: ${duration / 1000}s`);

        this.timer = setTimeout(() => {
            // Verify this timeout is still valid for the current player
            // Timer runs REGARDLESS of connection status - game must continue
            if (this.gameState.currentTurnPlayerId === currentPlayerId) {
                console.log(`⏰ Timer expired for ${currentPlayer?.name}`);
                this.handleTimeout();
            } else {
                console.log(`⚠️ Timeout cancelled - turn already changed`);
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
            console.log(`⏱️ Timeout: Auto-playing ${validMove.piece} for ${player.name}`);
            this.placePiece(player.id, validMove.piece, validMove.side);
        } else {
            console.log(`⏱️ Timeout: Auto-passing for ${player.name}`);
            this.passTurn(player.id);
        }

        // Notify about state change AND timeout
        if (this.onStateChange) {
            this.onStateChange(this.getState());
        }

        // Notify about timeout (will be sent via socket handler)
        console.log(`📢 Notifying all players: ${player.name}'s time ran out`);
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

        console.log(`🔍 Finding valid move for ${player.name} (Hand: ${player.hand.length})`);
        console.log(`   Board Ends: Head=${head}, Tail=${tail}`);

        // 1. First move of the hand (Board Empty)
        if (head === -1) {
            if (this.gameState.handNumber === 1) {
                // First hand: Must play [6,6]
                const d6 = player.hand.find(p => p[0] === 6 && p[1] === 6);
                console.log(`   First Hand: Looking for [6,6]. Found? ${!!d6}`);
                return d6 ? { piece: d6, side: 'head' } : null;
            } else {
                // Subsequent hands: Any piece is valid. Pick random.
                if (player.hand.length === 0) return null;
                const randomIdx = Math.floor(Math.random() * player.hand.length);
                console.log(`   Subsequent Hand Start: Picking random piece`);
                return { piece: player.hand[randomIdx], side: 'head' };
            }
        }

        // 2. Regular move (Board has pieces)
        const validMoves: { piece: Piece, side: 'head' | 'tail' }[] = [];

        console.log(`   Checking ${player.hand.length} pieces in hand...`);
        for (const piece of player.hand) {
            let matches = false;
            // Check Head
            if (piece[0] === head || piece[1] === head) {
                validMoves.push({ piece, side: 'head' });
                matches = true;
            }
            // Check Tail
            if (piece[0] === tail || piece[1] === tail) {
                validMoves.push({ piece, side: 'tail' });
                matches = true;
            }
            // Log matching debugging
            // console.log(`     Piece [${piece[0]},${piece[1]}] vs H:${head}/T:${tail} -> ${matches ? 'MATCH' : 'No'}`);
        }

        console.log(`   Total valid moves found: ${validMoves.length}`);

        if (validMoves.length === 0) return null;

        // Pick random valid move to satisfy "escoger una jugada aleatoria"
        const randomIdx = Math.floor(Math.random() * validMoves.length);
        const selected = validMoves[randomIdx];
        console.log(`   Selected move: [${selected.piece[0]},${selected.piece[1]}] on ${selected.side}`);
        return selected;
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

            this.gameState.board.push({ piece: piece });
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
            console.log(`⚠️ Ambiguous move (Double Match) for [${piece[0]},${piece[1]}] - Forcing RIGHT END (Tail) rule`);
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
            this.gameState.board.unshift({ piece: placedPiece });
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
            this.gameState.board.push({ piece: placedPiece });
        }

        player.hand.splice(pieceIdx, 1);
        this.gameState.consecutivePasses = 0;

        // Check Win / Capicúa
        if (player.hand.length === 0) {
            // Capicúa check: The piece played matched BOTH ends of the board.
            // IMPORTANT: Doubles do NOT count as Capicúa (only mixed pieces)
            const isDouble = piece[0] === piece[1];
            const isCapicua = !isDouble && (head !== -1 && (
                (piece[0] === head && piece[1] === tail) ||
                (piece[1] === head && piece[0] === tail) ||
                (head === tail)
            ));

            if (isCapicua) {
                console.log(`🎯 Capicúa detected! Piece [${piece[0]},${piece[1]}] matched both ends`);
            } else if (isDouble) {
                console.log(`⚠️ Double [${piece[0]},${piece[1]}] played - NOT a Capicúa`);
            }

            this.handleWin(player, 'domino', isCapicua);
            return true;
        }

        this.nextTurn();
        return true;
    }

    public passTurn(playerId: string) {
        // CRITICAL: Verify it's this player's turn
        if (playerId !== this.gameState.currentTurnPlayerId) {
            console.log(`❌ Rejected pass from ${playerId} - not their turn (current: ${this.gameState.currentTurnPlayerId})`);
            return;
        }

        // Validation: Can ONLY pass if no moves available
        const player = this.getCurrentPlayer();
        if (player && this.findAnyValidMove(player)) {
            console.log(`❌ ${player.name} cannot pass - has valid moves`);
            return;
        }

        this.gameState.consecutivePasses++;
        console.log(`Pass count: ${this.gameState.consecutivePasses}`);

        // Check for Pase Redondo (Round Pass) - All 3 opponents passed, turn returns to same player
        // IMPORTANT: Only if the current player CAN still play (not a Tranque)
        if (this.gameState.consecutivePasses === 3) {
            const currentPlayer = this.getCurrentPlayer();

            // Check if current player has valid moves
            if (currentPlayer && this.findAnyValidMove(currentPlayer)) {
                // Check team score - Pase Redondo does NOT apply if team has 170+ points
                const teamPlayers = this.gameState.players.filter(p => p.team === currentPlayer.team);
                const teamScore = teamPlayers.reduce((sum, p) => sum + p.score, 0);

                if (teamScore >= 170) {
                    console.log(`⚠️ Pase Redondo NOT applied - Team ${currentPlayer.team} has ${teamScore} points (170+ limit)`);
                    // Reset consecutive passes but no bonus
                    this.gameState.consecutivePasses = 0;
                    this.startTurnTimer();
                    return;
                }

                // TRUE Pase Redondo - player can continue playing and team < 170
                console.log(`🎉 PASE REDONDO! Player ${currentPlayer.name} can still play, +30 bonus`);

                // Award +30 to the team
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
                return;
            } else {
                // Current player also can't play - this will be a Tranque on next pass
                console.log(`⚠️ Not a Pase Redondo - current player also can't play (Tranque incoming)`);
                // Continue to next player to complete the Tranque
            }
        }

        // Check for Tranque (all 4 passed)
        if (this.gameState.consecutivePasses === 4) {
            console.log(`🔒 TRANQUE - All players passed`);
            this.handleTranque();
            return;
        }

        // Move to next player
        this.nextTurn();
    }

    private nextTurn() {
        if (this.gameState.winnerTeam) return;

        // COUNTERCLOCKWISE turn order: 0 (South) -> 1 (East) -> 2 (North) -> 3 (West) -> 0
        const currentIdx = this.gameState.players.findIndex(p => p.id === this.gameState.currentTurnPlayerId);
        const nextIdx = (currentIdx + 1) % this.gameState.players.length;
        this.gameState.currentTurnPlayerId = this.gameState.players[nextIdx].id;

        console.log(`Turn: ${this.gameState.players[currentIdx].name} → ${this.gameState.players[nextIdx].name} (counterclockwise)`);

        this.startTurnTimer();
    }

    // --- Scoring & End Game ---
    private handleWin(winner: Player, type: 'domino' | 'tranque', isCapicua: boolean = false) {
        this.gameState.handWinnerId = winner.id;

        // Calculate points from UNPLAYED pieces (pieces still in hand)
        // Each player's remaining pieces are summed
        const totalTable = this.gameState.players.reduce((sum, p) => sum + this.sumHand(p.hand), 0);

        console.log(`Counting unplayed pieces:`);
        this.gameState.players.forEach(p => {
            const handValue = this.sumHand(p.hand);
            console.log(`  ${p.name} (Team ${p.team}): ${p.hand.length} pieces = ${handValue} points`);
        });
        console.log(`  Total unplayed: ${totalTable} points`);

        // Apply bonus
        let bonus = 0; // Initialize bonus variable
        if (type === 'domino' && isCapicua) {
            bonus = 30;
            console.log("🎉 ¡Capicúa! Bonus +30 (ALWAYS applies, even with 170+ points)");
            this.gameState.winReason = 'capicua';
        } else {
            this.gameState.winReason = type;
        }

        // Update Score - Add points to ALL team members
        // Update Score - Add points to TEAM SCORES
        const teamPlayers = this.gameState.players.filter(p => p.team === winner.team);
        const pointsToAdd = totalTable + bonus;

        // update dedicated team score
        this.gameState.teamScores[winner.team] += pointsToAdd;

        // Store points earned this hand for UI display
        this.gameState.handPoints = pointsToAdd;

        // Also update individual player score (just for tracking, not for game logic anymore)
        winner.score += pointsToAdd; // Only winner gets the "individual" credit if we want to keep it

        console.log(`Team ${winner.team} wins hand! Points: ${totalTable} + Bonus: ${bonus} = ${pointsToAdd}`);
        console.log(`Current Scores: Team A: ${this.gameState.teamScores.A}, Team B: ${this.gameState.teamScores.B}`);

        // Check Match Win Condition - Use TEAM SCORE
        const teamScore = this.gameState.teamScores[winner.team];
        if (teamScore >= 200) {
            this.gameState.winnerTeam = winner.team;
            console.log(`🏆 Team ${winner.team} wins the match with ${teamScore} points!`);
        } else {
            this.lastWinnerId = winner.id;
            this.gameState.handNumber++;
            console.log(`Hand ${this.gameState.handNumber - 1} won by ${winner.name}. Points: ${pointsToAdd}`);
        }

        // Stop timer
        if (this.timer) {
            clearTimeout(this.timer);
            this.timer = null;
        }
    }

    private handleTranque() {
        if (this.timer) clearTimeout(this.timer);
        console.log("Tranque detected!");

        // Logic: The "trancador" is the last player who successfully placed a piece.
        // After that placement, 4 consecutive passes happened.
        // Current turn is at the player who would play next after the 4th pass.
        // So we need to go back 4 positions to find who played last.

        const currentIdx = this.gameState.players.findIndex(p => p.id === this.gameState.currentTurnPlayerId);

        // The trancador is 4 positions back (wrapping around)
        const trancadorIdx = (currentIdx - 4 + this.gameState.players.length) % this.gameState.players.length;
        const trancador = this.gameState.players[trancadorIdx];

        // The opponent is the next player after trancador
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
            // Tie: In Dominican rules, usually the trancador loses on ties
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
