# Domino Dominicano Profesional

Multi-platform Domino game implementation with real-time multiplayer support.

## Architecture

```
domino/
├── client/                 # React + TypeScript + Vite web client
├── server/                 # Node.js + Express + Socket.IO server
├── flutter_client/         # Flutter mobile/desktop client
└── packages/
    └── shared-types/       # Shared TypeScript types (server, web, mobile)
```

## Features

- **Dominican Domino Rules**: Double-6 start, Capicúa (+30), Tranque, Pase Redondo (170+ limit)
- **Real-time Multiplayer**: Socket.IO with reconnection support (2-min window)
- **Matchmaking**: Public queue + private rooms with invite codes
- **Turn Timer**: 5s auto-play/auto-pass with visual countdown
- **Cross-platform**: Web (React), Mobile/Desktop (Flutter), shared types

## Quick Start

### Prerequisites
- Node.js 18+
- Flutter 3.11+ (for mobile client)

### Server
```bash
cd server
npm install
npm run build
npm run dev          # Development with ts-node
# or
npm start            # Production (requires build first)
```
Runs on `http://localhost:3000`

### Web Client
```bash
cd client
npm install
npm run dev          # Development server
npm run build        # Production build
```
Runs on `http://localhost:5173`

### Shared Types
```bash
cd packages/shared-types
npm install
npm run build        # Generates dist/ for server/client consumption
```

### Flutter Client
```bash
cd flutter_client
flutter pub get
flutter run          # Run on connected device/emulator
```

## Game Rules Summary

| Rule | Description |
|------|-------------|
| **Start** | First hand: Double-6 (6-6) must be played. Subsequent hands: previous winner starts. |
| **Play** | Match either end. If piece fits both ends → must play Right (Tail). |
| **Capicúa** | Winning with mixed piece that closes both ends → +30 bonus (always applies). |
| **Tranque** | All 4 players pass consecutively → lowest hand points wins. |
| **Pase Redondo** | 3 opponents pass, you can play again → +30 team bonus (NOT if team ≥170). |
| **Salida Bonus** | First play is Double → partner plays next = +30. First play is Mixed → partner plays next = +60. |
| **Match Win** | First team to 200 points wins. |

## Socket Events

### Client → Server
- `create_room` - Create private/public room
- `join_room` - Join by room code
- `find_match` - Public matchmaking queue
- `start_game` - Host starts game (4 players required)
- `start_matchmaking` - Host starts auto-fill for private room
- `place_piece` - Play a tile `{piece, side: 'head'|'tail'}`
- `pass_turn` - Pass (only valid if no moves)
- `player_ready` - Ready for next hand
- `leave_room` - Leave current room

### Server → Client
- `room_joined` - Room state on join
- `player_joined` - Updated player list
- `game_started` - Initial game state
- `game_update` - Real-time state updates
- `notification` - Info/warning/success/error messages
- `matchmaking_started` / `matchmaking_failed`
- `ready_status` - Ready count for next hand
- `match_won` - Match finished

## Development

### Run Tests
```bash
cd server && npm test          # GameEngine tests (Jest)
```

### Lint
```bash
cd client && npm run lint      # ESLint
cd server && npm run build     # TypeScript compile check
```

## Deployment

1. Build shared-types: `cd packages/shared-types && npm run build`
2. Build server: `cd server && npm run build`
3. Build client: `cd client && npm run build`
4. Deploy `server/dist` + `client/dist` to hosting
5. Set `VITE_SERVER_URL` env var for client to point to server

## Tech Stack

| Layer | Technology |
|-------|------------|
| Server | Node.js, Express, Socket.IO, TypeScript |
| Client | React 19, Vite, TypeScript, Socket.IO Client |
| Mobile | Flutter, socket_io_client |
| Shared | TypeScript (compiled to JS/TS declarations) |
| Testing | Jest, ts-jest |
| Linting | ESLint (flat config), TypeScript ESLint |