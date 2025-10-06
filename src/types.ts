//types.ts
export class Player {
    public readonly id: number;
    public name: string;
    public teamName: 'Black' | 'Red' | null = null;    
    constructor(id: number, name:string) {
        this.id = id;
        this.name = name;
    }
}

export interface Card {
    suit: 'Spades' | 'Hearts' | 'Diamonds' | 'Clubs';
    rank: string;
    value: number; 
}

export interface Team {
    name: 'Black' | 'Red';
    player1: Player;
    player2: Player;
}

export interface Trick {
   id: number;
   leadPlayerId: number;
   leadingSuit: Card['suit'] | null;
   cardsPlayed: { playerId: number, card: Card }[];
   winnerId: number | null;
}

export interface RoundState {
    roundNumber: number;
    hands: { [playerId: number]: Card[] }; 
    deck: Card[];
    dealerId: number;
    masterCallerId: number;
    masterSuit: Card['suit'] | null;
    
    currentTrick: Trick;
    playedTricks: Trick[];
    
    scores: {
        Black: { tens: number, tricks: number },
        Red: { tens: number, tricks: number }
    };
    
    phase: 'dealing' | 'master_selection' | 'playing' | 'finished';
    roundWinner: Team['name'] | null;
    nextDealerId: number | null;
}

export interface GameState { 
    roomId: string; 
    players: Player[]; 
    teams: Team[];
    currentRoundState: RoundState | null;
    pastRounds: RoundState[];
}