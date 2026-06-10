import 'package:flutter/material.dart';

class DominoPiece extends StatelessWidget {
  final List<int> values;
  final String orientation; // 'vertical' or 'horizontal'
  final bool disabled;
  final VoidCallback? onClick;
  final bool isOpponent;
  final bool isStarter;
  final String? ownerTeam;

  const DominoPiece({
    super.key,
    required this.values,
    this.orientation = 'vertical',
    this.disabled = false,
    this.onClick,
    this.isOpponent = false,
    this.isStarter = false,
    this.ownerTeam,
  });

  Widget _buildDot() {
    return Container(
      width: 4,
      height: 4,
      decoration: const BoxDecoration(
        color: Color(0xFF1C1C1E),
        shape: BoxShape.circle,
        boxShadow: [
          BoxShadow(
            color: Colors.black38,
            offset: Offset(0, 1),
            blurRadius: 1,
            spreadRadius: 0,
          ),
        ],
      ),
    );
  }

  Widget _buildEmptyDot() {
    return const SizedBox(width: 4, height: 4);
  }

  Widget _buildHalf(int val) {
    List<Widget> dots = [];

    // Map the dots strictly as a 3x3 grid like the CSS
    // Grid positions:
    // 0 1 2
    // 3 4 5
    // 6 7 8
    List<int> activeDots = [];
    switch (val) {
      case 1: activeDots = [4]; break;
      case 2: activeDots = [0, 8]; break;
      case 3: activeDots = [0, 4, 8]; break;
      case 4: activeDots = [0, 2, 6, 8]; break;
      case 5: activeDots = [0, 2, 4, 6, 8]; break;
      case 6: activeDots = [0, 2, 3, 5, 6, 8]; break;
    }

    for (int i = 0; i < 9; i++) {
      if (activeDots.contains(i)) {
        dots.add(_buildDot());
      } else {
        dots.add(_buildEmptyDot());
      }
    }

    return Expanded(
      child: Center(
        child: SizedBox(
          width: 18,
          height: 18,
          child: GridView.count(
            crossAxisCount: 3,
            mainAxisSpacing: 2,
            crossAxisSpacing: 2,
            physics: const NeverScrollableScrollPhysics(),
            children: dots,
          ),
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    bool isVertical = orientation == 'vertical';
    double w = isVertical ? 30 : 60;
    double h = isVertical ? 60 : 30;

    BoxDecoration decor = BoxDecoration(
      color: isOpponent ? const Color(0xFFE0E0E0) : const Color(0xFFF5F5F7),
      borderRadius: BorderRadius.circular(6),
      boxShadow: [
        const BoxShadow(
          color: Colors.black26,
          offset: Offset(0, 2),
          blurRadius: 5,
        ),
      ],
      border: isStarter 
        ? Border.all(
            color: ownerTeam == 'A' ? const Color(0xFF00308F) : const Color(0xFFC8102E), 
            width: 2
          ) 
        : null,
    );

    Widget content;
    if (isOpponent) {
      content = const SizedBox();
    } else {
      content = Flex(
        direction: isVertical ? Axis.vertical : Axis.horizontal,
        children: [
          _buildHalf(values[0]),
          Container(
            width: isVertical ? double.infinity : 1,
            height: isVertical ? 1 : double.infinity,
            color: Colors.black12,
            margin: EdgeInsets.symmetric(
              horizontal: isVertical ? 0 : 2,
              vertical: isVertical ? 2 : 0,
            ),
          ),
          _buildHalf(values[1]),
        ],
      );
    }

    Widget piece = Container(
      width: w,
      height: h,
      padding: const EdgeInsets.all(4),
      decoration: decor,
      child: content,
    );

    if (!disabled && onClick != null) {
      return MouseRegion(
        cursor: SystemMouseCursors.click,
        child: GestureDetector(
          onTap: onClick,
          child: piece,
        ),
      );
    }

    return piece;
  }
}
