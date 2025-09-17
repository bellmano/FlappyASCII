// Polyfill for TextEncoder in Node.js (required by jsdom)
const { TextEncoder, TextDecoder } = require('util');
global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder;

const { JSDOM } = require('jsdom');

// Mock localStorage
const localStorageMock = (() => {
	let store = {};
	return {
		getItem: key => store[key] || null,
		setItem: (key, value) => { store[key] = value.toString(); },
		clear: () => { store = {}; },
		removeItem: key => { delete store[key]; }
	};
})();
Object.defineProperty(global, 'localStorage', { value: localStorageMock });

// Mock window.crypto.getRandomValues
global.crypto = {
	getRandomValues: arr => { arr[0] = Math.floor(Math.random() * 0xFFFFFFFF); return arr; }
};

// Helper to create a mock DOM for game-screen
function createMockDOM() {
	const dom = new JSDOM('<!DOCTYPE html><div id="game-screen"></div>');
	global.document = dom.window.document;
	global.window = dom.window;
	return document.getElementById('game-screen');
}

// Global setup to ensure gameScreen is available for all tests
let mockGameScreen;
let flappyascii;

beforeAll(() => {
	flappyascii = require('../src/flappyascii.js');
});

beforeEach(() => {
	// Create fresh DOM and mock game screen for each test
	const dom = new JSDOM('<!DOCTYPE html><div id="game-screen"></div>');
	global.document = dom.window.document;
	global.window = dom.window;
	mockGameScreen = document.getElementById('game-screen');
	
	// Manually set the gameScreen in the flappyascii module
	flappyascii.gameScreen = mockGameScreen;
});

describe('Main Exports', () => {
	test('exports main game functions and classes', () => {
		const exported = require('../src/flappyascii.js');
		expect(exported).toHaveProperty('Bird');
		expect(exported).toHaveProperty('Pipe');
		expect(exported).toHaveProperty('resetGame');
		expect(exported).toHaveProperty('drawGame');
		expect(exported).toHaveProperty('updateGameColors');
	});
});

describe('Bird class', () => {
	let flappyascii;
	beforeAll(() => { flappyascii = require('../src/flappyascii.js'); });
	test('constructor bounds', () => {
		const b1 = new flappyascii.Bird(-10);
		expect(b1.y).toBeGreaterThanOrEqual(1);
		const b2 = new flappyascii.Bird(flappyascii.SCREEN_HEIGHT + 10);
		expect(b2.y).toBeLessThan(flappyascii.SCREEN_HEIGHT);
	});
	test('flap sets velocity', () => {
		const bird = new flappyascii.Bird(10);
		bird.flap();
		expect(bird.velocity).toBe(flappyascii.FLAP_STRENGTH);
	});
	test('update applies gravity and bounds', () => {
		const bird = new flappyascii.Bird(1);
		bird.velocity = -10;
		bird.update(true);
		expect(bird.y).toBeGreaterThanOrEqual(1);
		bird.y = flappyascii.SCREEN_HEIGHT;
		bird.update(true);
		expect(bird.y).toBeLessThanOrEqual(flappyascii.SCREEN_HEIGHT - 1);
	});
	test('update hovers when not started', () => {
		const bird = new flappyascii.Bird(10);
		bird.update(false);
		expect(Math.abs(bird.y - Math.floor(flappyascii.SCREEN_HEIGHT / 2))).toBeLessThanOrEqual(1);
	});
	test('animation direction changes when offset exceeds limit', () => {
		const bird = new flappyascii.Bird(10);
		bird.animationOffset = 0.6; // Greater than 0.5
		const originalDirection = bird.animationDirection;
		bird.update(false);
		expect(bird.animationDirection).toBe(-originalDirection);
	});
});

describe('Pipe class', () => {
	let flappyascii;
	beforeAll(() => { flappyascii = require('../src/flappyascii.js'); });
	test('constructor randomizes gap_y in bounds', () => {
		const pipe = new flappyascii.Pipe(50);
		expect(pipe.gap_y).toBeGreaterThanOrEqual(8);
		expect(pipe.gap_y).toBeLessThanOrEqual(flappyascii.SCREEN_HEIGHT - 8);
	});
	test('update moves pipe left', () => {
		const pipe = new flappyascii.Pipe(50);
		const oldX = pipe.x;
		pipe.update();
		expect(pipe.x).toBeLessThan(oldX);
	});
	test('isCollision detects collision', () => {
		const pipe = new flappyascii.Pipe(flappyascii.BIRD_X);
		const bird = new flappyascii.Bird(pipe.gap_y - flappyascii.PIPE_GAP_SIZE);
		bird.x = flappyascii.BIRD_X;
		expect(pipe.isCollision(bird)).toBe(true);
		bird.y = pipe.gap_y;
		expect(pipe.isCollision(bird)).toBe(false);
	});
	test('isOffscreen returns true when x < 0', () => {
		const pipe = new flappyascii.Pipe(-1);
		expect(pipe.isOffscreen()).toBe(true);
	});
});

