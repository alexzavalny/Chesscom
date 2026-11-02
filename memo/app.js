// Difficulty settings for position generation
const DIFFICULTY_SETTINGS = {
    easy: { pieces: 3, mainPieces: 1 },
    medium: { pieces: 5, mainPieces: 2 },
    hard: { pieces: 7, mainPieces: 3 }
};

const GAME_DURATION = 180; // 3 minutes in seconds
const HIGH_SCORES_TO_KEEP = 5;

// Helper to generate random positions
function generatePosition(difficulty = 'medium') {
    const chess = new Chess();
    chess.clear();
    
    const settings = DIFFICULTY_SETTINGS[difficulty];
    const pieces = ['r', 'n', 'b', 'q', 'k', 'p'];
    const mainPieces = ['r', 'n', 'b', 'q'];
    const squares = Array.from({ length: 64 }, (_, i) => {
        const file = String.fromCharCode(97 + (i % 8));
        const rank = Math.floor(i / 8) + 1;
        return `${file}${rank}`;
    });
    
    // Place required main pieces
    for (let i = 0; i < settings.mainPieces; i++) {
        const piece = mainPieces[Math.floor(Math.random() * mainPieces.length)];
        const color = Math.random() < 0.5 ? 'w' : 'b';
        while (true) {
            const square = squares[Math.floor(Math.random() * squares.length)];
            if (!chess.get(square)) {
                chess.put({ type: piece, color: color }, square);
                break;
            }
        }
    }
    
    // Fill remaining pieces
    for (let i = settings.mainPieces; i < settings.pieces; i++) {
        const piece = pieces[Math.floor(Math.random() * pieces.length)];
        const color = Math.random() < 0.5 ? 'w' : 'b';
        while (true) {
            const square = squares[Math.floor(Math.random() * squares.length)];
            if (!chess.get(square)) {
                chess.put({ type: piece, color: color }, square);
                break;
            }
        }
    }
    
    return chess.fen();
}

// Vue app
const app = Vue.createApp({
    data() {
        return {
            timeLeft: GAME_DURATION,
            score: 0,
            targetPosition: '',
            positionHidden: false,
            showingResults: false,
            gameOver: false,
            gameStarted: false,
            timer: null,
            targetBoard: null,
            playerBoard: null,
            highScores: JSON.parse(localStorage.getItem('chessRushHighScores') || '[]')
        };
    },
    
    mounted() {
        // Don't initialize boards on mount anymore
    },
    
    methods: {
        initBoards() {
            const config = {
                draggable: false,
                position: 'start',
                pieceTheme: 'https://chessboardjs.com/img/chesspieces/wikipedia/{piece}.png',
                sparePieces: true
            };
            
            this.targetBoard = Chessboard('targetBoard', { ...config, draggable: false });
            this.playerBoard = Chessboard('playerBoard', config);
        },
        
        startGame() {
            this.gameStarted = true;
            // Wait for DOM update before initializing boards
            this.$nextTick(() => {
                this.initBoards();
                this.startNewGame();
            });
        },
        
        startNewGame() {
            this.timeLeft = GAME_DURATION;
            this.score = 0;
            this.gameOver = false;
            this.startTimer();
            this.generateNewPosition();
        },
        
        startTimer() {
            if (this.timer) clearInterval(this.timer);
            
            this.timer = setInterval(() => {
                this.timeLeft--;
                
                if (this.timeLeft <= 0) {
                    this.endGame();
                }
            }, 1000);
        },
        
        generateNewPosition() {
            const position = generatePosition();
            this.targetPosition = this.targetBoard.position(position);
            this.playerBoard.clear();
            this.positionHidden = false;
            this.showingResults = false;
            document.querySelector('.game-container').classList.remove('memorizing');
        },
        
        startMemorizing() {
            this.positionHidden = true;
            // Store the current position before clearing
            this.targetPosition = this.targetBoard.position();
            this.targetBoard.clear();
            // Enable dragging after clicking Ready
            document.querySelector('.game-container').classList.add('memorizing');
            this.playerBoard.destroy();
            this.playerBoard = Chessboard('playerBoard', {
                draggable: true,
                position: 'start',
                pieceTheme: 'https://chessboardjs.com/img/chesspieces/wikipedia/{piece}.png',
                sparePieces: true
            });
            this.playerBoard.clear();
        },
        
        submitPosition() {
            // Get positions as objects like {a1: 'wP', b1: 'wN', ...}
            const playerPosition = this.playerBoard.position();
            
            let correctPieces = 0;
            const squares = [
                'a1', 'b1', 'c1', 'd1', 'e1', 'f1', 'g1', 'h1',
                'a2', 'b2', 'c2', 'd2', 'e2', 'f2', 'g2', 'h2',
                'a3', 'b3', 'c3', 'd3', 'e3', 'f3', 'g3', 'h3',
                'a4', 'b4', 'c4', 'd4', 'e4', 'f4', 'g4', 'h4',
                'a5', 'b5', 'c5', 'd5', 'e5', 'f5', 'g5', 'h5',
                'a6', 'b6', 'c6', 'd6', 'e6', 'f6', 'g6', 'h6',
                'a7', 'b7', 'c7', 'd7', 'e7', 'f7', 'g7', 'h7',
                'a8', 'b8', 'c8', 'd8', 'e8', 'f8', 'g8', 'h8'
            ];

            // Compare each square
            squares.forEach(square => {
                if (playerPosition[square] && 
                    this.targetPosition[square] && 
                    playerPosition[square] === this.targetPosition[square]) {
                    correctPieces++;
                }
            });
            
            // Show results and update score
            this.targetBoard.position(this.targetPosition);
            this.showingResults = true;
            this.score += correctPieces;

            // Debug log
            console.log('Player pieces:', playerPosition);
            console.log('Target pieces:', this.targetPosition);
            console.log('Correct pieces:', correctPieces);
            console.log('New total score:', this.score);
        },
        
        nextPosition() {
            this.generateNewPosition();
        },
        
        endGame() {
            clearInterval(this.timer);
            this.gameOver = true;
            
            // Update high scores
            this.highScores.push(this.score);
            this.highScores.sort((a, b) => b - a);
            this.highScores = this.highScores.slice(0, HIGH_SCORES_TO_KEEP);
            localStorage.setItem('chessRushHighScores', JSON.stringify(this.highScores));
        },
        
        formatTime(seconds) {
            const minutes = Math.floor(seconds / 60);
            const remainingSeconds = seconds % 60;
            return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
        }
    }
});

app.mount('#app'); 