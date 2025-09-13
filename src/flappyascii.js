// Game constants
const SCREEN_WIDTH = 90;
const SCREEN_HEIGHT = 28;
const GRAVITY = 0.5;
const FLAP_STRENGTH = -1.5;
const PIPE_SPEED = 1;
const PIPE_FREQUENCY = 20;  // Lower means more pipes
const PIPE_GAP_SIZE = 5;
const BIRD_X = 20;

// Game characters - these can change based on theme
let BIRD_CHAR = '@';
let PIPE_CHAR = '|';
let GROUND_CHAR = '_';
let EMPTY_CHAR = ' ';

// Function to update game characters based on theme
function updateGameColors() {
    const currentTheme = document.documentElement.getAttribute('data-theme');
    
    // In dark mode, we use different characters for better visibility on light background
    if (currentTheme === 'dark') {
        BIRD_CHAR = '■';  // Solid block for better visibility on light background
        PIPE_CHAR = '║';  // Double vertical line for better visibility
        GROUND_CHAR = '═';  // Double horizontal line for ground
        EMPTY_CHAR = ' ';
    } else {
        BIRD_CHAR = '@';
        PIPE_CHAR = '|';
        GROUND_CHAR = '_';
        EMPTY_CHAR = ' ';
    }
    
    // If the game is already running, redraw it with the new colors
    if (gameRunning) {
        drawGame(bird, pipes, score, gameStarted);
    }
}

// Expose the updateGameColors function to the window object
window.updateGameColors = updateGameColors;

// We'll initialize colors when the DOM is loaded in the init function

// Game variables
let gameRunning = false;
let gameStarted = false;
let bird;
let pipes = [];
let score = 0;
let highScore = 0; // Track high score
let frameCounter = 0;
let animationFrameId;
let lastFrameTime = 0;
const frameDelay = 100; // milliseconds between frames (similar to Python's time.sleep(0.1))

// DOM element - will be initialized when the DOM is loaded
let gameScreen;

class Bird {
    constructor(y) {
        this.x = BIRD_X;
        this.y = y;
        this.velocity = 0;
        this.animationOffset = 0;
        this.animationDirection = 0.1;
        
        // Ensure the bird is within bounds
        if (this.y < 1) this.y = 1;
        if (this.y >= SCREEN_HEIGHT - 1) this.y = SCREEN_HEIGHT - 2;
    }
    
    flap() {
        this.velocity = FLAP_STRENGTH;
    }
    
    update(gameStarted) {
        if (gameStarted) {
            // Normal physics when game is started
            this.velocity += GRAVITY;
            this.y += this.velocity;
            
            // Keep the bird within the screen bounds
            if (this.y < 1) {
                this.y = 1;
                this.velocity = 0;
            }
            if (this.y >= SCREEN_HEIGHT - 1) {
                this.y = SCREEN_HEIGHT - 1;
                this.velocity = 0;
            }
        } else {
            // Gentle hovering animation when game hasn't started
            this.animationOffset += this.animationDirection;
            if (Math.abs(this.animationOffset) > 0.5) {
                this.animationDirection *= -1;
            }
            this.y = Math.floor(SCREEN_HEIGHT / 2) + this.animationOffset;
        }
    }
}

class Pipe {
    constructor(x) {
        // Use crypto.getRandomValues for secure random number generation
        const min = 8;
        const max = SCREEN_HEIGHT - 8;
        const range = max - min + 1;
        const randomBuffer = new Uint32Array(1);
        window.crypto.getRandomValues(randomBuffer);
        const randomValue = randomBuffer[0] / (0xFFFFFFFF + 1); // Normalize to [0,1)
        this.x = x;
        this.gap_y = Math.floor(randomValue * range) + min; // Random position between 8 and SCREEN_HEIGHT-8
        this.passed = false;
    }
    
    update() {
        this.x -= PIPE_SPEED;
    }
    
    isCollision(bird) {
        if (Math.floor(this.x) === bird.x) {
            if (Math.floor(bird.y) < this.gap_y - PIPE_GAP_SIZE / 2 || 
                Math.floor(bird.y) > this.gap_y + PIPE_GAP_SIZE / 2) {
                return true;
            }
        }
        return false;
    }
    
    isOffscreen() {
        return this.x < 0;
    }
}

function drawBird(grid, bird) {
    grid[Math.floor(bird.y)][bird.x] = BIRD_CHAR;
}

