import 'package:flutter/material.dart';
import 'package:socket_io_client/socket_io_client.dart' as IO;
import 'components/game_table.dart';

void main() {
  runApp(const DominoApp());
}

class DominoApp extends StatelessWidget {
  const DominoApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Dominó Dominicano',
      theme: ThemeData(
        brightness: Brightness.dark,
        scaffoldBackgroundColor: const Color(0xFF1A1A1A),
        primaryColor: const Color(0xFF00308F),
        colorScheme: const ColorScheme.dark(
          primary: Color(0xFF00308F),
          secondary: Color(0xFFC8102E),
          surface: Color(0xFF242424),
        ),
        useMaterial3: true,
      ),
      home: const MainScreen(),
    );
  }
}

class MainScreen extends StatefulWidget {
  const MainScreen({super.key});

  @override
  State<MainScreen> createState() => _MainScreenState();
}

class _MainScreenState extends State<MainScreen> {
  late IO.Socket socket;
  bool isConnected = false;
  String playerName = '';
  String roomIdInput = '';
  Map<String, dynamic>? currentRoom;
  Map<String, dynamic>? activeGame;
  String errorMsg = '';
  bool isMatchmaking = false;
  String matchmakingMessage = '';

  final TextEditingController _nameController = TextEditingController();
  final TextEditingController _roomController = TextEditingController();

  @override
  void initState() {
    super.initState();
    _initSocket();
  }

  void _initSocket() {
    socket = IO.io('http://192.168.1.8:3000', <String, dynamic>{
      'transports': ['websocket'],
      'autoConnect': false,
    });

    socket.onConnect((_) {
      setState(() => isConnected = true);
    });

    socket.onDisconnect((_) {
      setState(() => isConnected = false);
    });

    socket.on('room_joined', (data) {
      setState(() {
        currentRoom = Map<String, dynamic>.from(data);
        if (data['gameState'] != null) {
          activeGame = Map<String, dynamic>.from(data['gameState']);
        }
        errorMsg = '';
      });
    });

    socket.on('player_joined', (data) {
      setState(() {
        if (currentRoom != null) {
          currentRoom!['players'] = List<dynamic>.from(data);
        }
      });
    });

    socket.on('game_started', (data) {
      setState(() {
        activeGame = Map<String, dynamic>.from(data);
      });
    });

    socket.on('error', (data) {
      setState(() {
        errorMsg = data['message'] ?? 'Unknown error';
      });
    });

    socket.on('matchmaking_started', (data) {
      setState(() {
        isMatchmaking = true;
        matchmakingMessage = data['message'] ?? '';
        errorMsg = '';
      });
    });

    socket.on('matchmaking_failed', (data) {
      setState(() {
        isMatchmaking = false;
        matchmakingMessage = '';
        errorMsg = data['message'] ?? '';
      });
    });

    socket.connect();
  }

  @override
  void dispose() {
    socket.dispose();
    _nameController.dispose();
    _roomController.dispose();
    super.dispose();
  }

  void handleCreateRoom() {
    if (playerName.isEmpty) {
      _showError('Enter name');
      return;
    }
    socket.emit('create_room', {'playerName': playerName, 'isPrivate': true});
  }

  void handleFindMatch() {
    if (playerName.isEmpty) {
      _showError('Enter name');
      return;
    }
    socket.emit('find_match', {'playerName': playerName});
  }

  void handleJoinRoom() {
    if (playerName.isEmpty || roomIdInput.isEmpty) {
      _showError('Enter name and room ID');
      return;
    }
    socket.emit('join_room', {'roomId': roomIdInput, 'playerName': playerName});
  }

  void handleStartGame() {
    if (currentRoom == null) return;
    
    List players = currentRoom!['players'];
    if (players.length == 4) {
      socket.emit('start_game', {'roomId': currentRoom!['id']});
    } else {
      socket.emit('start_matchmaking', {'roomId': currentRoom!['id']});
    }
  }

