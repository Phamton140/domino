import 'package:flutter/material.dart';
import 'package:socket_io_client/socket_io_client.dart' as IO;
import 'domino_piece.dart';
import 'domino_board.dart';

class GameTable extends StatefulWidget {
  final Map<String, dynamic> gameState;
  final String roomId;
  final IO.Socket socket;
  final String myId;

  const GameTable({
    super.key,
    required this.gameState,
    required this.roomId,
    required this.socket,
    required this.myId,
  });

  @override
  State<GameTable> createState() => _GameTableState();
}

class _GameTableState extends State<GameTable> {
  List<int>? pendingPiece;

  int _getRelativePosition(int absPos, int myAbsPos) {
    return (absPos - myAbsPos + 4) % 4;
  }

  void _handlePlacePiece(List<int> piece) {
    var board = widget.gameState['board'] as List<dynamic>;
    if (board.isEmpty) {
      widget.socket.emit('place_piece', {'roomId': widget.roomId, 'piece': piece, 'side': 'tail'});
      return;
    }

    int head = board.first['piece'][0];
    int tail = board.last['piece'][1];

    bool canPlayHead = piece[0] == head || piece[1] == head;
    bool canPlayTail = piece[0] == tail || piece[1] == tail;

    if (head == tail && (canPlayHead || canPlayTail)) {
      widget.socket.emit('place_piece', {'roomId': widget.roomId, 'piece': piece, 'side': 'tail'});
      return;
    }

    if (canPlayHead && !canPlayTail) {
      widget.socket.emit('place_piece', {'roomId': widget.roomId, 'piece': piece, 'side': 'head'});
    } else if (canPlayTail && !canPlayHead) {
      widget.socket.emit('place_piece', {'roomId': widget.roomId, 'piece': piece, 'side': 'tail'});
    } else if (canPlayHead && canPlayTail) {
      setState(() {
        pendingPiece = piece;
      });
    }
  }

