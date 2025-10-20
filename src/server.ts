// src/server.ts
import express from 'express';
import { createServer } from 'http';
import { Server, Socket } from 'socket.io';
import path from 'path';
import { fileURLToPath } from 'url';
import type { GameState, Player } from './types.js';
import * as _ from './Game.js';
// --- Server Setup ---
const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, { cors: { origin: "*" } });
const PORT = 3001;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
app.use(express.static(path.join(__dirname, '..', 'public')));
const gameStates: { [roomId: string]: GameState } = {};
const socketToPlayerMap: { [socketId: string]: { roomId: string, playerId: number } } = {};

// Helper to generate a simple, random Room ID
function generateRoomId(): string {
    return Math.random().toString(36).substring(2, 6).toUpperCase();
}

// Helper to find all sockets in a room for a specific player
function findSocketByPlayerId(playerId: number, roomId: string): Socket | undefined {
    for (const [socketId, playerInfo] of Object.entries(socketToPlayerMap)) {
        if (playerInfo.roomId === roomId && playerInfo.playerId === playerId) {
            return io.sockets.sockets.get(socketId);
        }
    }
    return undefined;
}


io.on('connection', (socket) => {
    console.log(`A user connected: ${socket.id}`);

    // Create a new room
    socket.on('createRoom', ({ playerName }) => {
        const roomId = generateRoomId();
        socket.join(roomId);

        // Initialize game state
        gameStates[roomId] = _.initializeGameState(roomId);
        const state = gameStates[roomId]!;

        // Add creator as Player 0
        const playerId = 0;
        socketToPlayerMap[socket.id] = { roomId, playerId };
        _.addPlayer(playerName, state);

        console.log(`Player ${playerName} (ID: ${playerId}) created and joined new room ${roomId}`);

        // Send confirmation back to the creator
        socket.emit('roomCreated', {
            roomId,
            playerId,
            players: state.players.map(p => ({ id: p.id, name: p.name }))
        });

        // Update lobby for all in room
        io.to(roomId).emit('lobbyUpdate', {
            players: state.players.map(p => ({ id: p.id, name: p.name })),
            roomId
        });
    });

    // Join an existing room
    socket.on('joinRoom', ({ playerName, roomId }) => {
        const state = gameStates[roomId];

        // Validation checks
        if (!state) {
            socket.emit('joinError', { message: 'Room not found.' });
            return;
        }
        if (state.players.length >= 4) {
            socket.emit('joinError', { message: 'Room is full.' });
            return;
        }

        socket.join(roomId);
        const playerId = state.players.length;
        socketToPlayerMap[socket.id] = { roomId, playerId };

        _.addPlayer(playerName, state);
        console.log(`Player ${playerName} (ID: ${playerId}) joined existing room ${roomId}`);

        // Notify everyone in the room of the new player
        io.to(roomId).emit('lobbyUpdate', {
            players: state.players.map(p => ({ id: p.id, name: p.name })),
            roomId
        });

        // Send join confirmation to the joining player
        socket.emit('roomJoined', {
            roomId,
            playerId,
            players: state.players.map(p => ({ id: p.id, name: p.name }))
        });

        // If the room is now full, start the game
        if (state.players.length === 4) {
            console.log(`Room ${roomId} is full. Starting game...`);
            _.setUpTeams(state);
            _.startNewRound(state);

            const round = state.currentRoundState!;

            // Send personalized initial hands to each player
            state.players.forEach(player => {
                const playerSocket = findSocketByPlayerId(player.id, roomId);
                if (playerSocket) {
                    playerSocket.emit('gameStarted', {
                        yourHand: round.hands[player.id],
                        playerId: player.id,
                        allPlayers: state.players.map(p => ({
                            id: p.id,
                            name: p.name,
                            teamName: p.teamName
                        })),
                        masterCallerId: round.masterCallerId,
                        roundNumber: round.roundNumber
                    });

                    if (player.id === round.masterCallerId) {
                        playerSocket.emit('promptMasterSuit');
                    }
                }
            });
        }
    });

    socket.on('masterSuitChosen', ({ suit }) => {
        const playerInfo = socketToPlayerMap[socket.id];
        if (!playerInfo) return;

        const { roomId, playerId } = playerInfo;
        const state = gameStates[roomId];
        if (!state) return;

        _.chooseMasterSuit(state, playerId, suit);
        const round = state.currentRoundState!;

        // Notify all players about master suit and send final hands
        io.to(roomId).emit('updateMasterSuit', { masterSuit: round.masterSuit });

        state.players.forEach(player => {
            const playerSocket = findSocketByPlayerId(player.id, roomId);
            playerSocket?.emit('finalDeal', {
                yourHand: round.hands[player.id],
                playerId: player.id
            });
        });

        // Start the first trick
        io.to(roomId).emit('updateTurn', {
            currentPlayerId: round.currentTrick!.leadPlayerId,
            playableCards: _.getPlayableCards(state, round.currentTrick!.leadPlayerId)
        });
    });

    socket.on('playCard', ({ card }) => {
        const playerInfo = socketToPlayerMap[socket.id];
        if (!playerInfo) return;

        const { roomId, playerId } = playerInfo;
        const state = gameStates[roomId];
        if (!state) return;

        const result = _.playCard(state, playerId, card);
        if (result.success) {
            const player = state.players[playerId]!;
            io.to(roomId).emit('cardPlayed', {
                playerId: player.id,
                playerName: player.name,
                card
            });

            const round = state.currentRoundState!;

            // Check if trick is complete
            if (round.currentTrick!.cardsPlayed.length === 4) {
                _.endTrick(state);
                const lastTrick = round.playedTricks[round.playedTricks.length - 1];
                if (lastTrick) {
                    const trickWinner = state.players.find(p => p.id === lastTrick.winnerId);
                    if (trickWinner) {
                        io.to(roomId).emit('trickResult', {
                            winnerId: trickWinner.id,
                            winnerName: trickWinner.name,
                            roundInfo: round.scores
                        });
                    }
                }

                // Check if round is over
                if (round.playedTricks.length == 13) {
                    _.endRound(state);
                    io.to(roomId).emit('roundResult', {
                        scores: round.scores,
                        roundWinner: round.roundWinner
                    });

                    // Start new round after a delay
                    setTimeout(() => {
                        if (state.players.length === 4) {
                            _.startNewRound(state);
                            const newRound = state.currentRoundState!;

                            state.players.forEach(player => {
                                const playerSocket = findSocketByPlayerId(player.id, roomId);
                                if (playerSocket) {
                                    playerSocket.emit('newRoundStarted', {
                                        yourHand: newRound.hands[player.id],
                                        roundNumber: newRound.roundNumber,
                                        masterCallerId: newRound.masterCallerId
                                    });

                                    if (player.id === newRound.masterCallerId) {
                                        playerSocket.emit('promptMasterSuit');
                                    }
                                }
                            });
                        }
                    }, 5000);
                }
            }

            // Update turn for next player
            if (state.currentRoundState?.currentTrick) {
                const nextPlayerId = (state.currentRoundState.currentTrick.leadPlayerId +
                    state.currentRoundState.currentTrick.cardsPlayed.length) % 4;
                io.to(roomId).emit('updateTurn', {
                    currentPlayerId: nextPlayerId,
                    playableCards: _.getPlayableCards(state, nextPlayerId)
                });
            }
        } else {
            socket.emit('error', result.message);
        }
    });

    socket.on('disconnect', () => {
        const playerInfo = socketToPlayerMap[socket.id];
        if (playerInfo) {
            const { roomId, playerId } = playerInfo;
            console.log(`Player ${playerId} disconnected from room ${roomId}`);

            // Remove from mappings
            delete socketToPlayerMap[socket.id];
            if (gameStates[roomId])
                _.removePlayer(gameStates[roomId], playerId);
            // Notify other players
            socket.to(roomId).emit('playerDisconnected', { playerId });
        }
    });

    socket.on('getGameState', () => {
        const playerInfo = socketToPlayerMap[socket.id];
        if (!playerInfo) return;

        const { roomId, playerId } = playerInfo;
        const state = gameStates[roomId];
        if (!state) return;

        socket.emit('gameStateUpdate', {
            players: state.players.map(p => ({ id: p.id, name: p.name, teamName: p.teamName })),
            currentRound: state.currentRoundState,
            playerId: playerId
        });
    });
    socket.on('requestPlayerData', ({ roomId }, callback) => {
        const state = gameStates[roomId];
        if (!state) return callback({ success: false });
        callback({
            success: true,
            players: state.players.map(p => ({ id: p.id, name: p.name, team: p.teamName })),
        });
    });

});

httpServer.listen(PORT, () => {
    console.log(`Dahalmahra server is running and listening on http://localhost:${PORT}`);
});