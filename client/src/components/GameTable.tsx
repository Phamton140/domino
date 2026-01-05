import React, { useEffect, useState } from 'react';
import type { GameState, Piece, Player } from '../types';
import { socket } from '../socket';
import { DominoPiece } from './DominoPiece';
import { DominoBoard } from './DominoBoard';
import { SideSelectionModal } from './SideSelectionModal';
import './GameTable.css';

interface Props {
    initialState: GameState;
    roomId: string;
    myId: string;
}

export const GameTable: React.FC<Props> = ({ initialState, roomId, myId }) => {
    const [gameState, setGameState] = useState<GameState>(initialState);
    const [timeLeft, setTimeLeft] = useState(0);
    const [notification, setNotification] = useState<{ message: string, type: string } | null>(null);
    const [pendingPiece, setPendingPiece] = useState<Piece | null>(null);
    const [readyCount, setReadyCount] = useState(0);
    const [totalPlayers, setTotalPlayers] = useState(4);
    const [isReady, setIsReady] = useState(false);

    useEffect(() => {
        function onGameUpdate(state: GameState) {
            setGameState(state);
            setNotification(null);
            // Reset ready status when new hand starts
            if (state.handNumber !== gameState.handNumber) {
                setIsReady(false);
                setReadyCount(0);
            }
        }

        function onNotification(data: { message: string, type: string }) {
            setNotification(data);
            setTimeout(() => setNotification(null), 3000);
        }

        function onReadyStatus(data: { readyCount: number, totalPlayers: number, readyPlayers: string[] }) {
            setReadyCount(data.readyCount);
            setTotalPlayers(data.totalPlayers);
            const currentSocketId = socket.id || myId;
            setIsReady(data.readyPlayers.includes(currentSocketId));
        }

        socket.on('game_update', onGameUpdate);
        socket.on('notification', onNotification);
        socket.on('ready_status', onReadyStatus);

        // Timer Interval - ONLY for current player
        const interval = setInterval(() => {
            const currentSocketId = socket.id || myId;
            // Only update timer if it's the current player's turn
            if (gameState.turnDeadline > 0 && gameState.currentTurnPlayerId === currentSocketId) {
                setTimeLeft(Math.max(0, Math.ceil((gameState.turnDeadline - Date.now()) / 1000)));
            } else {
                setTimeLeft(0);
            }
        }, 100);

        return () => {
            socket.off('game_update', onGameUpdate);
            socket.off('notification', onNotification);
            socket.off('ready_status', onReadyStatus);
            clearInterval(interval);
        }
    }, [gameState.turnDeadline, gameState.currentTurnPlayerId, gameState.handNumber, roomId, myId]);

    const handlePlacePiece = (piece: Piece) => {
        const head = gameState.board[0]?.piece[0];
        const tail = gameState.board[gameState.board.length - 1]?.piece[1];

        if (gameState.board.length === 0) {
            socket.emit('place_piece', { roomId, piece, side: 'tail' });
            return;
        }

        const canPlayHead = piece[0] === head || piece[1] === head;
        const canPlayTail = piece[0] === tail || piece[1] === tail;

        // DOMINICAN RULE: If both ends are the same number, ALWAYS play to the right (tail)
        if (head === tail && (canPlayHead || canPlayTail)) {
            socket.emit('place_piece', { roomId, piece, side: 'tail' });
            return;
        }

        if (canPlayHead && !canPlayTail) {
            socket.emit('place_piece', { roomId, piece, side: 'head' });
        } else if (canPlayTail && !canPlayHead) {
            socket.emit('place_piece', { roomId, piece, side: 'tail' });
        } else if (canPlayHead && canPlayTail) {
            setPendingPiece(piece);
        } else {
            alert("¡Esta ficha no encaja!");
        }
    };

    const handleSideSelection = (side: 'head' | 'tail') => {
        if (pendingPiece) {
            socket.emit('place_piece', { roomId, piece: pendingPiece, side });
            setPendingPiece(null);
        }
    };

    const handlePass = () => {
        socket.emit('pass_turn', { roomId });
    };

    const handleExtension = () => {
        socket.emit('use_extension', { roomId });
    };

    const currentSocketId = socket.id || myId;
    const isMyTurn = gameState.currentTurnPlayerId === currentSocketId;
    const myPlayer = gameState.players.find(p => p.id === currentSocketId);

    // Determines relative position: 0=Bottom(Me), 1=Right, 2=Top, 3=Left
    // This assumes specific absolute positions: 0=South, 1=East, 2=North, 3=West
    const getRelativePosition = (absPos: number, myAbsPos: number) => {
        return (absPos - myAbsPos + 4) % 4;
    };

    const myPos = myPlayer?.position ?? 0; // Default to 0 if not found (observer/error)

    // Group players by position
    const playersByPos: { [key: number]: Player } = {};
    gameState.players.forEach((p) => {
        // Use p.position if available, otherwise fallback to finding index (legacy safety)
        const absPos = p.position !== undefined ? p.position : gameState.players.findIndex(pl => pl.id === p.id);
        const pos = getRelativePosition(absPos, myPos);
        playersByPos[pos] = p;
    });

    const renderPlayerCard = (pos: number) => {
        const player = playersByPos[pos];
        if (!player) return null; // Should not happen in 4 player game

        const isActive = player.id === gameState.currentTurnPlayerId;

        return (
            <div className={`player-card team-${player.team} ${isActive ? 'active' : ''}`}>
                <div className="player-avatar">
                    {player.name.substring(0, 2).toUpperCase()}
                </div>
                <div className="player-name">{player.name}</div>
                <div className="player-stats">
                    {player.score} pts (indiv) | {player.hand.length} fichas
                </div>
                {/* Visual indicator of remaining tiles */}
                <div className="hand-preview">
                    {Array.from({ length: Math.min(player.hand.length, 7) }).map((_, i) => (
                        <div key={i} className="mini-tile-back"></div>
                    ))}
                </div>
            </div>
        );
    };

    return (
        <div className="game-table">
            {pendingPiece && (
                <SideSelectionModal
                    onSelect={handleSideSelection}
                    onCancel={() => setPendingPiece(null)}
                />
            )}

            {/* Header / Info Bar */}
            <div className="info-bar">
                <div className="room-code-display">
                    <span>Sala: {roomId}</span>
                </div>

                {gameState.players.length === 4 && (
                    <div className="scores">
                        <span style={{ color: '#ff4444' }}>Team A: {gameState.teamScores?.A || 0}</span>
                        <span style={{ margin: '0 10px' }}>vs</span>
                        <span style={{ color: '#4444ff' }}>Team B: {gameState.teamScores?.B || 0}</span>
                    </div>
                )}

                <div className="turn-indicator">
                    {isMyTurn
                        ? <span className="timer">Tu Turno! ({timeLeft}s)</span>
                        : <span>Turno de: {gameState.players.find(p => p.id === gameState.currentTurnPlayerId)?.name}</span>
                    }
                </div>
            </div>

            {/* Left Player */}
            <div className="player-side left">
                {renderPlayerCard(3)}
            </div>

            {/* Center Area: Board + Top Player */}
            <div className="center-area">
                <div className="top-player-container">
                    {renderPlayerCard(2)}
                </div>

                <div className="board-container">
                    <DominoBoard board={gameState.board} />
                </div>
            </div>

            {/* Right Player */}
            <div className="player-side right">
                {renderPlayerCard(1)}
            </div>

            {/* Bottom Area: My Hand */}
            <div className="my-hand-area">
                {/* My Player Info (Optional, but good to see my own score) */}

                <div className="controls">
                    {isMyTurn && <button onClick={handlePass} className="pass-btn">Pasar</button>}
                    {isMyTurn && !myPlayer?.extensionUsed && (
                        <button onClick={handleExtension} className="extension-btn">Extensión</button>
                    )}
                </div>

                <div className="my-hand">
                    {myPlayer?.hand.map((piece, i) => {
                        const head = gameState.board[0]?.piece[0];
                        const tail = gameState.board[gameState.board.length - 1]?.piece[1];
                        let isValid = false;

                        if (gameState.board.length === 0) {
                            if (gameState.handNumber === 1) {
                                isValid = (piece[0] === 6 && piece[1] === 6);
                            } else {
                                isValid = true;
                            }
                        } else if (piece[0] === head || piece[1] === head || piece[0] === tail || piece[1] === tail) {
                            isValid = true;
                        }

                        return (
                            <DominoPiece
                                key={i}
                                values={piece}
                                onClick={() => isMyTurn && handlePlacePiece(piece)}
                                disabled={!isMyTurn || !isValid}
                                size="large" // Make my pieces larger
                            />
                        );
                    })}
                </div>
            </div>

            {/* Overlays */}
            {notification && (
                <div className={`notification-toast ${notification.type}`}>
                    {notification.message}
                </div>
            )}

            {gameState.handWinnerId && !gameState.winnerTeam && (
                <div className="overlay">
                    <h2>¡Mano Terminada!</h2>
                    <p className="winner-name">Ganador: {gameState.players.find(p => p.id === gameState.handWinnerId)?.name}</p>
                    {gameState.winReason && (
                        <p className="win-reason">
                            {gameState.winReason === 'capicua' && '🎉 ¡CAPICÚA! (+30 puntos bonus)'}
                            {gameState.winReason === 'domino' && '✨ Dominó'}
                            {gameState.winReason === 'tranque' && '🔒 Tranque'}
                        </p>
                    )}

                    <div className="hand-points">
                        <h3>Puntos: +{gameState.handPoints || 0}</h3>
                    </div>

                    <div className="ready-system" style={{ marginTop: '20px' }}>
                        <p className="ready-count">{readyCount}/{totalPlayers} listos</p>
                        {!isReady ? (
                            <button
                                className="primary"
                                style={{ fontSize: '1.2rem', padding: '10px 30px' }}
                                onClick={() => {
                                    socket.emit('player_ready', { roomId });
                                    setIsReady(true);
                                }}
                            >
                                ¡Listo!
                            </button>
                        ) : (
                            <p>✅ Esperando...</p>
                        )}
                    </div>
                </div>
            )}

            {gameState.winnerTeam && (
                <div className="overlay victory">
                    <h2>🏆 ¡Partida Terminada!</h2>
                    <p className="victory-message">¡El Equipo {gameState.winnerTeam} gana!</p>
                    <button onClick={() => window.location.reload()}>Salir</button>
                </div>
            )}
        </div>
    );
};
