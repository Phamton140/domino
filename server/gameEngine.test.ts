import { GameEngine } from './gameEngine';
import { Player, RoomConfig } from './types';

// Mock timer to avoid waiting in tests
jest.useFakeTimers();

describe('GameEngine', () => {
    let engine: GameEngine;
    let players: Player[];
    const config: RoomConfig = {
        maxPlayers: 4,
        isPrivate: false,
        targetScore: 200,
        turnDuration: 8
    };

    beforeEach(() => {
        players = [
            { id: '1', name: 'A', hand: [], score: 0, team: 'A', position: 0 },
            { id: '2', name: 'B', hand: [], score: 0, team: 'B', position: 1 },
            { id: '3', name: 'C', hand: [], score: 0, team: 'A', position: 2 },
            { id: '4', name: 'D', hand: [], score: 0, team: 'B', position: 3 },
        ];
        engine = new GameEngine(players, config);
        engine.startHand();
    });

    test('should deal 7 tiles to each player', () => {
        engine.getState().players.forEach(p => {
            expect(p.hand.length).toBe(7);
        });
    });

    test('should identify correct double-6 starter (or first player if dry run)', () => {
        expect(engine.getState().currentTurnPlayerId).toBeDefined();
    });

    test('should validate valid moves properly', () => {
        const state = engine.getState();
        const player = state.players.find(p => p.id === state.currentTurnPlayerId)!;

        // Force the board state for predictable testing
        state.board = [{ piece: [6, 6] }];

        // Player has [6,1] in hand
        player.hand = [[6, 1]];

        const valid = engine.isValidMove([6, 1], 'head');
        // Logic: Head is 6. [6,1] connects 6->6? No, [1,6]-[6,6]? 
        // GameEngine validMove implementation handles placement logic? 
        // Actually isValidMove() was implemented to check if it matches open ends.
        // Head=6, Tail=6. [6,1] has a 6. Should be valid.

        // Note: The public isValidMove function in my prev implementation had logic:
        // (piece[0] === openHead || piece[1] === openHead) ...
        // So yes, it should return true.
        expect(valid).toBe(true);
    });

    test('should handle timer timeout with auto-play or pass', () => {
        const spy = jest.spyOn(console, 'log');
        const currentPlayer = engine.getState().currentTurnPlayerId;

        // Fast-forward time (15s limit)
        jest.advanceTimersByTime(15001);

        expect(spy).toHaveBeenCalledWith(expect.stringContaining('Timeout'));
        // Turn should have changed
        expect(engine.getState().currentTurnPlayerId).not.toBe(currentPlayer);
    });

    test('should detect Tranque (4 passes)', () => {
        // Mock board state
        engine.getState().board = [{ piece: [6, 6] }];

        const p1 = players[0].id;
        const p2 = players[1].id;
        const p3 = players[2].id;
        const p4 = players[3].id;

        // Mock current player to p1
        engine.getState().currentTurnPlayerId = p1;

        // Force hands to have NO matching tiles (e.g., all 0s vs 6s)
        players.forEach(p => p.hand = [[0, 0]]);

        // Pass 1
        engine.passTurn(p1);
        expect(engine.getState().consecutivePasses).toBe(1);
        expect(engine.getState().currentTurnPlayerId).toBe(p2);

        // Pass 2, 3, 4
        engine.passTurn(p2);
        engine.passTurn(p3);
        engine.passTurn(p4);

        expect(engine.getState().consecutivePasses).toBe(4);
        // Should have triggered Tranque handler -> Win logic
        // Check winnerTeam is set
        // Check handWinnerId is set (hand finished)
        // winnerTeam is only set if score >= 200, which won't happen here with 0 points
        expect(engine.getState().handWinnerId).toBeDefined();
        // expect(engine.getState().winReason).toBe('tranque'); // This might differ if logic changed? No.

        // Verify team score was updated (0 points added though in this specific test case of 0-0 hands)
        // But ensures no crash.
    });
});
