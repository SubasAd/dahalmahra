#  Dahalmahra - Nepali Card Game

A real-time multiplayer implementation of the traditional Nepali card game "Dahalmahra" (also known as "Dailamahra" or "Kill 10" if we translate), similar to Callbreak but with unique rules and gameplay.


## 🎮 About the Game

Dahalmahra is a traditional Nepali trick-taking card game played by 4 players in 2 teams. The main objective is to capture tricks containing 10-value cards while following complex suit rules and master suit selection.

## 🚀 Features

- **Real-time Multiplayer**: Play with 4 players using WebSocket technology
- **Authentic Game Rules**: Complete implementation of traditional Dahalmahra rules
- **Modern UI**: Beautiful gradients, animations, and responsive design
- **Team Play**: 2 vs 2 team-based gameplay (Black vs Red)
- **Master Suit Mechanics**: Dynamic suit ordering based on master selection
- **Automatic Scoring**: Real-time score tracking and round management

## 📥 Installation & Setup

### Prerequisites:
- Node.js (version 16 or higher)
- npm or yarn

### Steps:

1. **Clone the repository**:
```bash
git clone https://github.com/yourusername/dahalmahra-card-game.git
cd dahalmahra-card-game
```

2. **Install dependencies**:
```bash
npm install
```


3. **Start the server**:
```bash
npm start
```

4. **Open your browser** and navigate to:
```
http://localhost:3001
```

## 🎯 How to Play

### Basic Rules:
- **Teams**: 4 players in 2 teams (Players 0 & 2 vs Players 1 & 3)
- **Objective**: Capture tricks containing 10-value cards
- **Master Suit**: Chosen by dealer's partner, determines trump order
- **Gameplay**: Follow suit if possible, otherwise play any card
- **Scoring**: Each captured 10-card = 1 point for your team
- **Winning**: Team with most points after 13 tricks wins

### Special Rules:
- **Kot (Sweep)**: Capturing all four 10-cards in a round
- **Complex Dealer Rotation**: Dealer changes based on win/loss and Kot situations

## 📁 Project Structure

```
dahalmahra/
├── public/
│   ├── index.html          # Game interface
│   ├── style.css           # Styles & responsive design
│   ├── client.js           # Client-side logic
│   └── images/cards/       # Card assets (included)
├── src/
│   ├── server.ts           # Express + Socket.IO server
│   ├── Game.ts             # Core game logic
│   └── types.ts            # Type definitions
├── package.json
├── .gitignore
├── package-lock.json
├── tsconfig.json
└── README.md
```

## 🛠 Tech Stack

- **Backend**: Node.js, Express, TypeScript
- **Real-time**: Socket.IO
- **Frontend**: Vanilla JavaScript, HTML5, CSS3
- **Game Logic**: Pure TypeScript implementation

## 🤝 Contributing

Contributions are welcome! Feel free to submit issues and pull requests.

## 📝 License

MIT License - see LICENSE file for details.

---

**Enjoy playing Dahalmahra!** 
