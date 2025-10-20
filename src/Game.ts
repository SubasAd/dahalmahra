import type { GameState, Card } from './types.js';
import * as types from './types.js'

export function initializeGameState(room: string): types.GameState {
    return {
        roomId: room,
        players: [],
        teams: [],
        currentRoundState: null,
        pastRounds: [],
    };
}
function logAction(action: string, payload: any, state: types.GameState) {
    console.log(`🚀 [ACTION] ${action}:`, payload);
    console.log('📊 [STATE AFTER]:', JSON.stringify(state, null, 2));
    console.log('---');
}

export function addPlayer(name: string, currentState: types.GameState) {
    if (currentState.players.length >= 4) {
        logAction("ADD_PLAYER", { name }, currentState);
        return currentState;
    }
    const newPlayerId = currentState.players.length;
    const newPlayer = new types.Player(newPlayerId, name);
    currentState.players.push(newPlayer);
    console.log(`Logic: Player '${name}' added with ID ${newPlayerId}. Total players: ${currentState.players.length}`);
    logAction("ADD_PLAYER", { name }, currentState);
}

export function setUpTeams(gameState: types.GameState) {
    if (gameState.players.length !== 4) {
        console.error("Logic: Cannot set up teams without exactly 4 players.");
        return;
    }

    const players = gameState.players;
    const teamBlack: types.Team = {
        name: 'Black',
        player1: players.find(p => p.id === 0)!,
        player2: players.find(p => p.id === 2)!
    };
    const teamRed: types.Team = {
        name: 'Red',
        player1: players.find(p => p.id === 1)!,
        player2: players.find(p => p.id === 3)!
    };

    // Directly mutate the teams array and the players within it
    gameState.teams = [teamBlack, teamRed];
    gameState.players.forEach(p => {
        p.teamName = (p.id === 0 || p.id === 2) ? 'Black' : 'Red';
    });
    console.log("Logic: Teams set up - Black (Players 0 & 2), Red (Players 1 & 3).");
    logAction("SET_UP_TEAMS", {}, gameState);

}

/**
 * Creates a standard 52-card deck.
 * @returns An array of 52 unique Card objects, sorted by suit and rank.
 */
export function createDeck(): types.Card[] {
    const suits: types.Card['suit'][] = ['Spades', 'Hearts', 'Diamonds', 'Clubs'];
    const ranks = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'Jack', 'Queen', 'King', 'Ace'];
    const deck: types.Card[] = [];

    for (const suit of suits) {
        for (const rank of ranks) {
            let value = 0;
            // Use a switch for clarity
            switch (rank) {
                case 'Jack': value = 11; break;
                case 'Queen': value = 12; break;
                case 'King': value = 13; break;
                case 'Ace': value = 14; break;
                default: value = parseInt(rank);
            }
            deck.push({ suit, rank, value });
        }
    }
    return deck;
}

/**
 * Shuffles an array of cards using the Fisher-Yates algorithm.
 * This function is "pure" - it does not modify the original array.
 * @param deck The array of cards to shuffle.
 * @returns A new array containing the same cards in a random order.
 */
export function shuffleDeck(deck: types.Card[]): types.Card[] {
    const shuffled: types.Card[] = [...deck];
    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i]!, shuffled[j]!] = [shuffled[j]!, shuffled[i]!];
    }
    return shuffled;
}

// In src/gameLogic.ts

/**
 * Initializes a new round within the GameState.
 * This function mutates the provided gameState object.
 * It determines the dealer, creates/shuffles a deck, deals the first 5 cards,
 * and sets the game phase to 'master_selection'.
 * @param gameState The GameState object to mutate.
 */