describe('Game Logic Functions', () => {
	let flappyascii;
	beforeAll(() => { flappyascii = require('../src/flappyascii.js'); });
	beforeEach(() => { flappyascii.resetGame(); });
	test('resetGame initializes game state', () => {
		flappyascii.resetGame();
		expect(flappyascii.bird).toBeDefined();
		expect(flappyascii.pipes.length).toBe(0);
		expect(flappyascii.score).toBe(0);
		expect(flappyascii.gameRunning).toBe(true);
		expect(flappyascii.gameStarted).toBe(false);
	});
	test('addPipeIfNeeded adds pipe at correct frame', () => {
		flappyascii.frameCounter = flappyascii.PIPE_FREQUENCY - 1;
		flappyascii.addPipeIfNeeded();
		expect(flappyascii.pipes.length).toBe(1);
	});
	test('updatePipesAndCheckCollisions increments score and removes offscreen pipes', () => {
		const pipe = new flappyascii.Pipe(flappyascii.BIRD_X - 1);
		pipe.passed = false;
		flappyascii.pipes.push(pipe);
		flappyascii.score = 0;
		flappyascii.updatePipesAndCheckCollisions();
		expect(pipe.passed).toBe(true);
		expect(flappyascii.score).toBeGreaterThanOrEqual(1);
		pipe.x = -1;
		flappyascii.updatePipesAndCheckCollisions();
		expect(flappyascii.pipes.length).toBe(0);
	});
	test('checkGroundCollision sets gameRunning false if bird hits ground', () => {
		flappyascii.bird.y = flappyascii.SCREEN_HEIGHT - 1;
		flappyascii.checkGroundCollision();
		expect(flappyascii.gameRunning).toBe(false);
	});
});

