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
    const [prevConsecutivePasses, setPrevConsecutivePasses] = useState(0);

    const currentSocketId = socket.id || myId;
    const isMyTurn = gameState.currentTurnPlayerId === currentSocketId;
    const myPlayer = gameState.players.find(p => p.id === currentSocketId);

    // Determines relative position: 0=Bottom(Me), 1=Right, 2=Top, 3=Left
    const getRelativePosition = (absPos: number, myAbsPos: number) => {
        return (absPos - myAbsPos + 4) % 4;
    };

    const myPos = myPlayer?.position ?? 0;

    const playersByPos: { [key: number]: Player } = {};
    gameState.players.forEach((p) => {
        const absPos = p.position !== undefined ? p.position : gameState.players.findIndex(pl => pl.id === p.id);
        const pos = getRelativePosition(absPos, myPos);
        playersByPos[pos] = p;
    });

    // Check if player has any valid moves
    const hasValidMove = myPlayer?.hand.some(piece => {
        // If board is empty
        if (gameState.board.length === 0) {
            // First hand MUST be double 6
            if (gameState.handNumber === 1) {
                return piece[0] === 6 && piece[1] === 6;
            }
            // Other hands: any piece can start
            return true;
        }

        const head = gameState.board[0]?.piece[0];
        const tail = gameState.board[gameState.board.length - 1]?.piece[1];

        // Check matching
        const canPlay = piece[0] === head || piece[1] === head || piece[0] === tail || piece[1] === tail;
        return canPlay;
    });

    console.log(`Render: ID=${currentSocketId}, Turn=${gameState.currentTurnPlayerId}, MyTurn=${isMyTurn}, ValidMove=${hasValidMove}`);

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
            setTimeout(() => setNotification(null), 2000);
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

        // Timer Interval - Updates for ANY player to drive the UI timer
        const interval = setInterval(() => {
            if (gameState.turnDeadline > 0) {
                // We always update 'timeLeft' so the UI re-renders and shows the progress ring for opponents too
                const time = Math.max(0, Math.ceil((gameState.turnDeadline - Date.now()) / 1000));
                setTimeLeft(time);
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

    // Auto-Pass Logic
    useEffect(() => {
        if (isMyTurn && !hasValidMove) {
            console.log("Auto-Pass Effect: No moves, scheduling pass...");
            const timer = setTimeout(() => {
                console.log("Auto-Pass Effect: Emitting pass_turn");
                socket.emit('pass_turn', { roomId });
            }, 1000);
            return () => clearTimeout(timer);
        }
    }, [isMyTurn, hasValidMove, roomId]);

    // Pass Notification Logic
    useEffect(() => {
        if (gameState.consecutivePasses > prevConsecutivePasses) {
            const currentPlayerIdx = gameState.players.findIndex(p => p.id === gameState.currentTurnPlayerId);
            // Previous player index (wrapping) - whoever just passed
            const prevPlayerIdx = (currentPlayerIdx - 1 + gameState.players.length) % gameState.players.length;
            const prevPlayer = gameState.players[prevPlayerIdx];

            if (prevPlayer) {
                setNotification({
                    message: `El jugador ${prevPlayer.name} ha pasado`,
                    type: 'info'
                });
                setTimeout(() => setNotification(null), 2000);
            }
        }
        setPrevConsecutivePasses(gameState.consecutivePasses);
    }, [gameState.consecutivePasses, prevConsecutivePasses, gameState.currentTurnPlayerId, gameState.players]);


    const handlePlacePiece = (piece: Piece) => {
        console.log("Attempting to place piece:", piece, "Room:", roomId);
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



    const renderPlayerCard = (pos: number) => {

        const player = playersByPos[pos];

        // Debug placeholder for missing players
        if (!player) {
            return (
                <div className="compact-player-card placeholder">
                    <div className="avatar-wrapper">
                        <div className="player-avatar" style={{ borderStyle: 'dashed', opacity: 0.5 }}>
                            ?
                        </div>
                    </div>
                    <div className="player-name" style={{ opacity: 0.5 }}>
                        Esperando...
                    </div>
                </div>
            );
        }

        const isActive = player.id === gameState.currentTurnPlayerId;

        // Timer Logic for Border
        let progress = 0;
        let circumference = 2 * Math.PI * 28; // r=28 (60px container, 2px border, slightly inside)

        if (isActive && gameState.turnDeadline) {
            // If it's ME, we use the local timeLeft state which decrements every second
            // If it's an OPPONENT, we can calculate it based on server time or stick to a simple visual cue
            // For better UX for "others", let's use the same timeLeft logic if we want to show THEIR time ticking
            // But 'timeLeft' state currently only updates if it is MY turn.
            // We should update the timer interval to update 'timeLeft' for ANY active player or create a separate display state.

            // However, to keep it simple and performant:
            // We can calculate the static percentage based on current render, but for smooth animation we need state or CSS.
            // CSS transition handles smoothness if we update a style property.

            const totalDuration = 20000; // Assuming 20s turn (need to verify this constant or pass it from server)
            const msLeft = Math.max(0, gameState.turnDeadline - Date.now());
            // We'll use a rough percentage for visual indication
            progress = msLeft / totalDuration;
        }

        const dashArray = circumference;
        const dashOffset = isActive ? circumference * (1 - progress) : circumference;
        // Note: Progress is cleaner if we trigger a re-render or use the interval.
        // The existing interval in useEffect only updates 'timeLeft' if it is MY turn. 
        // Let's rely on standard React updates for now or just show "active" state without precise countdown for opponents if simplest.
        // BUT the user asked for "timer que se va agotando". 
        // So we need to ensure the component re-renders or we use CSS animation.
        // Since `gameState` updates on moves, we don't get 60fps updates. 
        // We will add a small trick: CSS animation is hard to sync with server time.
        // Better: Update the interval to set a generic 'secondsLeft' for WHOEVER is playing.

        return (
            <div className={`compact-player-card team-${player.team} ${isActive ? 'active' : ''}`}>
                <div className="player-info-group">
                    <div className="avatar-wrapper">
                        {isActive && (
                            <svg className="timer-ring" width="60" height="60">
                                <circle
                                    className="timer-ring-bg"
                                    cx="30" cy="30" r="28"
                                />
                                <circle
                                    className="timer-ring-progress"
                                    cx="30" cy="30" r="28"
                                    strokeDasharray={dashArray}
                                    strokeDashoffset={dashOffset}
                                />
                            </svg>
                        )}
                        <div className="player-avatar">
                            {player.name.substring(0, 2).toUpperCase()}
                        </div>
                    </div>

                    <div className="player-name">
                        {player.name}
                    </div>
                </div>

                <div className="opponent-hand-container">
                    {Array.from({ length: player.hand.length }).map((_, i) => (
                        <div
                            key={i}
                            className={`domino-piece ${pos === 1 || pos === 3 ? 'horizontal' : 'vertical'} opponent-hidden`}
                        ></div>
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

            <div className="info-bar">
                <div className="room-code-display">
                    <span style={{ fontSize: '0.8rem', opacity: 0.7 }}>Sala: {roomId}</span>
                </div>

                {gameState.players.length === 4 && (
                    <div className="scores" style={{
                        background: 'rgba(0,0,0,0.4)',
                        padding: '5px 10px',
                        borderRadius: '8px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '2px'
                    }}>
                        <div style={{ color: '#ff6666', fontWeight: 'bold' }}>Team A: {gameState.teamScores?.A || 0}</div>
                        <div style={{ color: '#6666ff', fontWeight: 'bold' }}>Team B: {gameState.teamScores?.B || 0}</div>
                    </div>
                )}
            </div>

            {/* Absolute Top Player */}
            <div className="player-side top">
                {renderPlayerCard(2)}
            </div>

            {/* Grid Side Players */}
            <div className="player-side left">
                {renderPlayerCard(3)}
            </div>

            <div className="player-side right">
                {renderPlayerCard(1)}
            </div>

            {/* Center Board (Canvas) */}
            <div className="board-area">
                <DominoBoard board={gameState.board} />
            </div>

            {/* Bottom Player (Me) */}
            <div className="player-me">
                {/* My Player Info (Avatar + Name) */}
                {myPlayer && (
                    <div className="player-info-group">
                        <div className="avatar-wrapper">
                            {/* Timer Ring */}
                            {isMyTurn && (
                                <svg className="timer-ring" width="56" height="56">
                                    <circle className="timer-ring-bg" cx="28" cy="28" r="26" stroke="transparent" />
                                    <circle
                                        className="timer-ring-progress"
                                        cx="28" cy="28" r="26"
                                        strokeDasharray={2 * Math.PI * 26}
                                        strokeDashoffset={isMyTurn ? (2 * Math.PI * 26) * (1 - (timeLeft / 20)) : 2 * Math.PI * 26}
                                        stroke="lime"
                                        fill="none"
                                        strokeWidth="3"
                                    />
                                </svg>
                            )}
                            <div className="player-avatar">
                                {myPlayer.name.substring(0, 2).toUpperCase()}
                            </div>
                        </div>
                        <div className="player-name">
                            {myPlayer.name}
                        </div>
                    </div>
                )}

                <div className="my-hand-container">
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
                                size="medium"
                            />
                        );
                    })}
                </div>
            </div >

            {/* Overlays */}
            {
                notification && (
                    <div className={`notification-toast ${notification.type}`}>
                        {notification.message}
                    </div>
                )
            }

            {
                gameState.handWinnerId && !gameState.winnerTeam && (
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
                )
            }

            {
                gameState.winnerTeam && (
                    <div className="overlay victory">
                        <h2>🏆 ¡Partida Terminada!</h2>
                        <p className="victory-message">¡El Equipo {gameState.winnerTeam} gana!</p>
                        <button onClick={() => window.location.reload()}>Salir</button>
                    </div>
                )
            }
        </div >
    );
};