export function startNewRound(gameState: types.GameState): void {
    let dealerId: number = findDealer(gameState);

    // 2. Create and shuffle a fresh deck of cards
    const newDeck = shuffleDeck(createDeck());

    // 3. Deal the initial 5 cards to each player
    const hands: { [playerId: number]: types.Card[] } = { 0: [], 1: [], 2: [], 3: [] };
    for (let i = 0; i < 5; i++) {
        for (let p_id = 0; p_id < 4; p_id++) {
            const card = newDeck.pop();
            if (card) {
                hands[p_id]!.push(card);
            }
        }
    }

    // 4. Create the new RoundState object
    const newRound: types.RoundState = {
        roundNumber: gameState.pastRounds.length + 1,
        hands: hands,
        deck: newDeck, // The remaining 32 cards
        dealerId: dealerId,
        masterCallerId: (dealerId + 1) % 4,
        masterSuit: null,

        // The first trick is ready to start, led by the master caller
        currentTrick: {
            id: 1,
            leadPlayerId: (dealerId + 1) % 4,
            leadingSuit: null,
            cardsPlayed: [],
            winnerId: null
        },
        playedTricks: [],

        scores: {
            Black: { tens: 0, tricks: 0 },
            Red: { tens: 0, tricks: 0 }
        },

        phase: 'master_selection', // The game is now waiting for this choice
        roundWinner: null,
        nextDealerId: null
    };

    // 5. Mutate the main GameState to begin the new round
    gameState.currentRoundState = newRound;
    logAction("START_NEW_ROUND", { round: newRound }, gameState);
    console.log(`Logic: Round ${newRound.roundNumber} started. Dealer is Player ${dealerId}. Waiting for master suit selection.`);
}
// Add this new function to your src/gameLogic.ts file.

/**
 * Finalizes a completed round.
 * It calculates scores, determines the winner, checks for a Kot,
 * calculates the dealer for the next round based on the complex rules,
 * and transitions the state by moving the current round to pastRounds.
 * This function mutates the gameState object.
 * @param gameState The GameState where the current round has just finished.
 */
export function endRound(gameState: types.GameState): void {
    const round = gameState.currentRoundState;
    if (!round || round.playedTricks.length !== 13) {
        console.error("Logic Error: endRound called but round is not complete.");
        return;
    }
    console.log(`Logic: Ending Round ${round.roundNumber}...`);

    // --- Step 1: Calculate Final Scores for the Round ---
    const teamScores = calculateScores(round, gameState);
    console.log(`Logic: Final Scores - Black: ${teamScores.Black.tens} tens, Red: ${teamScores.Red.tens} tens.`);

    // --- Step 2: Determine Round Winner ---
    let winnerName: 'Black' | 'Red';
    if (teamScores.Black.tens > teamScores.Red.tens) {
        winnerName = 'Black';
    } else if (teamScores.Red.tens > teamScores.Black.tens) {
        winnerName = 'Red';
    } else { // Tie-breaker on tricks
        winnerName = (teamScores.Black.tricks >= teamScores.Red.tricks) ? 'Black' : 'Red';
    }
    round.roundWinner = winnerName;
    console.log(`Logic: Round winner is Team ${winnerName}.`);

    // --- Step 3: Check for a "Kot" ---
    const wasKot = teamScores.Black.tens === 4 || teamScores.Red.tens === 4;

    // --- Step 4: Calculate the Next Dealer ID using our rules ---
    const dealer = gameState.players[round.dealerId]!;
    const dealerTeamName = dealer.teamName!;
    let nextDealerId: number;

    if (winnerName === dealerTeamName) { // Dealer's team won
        if (wasKot) {
            // Rule: Dealer's team wins with Kot -> Dealer passes ANTI-CLOCKWISE
            nextDealerId = (round.dealerId - 1 + 4) % 4;
            console.log("Logic: Dealer's team won with Kot. Dealer passes anti-clockwise.");
        } else {
            // Rule: Dealer's team wins normally -> Dealer passes CLOCKWISE
            nextDealerId = (round.dealerId + 1) % 4;
            console.log("Logic: Dealer's team won. Dealer passes clockwise.");
        }
    } else { // Dealer's team lost
        if (wasKot) {
            // Rule: Dealer's team loses with Kot -> Dealer passes to TEAMMATE
            nextDealerId = (round.dealerId + 2) % 4;
            console.log("Logic: Dealer's team lost with Kot. Dealer passes to teammate.");
        } else {
            // Rule: Dealer's team loses normally -> SAME DEALER is punished
            nextDealerId = round.dealerId;
            console.log("Logic: Dealer's team lost. Dealer is punished and deals again.");
        }
    }
    round.nextDealerId = nextDealerId;
    round.phase = 'finished';

    // --- Step 5: Transition the Game State ---
    // Move the completed round into the history
    gameState.pastRounds.push(round);
    // Set the current round to null, ready for the next one
    gameState.currentRoundState = null;
    logAction("END_ROUND", { round: round }, gameState);
    console.log(`Logic: Round ${round.roundNumber} finalized. Next dealer will be Player ${nextDealerId}.`);
}
function calculateScores(round: types.RoundState, gameState: GameState) {
    const teamScores = {
        Black: { tens: 0, tricks: 0 },
        Red: { tens: 0, tricks: 0 }
    };
    for (const trick of round.playedTricks) {
        const winningTeamName = gameState.players[trick.winnerId!]!.teamName!;
        teamScores[winningTeamName].tricks++;
        for (const play of trick.cardsPlayed) {
            if (play.card.rank === '10') {
                teamScores[winningTeamName].tens++;
            }
        }
    }
    round.scores = teamScores;
    return teamScores;
}

