"use strict";
/**
 * Shared TypeScript types for Domino game
 * Used by: Server (Node.js), Web Client (React), Mobile Client (Flutter via codegen)
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.GAME_CONSTANTS = void 0;
exports.sumHand = sumHand;
exports.generateDeck = generateDeck;
exports.shuffleDeck = shuffleDeck;
exports.GAME_CONSTANTS = {
    TARGET_SCORE: 200,
    TILES_PER_PLAYER: 7,
    MAX_PLAYERS: 4,
    DEFAULT_TURN_DURATION: 15,
    PASA_REDONDO_THRESHOLD: 170,
    BONUS: {
        CAPICUA: 30,
        PASA_REDONDO: 30,
        SALIDA_DOBLE: 30,
        SALIDA_MIXTA: 60,
    },
    RECONNECT_WINDOW_MS: 120000,
    READY_TIMER_MS: 10000,
    PASS_NOTIFICATION_MS: 2500,
};
function sumHand(hand) {
    return hand.reduce((sum, p) => sum + p[0] + p[1], 0);
}
function generateDeck() {
    const deck = [];
    for (let i = 0; i <= 6; i++) {
        for (let j = i; j <= 6; j++) {
            deck.push([i, j]);
        }
    }
    return deck;
}
function shuffleDeck(deck) {
    const shuffled = [...deck];
    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
}
