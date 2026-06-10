import { Server, Socket } from 'socket.io';
import { RoomManager } from './roomManager';
import { GameEngine } from './gameEngine';
import { Piece } from './types';

const roomManager = new RoomManager();

// Helper function to start game automatically
function startGameAutomatically(roomId: string, io: Server, manager: RoomManager) {
    const room = manager.getRoom(roomId);
    if (!room || room.players.length < 4) return;

    // Sort players by position to ensure correct turn order (0->1->2->3)
    room.players.sort((a, b) => (a.position - b.position));

    // Create engine with state change callback
    const engine = new GameEngine(room.players, room.config, (state) => {
        io.to(room.id).emit('game_update', state);
    });
    room.gameState = engine.getState();
    room.engine = engine;

    engine.startHand();
    room.status = 'playing';

    io.to(room.id).emit('game_started', room.gameState);
}

// Helper function for matchmaking auto-fill
function startAutoFill(roomId: string, io: Server, manager: RoomManager) {
    const MATCHMAKING_TIMEOUT = 30000; // 30 seconds
    const CHECK_INTERVAL = 1000; // 1 second

    const checkInterval = setInterval(() => {
        const room = manager.getRoom(roomId);
        if (!room || room.status !== 'matchmaking') {
            clearInterval(checkInterval);
            return;
        }

        const needed = 4 - room.players.length;
        if (needed > 0) {
            const available = manager.findPlayersForRoom(roomId, needed);

            // Add available players
            available.forEach(({ id, name }) => {
                const playerSocket = io.sockets.sockets.get(id);
                if (playerSocket) {
                    const updated = manager.joinRoom(roomId, id, name, false);

                    if (updated) {
                        playerSocket.join(roomId);
                        manager.removeFromMatchmaking(id);
                        playerSocket.emit('room_joined', updated);
                        io.to(roomId).emit('player_joined', updated.players);
                    }
                }
            });
        }

        // Check if full or timeout
        const currentRoom = manager.getRoom(roomId);
        if (!currentRoom) {
            clearInterval(checkInterval);
            return;
        }

        const elapsed = Date.now() - (currentRoom.matchmakingStartTime || 0);
        const isFull = currentRoom.players.length === 4;
        const isTimeout = elapsed >= MATCHMAKING_TIMEOUT;

        if (isFull || isTimeout) {
            clearInterval(checkInterval);

            if (currentRoom.players.length >= 4) {
                startGameAutomatically(roomId, io, manager);
            } else {
                io.to(roomId).emit('matchmaking_failed', {
                    message: `No se encontraron suficientes jugadores. Tienes ${currentRoom.players.length}/4.`
                });
                currentRoom.status = 'waiting';
            }
        }
    }, CHECK_INTERVAL);
}

// Helper function to start next hand
function startNextHand(room: any, io: Server, manager: RoomManager) {
    const engine = room.engine as GameEngine;
    if (!engine) return;

    room.readyPlayers.clear();

    if (room.nextHandTimer) {
        clearTimeout(room.nextHandTimer);
        room.nextHandTimer = undefined;
    }

    engine.startHand();
    io.to(room.id).emit('game_update', engine.getState());
}