function findDealer(gameState: types.GameState): number {
    let dealerId: number = 0;
    if (gameState.pastRounds.length >= 1) {
        const lastRound = gameState.pastRounds[gameState.pastRounds.length - 1];
        if (lastRound && lastRound.nextDealerId) {
            dealerId = lastRound.nextDealerId;

        }
    } else {
        const tempDeck = shuffleDeck(createDeck());
        const drawnCards = tempDeck.slice(0, 4);
        let lowestCardValue = Infinity;
        let initialDealerId = -1;
        drawnCards.forEach((card, index) => {
            if (card.value < lowestCardValue) {
                lowestCardValue = card.value;
                initialDealerId = index;
            }
        });
        logAction("FIND_DEALER", { initialDealerId }, gameState);
        return initialDealerId;
    }
    logAction("FIND_DEALER", { dealerId }, gameState);
    return dealerId;

}

/**
 * Sets the master suit for the round, deals the remaining cards, and transitions the game phase to 'playing'.
 * This function mutates the gameState object.
 * @param gameState The GameState object to mutate.
 * @param playerId The ID of the player choosing the suit.
 * @param chosenSuit The suit they have chosen.
 */
export function chooseMasterSuit(gameState: types.GameState, playerId: number, chosenSuit: types.Card['suit']): void {
    const round = gameState.currentRoundState;

    // --- 1. VALIDATION ---
    // Make sure a round is actually happening.
    if (!round) {
        console.error("Logic Error: chooseMasterSuit called when no round is in progress.");
        return;
    }
    // Make sure the game is in the correct phase.
    if (round.phase !== 'master_selection') {
        console.error("Logic Error: Master suit can only be chosen during the 'master_selection' phase.");
        return;
    }
    // Make sure the correct player is making the choice.
    if (playerId !== round.masterCallerId) {
        console.error(`Logic Error: Player ${playerId} tried to choose the master suit, but it's Player ${round.masterCallerId}'s turn.`);
        return;
    }

    // --- 2. UPDATE STATE: Set the Master Suit ---
    round.masterSuit = chosenSuit;
    console.log(`Logic: Master suit set to ${chosenSuit} by Player ${playerId}.`);

    // --- 3. DEAL REMAINING CARDS ---
    // The deck currently has 32 cards left (52 total - 20 dealt). We deal 8 to each player.
    for (let i = 0; i < 8; i++) {
        for (let p_id = 0; p_id < 4; p_id++) {
            const card = round.deck.pop();
            if (card) {
                round.hands[p_id]!.push(card);
            }
        }
    }
    console.log(`Logic: Dealt remaining cards. Player 0 now has ${round.hands[0]?.length} cards.`);

    // --- 4. UPDATE PHASE ---
    // The round is now ready for card play to begin.
    round.phase = 'playing';
    logAction("CHOOSE_MASTER_SUIT", { playerId, chosenSuit }, gameState);
    console.log(`Logic: Round phase is now 'playing'.`);
}

// Add these functions to your src/gameLogic.ts file.

/**
 * Validates if a card play is legal according to the game rules.
 * @param round The current RoundState.
 * @param playerHand The hand of the player making the move.
 * @param cardToPlay The card they want to play.
 * @returns True if the move is valid, false otherwise.
 */
function isMoveValid(round: types.RoundState, playerHand: types.Card[], cardToPlay: types.Card): boolean {
    const leadingSuit = round.currentTrick?.leadingSuit;
    if (!leadingSuit) {
        return true; // Any card can be played to lead a trick.
    }

    const hasLeadingSuit = playerHand.some(c => c.suit === leadingSuit);
    if (hasLeadingSuit && cardToPlay.suit !== leadingSuit) {
        return false; // Player has the leading suit but didn't play it.
    }

    return true; // The move is valid.
}

