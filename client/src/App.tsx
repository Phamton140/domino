import { useEffect, useState } from 'react';
import { socket } from './socket';
import { GameTable } from './components/GameTable';
import './App.css';
import type { GameState, Room, Player } from './types';

function App() {
  const [isConnected, setIsConnected] = useState(socket.connected);
  const [playerName, setPlayerName] = useState('');
  const [roomIdInput, setRoomIdInput] = useState('');
  const [currentRoom, setCurrentRoom] = useState<Room | null>(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [activeGame, setActiveGame] = useState<GameState | null>(null);
  const [isMatchmaking, setIsMatchmaking] = useState(false);
  const [matchmakingMessage, setMatchmakingMessage] = useState('');

  useEffect(() => {
    function onConnect() {
      setIsConnected(true);
    }

    function onDisconnect() {
      setIsConnected(false);
    }

    function onRoomJoined(room: Room) {
      console.log("Joined room:", room);
      setCurrentRoom(room);
      if (room.gameState) setActiveGame(room.gameState);
      setErrorMsg('');
    }

    function onPlayerJoined(players: Player[]) {
      console.log("Player joined:", players);
      setCurrentRoom(prev => prev ? { ...prev, players } : null);
    }

    function onGameStarted(state: GameState) {
      console.log("Game Started!", state);
      setActiveGame(state);
    }

    function onError(err: { message: string }) {
      setErrorMsg(err.message);
    }

    function onMatchmakingStarted(data: { message: string, timeout?: number }) {
      setIsMatchmaking(true);
      setMatchmakingMessage(data.message);
      setErrorMsg('');
    }

    function onMatchmakingFailed(data: { message: string }) {
      setIsMatchmaking(false);
      setMatchmakingMessage('');
      setErrorMsg(data.message);
    }

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('room_joined', onRoomJoined);
    socket.on('player_joined', onPlayerJoined);
    socket.on('game_started', onGameStarted);
    socket.on('error', onError);
    socket.on('matchmaking_started', onMatchmakingStarted);
    socket.on('matchmaking_failed', onMatchmakingFailed);

    socket.connect();

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('room_joined', onRoomJoined);
      socket.off('player_joined', onPlayerJoined);
      socket.off('game_started', onGameStarted);
      socket.off('error', onError);
      socket.off('matchmaking_started', onMatchmakingStarted);
      socket.off('matchmaking_failed', onMatchmakingFailed);
      // DON'T disconnect socket - keep it alive for reconnection
    };
  }, []);

  const handleCreateRoom = () => {
    if (!playerName) return alert('Enter name');
    socket.emit('create_room', { playerName, isPrivate: true });
  };

  const handleStartGame = () => {
    if (!currentRoom) return;

    // If room has 4 players, start game directly
    if (currentRoom.players.length === 4) {
      socket.emit('start_game', { roomId: currentRoom.id });
    } else {
      // Otherwise, start matchmaking
      socket.emit('start_matchmaking', { roomId: currentRoom.id });
    }
  };

  const handleFindMatch = () => {
    if (!playerName) return alert('Enter name');
    socket.emit('find_match', { playerName });
  };

  const handleJoinRoom = () => {
    if (!playerName || !roomIdInput) return alert('Enter name and room ID');
    socket.emit('join_room', { roomId: roomIdInput, playerName });
  };

  if (activeGame && currentRoom) {
    return <GameTable initialState={activeGame} roomId={currentRoom.id} myId={socket.id || ''} />;
  }

  return (
    <div className="App">
      <h1>Domino Dominicano Profesional</h1>

      <div className="status-bar">
        Status: <span className={isConnected ? 'connected' : 'disconnected'}>
          {isConnected ? 'Connected' : 'Disconnected'}
        </span>
      </div>

      {!currentRoom ? (
        <div className="lobby-controls">
          <input
            placeholder="Enter your name"
            value={playerName}
            onChange={e => setPlayerName(e.target.value)}
          />

          <div className="actions">
            <button onClick={handleFindMatch} className="primary" disabled={!isConnected}>
              Play Online
            </button>
            <div className="divider">OR</div>
            <button onClick={handleCreateRoom} disabled={!isConnected}>Create Private Room</button>
            <div className="join-group">
              <input
                placeholder="Room Code"
                value={roomIdInput}
                onChange={e => setRoomIdInput(e.target.value)}
              />
              <button onClick={handleJoinRoom} disabled={!isConnected}>Join</button>
            </div>
          </div>
          {errorMsg && <p className="error">{errorMsg}</p>}
        </div>
      ) : (
        <div className="room-view">
          <h2>Room: {currentRoom.id}</h2>
          <div className="player-list">
            <h3>Players ({currentRoom.players.length}/4)</h3>
            <ul>
              {currentRoom.players.map(p => (
                <li key={p.id}>{p.name} {p.id === socket.id ? '(You)' : ''}</li>
              ))}
            </ul>
            {currentRoom.players.length < 4 && !isMatchmaking && (
              <p className="waiting-message">
                ⏳ Esperando {4 - currentRoom.players.length} jugador(es) más...
              </p>
            )}
            {isMatchmaking && (
              <div className="matchmaking-status">
                <div className="spinner"></div>
                <p className="matchmaking-text">{matchmakingMessage}</p>
                <p className="player-count">Jugadores: {currentRoom.players.length}/4</p>
              </div>
            )}
          </div>
          <div className="room-actions">
            {/* Show Start Game only if Host (first player usually) */}
            {currentRoom.players[0]?.id === socket.id && (
              <button
                className="primary"
                onClick={handleStartGame}
                disabled={isMatchmaking}
              >
                {isMatchmaking
                  ? '🔍 Buscando jugadores...'
                  : currentRoom.players.length === 4
                    ? 'Iniciar Juego'
                    : `Buscar Jugadores (${currentRoom.players.length}/4)`}
              </button>
            )}
            <button onClick={() => window.location.reload()}>Leave Room</button>
          </div>
          {errorMsg && <p className="error">{errorMsg}</p>}
        </div>
      )}
    </div>
  );
}

export default App;
