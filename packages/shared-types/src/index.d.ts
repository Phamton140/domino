/**
 * Shared TypeScript types for Domino game
 * Used by: Server (Node.js), Web Client (React), Mobile Client (Flutter via codegen)
 */
export type Piece = [number, number];
export interface Player {
    id: string;
    name: string;
    hand: Piece[];
    score: number;
    team: "A" | "B";
    position: number;
}
export type GameStatus = "waiting" | "matchmaking" | "playing" | "finished";
export interface BoardPiece {
    piece: Piece;
    isStarter?: boolean;
    ownerTeam?: "A" | "B";
}
export interface GameState {
    board: BoardPiece[];
    players: Player[];
    currentTurnPlayerId: string;
    turnDeadline: number;
    winnerTeam?: "A" | "B";
    consecutivePasses: number;
    handNumber: number;
    handWinnerId?: string;
    winReason?: "domino" | "tranque" | "capicua";
    handPoints?: number;
    teamScores: {
        A: number;
        B: number;
    };
}
export interface RoomConfig {
    maxPlayers: number;
    isPrivate: boolean;
    targetScore: number;
    turnDuration: number;
}
export interface Room {
    id: string;
    hostId: string;
    players: Player[];
    spectators: string[];
    status: GameStatus;
    config: RoomConfig;
    gameState: GameState | null;
    matchmakingStartTime?: number;
    invitedPlayers: string[];
    disconnectedPlayers: Map<string, {
        playerId: string;
        playerName: string;
        disconnectTime: number;
    }>;
    readyPlayers: Set<string>;
    nextHandTimer?: ReturnType<typeof setTimeout>;
}
export interface ServerToClientEvents {
    room_joined: (room: Room) => void;
    player_joined: (players: Player[]) => void;
    game_started: (state: GameState) => void;
    game_update: (state: GameState) => void;
    error: (err: {
        message: string;
    }) => void;
    notification: (data: {
        message: string;
        type: "info" | "warning" | "success" | "error";
    }) => void;
    matchmaking_started: (data: {
        message: string;
        timeout?: number;
        currentPlayers: number;
    }) => void;
    matchmaking_failed: (data: {
        message: string;
    }) => void;
    ready_status: (data: {
        readyCount: number;
        totalPlayers: number;
        readyPlayers: string[];
    }) => void;
    match_won: (data: {
        team: "A" | "B";
        totalScore: number;
        reason: string;
    }) => void;
}
export interface ClientToServerEvents {
    create_room: (data: {
        playerName: string;
        isPrivate: boolean;
    }) => void;
    join_room: (data: {
        roomId: string;
        playerName: string;
    }) => void;
    find_match: (data: {
        playerName: string;
    }) => void;
    start_game: (data: {
        roomId: string;
    }) => void;
    start_matchmaking: (data: {
        roomId: string;
    }) => void;
    place_piece: (data: {
        roomId: string;
        piece: Piece;
        side: "head" | "tail";
    }) => void;
    pass_turn: (data: {
        roomId: string;
    }) => void;
    player_ready: (data: {
        roomId: string;
    }) => void;
    player_blur: (data: {
        roomId: string;
    }) => void;
    leave_room: () => void;
}
export declare const GAME_CONSTANTS: {
    readonly TARGET_SCORE: 200;
    readonly TILES_PER_PLAYER: 7;
    readonly MAX_PLAYERS: 4;
    readonly DEFAULT_TURN_DURATION: 15;
    readonly PASA_REDONDO_THRESHOLD: 170;
    readonly BONUS: {
        readonly CAPICUA: 30;
        readonly PASA_REDONDO: 30;
        readonly SALIDA_DOBLE: 30;
        readonly SALIDA_MIXTA: 60;
    };
    readonly RECONNECT_WINDOW_MS: 120000;
    readonly READY_TIMER_MS: 10000;
    readonly PASS_NOTIFICATION_MS: 2500;
};
export declare function sumHand(hand: Piece[]): number;
export declare function generateDeck(): Piece[];
export declare function shuffleDeck(deck: Piece[]): Piece[];
//# sourceMappingURL=index.d.ts.map