/**
 * Processes a single card play from a player.
 * Validates the move and mutates the gameState if it's legal.
 * @param gameState The GameState object to mutate.
 * @param playerId The ID of the player playing the card.
 * @param card The card being played.
 * @returns A result object indicating if the move was successful.
 */
export function playCard(gameState: types.GameState, playerId: number, card: types.Card): { success: boolean, message: string } {
    const round = gameState.currentRoundState;
    if (!round || round.phase !== 'playing' || !round.currentTrick) {
        return { success: false, message: 'Not in the playing phase.' };
    }

    const currentTurnId = (round.currentTrick.leadPlayerId + round.currentTrick.cardsPlayed.length) % 4;
    if (playerId !== currentTurnId) {
        return { success: false, message: 'It is not your turn.' };
    }

    const playerHand = round.hands[playerId]!;
    const cardInHand = playerHand.find(c => c.rank === card.rank && c.suit === card.suit);
    if (!cardInHand) {
        return { success: false, message: 'Card not in hand.' };
    }

    if (!isMoveValid(round, playerHand, cardInHand)) {
        return { success: false, message: 'You must follow the leading suit.' };
    }

    // --- All checks passed, mutate the state ---
    // Remove card from hand
    round.hands[playerId] = playerHand.filter(c => c !== cardInHand);

    // Set leading suit if this is the first card of the trick
    if (round.currentTrick.cardsPlayed.length === 0) {
        round.currentTrick.leadingSuit = cardInHand.suit;
    }

    // Add card to the trick
    round.currentTrick.cardsPlayed.push({ playerId, card: cardInHand });
    console.log(`Logic: Player ${playerId} played ${card.rank} of ${card.suit}.`);
    logAction("PLAY_CARD", { playerId, card: cardInHand }, gameState);
    return { success: true, message: 'Card played successfully.' };
}

/**
 * To be called after a trick is full (4 cards played).
 * Determines the winner, updates the state, and sets up for the next trick.
 * This function mutates the gameState object.
 * @param gameState The GameState object to mutate.
 */
export function endTrick(gameState: types.GameState): void {
    const round = gameState.currentRoundState;
    if (!round || round.currentTrick?.cardsPlayed.length !== 4) {
        console.error("Logic Error: endTrick called but trick is not complete.");
        return;
    }

    const trick = round.currentTrick!;

    // --- Determine the winner of the trick ---
    let winnerId = trick.leadPlayerId;
    let winningCard = trick.cardsPlayed.find(p => p.playerId === winnerId)!.card;

    for (const play of trick.cardsPlayed) {
        if (play.playerId === winnerId) continue;

        const currentCard = play.card;
        const isWinningCardMaster = winningCard.suit === round.masterSuit;
        const isCurrentCardMaster = currentCard.suit === round.masterSuit;

        if (isCurrentCardMaster && !isWinningCardMaster) {
            // A master card always beats a non-master card.
            winningCard = currentCard;
            winnerId = play.playerId;
        } else if (isCurrentCardMaster === isWinningCardMaster) {
            // If both are master, or both are non-master, compare by suit and value.
            if (currentCard.suit === winningCard.suit && currentCard.value > winningCard.value) {
                // If they are the same suit, the higher value wins.
                winningCard = currentCard;
                winnerId = play.playerId;
            }
        }
    }

    trick.winnerId = winnerId;
    console.log(`Logic: Player ${winnerId} won trick ${trick.id}.`);

    // --- Update State ---
    round.playedTricks.push(trick);
    calculateScores(round, gameState);

    // --- Setup the Next Trick ---
    const nextTrickId = round.playedTricks.length + 1;
    if (nextTrickId <= 13) {
        round.currentTrick = {
            id: nextTrickId,
            leadPlayerId: winnerId, // The winner leads the next trick
            leadingSuit: null,
            cardsPlayed: [],
            winnerId: null
        };
    } else {
        endRound(gameState);
    }
    logAction("END_TRICK", { trick: trick }, gameState);
}

export function removePlayer(state: GameState, playerId: number): void {
    state.players.splice(playerId, 1);


}

export function getPlayableCards(state: GameState, playerId: number): Card[] {
    const round = state.currentRoundState;
    if (!round) return [];
    const hand = round.hands[playerId]!;
    const leadingSuit = round.currentTrick?.leadingSuit;
    if (!leadingSuit) return hand;
    const hasLeadingSuit = hand.some(c => c.suit === leadingSuit);
    return hasLeadingSuit ? hand.filter(c => c.suit === leadingSuit) : hand;
}
