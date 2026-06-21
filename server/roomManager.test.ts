import { RoomManager } from './roomManager';

jest.mock('uuid', () => ({
    v4: () => 'ABCDEF1234',
}));

describe('RoomManager', () => {
    let rm: RoomManager;

    beforeEach(() => {
        rm = new RoomManager();
    });

    describe('createRoom', () => {
        test('creates room with host as player 0 team A', () => {
            const room = rm.createRoom('host1', 'Host', false);
            expect(room.id).toMatch(/^[A-Z0-9]{6}$/);
            expect(room.hostId).toBe('host1');
            expect(room.status).toBe('waiting');
            expect(room.players).toHaveLength(1);
            expect(room.players[0]).toMatchObject({
                id: 'host1', name: 'Host', team: 'A', position: 0,
            });
            expect(room.config).toMatchObject({
                maxPlayers: 4, isPrivate: false, targetScore: 200, turnDuration: 5,
            });
            expect(room.gameState).toBeNull();
            expect(room.spectators).toEqual([]);
            expect(room.invitedPlayers).toEqual([]);
        });

        test('creates private room', () => {
            const room = rm.createRoom('host1', 'Host', true);
            expect(room.config.isPrivate).toBe(true);
        });
    });

    describe('joinRoom', () => {
        test('2nd player gets team A (partner), position 2', () => {
            const room1 = rm.createRoom('h1', 'Host');
            const room = rm.joinRoom(room1.id, 'p2', 'P2');
            expect(room!.players).toHaveLength(2);
            const p2 = room!.players[1];
            expect(p2.team).toBe('A');
            expect(p2.position).toBe(2);
        });

        test('3rd player gets team B, position 1', () => {
            const room1 = rm.createRoom('h1', 'Host');
            rm.joinRoom(room1.id, 'p2', 'P2');
            rm.joinRoom(room1.id, 'p3', 'P3');
            const p3 = rm.getRoom(room1.id)!.players[2];
            expect(p3.team).toBe('B');
            expect(p3.position).toBe(1);
        });

        test('4th player gets team B, position 3', () => {
            const room1 = rm.createRoom('h1', 'Host');
            rm.joinRoom(room1.id, 'p2', 'P2');
            rm.joinRoom(room1.id, 'p3', 'P3');
            rm.joinRoom(room1.id, 'p4', 'P4');
            const p4 = rm.getRoom(room1.id)!.players[3];
            expect(p4.team).toBe('B');
            expect(p4.position).toBe(3);
        });

        test('rejects join when room is full', () => {
            const room1 = rm.createRoom('h1', 'Host');
            rm.joinRoom(room1.id, 'p2', 'P2');
            rm.joinRoom(room1.id, 'p3', 'P3');
            rm.joinRoom(room1.id, 'p4', 'P4');
            expect(rm.joinRoom(room1.id, 'p5', 'P5')).toBeNull();
        });

        test('rejects join when room is playing', () => {
            const room1 = rm.createRoom('h1', 'Host');
            const room = rm.getRoom(room1.id)!;
            room.status = 'playing';
            expect(rm.joinRoom(room1.id, 'p2', 'P2')).toBeNull();
        });

        test('returns room if player already joined', () => {
            const room1 = rm.createRoom('h1', 'Host');
            const room = rm.joinRoom(room1.id, 'p2', 'P2');
            expect(rm.joinRoom(room1.id, 'p2', 'P2')).toBe(room);
        });

        test('returns null for non-existent room', () => {
            expect(rm.joinRoom('NONEXIST', 'p1', 'P1')).toBeNull();
        });
    });

    describe('leaveRoom', () => {
        test('removes player and reassigns host', () => {
            const room1 = rm.createRoom('h1', 'Host');
            rm.joinRoom(room1.id, 'p2', 'P2');
            expect(rm.leaveRoom(room1.id, 'h1')).toBe(true);
            const room = rm.getRoom(room1.id)!;
            expect(room.hostId).toBe('p2');
            expect(room.players).toHaveLength(1);
        });

        test('destroys empty room', () => {
            const room1 = rm.createRoom('h1', 'Host');
            rm.leaveRoom(room1.id, 'h1');
            expect(rm.getRoom(room1.id)).toBeUndefined();
        });

        test('returns false for non-existent room', () => {
            expect(rm.leaveRoom('NONEXIST', 'p1')).toBe(false);
        });
    });

    describe('findMatch', () => {
        test('finds public waiting room with space', () => {
            const room1 = rm.createRoom('h1', 'Host');
            const found = rm.findMatch('p2');
            expect(found).not.toBeNull();
            expect(found!.players).toHaveLength(1);
        });

        test('returns null when no public rooms available', () => {
            rm.createRoom('h1', 'Host', true);
            expect(rm.findMatch('p2')).toBeNull();
        });

        test('returns null when all rooms are full', () => {
            const room1 = rm.createRoom('h1', 'Host');
            rm.joinRoom(room1.id, 'p2', 'P2');
            rm.joinRoom(room1.id, 'p3', 'P3');
            rm.joinRoom(room1.id, 'p4', 'P4');
            expect(rm.findMatch('p5')).toBeNull();
        });
    });

    describe('matchmaking queue', () => {
        test('add and remove from queue', () => {
            rm.addToMatchmaking('p1', 'P1');
            expect(rm.getQueueSize()).toBe(1);
            expect(rm.getPlayerName('p1')).toBe('P1');
            rm.removeFromMatchmaking('p1');
            expect(rm.getQueueSize()).toBe(0);
        });

        test('duplicate add does not increase queue', () => {
            rm.addToMatchmaking('p1', 'P1');
            rm.addToMatchmaking('p1', 'P1');
            expect(rm.getQueueSize()).toBe(1);
        });
    });

    describe('startMatchmaking', () => {
        test('sets status to matchmaking', () => {
            const room1 = rm.createRoom('h1', 'Host');
            expect(rm.startMatchmaking(room1.id)).toBe(true);
            expect(rm.getRoom(room1.id)!.status).toBe('matchmaking');
        });

        test('fails for private room with no invited', () => {
            const room1 = rm.createRoom('h1', 'Host', true);
            expect(rm.startMatchmaking(room1.id)).toBe(false);
        });

        test('returns false for non-existent room', () => {
            expect(rm.startMatchmaking('NONEXIST')).toBe(false);
        });
    });

    describe('findPlayersForRoom', () => {
        test('returns matching players from queue', () => {
            const room1 = rm.createRoom('h1', 'Host');
            rm.addToMatchmaking('p2', 'P2');
            rm.addToMatchmaking('p3', 'P3');
            const found = rm.findPlayersForRoom(room1.id, 2);
            expect(found).toHaveLength(2);
            expect(found[0].id).toBe('p2');
        });

        test('excludes players already in room', () => {
            const room1 = rm.createRoom('h1', 'Host');
            rm.addToMatchmaking('h1', 'Host');
            rm.addToMatchmaking('p2', 'P2');
            const found = rm.findPlayersForRoom(room1.id, 2);
            expect(found).toHaveLength(1);
            expect(found[0].id).toBe('p2');
        });

        test('returns empty array for non-existent room', () => {
            expect(rm.findPlayersForRoom('NONEXIST', 2)).toEqual([]);
        });
    });
});
