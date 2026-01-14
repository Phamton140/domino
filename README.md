# Dominoes Web App (Dominican Rules)

A modern, multiplayer domino game built with **React, Node.js, and Socket.io**, specifically implemented with **Dominican Dominoes rules**.

## Features

- 🎮 **Multiplayer**: Support for 4 players (2vs2).
- 📱 **Mobile Optimized**: Responsive design with landscape mode support.
- 🎨 **Modern UI**: Smooth animations, dark mode aesthetics, and clear player indicators.
- ⚡ **Real-time**: Instant state updates via WebSockets.
- 🎯 **Smart Board Positioning**: Automatic centering and scaling eliminates the need for manual adjustments.

## 🇩🇴 Dominican Dominoes Rules (Reglas Dominicanas)

This implementation follows the popular 4-player partnership style played in the Dominican Republic.

### 1. The Match (La Partida)
- **Players**: 4 players divided into 2 teams (Team A vs Team B).
- **Goal**: First team to reach **200 points** wins the match.

### 2. The Hand (La Mano)
- **Tiles**: Double-6 set (28 tiles).
- **Distribution**: 7 tiles per player.
- **Turn Order**: Counter-clockwise (Right to Left).

### 3. Starting the Game (La Salida)
- **First Hand**: The player holding the **Double-6** MUST start.
- **Subsequent Hands**: The winner of the previous hand starts. They can play **ANY** tile.

### 4. Scoring & Bonuses (Puntos y Bonos)
Points are calculated by summing the unplayed tiles on the table when a hand ends.

#### 🌟 Special Bonuses (Bonos Especiales)
These bonuses are added to the table score:

*   **Capicúa (+30 pts)**:
    *   Winning with a non-double tile that matches both open ends of the board.
    *   *Rule logic*: Always applies, even if the team has 170+ points.

*   **Pase Redondo (+30 pts)**:
    *   When a player passes, and the turn returns to them (all 3 other players passed), and they *can* play.
    *   *Restriction*: **Does NOT apply** if the team has **170 points or more**.

*   **Start Bonuses (Bonos de Salida)**:
    *   **Salida a Doble (+30 pts)**: Starter plays a Double → Next player passes → Starter's partner plays.
    *   **Salida a Mixta (+60 pts)**: Starter plays a Mixed tile → Next player passes → Starter's partner plays.
    *   *Condition*: If the partner also passes, the bonus is voided.

### 5. Winning the Hand
A hand ends in two ways:
1.  **Domino**: A player plays their last tile.
    *   Score: Sum of all other players' remaining tiles + Bonuses.
2.  **Tranque (Blocked Game)**: No player can move.
    *   Rule: The player with the **lowest individual hand** score wins for their team.
    *   Tie Rule: If tied, the non-blocking team usually wins (implemented as opponent of the blocker wins).

## Tech Stack

- **Client**: React, TypeScript, Vite, CSS Modules.
- **Server**: Node.js, Express, Socket.io, TypeScript.

### Running Locally

1. **Server**:
   ```bash
   cd server
   npm install
   npm run dev
   ```

2. **Client**:
   ```bash
   cd client
   npm install
   npm run dev
   ```