  Widget _buildOpponentCard(dynamic player, int pos) {
    if (player == null) return const SizedBox();
    bool isActive = player['id'] == widget.gameState['currentTurnPlayerId'];

    List<Widget> pieces = List.generate(
      player['hand'].length,
      (index) => Padding(
        padding: const EdgeInsets.all(2.0),
        child: DominoPiece(
          values: const [0, 0],
          isOpponent: true,
          orientation: (pos == 1 || pos == 3) ? 'horizontal' : 'vertical',
        ),
      ),
    );

    return Container(
      padding: const EdgeInsets.all(8),
      decoration: BoxDecoration(
        color: isActive ? Colors.white.withOpacity(0.1) : Colors.transparent,
        borderRadius: BorderRadius.circular(8),
        border: isActive ? Border.all(color: Colors.green, width: 2) : null,
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          CircleAvatar(
            backgroundColor: player['team'] == 'A' ? const Color(0xFF00308F) : const Color(0xFFC8102E),
            child: Text(player['name'].substring(0, 2).toUpperCase(), style: const TextStyle(color: Colors.white)),
          ),
          const SizedBox(height: 4),
          if (pos == 2)
            Row(mainAxisAlignment: MainAxisAlignment.center, children: pieces)
          else
            Column(mainAxisAlignment: MainAxisAlignment.center, children: pieces)
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    List<dynamic> players = widget.gameState['players'];
    
    // Find my player securely
    var myPlayer = players.firstWhere((p) => p['id'] == widget.myId, orElse: () => null);
    
    // Default to position 0 if I'm not in the players list (e.g., spectator)
    int myPos = myPlayer?['position'] ?? 0;

    Map<int, dynamic> playersByPos = {};
    for (var p in players) {
      int absPos = p['position'] ?? players.indexOf(p);
      int pos = _getRelativePosition(absPos, myPos);
      playersByPos[pos] = p;
    }

    bool isMyTurn = widget.gameState['currentTurnPlayerId'] == widget.myId;

    return Stack(
      children: [
        // Board
        Positioned.fill(
          child: DominoBoard(board: widget.gameState['board']),
        ),

        // Opponent Top (2)
        if (playersByPos[2] != null)
          Positioned(
            top: 20,
            left: 0,
            right: 0,
            child: Align(
              alignment: Alignment.topCenter,
              child: _buildOpponentCard(playersByPos[2], 2),
            ),
          ),

        // Opponent Left (3)
        if (playersByPos[3] != null)
          Positioned(
            left: 20,
            top: 0,
            bottom: 0,
            child: Align(
              alignment: Alignment.centerLeft,
              child: _buildOpponentCard(playersByPos[3], 3),
            ),
          ),

        // Opponent Right (1)
        if (playersByPos[1] != null)
          Positioned(
            right: 20,
            top: 0,
            bottom: 0,
            child: Align(
              alignment: Alignment.centerRight,
              child: _buildOpponentCard(playersByPos[1], 1),
            ),
          ),

        // My Hand (Bottom)
        if (myPlayer != null)
          Positioned(
            bottom: 20,
            left: 0,
            right: 0,
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                if (isMyTurn)
                  const Padding(
                    padding: EdgeInsets.only(bottom: 8.0),
                    child: Text('¡ES TU TURNO!', style: TextStyle(color: Colors.green, fontWeight: FontWeight.bold, fontSize: 18)),
                  ),
                SingleChildScrollView(
                  scrollDirection: Axis.horizontal,
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: (myPlayer['hand'] as List<dynamic>).map((p) {
                      List<int> piece = List<int>.from(p);
                      
                      bool isValid = false;
                      var board = widget.gameState['board'] as List<dynamic>;
                      if (board.isEmpty) {
                        isValid = widget.gameState['handNumber'] == 1 ? (piece[0] == 6 && piece[1] == 6) : true;
                      } else {
                        int head = board.first['piece'][0];
                        int tail = board.last['piece'][1];
                        isValid = piece[0] == head || piece[1] == head || piece[0] == tail || piece[1] == tail;
                      }

                      return Padding(
                        padding: const EdgeInsets.symmetric(horizontal: 4.0),
                        child: DominoPiece(
                          values: piece,
                          disabled: !isMyTurn || !isValid,
                          onClick: () => _handlePlacePiece(piece),
                        ),
                      );
                    }).toList(),
                  ),
                ),
              ],
            ),
          ),

        // Side Selection Modal
        if (pendingPiece != null)
          Positioned.fill(
            child: Container(
              color: Colors.black54,
              child: Center(
                child: Card(
                  color: const Color(0xFF333333),
                  child: Padding(
                    padding: const EdgeInsets.all(24.0),
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        const Text('¿Dónde quieres jugar esta ficha?', style: TextStyle(fontSize: 18, color: Colors.white)),
                        const SizedBox(height: 20),
                        Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            ElevatedButton(
                              onPressed: () {
                                widget.socket.emit('place_piece', {'roomId': widget.roomId, 'piece': pendingPiece, 'side': 'head'});
                                setState(() => pendingPiece = null);
                              },
                              child: const Text('Izquierda (Head)'),
                            ),
                            const SizedBox(width: 16),
                            ElevatedButton(
                              onPressed: () {
                                widget.socket.emit('place_piece', {'roomId': widget.roomId, 'piece': pendingPiece, 'side': 'tail'});
                                setState(() => pendingPiece = null);
                              },
                              child: const Text('Derecha (Tail)'),
                            ),
                          ],
                        ),
                        const SizedBox(height: 16),
                        TextButton(
                          onPressed: () => setState(() => pendingPiece = null),
                          child: const Text('Cancelar', style: TextStyle(color: Colors.grey)),
                        )
                      ],
                    ),
                  ),
                ),
              ),
            ),
          ),

        // Game Over Overlay
        if (widget.gameState['handWinnerId'] != null && widget.gameState['winnerTeam'] == null)
          Positioned.fill(
            child: Container(
              color: Colors.black87,
              child: Center(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    const Text('¡Mano Terminada!', style: TextStyle(fontSize: 28, fontWeight: FontWeight.bold, color: Colors.white)),
                    const SizedBox(height: 16),
                    ElevatedButton(
                      style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFF00308F)),
                      onPressed: () {
                        widget.socket.emit('player_ready', {'roomId': widget.roomId});
                      },
                      child: const Text('¡Listo para la siguiente!', style: TextStyle(color: Colors.white)),
                    )
                  ],
                ),
              ),
            ),
          )
      ],
    );
  }
}
