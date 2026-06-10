import type { Piece, Player, GameState, RoomConfig, Room, GameStatus, BoardPiece } from "@domino/shared-types";

// Re-export shared types
export type { Piece, Player, GameState, RoomConfig, Room, GameStatus, BoardPiece };

// Server-specific extensions
export interface ServerRoom extends Room {
  engine?: any; // GameEngine instance (avoiding circular dependency)
  nextHandTimer?: ReturnType<typeof setTimeout>;
}

// Type for socket events
export interface ServerToClientEvents {
  room_joined: (room: Room) => void;
  player_joined: (players: Player[]) => void;
  game_started: (state: GameState) => void;
  game_update: (state: GameState) => void;
  error: (err: { message: string }) => void;
  notification: (data: { message: string; type: "info" | "warning" | "success" | "error" }) => void;
  matchmaking_started: (data: { message: string; timeout?: number; currentPlayers: number }) => void;
  matchmaking_failed: (data: { message: string }) => void;
  ready_status: (data: { readyCount: number; totalPlayers: number; readyPlayers: string[] }) => void;
  match_won: (data: { team: "A" | "B"; totalScore: number; reason: string }) => void;
}

export interface ClientToServerEvents {
  create_room: (data: { playerName: string; isPrivate: boolean }) => void;
  join_room: (data: { roomId: string; playerName: string }) => void;
  find_match: (data: { playerName: string }) => void;
  start_game: (data: { roomId: string }) => void;
  start_matchmaking: (data: { roomId: string }) => void;
  place_piece: (data: { roomId: string; piece: Piece; side: "head" | "tail" }) => void;
  pass_turn: (data: { roomId: string }) => void;
  player_ready: (data: { roomId: string }) => void;
  player_blur: (data: { roomId: string }) => void;
  leave_room: () => void;
}