function drawPipes(grid, pipes) {
    for (const pipe of pipes) {
        for (let y = 0; y < SCREEN_HEIGHT - 1; y++) {
            if (y < pipe.gap_y - PIPE_GAP_SIZE / 2 || y > pipe.gap_y + PIPE_GAP_SIZE / 2) {
                if (pipe.x >= 0 && pipe.x < SCREEN_WIDTH) {
                    grid[y][Math.floor(pipe.x)] = PIPE_CHAR;
                }
            }
        }
    }
}

function drawGround(grid) {
    for (let x = 0; x < SCREEN_WIDTH; x++) {
        grid[SCREEN_HEIGHT - 1][x] = GROUND_CHAR;
    }
}

function drawScore(grid, score) {
    const scoreText = `Score: ${score}`;
    for (let i = 0; i < scoreText.length && i < SCREEN_WIDTH; i++) {
        grid[0][i] = scoreText[i];
    }
}

function drawHighScore(grid) {
    const highScoreText = `High Score: ${highScore}`;
    const highScorePos = SCREEN_WIDTH - highScoreText.length;
    for (let i = 0; i < highScoreText.length && highScorePos + i < SCREEN_WIDTH; i++) {
        grid[0][highScorePos + i] = highScoreText[i];
    }
}

function drawInstructions(grid, gameStarted) {
    if (!gameStarted) {
        const instructions = "Press SPACE to start";
        const startPos = Math.floor((SCREEN_WIDTH - instructions.length) / 2);
        for (let i = 0; i < instructions.length; i++) {
            if (startPos + i >= 0 && startPos + i < SCREEN_WIDTH) {
                grid[2][startPos + i] = instructions[i];
            }
        }
    }
}

function drawGame(bird, pipes, score, gameStarted) {
    const grid = Array(SCREEN_HEIGHT).fill().map(() => Array(SCREEN_WIDTH).fill(EMPTY_CHAR));
    drawBird(grid, bird);
    drawPipes(grid, pipes);
    drawGround(grid);
    drawScore(grid, score);
    drawHighScore(grid);
    drawInstructions(grid, gameStarted);
    gameScreen.textContent = grid.map(row => row.join('')).join('\n');
}

function gameOverScreen(score) {
    // Create a blank screen
    const grid = Array(SCREEN_HEIGHT).fill().map(() => Array(SCREEN_WIDTH).fill(EMPTY_CHAR));
    
    // Update high score if current score is higher
    if (score > highScore) {
        highScore = score;
        // Save high score to localStorage
        localStorage.setItem('flappyBirdHighScore', highScore);
    }
    
    // Add game over text
    const gameOverText = "GAME OVER";
    const scoreText = `Final Score: ${score}`;
    const highScoreText = `High Score: ${highScore}`;
    const restartText = "Press 'r' to restart";
    
    const gameOverPos = Math.floor((SCREEN_WIDTH - gameOverText.length) / 2);
    const scorePos = Math.floor((SCREEN_WIDTH - scoreText.length) / 2);
    const highScorePos = Math.floor((SCREEN_WIDTH - highScoreText.length) / 2);
    const restartPos = Math.floor((SCREEN_WIDTH - restartText.length) / 2);
    
    // Position the text vertically centered
    const centerY = Math.floor(SCREEN_HEIGHT / 2) - 3;
    
    for (let i = 0; i < gameOverText.length; i++) {
        grid[centerY][gameOverPos + i] = gameOverText[i];
    }
    
    for (let i = 0; i < scoreText.length; i++) {
        grid[centerY + 1][scorePos + i] = scoreText[i];
    }
    
    for (let i = 0; i < highScoreText.length; i++) {
        grid[centerY + 2][highScorePos + i] = highScoreText[i];
    }
    
    for (let i = 0; i < restartText.length; i++) {
        grid[centerY + 3][restartPos + i] = restartText[i];
    }
    
    // Render the grid to the game screen
    gameScreen.textContent = grid.map(row => row.join('')).join('\n');
}

function resetGame() {
    bird = new Bird(Math.floor(SCREEN_HEIGHT / 2));
    pipes = [];
    score = 0;
    frameCounter = 0;
    gameRunning = true;
    gameStarted = false;
}