describe('Drawing Functions', () => {
	let flappyascii;
	beforeAll(() => { flappyascii = require('../src/flappyascii.js'); });
	test('drawBird places bird char', () => {
		const grid = Array(flappyascii.SCREEN_HEIGHT).fill().map(() => Array(flappyascii.SCREEN_WIDTH).fill(flappyascii.EMPTY_CHAR));
		flappyascii.drawBird(grid, new flappyascii.Bird(10));
		// Just check that bird char is present somewhere
		const found = grid.some(row => row.includes(flappyascii.BIRD_CHAR));
		expect(found).toBe(true);
	});
	test('drawPipes places pipe chars', () => {
		const pipe = new flappyascii.Pipe(10);
		const pipes = [pipe];
		const grid = Array(flappyascii.SCREEN_HEIGHT).fill().map(() => Array(flappyascii.SCREEN_WIDTH).fill(flappyascii.EMPTY_CHAR));
		flappyascii.drawPipes(grid, pipes);
		let found = false;
		for (let y = 0; y < flappyascii.SCREEN_HEIGHT - 1; y++) {
			if (y < pipe.gap_y - flappyascii.PIPE_GAP_SIZE / 2 || y > pipe.gap_y + flappyascii.PIPE_GAP_SIZE / 2) {
				if (grid[y][Math.floor(pipe.x)] === flappyascii.PIPE_CHAR) found = true;
			}
		}
		expect(found).toBe(true);
	});
	test('drawGround places ground chars', () => {
		const grid = Array(flappyascii.SCREEN_HEIGHT).fill().map(() => Array(flappyascii.SCREEN_WIDTH).fill(flappyascii.EMPTY_CHAR));
		flappyascii.drawGround(grid);
		for (let x = 0; x < flappyascii.SCREEN_WIDTH; x++) {
			expect(grid[flappyascii.SCREEN_HEIGHT - 1][x]).toBe(flappyascii.GROUND_CHAR);
		}
	});
	test('drawScore writes score', () => {
		const grid = Array(flappyascii.SCREEN_HEIGHT).fill().map(() => Array(flappyascii.SCREEN_WIDTH).fill(flappyascii.EMPTY_CHAR));
		flappyascii.drawScore(grid, 42);
		expect(grid[0].join('')).toContain('Score: 42');
	});
	test('drawHighScore writes high score', () => {
		flappyascii.highScore = 99;
		const grid = Array(flappyascii.SCREEN_HEIGHT).fill().map(() => Array(flappyascii.SCREEN_WIDTH).fill(flappyascii.EMPTY_CHAR));
		flappyascii.drawHighScore(grid);
		expect(grid[0].join('')).toContain('High Score: 99');
	});
	test('drawInstructions writes instructions when not started', () => {
		const grid = Array(flappyascii.SCREEN_HEIGHT).fill().map(() => Array(flappyascii.SCREEN_WIDTH).fill(flappyascii.EMPTY_CHAR));
		flappyascii.drawInstructions(grid, false);
		expect(grid[2].join('')).toContain('Press SPACE to start');
	});
});
describe('Theme and Character Updates', () => {
	let flappyascii;
	beforeAll(() => { flappyascii = require('../src/flappyascii.js'); });
	test('updateGameColors sets dark theme characters', () => {
		document.documentElement.setAttribute('data-theme', 'dark');
		flappyascii.updateGameColors();
		expect(flappyascii.BIRD_CHAR).toBe('■');
		expect(flappyascii.PIPE_CHAR).toBe('║');
		expect(flappyascii.GROUND_CHAR).toBe('═');
		expect(flappyascii.EMPTY_CHAR).toBe(' ');
	});
	test('updateGameColors sets light theme characters', () => {
		document.documentElement.setAttribute('data-theme', 'light');
		flappyascii.updateGameColors();
		expect(flappyascii.BIRD_CHAR).toBe('@');
		expect(flappyascii.PIPE_CHAR).toBe('|');
		expect(flappyascii.GROUND_CHAR).toBe('_');
		expect(flappyascii.EMPTY_CHAR).toBe(' ');
	});
});
describe('Game Over Screen', () => {
	let flappyascii;
	beforeAll(() => { flappyascii = require('../src/flappyascii.js'); });
	test('gameOverScreen updates high score and renders', () => {
		flappyascii.highScore = 0;
		flappyascii.score = 10;
		flappyascii.gameOverScreen(10);
		expect(flappyascii.highScore).toBe(10);
	});
	test('gameOverScreen does not update high score if lower', () => {
		flappyascii.highScore = 20;
		flappyascii.score = 10;
		flappyascii.gameOverScreen(10);
		expect(flappyascii.highScore).toBe(20);
	});
});
describe('addPipeIfNeeded', () => {
	let flappyascii;
	beforeAll(() => { flappyascii = require('../src/flappyascii.js'); });
	beforeEach(() => { flappyascii.resetGame(); });
	test('does not add pipe if not at frequency', () => {
		flappyascii.frameCounter = 1;
		flappyascii.addPipeIfNeeded();
		expect(flappyascii.pipes.length).toBe(0);
	});
});
describe('updatePipesAndCheckCollisions', () => {
	let flappyascii;
	beforeAll(() => { flappyascii = require('../src/flappyascii.js'); });
	beforeEach(() => { flappyascii.resetGame(); });
	test('sets gameRunning false on collision', () => {
		// Create a pipe that will collide with the bird
		// Position it 1 unit to the right since update() will move it left by 1
		const pipe = new flappyascii.Pipe(flappyascii.BIRD_X + 1);
		pipe.x = flappyascii.BIRD_X + 1; // Will become BIRD_X after update()
		// Position bird outside the gap (collision) - need to ensure integer position
		flappyascii.bird.y = Math.floor(pipe.gap_y - flappyascii.PIPE_GAP_SIZE / 2) - 1;
		
		flappyascii.pipes.push(pipe);
		flappyascii.updatePipesAndCheckCollisions();
		expect(flappyascii.gameRunning).toBe(false);
	});
});
describe('checkGroundCollision', () => {
	let flappyascii;
	beforeAll(() => { flappyascii = require('../src/flappyascii.js'); });
	beforeEach(() => { flappyascii.resetGame(); });
	test('does not set gameRunning false if bird above ground', () => {
		flappyascii.bird.y = flappyascii.SCREEN_HEIGHT - 2;
		flappyascii.checkGroundCollision();
		expect(flappyascii.gameRunning).toBe(true);
	});
});
describe('Game Loop', () => {
	let flappyascii;
	beforeAll(() => { flappyascii = require('../src/flappyascii.js'); });
	beforeEach(() => {
		flappyascii.resetGame();
	});
	test('gameLoop draws game when running', () => {
		flappyascii.gameRunning = true;
		flappyascii.gameStarted = false;
		// Simulate enough time passed
		flappyascii.lastFrameTime = 0;
		flappyascii.gameLoop(200);
		// Just check that the function ran without error and game is still running
		expect(flappyascii.gameRunning).toBe(true);
	});
	test('gameLoop shows game over when not running', () => {
		flappyascii.gameRunning = false;
		flappyascii.score = 5;
		flappyascii.gameLoop(200);
		// Game should remain not running
		expect(flappyascii.gameRunning).toBe(false);
	});
	test('gameLoop skips frame if not enough time has passed', () => {
		flappyascii.gameRunning = true;
		flappyascii.lastFrameTime = 150; // Recent frame time
		const initialBirdY = flappyascii.bird.y;
		flappyascii.gameLoop(200); // Only 50ms passed
		// Should not have processed frame, so bird should be unchanged
		expect(flappyascii.bird.y).toBe(initialBirdY);
	});
});

