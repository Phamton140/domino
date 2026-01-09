export type Piece = [number, number];

export interface Player {
    id: string;
    name: string;
    hand: Piece[];
    score: number;
    team: 'A' | 'B';
    position: number; // 0-3: 0=South, 1=East, 2=North, 3=West (Counter-Clockwise)
}

export type GameStatus = 'waiting' | 'playing' | 'finished';

export interface GameState {
    players: Player[];
    board: { piece: Piece, isStarter?: boolean, ownerTeam?: 'A' | 'B' }[];
    currentTurnPlayerId: string;
    turnDeadline: number;
    handNumber: number;
    consecutivePasses: number;
    handWinnerId: string | null;
    winnerTeam: 'A' | 'B' | null;
    winReason?: 'domino' | 'tranque' | 'capicua';
    handPoints?: number; // Points earned in this hand (for display breakdown)
    teamScores: { A: number, B: number };
}

export interface Room {
    id: string;
    hostId: string;
    players: Player[];
    status: GameStatus;
    gameState: GameState | null;
    config: {
        isPrivate: boolean;
        maxPlayers: number;
        targetScore: number;
        turnDuration: number;
    };
}
