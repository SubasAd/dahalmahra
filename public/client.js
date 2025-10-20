class DahalmahraClient {
    constructor() {
        this.socket = null;
        this.playerId = null;
        this.roomId = null;
        this.playerName = null;
        this.currentHand = [];
        this.selectedCard = null;
        this.players = [];
        this.initializeEventListeners();
    }

    getSuitOrder(masterSuit) {
        const redSuits = ['Diamonds', 'Hearts'];
        const blackSuits = ['Clubs', 'Spades'];

        // Determine if master is red or black
        const isMasterRed = redSuits.includes(masterSuit);

        // Remove master from its respective array
        const masterRedSuits = redSuits.filter(suit => suit !== masterSuit);
        const masterBlackSuits = blackSuits.filter(suit => suit !== masterSuit);

        let order = {};
        let position = 0;

        // Always start with master suit
        order[masterSuit] = position++;

        if (isMasterRed) {
            // Red master: red → black → red → black
            if (masterBlackSuits.length > 0) order[masterBlackSuits[0]] = position++;
            if (masterRedSuits.length > 0) order[masterRedSuits[0]] = position++;
            if (masterBlackSuits.length > 1) order[masterBlackSuits[1]] = position++;
        } else {
            // Black master: black → red → black → red
            if (masterRedSuits.length > 0) order[masterRedSuits[0]] = position++;
            if (masterBlackSuits.length > 0) order[masterBlackSuits[0]] = position++;
            if (masterRedSuits.length > 1) order[masterRedSuits[1]] = position++;
        }

        return order;
    }

    renderHand() {
        const handContainer = document.getElementById('handContainer');
        handContainer.innerHTML = '';

        // Set up container for horizontal layout
        handContainer.style.position = 'relative';
        handContainer.style.height = '140px';
        handContainer.style.textAlign = 'center';
        handContainer.style.whiteSpace = 'nowrap';
        handContainer.style.padding = '20px 0';

        // Sort cards using master suit order
        this.currentHand.sort((a, b) => {
            if (a.suit !== b.suit) {
                const suitOrder = this.getSuitOrder(this.masterSuit || 'Spades');
                return suitOrder[a.suit] - suitOrder[b.suit];
            }
            return a.value - b.value;
        });

        this.currentHand.forEach((card, i) => {
            const cardEl = document.createElement('div');
            cardEl.className = `card ${card.suit.toLowerCase()}`;
            cardEl.setAttribute('data-card', `${card.rank}-${card.suit}`);

            cardEl.innerHTML = `
            <img src="images/cards/${card.rank.toLowerCase()}_of_${card.suit.toLowerCase()}.svg" 
                 alt="${card.rank} of ${card.suit}">
        `;

            // Horizontal overlapping layout
            const overlap = 30; // pixels of overlap between cards
            const cardWidth = 90;
            const totalWidth = (this.currentHand.length * (cardWidth - overlap)) + overlap;
            const startPosition = (handContainer.offsetWidth - totalWidth) / 2;

            cardEl.style.position = 'relative';
            cardEl.style.display = 'inline-block';
            cardEl.style.left = '0';
            cardEl.style.marginLeft = i === 0 ? '0' : `-${overlap}px`; // Overlap previous card
            cardEl.style.transform = 'none'; // Remove rotation
            cardEl.style.zIndex = i; // Leftmost cards behind, rightmost in front
            cardEl.style.transition = 'all 0.3s ease';
            cardEl.style.verticalAlign = 'top';

            cardEl.addEventListener('click', () => this.playCard(card, cardEl));
            handContainer.appendChild(cardEl);
        });
    }
    initializeEventListeners() {
        // Landing screen events
        document.getElementById('createRoomBtn').addEventListener('click', () => this.createRoom());
        document.getElementById('joinRoomBtn').addEventListener('click', () => this.joinRoom());

        // Game events
        document.getElementById('playCardBtn').addEventListener('click', () => this.playCard());

        // Master suit selection
        document.querySelectorAll('.suit-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const suit = e.target.dataset.suit;
                this.chooseMasterSuit(suit);
            });
        });

        // Enter key support
        document.getElementById('playerName').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.createRoom();
        });

        document.getElementById('roomCode').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.joinRoom();
        });
        console.log(this);
    }

    connect() {
        this.socket = io();

        this.socket.on('connect', () => {
            console.log('Connected to server');
        });

        this.socket.on('roomCreated', (data) => {
            this.roomId = data.roomId;
            this.playerId = data.playerId;
            this.players = data.players;
            this.showLobby();
        });

        this.socket.on('roomJoined', (data) => {
            this.roomId = data.roomId;
            this.playerId = data.playerId;
            this.players = data.players;
            this.showLobby();
        });

        this.socket.on('joinError', (data) => {
            this.showError(data.message);
        });

        this.socket.on('lobbyUpdate', (data) => {
            this.players = data.players;
            this.updateLobby();
        });

        this.socket.on('gameStarted', (data) => {
            this.currentHand = data.yourHand;
            this.playerId = data.playerId;
            this.players = data.allPlayers;
            this.showGame();
            this.updateGameInfo();
            this.renderHand();
        });

        this.socket.on('promptMasterSuit', () => {
            this.showMasterSuitModal();
        });

        this.socket.on('updateMasterSuit', (data) => {
            this.updateMasterSuit(data.masterSuit);
        });

        this.socket.on('finalDeal', (data) => {
            this.currentHand = data.yourHand;
            this.renderHand();
        });

        this.socket.on('updateTurn', (data) => {
            this.updateTurn(data.currentPlayerId, data.playableCards || []);
        });

        this.socket.on('cardPlayed', (data) => {
            this.handleCardPlayed(data);
        });

        this.socket.on('trickResult', (data) => {
            console.log("Trick result data:", data);
            this.showMessage(`${data.winnerName} won the trick!`, 'success');
            this.updateRoundInfo(data.roundInfo);
            this.clearTrickArea();
        });

        this.socket.on('roundResult', (data) => {
            this.showMessage(`Round over! Winner: Team ${data.roundWinner}`, 'info');
        });

        this.socket.on('newRoundStarted', (data) => {
            this.currentHand = data.yourHand;
            this.showMessage(`Round ${data.roundNumber} started!`, 'info');
            this.renderHand();
            if (data.masterCallerId === this.playerId) {
                this.showMasterSuitModal();
            }
        });

        this.socket.on('playerDisconnected', (data) => {
            this.showMessage(`Player ${data.playerId} disconnected`, 'warning');
        });

        this.socket.on('error', (message) => {
            this.showError(message);
        });

        this.socket.on('gameStateUpdate', (data) => {
            // Handle game state updates if needed
        });
    }

    createRoom() {
        const playerName = document.getElementById('playerName').value.trim();
        if (!playerName) {
            this.showError('Please enter your name');
            return;
        }

        this.playerName = playerName;
        this.connect();
        this.socket.emit('createRoom', { playerName });
    }

    joinRoom() {
        const playerName = document.getElementById('playerName').value.trim();
        const roomCode = document.getElementById('roomCode').value.trim().toUpperCase();

        if (!playerName) {
            this.showError('Please enter your name');
            return;
        }

        if (!roomCode) {
            this.showError('Please enter room code');
            return;
        }

        this.playerName = playerName;
        this.connect();
        this.socket.emit('joinRoom', { playerName, roomId: roomCode });
    }

    showLobby() {
        document.getElementById('landing').classList.remove('active');
        document.getElementById('lobby').classList.add('active');
        document.getElementById('roomIdDisplay').textContent = this.roomId;
        this.updateLobby();
    }

    updateLobby() {
        const playerSlots = document.querySelectorAll('.player-slot');
        const playerCount = document.getElementById('playerCount');

        playerSlots.forEach(slot => {
            const slotNumber = parseInt(slot.dataset.slot);
            const player = this.players[slotNumber];

            if (player) {
                slot.classList.add('occupied');
                slot.querySelector('.player-name').textContent = player.name;
                // Highlight current player
                if (player.id === this.playerId) {
                    slot.style.borderColor = '#2ecc71';
                    slot.querySelector('.player-name').innerHTML = `${player.name} <span style="color: #2ecc71;">(You)</span>`;
                } else {
                    slot.style.borderColor = '';
                    slot.querySelector('.player-name').textContent = player.name;
                }
            } else {
                slot.classList.remove('occupied');
                slot.querySelector('.player-name').textContent = 'Waiting...';
                slot.style.borderColor = '';
            }
        });

        playerCount.textContent = this.players.length;

        // Update lobby message
        const lobbyInfo = document.querySelector('.lobby-info p');
        if (this.players.length === 4) {
            lobbyInfo.textContent = 'Game starting...';
        } else {
            lobbyInfo.textContent = `Waiting for ${4 - this.players.length} more players...`;
        }
        console.log(this.players);
    }

    showGame() {
        document.getElementById('lobby').classList.remove('active');
        document.getElementById('game').classList.add('active');
        document.getElementById('gameRoomId').textContent = this.roomId;
    }

    updateGameInfo() {
        // Update current player info
        const currentPlayer = this.players.find(p => p.id === this.playerId);
        if (currentPlayer) {
            document.getElementById('playerNameDisplay').textContent = currentPlayer.name;
            document.getElementById('playerTeam').textContent = currentPlayer.teamName;
            document.getElementById('playerTeam').className = `team-tag ${currentPlayer.teamName?.toLowerCase()}`;
        }

        // Update opponents
        this.updateOpponents();
    }

    updateOpponents() {

        const opponentArea = document.querySelector('.opponents-area');
        const playerId = this.playerId;
        const positions = ["bottom", "left", "top", "right"];

        // Build mapping from actual player.id → position
        const layoutMap = {};
        for (let offset = 0; offset < 4; offset++) {
            const relativeId = (playerId + offset) % 4;
            layoutMap[relativeId] = positions[offset];
        }

        this.players.forEach(player => {
            if (player.id === this.playerId) return;
            console.log(player, layoutMap[player.id]);
            opponentArea.insertAdjacentHTML('beforeend', `
    <div class="opponent opponent-${layoutMap[player.id]}" data-player-id="${player.id}">
      <div class="opponent-info">
        <span class="player-name">${player.name}</span>
        <span class="team-tag ${player.teamName.toLowerCase()}">${player.teamName}</span>
      </div>
      <div class="cards-pile"></div>
    </div>
  `);
        });
    }


    getSuitSymbol(suit) {
        const symbols = {
            'Spades': '♠',
            'Hearts': '♥',
            'Diamonds': '♦',
            'Clubs': '♣'
        };
        return symbols[suit] || suit;
    }

    selectCard(card, cardEl) {
        // Deselect previous card
        document.querySelectorAll('.card.selected').forEach(el => {
            el.classList.remove('selected');
        });

        // Select new card
        cardEl.classList.add('selected');
        this.selectedCard = card;
        document.getElementById('playCardBtn').disabled = false;
    }

    updateRoundInfo(data) {
     
        const roundInfo = document.getElementById('roundInfoBar');
        roundInfo.innerHTML = `
            <div>Round: ${data.roundNumber}</div>
            <div>Scores: 
                <span class="team-score black">Black  Tens: ${data.Black.tens} | Tricks: ${data.Black.tricks}</span> - <br/>
                <span class="team-score red">Red  Tens: ${data.Red.tens} | Tricks: ${data.Red.tricks}</span>
            </div>
        `;
    }
    playCard(card, cardEl) {
        this.socket.emit('playCard', { card });
        cardEl.classList.remove('selected');
        document.getElementById('playCardBtn').disabled = true;
    }

    showMasterSuitModal() {
        document.getElementById('masterSuitModal').classList.add('active');
    }

    chooseMasterSuit(suit) {
        this.socket.emit('masterSuitChosen', { suit });
        document.getElementById('masterSuitModal').classList.remove('active');
    }

    updateMasterSuit(suit) {
        const masterSuitDisplay = document.getElementById('masterSuitDisplay');
        masterSuitDisplay.textContent = suit.concat(' ', this.getSuitSymbol(suit));
        masterSuitDisplay.className = suit.toLowerCase();
    }

    updateTurn(currentPlayerId, playableCards) {
        const isMyTurn = currentPlayerId === this.playerId;
        const turnInfo = document.getElementById('turnInfo');

        if (isMyTurn) {
            turnInfo.textContent = 'Your turn!';
            turnInfo.style.color = '#2ecc71';
            this.enablePlayableCards(playableCards);
        } else {
            const currentPlayer = this.players.find(p => p.id === currentPlayerId);
            const playerName = currentPlayer ? currentPlayer.name : 'Opponent';
            turnInfo.textContent = `${playerName}'s turn`;
            turnInfo.style.color = '#e74c3c';
            this.disableAllCards();
        }

        // Highlight current player
        this.highlightCurrentPlayer(currentPlayerId);
    }

    highlightCurrentPlayer(playerId) {
        // Remove highlight from all players
        document.querySelectorAll('.opponent').forEach(el => {
            el.style.boxShadow = 'none';
        });

        // Highlight current player
        if (playerId === this.playerId) {
            // Highlight player's own area
            document.querySelector('.player-area').style.boxShadow = '0 0 20px rgba(46, 204, 113, 0.5)';
        } else {
            const opponentEl = document.querySelector(`[data-player-id="${playerId}"]`);
            if (opponentEl) {
                opponentEl.style.boxShadow = '0 0 20px rgba(46, 204, 113, 0.5)';
            }
        }
    }

    enablePlayableCards(playableCards) {
        const cardElements = document.querySelectorAll('.card');

        cardElements.forEach(cardEl => {
            const cardValue = cardEl.querySelector('.card-value').textContent;
            const cardSuit = this.getSuitFromSymbol(cardEl.querySelector('.card-suit').textContent);

            const isPlayable = playableCards.some(card =>
                card.rank === cardValue && card.suit === cardSuit
            );

            if (isPlayable) {
                cardEl.classList.remove('unplayable');
                cardEl.style.cursor = 'pointer';
            } else {
                cardEl.classList.add('unplayable');
                cardEl.style.cursor = 'not-allowed';
            }
        });
    }

    disableAllCards() {
        document.querySelectorAll('.card').forEach(cardEl => {
            cardEl.classList.add('unplayable');
            cardEl.style.cursor = 'not-allowed';
        });
    }

    getSuitFromSymbol(symbol) {
        const suits = {
            '♠': 'Spades',
            '♥': 'Hearts',
            '♦': 'Diamonds',
            '♣': 'Clubs'
        };
        return suits[symbol] || symbol;
    }

    handleCardPlayed(data) {
        this.showMessage(`${data.playerName} played ${data.card.rank} of ${data.card.suit}`, 'info');
        console.log("Handle Card played:", data);
        // Update opponent card counts
        if (data.playerId !== this.playerId) {
            const opponentEl = document.querySelector(`[data-player-id="${data.playerId}"]`);
            if (opponentEl) {
                const countEl = opponentEl.querySelector('.cards-count');
                if (countEl) {
                    const currentCount = parseInt(countEl?.textContent) || 13;
                    countEl.textContent = `${currentCount - 1} cards`;
                }

            }
        } else {
            // Remove card from hand
            this.currentHand = this.currentHand.filter(card =>
                !(card.rank === data.card.rank && card.suit === data.card.suit)
            );
            this.renderHand();
        }

        // Add card to trick area
        this.addCardToTrick(data.playerId, data.card);
    }

    addCardToTrick(playerId, card) {
        const trickArea = document.getElementById('trickArea');
        const cardEl = document.createElement('div');
        cardEl.className = `trick-card ${card.suit.toLowerCase()}`;
        const player = this.players.find(p => p.id === playerId);
        cardEl.innerHTML = `
            <img src="images/cards/${card.rank.toLowerCase()}_of_${card.suit.toLowerCase()}.svg" 
                 alt="${card.rank} of ${card.suit}">
            <div class="played-by">${player?.name || 'Player'}</div>
        `;
        cardEl.style.order = playerId;
        cardEl.style.color = player?.teamName.toLowerCase()|| 'black';

        trickArea.appendChild(cardEl);
    }

    clearTrickArea() {
        const trickArea = document.getElementById('trickArea');
        trickArea.innerHTML = '';
    }

    showMessage(message, type = 'info') {
        const messagesContainer = document.getElementById('gameMessages');
        const messageEl = document.createElement('div');
        messageEl.className = `message ${type}`;
        messageEl.textContent = message;
        messagesContainer.appendChild(messageEl);
        setTimeout(() => {
            messageEl.remove();
        }, 3000);
    }

    showError(message) {
        document.getElementById('errorMessage').textContent = message;
        document.getElementById('errorModal').classList.add('active');
    }
}

function closeErrorModal() {
    document.getElementById('errorModal').classList.remove('active');
}

// Initialize the game when page loads
document.addEventListener('DOMContentLoaded', () => {
    new DahalmahraClient();
});