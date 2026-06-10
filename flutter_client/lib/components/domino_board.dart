import 'package:flutter/material.dart';
import 'domino_piece.dart';

class PositionedPiece {
  final List<int> piece;
  final double x;
  final double y;
  final double width;
  final double height;
  final String orientation;
  final bool isAnchor;
  final String? ownerTeam;

  PositionedPiece({
    required this.piece,
    required this.x,
    required this.y,
    required this.width,
    required this.height,
    required this.orientation,
    this.isAnchor = false,
    this.ownerTeam,
  });
}

class DominoBoard extends StatefulWidget {
  final List<dynamic> board;

  const DominoBoard({super.key, required this.board});

  @override
  State<DominoBoard> createState() => _DominoBoardState();
}

class _DominoBoardState extends State<DominoBoard> {
  List<int>? anchorRef;
  
  // Interactive viewer controller
  final TransformationController _transformationController = TransformationController();

  List<PositionedPiece> calculatePositions() {
    if (widget.board.isEmpty) return [];

    int anchorIndex = -1;

    if (anchorRef != null) {
      anchorIndex = widget.board.indexWhere((b) {
        var p = b['piece'];
        return p[0] == anchorRef![0] && p[1] == anchorRef![1];
      });
    }

    if (anchorIndex == -1) {
      anchorIndex = widget.board.indexWhere((b) => b['isStarter'] == true);
      if (anchorIndex == -1) {
        anchorIndex = widget.board.indexWhere((b) {
          var p = b['piece'];
          return p[0] == 6 && p[1] == 6;
        });
        if (anchorIndex == -1) {
          for (int d = 5; d >= 0; d--) {
            int dIdx = widget.board.indexWhere((b) {
              var p = b['piece'];
              return p[0] == d && p[1] == d;
            });
            if (dIdx != -1) {
              anchorIndex = dIdx;
              break;
            }
          }
        }
      }
    }

    if (anchorIndex == -1) {
      anchorIndex = widget.board.length ~/ 2;
    }

    var centerPieceData = widget.board[anchorIndex];
    List<int> centerPiece = List<int>.from(centerPieceData['piece']);
    anchorRef = centerPiece;

    List<Map<String, dynamic>> leftChain = [];
    List<Map<String, dynamic>> rightChain = [];

    List<int> previousPiece = centerPiece;
    for (int i = anchorIndex + 1; i < widget.board.length; i++) {
      List<int> p = List<int>.from(widget.board[i]['piece']);
      int matchVal = (p[0] == previousPiece[0] || p[0] == previousPiece[1]) ? p[0] : p[1];
      rightChain.add({'piece': p, 'matchVal': matchVal});
      previousPiece = p;
    }

    previousPiece = centerPiece;
    for (int i = anchorIndex - 1; i >= 0; i--) {
      List<int> p = List<int>.from(widget.board[i]['piece']);
      int matchVal = (p[0] == previousPiece[0] || p[0] == previousPiece[1]) ? p[0] : p[1];
      leftChain.add({'piece': p, 'matchVal': matchVal});
      previousPiece = p;
    }

    const double GAP = 2.0;
    List<PositionedPiece> results = [];

    bool centerIsDouble = centerPiece[0] == centerPiece[1];
    double cW = centerIsDouble ? 30.0 : 60.0;
    double cH = centerIsDouble ? 60.0 : 30.0;

    results.add(PositionedPiece(
      piece: centerPiece,
      x: -cW / 2,
      y: -cH / 2,
      width: cW,
      height: cH,
      orientation: centerIsDouble ? "vertical" : "horizontal",
      isAnchor: true,
      ownerTeam: centerPieceData['ownerTeam'],
    ));

    void layoutChain(List<Map<String, dynamic>> chain, double anchorX, double anchorY, String chainType) {
      double lastX = anchorX;
      double lastY = anchorY;
      double lastW = cW;
      double lastH = cH;

      int curDirX = chainType == 'right' ? 1 : -1;
      int curDirY = 0;

      int state = 0;
      int vTotalCount = 0;
      int hMixedCount = 0;
      int hDoubleCount = 0;

      int lastState = 0;
      bool lastIsDouble = centerIsDouble;
      String lastOrientation = centerIsDouble ? "vertical" : "horizontal";

      int vThreshold = 2;

      for (var item in chain) {
        List<int> piece = item['piece'];
        int matchVal = item['matchVal'];
        bool isDouble = piece[0] == piece[1];

        int nextState = state;

        if (state == 0) {
          if (isDouble) hDoubleCount++;
          else hMixedCount++;

          if ((hMixedCount + hDoubleCount) >= 5 && !isDouble) {
            nextState = 1;
            if (chainType == 'right') {
              curDirX = 0; curDirY = -1;
            } else {
              curDirX = 0; curDirY = 1;
            }
            vThreshold = lastIsDouble ? 1 : 2;
            vTotalCount = 0;
          }
        } else if (state == 1) {
          vTotalCount++;
          if (vTotalCount >= vThreshold && !isDouble) {
            nextState = 2;
            if (chainType == 'right') {
              curDirX = -1; curDirY = 0;
            } else {
              curDirX = 1; curDirY = 0;
            }
            vTotalCount = 0;
          }
        }

        state = nextState;

        String orientation;
        if (isDouble) {
          orientation = (lastOrientation == "horizontal") ? "vertical" : "horizontal";
        } else {
          orientation = (state == 1) ? "vertical" : "horizontal";
        }

        double w = (orientation == "horizontal") ? 60 : 30;
        double h = (orientation == "horizontal") ? 30 : 60;

        double pX = 0, pY = 0;
        List<int> renderValues = [...piece];

        if (state == 1) {
          if (lastState == 0) {
            int incomingDirX = (chainType == 'right') ? 1 : -1;
            pX = lastX + (incomingDirX * (lastW / 2 - w / 2));
            pY = lastY + (curDirY * (lastH / 2 + h / 2 + GAP));
          } else {
            double dist = (lastH / 2) + GAP + (h / 2);
            pY = lastY + (dist * curDirY);
            pX = lastX;
          }

          if (curDirY == 1) {
            renderValues = (piece[0] == matchVal) ? [piece[0], piece[1]] : [piece[1], piece[0]];
          } else {
            renderValues = (piece[1] == matchVal) ? [piece[0], piece[1]] : [piece[1], piece[0]];
          }
        } else if (state == 2) {
          if (lastState == 1) {
            int incomingDirY = (chainType == 'right') ? -1 : 1;
            pY = lastY + (incomingDirY * (lastH / 2 - h / 2));
            pX = lastX + (curDirX * (lastW / 2 + w / 2 + GAP));
          } else {
            double dist = (lastW / 2) + GAP + (w / 2);
            pX = lastX + (dist * curDirX);
            pY = lastY;
          }

          if (curDirX == 1) {
            renderValues = (piece[0] == matchVal) ? [piece[0], piece[1]] : [piece[1], piece[0]];
          } else {
            renderValues = (piece[1] == matchVal) ? [piece[0], piece[1]] : [piece[1], piece[0]];
          }
        } else {
          double dist = (lastW / 2) + GAP + (w / 2);
          pX = lastX + (dist * curDirX);
          pY = lastY;

          if (curDirX == 1) {
            renderValues = (piece[0] == matchVal) ? [piece[0], piece[1]] : [piece[1], piece[0]];
          } else {
            renderValues = (piece[1] == matchVal) ? [piece[0], piece[1]] : [piece[1], piece[0]];
          }
        }

        results.add(PositionedPiece(
          piece: renderValues,
          x: pX - (w / 2),
          y: pY - (h / 2),
          width: w,
          height: h,
          orientation: orientation,
        ));

        lastX = pX;
        lastY = pY;
        lastW = w;
        lastH = h;
        lastState = state;
        lastIsDouble = isDouble;
        lastOrientation = orientation;
      }
    }

    layoutChain(rightChain, 0, 0, 'right');
    layoutChain(leftChain, 0, 0, 'left');

    return results;
  }