export const setupSocketHandlers = (io: Server) => {
    io.on('connection', (socket: Socket) => {
        // ... existing handlers ...
        // Note: We need to store GameEngines map
        // Better: Room object should hold the Engine instance?
        // Let's modify Room type or RoomManager. 
        // For now, let's keep a map here or attach to RoomManager status.
        // Ideally, RoomManager manages the state.

        // START GAME
        socket.on('start_game', (data: { roomId: string }) => {
            const room = roomManager.getRoom(data.roomId);
            if (!room) {
                socket.emit('error', { message: 'Sala no encontrada' });
                return;
            }
            if (room.hostId !== socket.id) {
                socket.emit('error', { message: 'Solo el anfitrión puede iniciar el juego' });
                return;
            }

            // Validate minimum players (4 for Dominican Dominoes)
            if (room.players.length < 4) {
                socket.emit('error', {
                    message: `Se necesitan 4 jugadores para comenzar. Actualmente hay ${room.players.length}.`
                });
                return;
            }

            // Sort players by position to ensure correct turn order (0->1->2->3)
            room.players.sort((a, b) => (a.position - b.position));

            const engine = new GameEngine(room.players, room.config, (state) => {
                io.to(room.id).emit('game_update', state);
            });
            room.gameState = engine.getState();
            room.engine = engine;

            engine.startHand();
            room.status = 'playing';

            io.to(room.id).emit('game_started', room.gameState);
        });

        // START MATCHMAKING (for private rooms with invites)
        socket.on('start_matchmaking', (data: { roomId: string }) => {
            const room = roomManager.getRoom(data.roomId);
            if (!room) {
                socket.emit('error', { message: 'Sala no encontrada' });
                return;
            }
            if (room.hostId !== socket.id) {
                socket.emit('error', { message: 'Solo el anfitrión puede iniciar matchmaking' });
                return;
            }

            // Check for invited players if private room
            if (room.config.isPrivate && room.invitedPlayers.length === 0) {
                socket.emit('error', {
                    message: 'Necesitas al menos 1 invitado para iniciar matchmaking en sala privada'
                });
                return;
            }

            // Start matchmaking
            if (roomManager.startMatchmaking(room.id)) {
                io.to(room.id).emit('matchmaking_started', {
                    message: 'Buscando jugadores adicionales...',
                    timeout: 30000,
                    currentPlayers: room.players.length
                });

                // Start auto-fill process
                startAutoFill(room.id, io, roomManager);
            } else {
                socket.emit('error', { message: 'No se pudo iniciar matchmaking' });
            }
        });

        // PLACE PIECE
        socket.on('place_piece', (data: { roomId: string, piece: Piece, side: 'head' | 'tail' }) => {
            const room = roomManager.getRoom(data.roomId);
            if (!room || !room.gameState) return;
            const engine = (room as any).engine as GameEngine;

            const success = engine.placePiece(socket.id, data.piece, data.side);
            if (success) {
                io.to(room.id).emit('game_update', engine.getState());
            } else {
                socket.emit('error', { message: 'Invalid move' });
            }
        });

        // PASS TURN
        socket.on('pass_turn', (data: { roomId: string }) => {
            const room = roomManager.getRoom(data.roomId);
            if (!room || !room.gameState) return;
            const engine = (room as any).engine as GameEngine;

            // Engine expects passTurn(playerId)
            engine.passTurn(socket.id);
            // We need to check if pass was successful/valid? engine.passTurn is void but checks validity internally.
            // It updates state if valid.
            io.to(room.id).emit('game_update', engine.getState());
        });

        // EXTENSION
        // ANTI-CHEAT: FOCUS DETECTION
        socket.on('player_blur', (data: { roomId: string }) => {
            const room = roomManager.getRoom(data.roomId);
            if (!room) return;
            // Notify others
            socket.to(data.roomId).emit('notification', {
                type: 'warning',
                message: `User ${socket.id} (Player) has switched tabs! Anti-cheat alert.`
            });
        });

        // EXTENSION REMOVED
        // ANTI-CHEAT: FOCUS DETECTION

        // PLAYER READY FOR NEXT HAND
        socket.on('player_ready', (data: { roomId: string }) => {
            const room = roomManager.getRoom(data.roomId);
            if (!room || !room.gameState) return;

            room.readyPlayers.add(socket.id);

            const playerName = room.players.find(p => p.id === socket.id)?.name || 'Unknown';

            io.to(room.id).emit('ready_status', {
                readyCount: room.readyPlayers.size,
                totalPlayers: room.players.length,
                readyPlayers: Array.from(room.readyPlayers)
            });

            if (room.readyPlayers.size === 1) {
                room.nextHandTimer = setTimeout(() => {
                    startNextHand(room, io, roomManager);
                }, 10000);
            }

            if (room.readyPlayers.size === room.players.length) {
                if (room.nextHandTimer) {
                    clearTimeout(room.nextHandTimer);
                    room.nextHandTimer = undefined;
                }

                startNextHand(room, io, roomManager);
            }
        });

        // Existing handlers below...
        // Create Room
        socket.on('create_room', (data: { playerName: string; isPrivate: boolean }) => {
            const room = roomManager.createRoom(socket.id, data.playerName, data.isPrivate);
            socket.join(room.id);
            socket.emit('room_joined', room);
        });

        // Join Room
        socket.on('join_room', (data: { roomId: string; playerName: string }) => {
            const room = roomManager.getRoom(data.roomId);

            if (!room) {
                socket.emit('error', { message: 'Sala no encontrada' });
                return;
            }

            let isReconnection = false;
            let reconnectedPlayer = null;

            for (const [disconnectedSocketId, disconnectedInfo] of room.disconnectedPlayers.entries()) {
                if (disconnectedInfo.playerName === data.playerName) {
                    isReconnection = true;
                    reconnectedPlayer = room.players.find(p => p.id === disconnectedSocketId);

                    if (reconnectedPlayer) {
                        reconnectedPlayer.id = socket.id;
                        room.disconnectedPlayers.delete(disconnectedSocketId);
                        socket.join(room.id);

                        const cleanRoom = {
                            id: room.id,
                            hostId: room.hostId,
                            players: room.players,
                            spectators: room.spectators,
                            status: room.status,
                            config: room.config,
                            gameState: room.gameState,
                            invitedPlayers: room.invitedPlayers
                        };
                        socket.emit('room_joined', cleanRoom);

                        if (room.status === 'playing' && room.gameState) {
                            socket.emit('game_started', room.gameState);
                            const engine = (room as any).engine;
                            if (engine) {
                                socket.emit('game_update', engine.getState());
                            }
                        }

                        io.to(room.id).emit('notification', {
                            type: 'success',
                            message: `${data.playerName} se ha reconectado!`
                        });
                        io.to(room.id).emit('player_joined', room.players);
                        return;
                    }
                }
            }

            // Not a reconnection, try normal join
            const updatedRoom = roomManager.joinRoom(data.roomId, socket.id, data.playerName, true); // Mark as invited
            if (updatedRoom) {
                socket.join(updatedRoom.id);
                socket.emit('room_joined', updatedRoom);
                io.to(updatedRoom.id).emit('player_joined', updatedRoom.players);
            } else {
                socket.emit('error', { message: 'No se puede unir a la sala (puede estar llena o en juego)' });
            }
        });

        // Find Match
        socket.on('find_match', (data: { playerName: string }) => {
            // Add to matchmaking queue
            roomManager.addToMatchmaking(socket.id, data.playerName);

            // Try to find existing public room
            let room = roomManager.findMatch(socket.id);

            if (!room) {
                // Create new public room
                room = roomManager.createRoom(socket.id, data.playerName, false);
                socket.join(room.id);
                socket.emit('room_joined', room);
                socket.emit('matchmaking_started', {
                    message: 'Buscando jugadores...',
                    queueSize: roomManager.getQueueSize()
                });
            } else {
                // Join existing room
                const updatedRoom = roomManager.joinRoom(room.id, socket.id, data.playerName);
                if (updatedRoom) {
                    roomManager.removeFromMatchmaking(socket.id);
                    socket.join(updatedRoom.id);
                    socket.emit('room_joined', updatedRoom);
                    io.to(updatedRoom.id).emit('player_joined', updatedRoom.players);

                    // If room is full, start game automatically
                    if (updatedRoom.players.length === 4) {
                        startGameAutomatically(updatedRoom.id, io, roomManager);
                    }
                }
            }
        });

        socket.on('disconnect', () => {
            const rooms = (roomManager as any).rooms as Map<string, any>;

            for (const [roomId, room] of rooms.entries()) {
                const player = room.players.find((p: any) => p.id === socket.id);

                if (player && room.status === 'playing') {
                    room.disconnectedPlayers.set(socket.id, {
                        playerId: socket.id,
                        playerName: player.name,
                        disconnectTime: Date.now()
                    });

                    io.to(roomId).emit('notification', {
                        type: 'warning',
                        message: `${player.name} se ha desconectado. Tiene 2 minutos para volver...`
                    });

                    setTimeout(() => {
                        if (room.disconnectedPlayers.has(socket.id)) {
                            const losingTeam = player.team;
                            const winningTeam = losingTeam === 'A' ? 'B' : 'A';

                            room.status = 'finished';
                            if (room.gameState) {
                                room.gameState.winnerTeam = winningTeam;
                            }

                            io.to(roomId).emit('match_won', {
                                team: winningTeam,
                                totalScore: 200,
                                reason: `${player.name} abandonó la partida`
                            });

                            room.disconnectedPlayers.delete(socket.id);
                            roomManager.leaveRoom(roomId, socket.id);
                        }
                    }, 120000);

                    break;
                } else if (player) {
                    roomManager.leaveRoom(roomId, socket.id);
                    io.to(roomId).emit('player_joined', room.players);
                    break;
                }
            }

            roomManager.removeFromMatchmaking(socket.id);
        });
    });
};