  void _showError(String msg) {
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(msg)));
  }

  Widget _buildLobby() {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(24.0),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          TextField(
            controller: _nameController,
            decoration: InputDecoration(
              labelText: 'Nombre del jugador',
              border: OutlineInputBorder(
                borderRadius: BorderRadius.circular(12),
              ),
              filled: true,
              fillColor: const Color(0xFF333333),
            ),
            onChanged: (val) => playerName = val,
          ),
          const SizedBox(height: 24),
          ElevatedButton(
            style: ElevatedButton.styleFrom(
              backgroundColor: const Color(0xFF00308F),
              padding: const EdgeInsets.symmetric(vertical: 16),
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(12),
              ),
            ),
            onPressed: isConnected ? handleFindMatch : null,
            child: const Text('Jugar Online', style: TextStyle(fontSize: 18, color: Colors.white, fontWeight: FontWeight.bold)),
          ),
          const Padding(
            padding: EdgeInsets.symmetric(vertical: 16.0),
            child: Text('O', textAlign: TextAlign.center, style: TextStyle(color: Colors.grey)),
          ),
          ElevatedButton(
            style: ElevatedButton.styleFrom(
              backgroundColor: const Color(0xFF333333),
              padding: const EdgeInsets.symmetric(vertical: 16),
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(12),
              ),
            ),
            onPressed: isConnected ? handleCreateRoom : null,
            child: const Text('Crear Sala Privada', style: TextStyle(fontSize: 16, color: Colors.white)),
          ),
          const SizedBox(height: 16),
          Row(
            children: [
              Expanded(
                child: TextField(
                  controller: _roomController,
                  decoration: InputDecoration(
                    labelText: 'Código de Sala',
                    border: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(12),
                    ),
                    filled: true,
                    fillColor: const Color(0xFF333333),
                  ),
                  onChanged: (val) => roomIdInput = val,
                ),
              ),
              const SizedBox(width: 8),
              ElevatedButton(
                style: ElevatedButton.styleFrom(
                  backgroundColor: const Color(0xFFC8102E),
                  padding: const EdgeInsets.symmetric(vertical: 20, horizontal: 24),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(12),
                  ),
                ),
                onPressed: isConnected ? handleJoinRoom : null,
                child: const Text('Unirse', style: TextStyle(color: Colors.white)),
              ),
            ],
          ),
          if (errorMsg.isNotEmpty)
            Padding(
              padding: const EdgeInsets.only(top: 16.0),
              child: Text(errorMsg, style: const TextStyle(color: Color(0xFFC8102E))),
            ),
        ],
      ),
    );
  }

  Widget _buildRoom() {
    List players = currentRoom!['players'] ?? [];
    bool isHost = players.isNotEmpty && players[0]['id'] == socket.id;

    return Padding(
      padding: const EdgeInsets.all(24.0),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text('Sala: ${currentRoom!['id']}', style: Theme.of(context).textTheme.headlineSmall),
          const SizedBox(height: 16),
          Text('Jugadores (${players.length}/4)', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 18)),
          const SizedBox(height: 8),
          Expanded(
            child: ListView.builder(
              itemCount: players.length,
              itemBuilder: (context, index) {
                var p = players[index];
                bool isMe = p['id'] == socket.id;
                return Card(
                  color: const Color(0xFF333333),
                  margin: const EdgeInsets.symmetric(vertical: 4),
                  child: ListTile(
                    title: Text('${p['name']} ${isMe ? '(Tú)' : ''}'),
                  ),
                );
              },
            ),
          ),
          if (players.length < 4 && !isMatchmaking)
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: Colors.orange.withOpacity(0.1),
                border: Border.all(color: Colors.orange.withOpacity(0.3)),
                borderRadius: BorderRadius.circular(8),
              ),
              child: Text('⏳ Esperando ${4 - players.length} jugador(es) más...',
                style: const TextStyle(color: Colors.orange),
                textAlign: TextAlign.center,
              ),
            ),
          if (isMatchmaking)
            Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: Colors.blue.withOpacity(0.1),
                border: Border.all(color: Colors.blue.withOpacity(0.3)),
                borderRadius: BorderRadius.circular(8),
              ),
              child: Column(
                children: [
                  const CircularProgressIndicator(),
                  const SizedBox(height: 16),
                  Text(matchmakingMessage, style: const TextStyle(color: Colors.blue, fontWeight: FontWeight.bold)),
                  Text('Jugadores: ${players.length}/4', style: const TextStyle(color: Colors.grey)),
                ],
              ),
            ),
          const SizedBox(height: 16),
          if (isHost)
            ElevatedButton(
              style: ElevatedButton.styleFrom(
                backgroundColor: const Color(0xFF00308F),
                padding: const EdgeInsets.symmetric(vertical: 16),
              ),
              onPressed: isMatchmaking ? null : handleStartGame,
              child: Text(
                isMatchmaking
                  ? '🔍 Buscando jugadores...'
                  : players.length == 4
                    ? 'Iniciar Juego'
                    : 'Buscar Jugadores (${players.length}/4)',
                style: const TextStyle(fontSize: 16, color: Colors.white),
              ),
            ),
          const SizedBox(height: 8),
          ElevatedButton(
            style: ElevatedButton.styleFrom(
              backgroundColor: const Color(0xFF333333),
              padding: const EdgeInsets.symmetric(vertical: 16),
            ),
            onPressed: () {
              setState(() {
                currentRoom = null;
                activeGame = null;
              });
              socket.emit('leave_room');
            },
            child: const Text('Salir de la Sala', style: TextStyle(color: Colors.white)),
          ),
        ],
      ),
    );
  }

  Widget _buildGame() {
    return GameTable(
      gameState: activeGame!,
      roomId: currentRoom!['id'],
      socket: socket,
      myId: socket.id ?? '',
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Dominó Dominicano'),
        centerTitle: true,
        backgroundColor: const Color(0xFF1A1A1A),
        actions: [
          Padding(
            padding: const EdgeInsets.all(16.0),
            child: Row(
              children: [
                Container(
                  width: 10,
                  height: 10,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    color: isConnected ? Colors.green : Colors.red,
                  ),
                ),
                const SizedBox(width: 8),
                Text(isConnected ? 'Online' : 'Offline', style: const TextStyle(fontSize: 12)),
              ],
            ),
          )
        ],
      ),
      body: activeGame != null
          ? _buildGame()
          : currentRoom == null
              ? _buildLobby()
              : _buildRoom(),
    );
  }
}