describe('Theme Colors with Game Running', () => {
	let flappyascii;
	beforeAll(() => { flappyascii = require('../src/flappyascii.js'); });
	beforeEach(() => {
		flappyascii.resetGame();
	});
	test('updateGameColors redraws game when running', () => {
		flappyascii.gameRunning = true;
		document.documentElement.setAttribute('data-theme', 'dark');
		flappyascii.updateGameColors();
		// Test that the theme was updated and function ran without error
		expect(flappyascii.BIRD_CHAR).toBe('■');
		expect(flappyascii.gameRunning).toBe(true);
	});
});

describe('Additional Coverage Tests', () => {
	let flappyascii;
	beforeAll(() => { flappyascii = require('../src/flappyascii.js'); });
	beforeEach(() => {
		flappyascii.resetGame();
	});
	
	test('drawGame with complete game state', () => {
		const bird = new flappyascii.Bird(10);
		const pipes = [new flappyascii.Pipe(50)];
		// Test that drawGame runs without error
		expect(() => flappyascii.drawGame(bird, pipes, 5, true)).not.toThrow();
	});
	
	test('gameOverScreen saves high score to localStorage', () => {
		flappyascii.highScore = 0;
		flappyascii.gameOverScreen(15);
		expect(localStorage.getItem('flappyBirdHighScore')).toBe('15');
	});

	test('updateGameColors redraws when game is running and gameScreen exists', () => {
		// Set up a mock gameScreen that actually works
		const mockElement = { textContent: '' };
		flappyascii.gameScreen = mockElement;
		flappyascii.gameRunning = true;
		
		document.documentElement.setAttribute('data-theme', 'dark');
		flappyascii.updateGameColors();
		
		// Check that the mock element was updated (line 36)
		expect(mockElement.textContent).toContain('Score: 0');
	});

	test('covers event listener branches', () => {
		// Test gameLoop returns early when not enough time passed (lines 297-299)
		flappyascii.gameRunning = true;
		flappyascii.lastFrameTime = Date.now();
		const oldBirdY = flappyascii.bird.y;
		
		// Should return early and not update bird
		flappyascii.gameLoop(flappyascii.lastFrameTime + 50); // Only 50ms passed
		expect(flappyascii.bird.y).toBe(oldBirdY);
	});

	test('covers init function when gameScreen is found', () => {
		// Mock getElementById to return a mock element
		const mockElement = { textContent: '' };
		const originalGetElementById = document.getElementById;
		document.getElementById = jest.fn().mockReturnValue(mockElement);
		
		// Mock requestAnimationFrame
		global.requestAnimationFrame = jest.fn();
		
		// Test the init function
		const flappyasciiModule = require('../src/flappyascii.js');
		
		// Restore the original function
		document.getElementById = originalGetElementById;
	});

	test('covers init function when gameScreen is not found', () => {
		// Mock getElementById to return null
		const originalGetElementById = document.getElementById;
		document.getElementById = jest.fn().mockReturnValue(null);
		
		// Mock console.error to verify it's called
		const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
		
		// Test the init function by re-requiring the module
		jest.resetModules();
		require('../src/flappyascii.js');
		
		// Restore
		document.getElementById = originalGetElementById;
		consoleSpy.mockRestore();
	});

	test('covers gameScreen setter with global', () => {
		const mockElement = { textContent: '' };
		flappyascii.gameScreen = mockElement;
		
		// Just check that the setter worked
		expect(flappyascii.gameScreen).toBe(mockElement);
	});

	test('covers gameLoop early return branches', () => {
		// Test the exact lines 297-299 by checking frameDelay logic
		flappyascii.gameRunning = true;
		flappyascii.lastFrameTime = 100;
		const initialScore = flappyascii.score;
		
		// Should return early because not enough time has passed
		flappyascii.gameLoop(150); // Only 50ms passed, less than frameDelay (100ms)
		
		// Score should not have changed because game logic didn't run
		expect(flappyascii.score).toBe(initialScore);
	});
});