  @override
  Widget build(BuildContext context) {
    List<PositionedPiece> positionedPieces = calculatePositions();

    return LayoutBuilder(
      builder: (context, constraints) {
        // Find bounding box
        double minX = 0, minY = 0, maxX = 0, maxY = 0;
        for (var p in positionedPieces) {
          if (p.x < minX) minX = p.x;
          if (p.y < minY) minY = p.y;
          if (p.x + p.width > maxX) maxX = p.x + p.width;
          if (p.y + p.height > maxY) maxY = p.y + p.height;
        }

        double boardW = maxX - minX + 100; // adding some padding
        double boardH = maxY - minY + 100;
        if (boardW < constraints.maxWidth) boardW = constraints.maxWidth;
        if (boardH < constraints.maxHeight) boardH = constraints.maxHeight;

        // Auto-center by placing origin at center of the container
        double offsetX = constraints.maxWidth / 2;
        double offsetY = constraints.maxHeight / 2;

        return InteractiveViewer(
          transformationController: _transformationController,
          minScale: 0.2,
          maxScale: 3.0,
          boundaryMargin: EdgeInsets.all(boardW),
          child: Stack(
            clipBehavior: Clip.none,
            children: [
              // Center cross for debugging
              // Positioned(left: offsetX, top: offsetY, child: Container(width: 5, height: 5, color: Colors.red)),
              
              ...positionedPieces.map((p) {
                return Positioned(
                  left: offsetX + p.x,
                  top: offsetY + p.y,
                  width: p.width,
                  height: p.height,
                  child: DominoPiece(
                    values: p.piece,
                    orientation: p.orientation,
                    disabled: true,
                    isStarter: p.isAnchor,
                    ownerTeam: p.ownerTeam,
                  ),
                );
              }),
            ],
          ),
        );
      },
    );
  }
}
