export type Piece = [number, number];

export interface Player {
    id: string; // Socket ID
    name: string;
    hand: Piece[];
    score: number;
    // Game session specific
    team: 'A' | 'B'; // For 2vs2
    position: number; // 0-3
    extensionUsed: boolean; // "Extensión de pensamiento"
}

export type GameStatus = 'waiting' | 'matchmaking' | 'playing' | 'finished';

export interface GameState {
    board: {
        piece: Piece;
        // We might need to track how it was placed (left/right) for UI, 
        // but specific logic can handle head/tail. 
        // For now, simpler is better.
    }[];
    players: Player[];
    currentTurnPlayerId: string;
    turnDeadline: number; // Timestamp for 8s limit
    winnerTeam?: 'A' | 'B';
    consecutivePasses: number; // To detect blocked game (tranque)
    handNumber: number;
    handWinnerId?: string;
    winReason?: 'domino' | 'tranque' | 'capicua';
    handPoints?: number; // Points earned in this hand (for display breakdown)
    teamScores: { A: number, B: number };
}

export interface RoomConfig {
    maxPlayers: number;
    isPrivate: boolean;
    targetScore: number; // 200
    turnDuration: number; // 15 seconds
}

export interface Room {
    id: string;
    hostId: string;
    players: Player[];
    spectators: string[]; // Socket IDs
    status: GameStatus;
    config: RoomConfig;
    gameState: GameState | null;
    engine?: any; // GameEngine instance (avoiding circular dependency)
    matchmakingStartTime?: number;
    invitedPlayers: string[]; // Socket IDs of invited players
    disconnectedPlayers: Map<string, { playerId: string, playerName: string, disconnectTime: number }>; // Track disconnections
    readyPlayers: Set<string>; // Players ready for next hand
    nextHandTimer?: NodeJS.Timeout; // Timer for auto-start next hand
}
