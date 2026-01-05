import { Room, Player, RoomConfig } from './types';
import { v4 as uuidv4 } from 'uuid';

export class RoomManager {
    private rooms: Map<string, Room> = new Map();
    private matchmakingQueue: Map<string, string> = new Map(); // playerId -> playerName

    createRoom(hostId: string, hostName: string, isPrivate: boolean = false): Room {
        const roomId = uuidv4().slice(0, 6).toUpperCase(); // Short code for sharing

        // Create host player
        const host: Player = {
            id: hostId,
            name: hostName,
            hand: [],
            score: 0,
            team: 'A', // Host is team A
            extensionUsed: false
        };

        const newRoom: Room = {
            id: roomId,
            hostId,
            players: [host],
            spectators: [],
            status: 'waiting',
            config: {
                maxPlayers: 4,
                isPrivate,
                targetScore: 200,
                turnDuration: 15 // 15 seconds per turn
            },
            gameState: null,
            invitedPlayers: [], // Initialize empty
            disconnectedPlayers: new Map(), // Track disconnections
            readyPlayers: new Set() // Track ready status for next hand
        };

        this.rooms.set(roomId, newRoom);
        return newRoom;
    }

    joinRoom(roomId: string, playerId: string, playerName: string, isInvited: boolean = false): Room | null {
        const room = this.getRoom(roomId);
        if (!room) return null;
        if (room.status !== 'waiting' && room.status !== 'matchmaking') return null;
        if (room.players.length >= room.config.maxPlayers) return null;

        const existingPlayer = room.players.find(p => p.id === playerId);
        if (existingPlayer) return room; // Already joined

        const position = room.players.length;

        // DOMINICAN DOMINOES SEATING (Counterclockwise):
        // Position 0 (Host/South) - Team A
        // Position 3 (West) - Team B (opponent to the right)
        // Position 2 (North/Partner) - Team A (across from host)
        // Position 1 (East) - Team B (opponent to the left)
        //
        // Turn order (counterclockwise): 0 → 3 → 2 → 1 → 0
        // Teams: A (0,2) vs B (1,3)

        const team = (position === 0 || position === 2) ? 'A' : 'B';

        const newPlayer: Player = {
            id: playerId,
            name: playerName,
            hand: [],
            score: 0,
            team,
            extensionUsed: false
        };

        room.players.push(newPlayer);

        // Track invited players
        if (isInvited) {
            room.invitedPlayers.push(playerId);
        }

        console.log(`✅ ${playerName} joined room ${roomId} at position ${position} (Team ${team})`);

        return room;
    }

    leaveRoom(roomId: string, playerId: string): boolean {
        const room = this.rooms.get(roomId);
        if (!room) return false;

        room.players = room.players.filter(p => p.id !== playerId);
        room.spectators = room.spectators.filter(id => id !== playerId);
        room.invitedPlayers = room.invitedPlayers.filter(id => id !== playerId);

        // If room empty, destroy
        if (room.players.length === 0 && room.spectators.length === 0) {
            this.rooms.delete(roomId);
        } else if (room.hostId === playerId) {
            // Reassign host
            room.hostId = room.players[0]?.id || '';
        }

        return true;
    }

    getRoom(roomId: string): Room | undefined {
        return this.rooms.get(roomId);
    }

    // Find a public room with space
    findMatch(playerId: string): Room | null {
        for (const room of this.rooms.values()) {
            if (!room.config.isPrivate &&
                room.status === 'waiting' &&
                room.players.length < room.config.maxPlayers) {
                return room;
            }
        }
        return null;
    }

    // Matchmaking queue methods
    addToMatchmaking(playerId: string, playerName: string): void {
        if (!this.matchmakingQueue.has(playerId)) {
            this.matchmakingQueue.set(playerId, playerName);
            console.log(`➕ Added ${playerName} to matchmaking queue (${this.matchmakingQueue.size} total)`);
        }
    }

    removeFromMatchmaking(playerId: string): void {
        const playerName = this.matchmakingQueue.get(playerId);
        if (this.matchmakingQueue.delete(playerId)) {
            console.log(`➖ Removed ${playerName} from matchmaking queue (${this.matchmakingQueue.size} remaining)`);
        }
    }

    getPlayerName(playerId: string): string | undefined {
        return this.matchmakingQueue.get(playerId);
    }

    findPlayersForRoom(roomId: string, needed: number): Array<{ id: string, name: string }> {
        const room = this.getRoom(roomId);
        if (!room) return [];

        const available: Array<{ id: string, name: string }> = [];

        for (const [playerId, playerName] of this.matchmakingQueue.entries()) {
            // Skip if already in this room
            if (room.players.some(p => p.id === playerId)) continue;

            available.push({ id: playerId, name: playerName });

            if (available.length >= needed) break;
        }

        return available;
    }

    startMatchmaking(roomId: string): boolean {
        const room = this.getRoom(roomId);
        if (!room) return false;

        // Verificar que haya al menos 1 invitado si es sala privada
        if (room.config.isPrivate && room.invitedPlayers.length === 0) {
            return false;
        }

        room.status = 'matchmaking';
        room.matchmakingStartTime = Date.now();
        console.log(`🔍 Started matchmaking for room ${roomId} (${room.players.length}/4 players)`);
        return true;
    }

    getQueueSize(): number {
        return this.matchmakingQueue.size;
    }
}