function addPipeIfNeeded() {
    frameCounter++;
    if (frameCounter % PIPE_FREQUENCY === 0) {
        pipes.push(new Pipe(SCREEN_WIDTH - 1));
    }
}

function updatePipesAndCheckCollisions() {
    for (let i = pipes.length - 1; i >= 0; i--) {
        const pipe = pipes[i];
        pipe.update();

        if (!pipe.passed && pipe.x < BIRD_X) {
            pipe.passed = true;
            score++;
        }

        if (pipe.isCollision(bird)) {
            gameRunning = false;
        }

        if (pipe.isOffscreen()) {
            pipes.splice(i, 1);
        }
    }
}

function checkGroundCollision() {
    if (bird.y >= SCREEN_HEIGHT - 1) {
        gameRunning = false;
    }
}

function gameLoop(timestamp) {
    if (timestamp - lastFrameTime < frameDelay) {
        animationFrameId = requestAnimationFrame(gameLoop);
        return;
    }
    lastFrameTime = timestamp;

    bird.update(gameStarted);

    if (gameStarted) {
        addPipeIfNeeded();
        updatePipesAndCheckCollisions();
        checkGroundCollision();
    }

    if (gameRunning) {
        drawGame(bird, pipes, score, gameStarted);
        animationFrameId = requestAnimationFrame(gameLoop);
    } else {
        gameOverScreen(score);
    }
}

// Event listeners for keyboard input
document.addEventListener('keydown', (event) => {
    if (event.code === 'Space') {
        event.preventDefault(); // Prevent scrolling
        if (!gameStarted && gameRunning) {
            gameStarted = true;
        }
        if (gameRunning) {
            bird.flap();
        }
    } else if (event.key.toLowerCase() === 'r' && !gameRunning) {
        resetGame();
        animationFrameId = requestAnimationFrame(gameLoop);
    }
});

// Initialize and start the game
function init() {
    // Initialize DOM elements
    gameScreen = document.getElementById('game-screen');
    
    // Load high score from localStorage if available
    const savedHighScore = localStorage.getItem('flappyBirdHighScore');
    if (savedHighScore !== null) {
        highScore = parseInt(savedHighScore, 10);
    }
    
    // Only start the game if we found the game screen element
    if (gameScreen) {
        console.log('Game screen found, initializing game...');
        resetGame();
        // Initialize colors based on current theme
        updateGameColors();
        
        // Draw initial game state
        drawGame(bird, pipes, score, gameStarted);
        
        // Start game loop
        console.log('Starting game loop...');
        animationFrameId = requestAnimationFrame(gameLoop);
    } else {
        console.error('Game screen element not found!');
    }
}

// Start the game when the page loads
window.addEventListener('load', init);

// Export for Jest/node testing
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        Bird,
        Pipe,
        SCREEN_WIDTH,
        SCREEN_HEIGHT,
        GRAVITY,
        FLAP_STRENGTH,
        PIPE_SPEED,
        PIPE_FREQUENCY,
        PIPE_GAP_SIZE,
        BIRD_X,
        get BIRD_CHAR() { return BIRD_CHAR; },
        get PIPE_CHAR() { return PIPE_CHAR; },
        get GROUND_CHAR() { return GROUND_CHAR; },
        get EMPTY_CHAR() { return EMPTY_CHAR; },
        updateGameColors,
        drawGame,
        drawBird,
        drawPipes,
        drawGround,
        drawScore,
        drawHighScore,
        drawInstructions,
        resetGame,
        addPipeIfNeeded,
        updatePipesAndCheckCollisions,
        checkGroundCollision,
        gameOverScreen,
        // Expose game state for tests
        get bird() { return bird; },
        get pipes() { return pipes; },
        get score() { return score; },
        get highScore() { return highScore; },
        get frameCounter() { return frameCounter; },
        get gameRunning() { return gameRunning; },
        get gameStarted() { return gameStarted; },
        set bird(val) { bird = val; },
        set pipes(val) { pipes = val; },
        set score(val) { score = val; },
        set highScore(val) { highScore = val; },
        set frameCounter(val) { frameCounter = val; },
        set gameRunning(val) { gameRunning = val; },
        set gameStarted(val) { gameStarted = val; },
        get gameScreen() { return gameScreen; },
        set gameScreen(val) {
            gameScreen = val;
            if (typeof global !== 'undefined') {
                global.gameScreen = val;
            }
        },
    };
}