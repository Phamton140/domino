import { GameEngine } from './gameEngine';
import { Piece, Player, RoomConfig } from './types';

jest.useFakeTimers();

function createEngine(startHand = true): { engine: GameEngine; players: Player[] } {
    const players: Player[] = [
        { id: '1', name: 'A', hand: [], score: 0, team: 'A', position: 0 },
        { id: '2', name: 'B', hand: [], score: 0, team: 'B', position: 1 },
        { id: '3', name: 'C', hand: [], score: 0, team: 'A', position: 2 },
        { id: '4', name: 'D', hand: [], score: 0, team: 'B', position: 3 },
    ];
    const config: RoomConfig = {
        maxPlayers: 4, isPrivate: false, targetScore: 200, turnDuration: 8,
    };
    const engine = new GameEngine(players, config);
    if (startHand) engine.startHand();
    return { engine, players };
}

describe('GameEngine', () => {
    describe('reparto', () => {
        test('7 fichas por jugador', () => {
            const { engine } = createEngine();
            engine.getState().players.forEach(p => expect(p.hand).toHaveLength(7));
        });
        test('28 fichas total', () => {
            const { engine } = createEngine();
            expect(engine.getState().players.flatMap(p => p.hand)).toHaveLength(28);
        });
        test('currentTurnPlayerId es quien tiene doble-6', () => {
            const { engine } = createEngine();
            const id = engine.getState().currentTurnPlayerId;
            expect(id).toBeTruthy();
            const starter = engine.getState().players.find(p => p.id === id)!;
            expect(starter.hand.some(b => b[0] === 6 && b[1] === 6)).toBe(true);
        });
        test('tablero vacío', () => {
            expect(createEngine().engine.getState().board).toHaveLength(0);
        });
        test('consecutivePasses = 0', () => {
            expect(createEngine().engine.getState().consecutivePasses).toBe(0);
        });
        test('handNumber = 1', () => {
            expect(createEngine().engine.getState().handNumber).toBe(1);
        });
    });

    describe('getOpenEnds', () => {
        test('[-1,-1] sin tablero', () => {
            expect(createEngine(false).engine.getOpenEnds()).toEqual([-1, -1]);
        });
        test('ficha única', () => {
            const { engine, players } = createEngine(false);
            const s = engine.getState();
            s.currentTurnPlayerId = players[0].id;
            players[0].hand = [[5, 5]];
            engine.placePiece(players[0].id, [5, 5], 'head');
            expect(engine.getOpenEnds()).toEqual([5, 5]);
        });
        test('colocar en head cambia ends', () => {
            const { engine, players } = createEngine(false);
            const s = engine.getState();
            // Usar [3,5] como base para evitar Doble Punta (3 !== 5)
            s.board = [{ piece: [3, 5] }];
            s.currentTurnPlayerId = players[0].id;
            players[0].hand = [[3, 6]];
            engine.placePiece(players[0].id, [3, 6], 'head');
            // [3,6] on head=3: placedPiece[1]=6===3? no; placedPiece[0]=3===3? yes -> flip to [6,3]
            // board after unshift: [[6,3],[3,5]] -> ends [6,5]
            expect(engine.getOpenEnds()).toEqual([6, 5]);
        });
        test('colocar en tail cambia ends', () => {
            const { engine, players } = createEngine(false);
            const s = engine.getState();
            s.board = [{ piece: [3, 5] }];
            s.currentTurnPlayerId = players[0].id;
            players[0].hand = [[5, 1]];
            engine.placePiece(players[0].id, [5, 1], 'tail');
            // [5,1] on tail=5: placedPiece[0]=5===5? yes -> no flip
            // board after push: [[3,5],[5,1]] -> ends [3,1]
            expect(engine.getOpenEnds()).toEqual([3, 1]);
        });
    });

    describe('isValidMove', () => {
        test('mano 1 solo doble-6', () => {
            const e = createEngine(false).engine;
            expect(e.isValidMove([6, 5], 'head')).toBe(false);
            expect(e.isValidMove([6, 6], 'head')).toBe(true);
        });
        test('mano 2+ tablero vacío acepta cualquier ficha', () => {
            const { engine } = createEngine(false);
            engine.getState().handNumber = 2;
            expect(engine.isValidMove([0, 1], 'head')).toBe(true);
            expect(engine.isValidMove([4, 4], 'head')).toBe(true);
        });
        test('empareja head', () => {
            const e = createEngine(false).engine;
            e.getState().board = [{ piece: [3, 5] }];
            expect(e.isValidMove([3, 2], 'head')).toBe(true);
            expect(e.isValidMove([2, 3], 'head')).toBe(true);
            expect(e.isValidMove([4, 4], 'head')).toBe(false);
        });
        test('empareja tail', () => {
            const e = createEngine(false).engine;
            e.getState().board = [{ piece: [3, 5] }];
            expect(e.isValidMove([5, 2], 'tail')).toBe(true);
            expect(e.isValidMove([2, 5], 'tail')).toBe(true);
            expect(e.isValidMove([4, 4], 'tail')).toBe(false);
        });
        test('rechaza sin match', () => {
            const e = createEngine(false).engine;
            e.getState().board = [{ piece: [3, 5] }];
            expect(e.isValidMove([1, 2], 'head')).toBe(false);
            expect(e.isValidMove([1, 2], 'tail')).toBe(false);
        });
    });

    describe('placePiece', () => {
        test('rechaza si no es turno', () => {
            expect(createEngine(false).engine.placePiece('x', [6, 6], 'head')).toBe(false);
        });
        test('rechaza ficha no en mano', () => {
            const { engine, players } = createEngine(false);
            engine.getState().currentTurnPlayerId = players[0].id;
            players[0].hand = [[6, 6]];
            expect(engine.placePiece(players[0].id, [5, 4], 'head')).toBe(false);
        });
        test('coloca doble-6 en mano 1, cambia turno', () => {
            const { engine, players } = createEngine(false);
            const s = engine.getState();
            s.currentTurnPlayerId = players[0].id;
            players[0].hand = [[6, 6], [0, 1]];
            expect(engine.placePiece(players[0].id, [6, 6], 'head')).toBe(true);
            expect(s.board).toHaveLength(1);
            expect(s.board[0].piece).toEqual([6, 6]);
            expect(s.board[0].isStarter).toBe(true);
            expect(s.board[0].ownerTeam).toBe('A');
            expect(s.currentTurnPlayerId).toBe(players[1].id);
        });
        test('mano 1 rechaza no doble-6 si tiene doble-6', () => {
            const { engine, players } = createEngine(false);
            const s = engine.getState();
            s.currentTurnPlayerId = players[0].id;
            players[0].hand = [[6, 6], [5, 4]];
            expect(engine.placePiece(players[0].id, [5, 4], 'head')).toBe(false);
        });
        test('mano 2+ acepta primera ficha cualquiera', () => {
            const { engine, players } = createEngine(false);
            const s = engine.getState();
            s.handNumber = 2;
            s.currentTurnPlayerId = players[0].id;
            players[0].hand = [[5, 4]];
            expect(engine.placePiece(players[0].id, [5, 4], 'head')).toBe(true);
        });
        test('Doble Punta fuerza tail cuando ficha empareja ambos extremos', () => {
            const { engine, players } = createEngine(false);
            const s = engine.getState();
            s.board = [{ piece: [2, 6] }, { piece: [6, 6] }, { piece: [6, 3] }]; // ends [2,3]
            s.currentTurnPlayerId = players[0].id;
            players[0].hand = [[2, 3]];
            engine.placePiece(players[0].id, [2, 3], 'head');
            // [2,3] matches head=2 AND tail=3 -> forced to tail
            const last = s.board[s.board.length - 1];
            expect(last.piece).toEqual([3, 2]); // flipped: [3,2] at tail (piece[0]=3===tail=3)
        });
        test('voltea ficha en head', () => {
            const { engine, players } = createEngine(false);
            const s = engine.getState();
            s.board = [{ piece: [3, 5] }];
            s.currentTurnPlayerId = players[0].id;
            players[0].hand = [[6, 3]];
            engine.placePiece(players[0].id, [6, 3], 'head');
            // [6,3] head=3: [1]=3===3 -> no flip
            expect(s.board[0].piece).toEqual([6, 3]);
        });
        test('voltea ficha en tail', () => {
            const { engine, players } = createEngine(false);
            const s = engine.getState();
            s.board = [{ piece: [3, 5] }];
            s.currentTurnPlayerId = players[0].id;
            players[0].hand = [[5, 1]];
            engine.placePiece(players[0].id, [5, 1], 'tail');
            // [5,1] tail=5: [0]=5===5 -> no flip
            expect(s.board[1].piece).toEqual([5, 1]);
        });
        test('reinicia consecutivePasses', () => {
            const { engine, players } = createEngine(false);
            const s = engine.getState();
            s.board = [{ piece: [3, 5] }]; // ends [3,5]
            s.currentTurnPlayerId = players[0].id;
            players[0].hand = [[3, 2]];
            engine.placePiece(players[0].id, [3, 2], 'head'); // board: [[2,3],[3,5]] ends [2,5]
            s.consecutivePasses = 3;
            s.currentTurnPlayerId = players[1].id;
            players[1].hand = [[5, 0]]; // connects tail=5
            engine.placePiece(players[1].id, [5, 0], 'tail');
            expect(s.consecutivePasses).toBe(0);
        });
    });

    describe('passTurn', () => {
        test('ignorado si tiene jugada', () => {
            const { engine, players } = createEngine(false);
            const s = engine.getState();
            s.board = [{ piece: [3, 5] }];
            s.currentTurnPlayerId = players[0].id;
            players[0].hand = [[3, 1]];
            engine.passTurn(players[0].id);
            expect(s.currentTurnPlayerId).toBe(players[0].id);
            expect(s.consecutivePasses).toBe(0);
        });
        test('avanza tras 2500ms si no tiene jugada', () => {
            const { engine, players } = createEngine(false);
            const s = engine.getState();
            s.board = [{ piece: [3, 5] }];
            s.currentTurnPlayerId = players[0].id;
            s.handNumber = 2;
            players[0].hand = [[0, 0]];
            engine.passTurn(players[0].id);
            jest.advanceTimersByTime(2500);
            expect(s.consecutivePasses).toBe(1);
            expect(s.currentTurnPlayerId).toBe(players[1].id);
        });
    });

    describe('Tranque', () => {
        function do4Passes(engine: GameEngine, players: Player[]) {
            for (const p of players) { engine.passTurn(p.id); jest.advanceTimersByTime(2500); }
        }
        test('4 pases declara ganador', () => {
            const { engine, players } = createEngine(false);
            const s = engine.getState();
            s.board = [{ piece: [0, 1] }]; // ends [0,1]
            s.currentTurnPlayerId = players[0].id;
            s.handNumber = 2;
            players.forEach(p => (p.hand = [[5, 5]])); // 5s don't match 0 or 1
            do4Passes(engine, players);
            expect(s.handWinnerId).toBeDefined();
            expect(s.winReason).toBe('tranque');
        });
        test('gana menor puntaje (trancador P4 vs opponent P1)', () => {
            const { engine, players } = createEngine(false);
            const s = engine.getState();
            s.board = [{ piece: [0, 1] }]; // ends [0,1]
            s.currentTurnPlayerId = players[0].id;
            s.handNumber = 2;
            players[0].hand = [[5, 5]];  // P1=10pts (opponent)
            players[1].hand = [[6, 6]];  // P2=12pts
            players[2].hand = [[4, 4]];  // P3=8pts
            players[3].hand = [[0, 0]];  // P4=0pts (trancador) - wait, 0 matches head=0!
            players[3].hand = [[3, 3]];  // P4=6pts, doesn't match 0 or 1
            do4Passes(engine, players);
            // trancador=P4(6pts) vs opponent=P1(10pts) -> P4 wins (lower)
            expect(s.handWinnerId).toBe(players[3].id);
        });
        test('empate va al oponente', () => {
            const { engine, players } = createEngine(false);
            const s = engine.getState();
            s.board = [{ piece: [0, 1] }]; // ends [0,1]
            s.currentTurnPlayerId = players[0].id;
            s.handNumber = 2;
            players[0].hand = [[5, 5]];  // P1=10pts (opponent)
            players[1].hand = [[6, 6]];  // P2=12pts
            players[2].hand = [[4, 4]];  // P3=8pts
            players[3].hand = [[4, 6]];  // P4=10pts (trancador), same as P1
            do4Passes(engine, players);
            // trancador=P4(10pts) vs opponent=P1(10pts) tie -> opponent(P1) wins
            expect(s.handWinnerId).toBe(players[0].id);
        });
    });

    describe('Capicúa', () => {
        test('ficha mixta que cierra ambos extremos da +30', () => {
            const { engine, players } = createEngine(false);
            const s = engine.getState();
            s.board = [{ piece: [3, 6] }, { piece: [6, 6] }, { piece: [6, 1] }]; // ends [3,1]
            s.currentTurnPlayerId = players[3].id;
            players[3].hand = [[3, 1]];
            engine.placePiece(players[3].id, [3, 1], 'head');
            // [3,1] head=3: [0]=3===3, flip to [1,3] -> board: [[1,3],[3,6],[6,6],[6,1]]
            // ends: [1,1] -> capicua
            expect(s.handWinnerId).toBe(players[3].id);
            expect(s.winReason).toBe('capicua');
            expect(s.handPoints).toBeGreaterThanOrEqual(30);
        });
        test('no capicua si ficha ganadora es doble', () => {
            const { engine, players } = createEngine(false);
            const s = engine.getState();
            s.board = [{ piece: [3, 5] }];
            s.currentTurnPlayerId = players[0].id;
            players[0].hand = [[5, 5]];  // doble no puede ser capicua
            engine.placePiece(players[0].id, [5, 5], 'tail');
            // [5,5] tail=5: [0]=5===5 -> no flip -> board: [[3,5],[5,5]]
            // ends: [3,5], no capicua
            expect(s.handWinnerId).toBe(players[0].id);
            expect(s.winReason).toBe('domino');
            expect(s.handPoints).toBeLessThan(30);
        });
    });

    describe('Pase Redondo', () => {
        function setupPaseRedondo(engine: GameEngine, players: Player[], tailConnector: Piece) {
            const s = engine.getState();
            s.handNumber = 2;
            // P1 plays a piece so there's a board with a "last player"
            s.board = [{ piece: [3, 5] }];
            s.currentTurnPlayerId = players[0].id;
            players[0].hand = [tailConnector, [2, 2]];
            engine.placePiece(players[0].id, tailConnector, 'tail');
        }
        test('+30 si 3 pasan y 4to tiene jugada con score < 170', () => {
            const { engine, players } = createEngine(false);
            const s = engine.getState();
            setupPaseRedondo(engine, players, [5, 2]); // board: [[3,5],[2,5]] ends [3,2]
            // Opponents pass
            s.currentTurnPlayerId = players[1].id;
            players[1].hand = [[0, 0]];
            engine.passTurn(players[1].id); jest.advanceTimersByTime(2500);
            players[2].hand = [[0, 0]];
            engine.passTurn(players[2].id); jest.advanceTimersByTime(2500);
            players[3].hand = [[0, 0]];
            engine.passTurn(players[3].id); jest.advanceTimersByTime(2500);
            // Pase Redondo: P1 has valid move [2,2] matches tail=2, team < 170 -> +30
            expect(s.currentTurnPlayerId).toBe(players[0].id);
            expect(s.teamScores['A']).toBe(30);
        });
        test('no +30 si score >= 170', () => {
            const { engine, players } = createEngine(false);
            const s = engine.getState();
            s.teamScores['A'] = 170;
            setupPaseRedondo(engine, players, [5, 2]);
            s.currentTurnPlayerId = players[1].id;
            players[1].hand = [[0, 0]];
            engine.passTurn(players[1].id); jest.advanceTimersByTime(2500);
            players[2].hand = [[0, 0]];
            engine.passTurn(players[2].id); jest.advanceTimersByTime(2500);
            players[3].hand = [[0, 0]];
            engine.passTurn(players[3].id); jest.advanceTimersByTime(2500);
            expect(s.teamScores['A']).toBe(170); // unchanged
        });
    });

    describe('Salida', () => {
        function triggerSalida(engine: GameEngine, players: Player[], startPiece: Piece, connector: Piece, expectedBonus: number) {
            const s = engine.getState();
            s.handNumber = 2;
            s.currentTurnPlayerId = players[0].id;
            // Give extra piece so P1 doesn't win by domino (avoid capicúa)
            players[0].hand = [startPiece, connector, [3, 1]];
            engine.placePiece(players[0].id, startPiece, 'head'); // board: [startPiece]

            // P3 (partner, team A) passes -> sets pendingStartBonus
            s.currentTurnPlayerId = players[2].id;
            players[2].hand = [[0, 0]]; // no match for startPiece ends
            engine.passTurn(players[2].id); // synchronous: sets pendingStartBonus

            // P1 plays again -> bonus awarded
            s.currentTurnPlayerId = players[0].id;
            players[0].hand = [connector, [3, 1]];
            engine.placePiece(players[0].id, connector, 'head');
        }
        test('doble +30 si compañero pasa', () => {
            const { engine, players } = createEngine(false);
            triggerSalida(engine, players, [5, 5], [5, 3], 30);
            expect(engine.getState().teamScores['A']).toBe(30);
        });
        test('mixta +60 si compañero pasa', () => {
            const { engine, players } = createEngine(false);
            // startPiece [5,3] has ends [5,3]; play [5,1] on head=5
            const s = engine.getState();
            s.handNumber = 2;
            s.currentTurnPlayerId = players[0].id;
            players[0].hand = [[5, 3], [5, 1], [1, 2]];
            engine.placePiece(players[0].id, [5, 3], 'head');
            // P3 (partner, team A) passes -> sets pendingStartBonus
            s.currentTurnPlayerId = players[2].id;
            players[2].hand = [[0, 0]];
            engine.passTurn(players[2].id);
            // P1 plays again -> bonus awarded
            s.currentTurnPlayerId = players[0].id;
            players[0].hand = [[5, 1], [1, 2]];
            engine.placePiece(players[0].id, [5, 1], 'head');
            expect(engine.getState().teamScores['A']).toBe(60);
        });
    });

    describe('Victoria', () => {
        test('domino: puntos de manos restantes (no capicúa)', () => {
            const { engine, players } = createEngine(false);
            const s = engine.getState();
            s.board = [{ piece: [3, 5] }]; // ends [3,5]
            s.currentTurnPlayerId = players[0].id;
            s.handNumber = 2;
            players[0].hand = [[5, 1]];    // play on tail -> ends [3,1], not capicua
            players[1].hand = [[2, 3]];    // 5
            players[2].hand = [[1, 1]];    // 2
            players[3].hand = [[0, 4]];    // 4
            engine.placePiece(players[0].id, [5, 1], 'tail');
            // [5,1] on tail=5: [0]=5===5 -> no flip -> board [[3,5],[5,1]]
            expect(s.handWinnerId).toBe(players[0].id);
            expect(s.winReason).toBe('domino');
            expect(s.handPoints).toBe(11); // 5+2+4
        });
        test('match win a los 200', () => {
            const { engine, players } = createEngine(false);
            const s = engine.getState();
            s.teamScores['A'] = 190;
            s.board = [{ piece: [3, 5] }];
            s.currentTurnPlayerId = players[0].id;
            s.handNumber = 2;
            players[0].hand = [[5, 1]];
            players[1].hand = [[2, 3]];  // 5
            players[2].hand = [[1, 1]];  // 2
            players[3].hand = [[0, 4]];  // 4
            engine.placePiece(players[0].id, [5, 1], 'tail');
            expect(s.winnerTeam).toBe('A');
            expect(s.teamScores['A']).toBe(201);
        });
        test('menos de 200: siguiente mano', () => {
            const { engine, players } = createEngine(false);
            const s = engine.getState();
            s.board = [{ piece: [3, 5] }];
            s.currentTurnPlayerId = players[0].id;
            s.handNumber = 2;
            players[0].hand = [[5, 1]];
            players[1].hand = [[0, 0]];
            players[2].hand = [[0, 0]];
            players[3].hand = [[0, 0]];
            engine.placePiece(players[0].id, [5, 1], 'tail');
            expect(s.handWinnerId).toBe(players[0].id);
            expect(s.winnerTeam).toBeUndefined();
            expect(s.handNumber).toBe(3);
        });
    });

    describe('Timer', () => {
        test('auto-juega si hay jugada', () => {
            const { engine } = createEngine(true);
            const s = engine.getState();
            s.board = [{ piece: [3, 5] }];
            const p = s.players.find(pl => pl.id === s.currentTurnPlayerId)!;
            p.hand = [[5, 1]];
            const before = s.board.length;
            jest.advanceTimersByTime(5001);
            expect(s.board.length).toBe(before + 1);
        });
        test('auto-pasa si no hay jugada', () => {
            const { engine } = createEngine(true);
            const s = engine.getState();
            s.board = [{ piece: [3, 5] }];
            const p = s.players.find(pl => pl.id === s.currentTurnPlayerId)!;
            p.hand = [[0, 0]];
            const before = s.consecutivePasses;
            jest.advanceTimersByTime(5001);
            expect(s.consecutivePasses).toBe(before + 1);
        });
    });

    describe('Orden de turnos', () => {
        test('0->1->2->3->0 sin ganar', () => {
            const { engine, players } = createEngine(false);
            const s = engine.getState();
            // Setup board with 2 pieces so ends are different
            s.board = [{ piece: [3, 5] }, { piece: [5, 2] }]; // ends [3,2]
            s.currentTurnPlayerId = players[0].id;
            // Must match at least one end
            players[0].hand = [[3, 6], [6, 0]];
            engine.placePiece(players[0].id, [3, 6], 'head'); // [3,6] head=3: [1]=6!==3, [0]=3===3 -> flip [6,3]
            expect(s.currentTurnPlayerId).toBe(players[1].id);

            s.currentTurnPlayerId = players[1].id;
            players[1].hand = [[2, 4], [4, 0]];
            engine.placePiece(players[1].id, [2, 4], 'tail'); // [2,4] tail=2: [0]=2===2 -> no flip
            expect(s.currentTurnPlayerId).toBe(players[2].id);

            s.currentTurnPlayerId = players[2].id;
            players[2].hand = [[4, 1], [1, 0]];
            engine.placePiece(players[2].id, [4, 1], 'tail'); // [4,1] tail=4: [0]=4===4 -> no flip
            expect(s.currentTurnPlayerId).toBe(players[3].id);

            s.currentTurnPlayerId = players[3].id;
            players[3].hand = [[1, 0], [0, 0]];
            engine.placePiece(players[3].id, [1, 0], 'tail'); // [1,0] tail=1: [0]=1===1 -> no flip
            expect(s.currentTurnPlayerId).toBe(players[0].id);
        });
    });

    describe('getState', () => {
        test('propiedades esperadas', () => {
            const s = createEngine().engine.getState();
            expect(s).toHaveProperty('board');
            expect(s).toHaveProperty('players');
            expect(s).toHaveProperty('currentTurnPlayerId');
            expect(s).toHaveProperty('turnDeadline');
            expect(s).toHaveProperty('consecutivePasses');
            expect(s).toHaveProperty('handNumber');
            expect(s).toHaveProperty('teamScores');
        });
    });
});
