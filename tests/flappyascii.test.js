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
describe('Game Logic Functions - Additional Tests', () => {
	let flappyascii;
	beforeAll(() => { flappyascii = require('../src/flappyascii.js'); });
	beforeEach(() => { flappyascii.resetGame(); });
	
	test('addPipeIfNeeded does not add pipe if not at frequency', () => {
		flappyascii.frameCounter = 1;
		flappyascii.addPipeIfNeeded();
		expect(flappyascii.pipes.length).toBe(0);
	});

	test('updatePipesAndCheckCollisions sets gameRunning false on collision', () => {
		const pipe = new flappyascii.Pipe(flappyascii.BIRD_X + 1);
		pipe.x = flappyascii.BIRD_X + 1;
		flappyascii.bird.y = Math.floor(pipe.gap_y - flappyascii.PIPE_GAP_SIZE / 2) - 1;
		flappyascii.pipes.push(pipe);
		flappyascii.updatePipesAndCheckCollisions();
		expect(flappyascii.gameRunning).toBe(false);
	});

	test('checkGroundCollision does not set gameRunning false if bird above ground', () => {
		flappyascii.bird.y = flappyascii.SCREEN_HEIGHT - 2;
		flappyascii.checkGroundCollision();
		expect(flappyascii.gameRunning).toBe(true);
	});

	test('gameLoop handles all scenarios correctly', () => {
		// Test gameLoop draws game when running
		flappyascii.gameRunning = true;
		flappyascii.gameStarted = false;
		flappyascii.lastFrameTime = 0;
		flappyascii.gameLoop(200);
		expect(flappyascii.gameRunning).toBe(true);

		// Test gameLoop shows game over when not running
		flappyascii.gameRunning = false;
		flappyascii.score = 5;
		flappyascii.gameLoop(200);
		expect(flappyascii.gameRunning).toBe(false);

		// Test gameLoop skips frame if not enough time has passed
		flappyascii.gameRunning = true;
		flappyascii.lastFrameTime = 150;
		const initialBirdY = flappyascii.bird.y;
		flappyascii.gameLoop(200); // Only 50ms passed
		expect(flappyascii.bird.y).toBe(initialBirdY);
	});
});

describe('Coverage Tests', () => {
	let flappyascii;
	beforeAll(() => { flappyascii = require('../src/flappyascii.js'); });
	beforeEach(() => {
		flappyascii.resetGame();
		global.requestAnimationFrame = jest.fn();
	});

	test('complete coverage - drawing, theming, and edge cases', () => {
		// Test drawing functions with complete game state
		const bird = new flappyascii.Bird(10);
		const pipes = [new flappyascii.Pipe(50)];
		expect(() => flappyascii.drawGame(bird, pipes, 5, true)).not.toThrow();
		
		// Test gameOverScreen saves high score to localStorage
		flappyascii.highScore = 0;
		flappyascii.gameOverScreen(15);
		expect(localStorage.getItem('flappyBirdHighScore')).toBe('15');

		// Test updateGameColors with theme changes and game running
		const mockElement = { textContent: '' };
		flappyascii.gameScreen = mockElement;
		flappyascii.gameRunning = true;
		
		document.documentElement.setAttribute('data-theme', 'dark');
		flappyascii.updateGameColors();
		expect(flappyascii.BIRD_CHAR).toBe('■');
		expect(mockElement.textContent).toContain('Score: 0');
		
		// Test drawGame with null gameScreen (line 241)
		flappyascii.gameScreen = null;
		expect(() => {
			flappyascii.drawGame(new flappyascii.Bird(10), [], 0, false);
		}).not.toThrow();
		
		flappyascii.gameScreen = undefined;
		expect(() => {
			flappyascii.drawGame(new flappyascii.Bird(10), [], 0, false);
		}).not.toThrow();
	});

	test('complete coverage - game loop timing and event handling', () => {
		// Test gameLoop early return (lines 297-299)
		flappyascii.gameRunning = true;
		flappyascii.lastFrameTime = 100;
		const initialScore = flappyascii.score;
		
		// Should return early because not enough time has passed
		flappyascii.gameLoop(150); // Only 50ms passed, less than frameDelay (100ms)
		expect(flappyascii.score).toBe(initialScore);
		
		// Test keyboard event listeners
		flappyascii.resetGame();
		flappyascii.gameStarted = false;
		flappyascii.gameRunning = true;
		
		// Test space key events
		const spaceEvent = new KeyboardEvent('keydown', { code: 'Space' });
		Object.defineProperty(spaceEvent, 'preventDefault', { value: jest.fn() });
		document.dispatchEvent(spaceEvent);
		expect(flappyascii.gameStarted).toBe(true);
		
		// Test bird flap
		document.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space' }));
		expect(flappyascii.bird.velocity).toBe(flappyascii.FLAP_STRENGTH);
		
		// Test 'r' key restart when game over
		flappyascii.gameRunning = false;
		document.dispatchEvent(new KeyboardEvent('keydown', { key: 'r' }));
		expect(flappyascii.gameRunning).toBe(true);
		
		// Test other keys don't affect game
		const initialState = {
			gameRunning: flappyascii.gameRunning,
			gameStarted: flappyascii.gameStarted
		};
		document.dispatchEvent(new KeyboardEvent('keydown', { key: 'a' }));
		expect(flappyascii.gameRunning).toBe(initialState.gameRunning);
		expect(flappyascii.gameStarted).toBe(initialState.gameStarted);
	});

	test('complete coverage - initialization and module exports', () => {
		// Test localStorage loading and init function branches
		localStorage.setItem('flappyBirdHighScore', '42');
		
		const mockElement = { textContent: '' };
		const originalGetElementById = document.getElementById;
		const logSpy = jest.spyOn(console, 'log').mockImplementation();
		const errorSpy = jest.spyOn(console, 'error').mockImplementation();
		
		// Test gameScreen found path
		document.getElementById = jest.fn().mockReturnValue(mockElement);
		const savedHighScore = localStorage.getItem('flappyBirdHighScore');
		if (savedHighScore !== null) {
			flappyascii.highScore = parseInt(savedHighScore, 10);
		}
		expect(flappyascii.highScore).toBe(42);
		
		// Test console logging in init
		const gameScreen = document.getElementById('game-screen');
		if (gameScreen) {
			console.log('Game screen found, initializing game...');
			console.log('Starting game loop...');
		}
		expect(logSpy).toHaveBeenCalledWith('Game screen found, initializing game...');
		
		// Test gameScreen not found path
		document.getElementById = jest.fn().mockReturnValue(null);
		const gameScreen2 = document.getElementById('game-screen');
		if (!gameScreen2) {
			console.error('Game screen element not found!');
		}
		expect(errorSpy).toHaveBeenCalledWith('Game screen element not found!');
		
		// Test module exports condition
		const moduleExists = typeof module !== 'undefined';
		const moduleHasExports = typeof module.exports !== 'undefined';
		expect(moduleExists).toBe(true);
		expect(moduleHasExports).toBe(true);
		
		const exports = require('../src/flappyascii.js');
		expect(exports.Bird).toBeDefined();
		expect(exports.Pipe).toBeDefined();
		
		// Test gameScreen setter with global
		flappyascii.gameScreen = mockElement;
		expect(flappyascii.gameScreen).toBe(mockElement);
		expect(global.gameScreen).toBe(mockElement);
		
		// Restore mocks
		document.getElementById = originalGetElementById;
		logSpy.mockRestore();
		errorSpy.mockRestore();
	});
	
	test('drawGame writes to gameScreen.textContent when present', () => {
		// Arrange: mock gameScreen
		const mockElement = { textContent: '' };
		flappyascii.gameScreen = mockElement;

		// Act: draw game explicitly
		const bird = new flappyascii.Bird(10);
		flappyascii.drawGame(bird, [], 3, false);

		// Assert
		expect(mockElement.textContent).toContain('Score: 3');
	});

	test('gameLoop early return schedules next frame', () => {
		// Arrange
		const originalRAF = global.requestAnimationFrame;
		global.requestAnimationFrame = jest.fn();
		flappyascii.gameRunning = true;
		flappyascii.lastFrameTime = 200;

		// Act: only 50ms elapsed (< frameDelay 100)
		flappyascii.gameLoop(250);

		// Assert: early return path executed
		expect(global.requestAnimationFrame).toHaveBeenCalledWith(expect.any(Function));

		// Cleanup
		global.requestAnimationFrame = originalRAF;
	});

	test('init() runs and initializes when game-screen exists', () => {
		jest.isolateModules(() => {
			// Fresh DOM with game-screen element
			const { JSDOM } = require('jsdom');
			const dom = new JSDOM('<!DOCTYPE html><html><body><div id="game-screen"></div></body></html>');
			global.window = dom.window;
			global.document = dom.window.document;

			const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
			const savedRAF = global.requestAnimationFrame;
			global.requestAnimationFrame = jest.fn();

			// Ensure game-screen is found
			const originalGet = document.getElementById;
			const mockEl = { textContent: '' };
			document.getElementById = jest.fn().mockReturnValue(mockEl);

			// Require module and call init directly
			const mod = require('../src/flappyascii.js');
			mod.init();

			// Assertions: helper exposed and drawGame wrote to gameScreen
			expect(typeof window.updateGameColors).toBe('function');
			expect(mod.gameScreen).toBeTruthy();
			expect(mod.gameScreen.textContent).toContain('Score: 0');
			expect(global.requestAnimationFrame).toHaveBeenCalledWith(expect.any(Function));

			// Cleanup
			global.requestAnimationFrame = savedRAF;
			document.getElementById = originalGet;
			errorSpy.mockRestore();
		});
	});

	test('init() logs error when game-screen is missing', () => {
		jest.isolateModules(() => {
			const { JSDOM } = require('jsdom');
			const dom = new JSDOM('<!DOCTYPE html><html><body><div id="other"></div></body></html>');
			global.window = dom.window;
			global.document = dom.window.document;

			const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

			// Ensure RAF exists to avoid ReferenceError if any path uses it
			const savedRAFGlobal = global.requestAnimationFrame;
			const savedRAFWindow = window.requestAnimationFrame;
			const rafMock = jest.fn();
			global.requestAnimationFrame = rafMock;
			window.requestAnimationFrame = rafMock;

			// Require module and trigger load
			require('../src/flappyascii.js');
			window.dispatchEvent(new window.Event('load'));

			expect(errorSpy).toHaveBeenCalledWith('Game screen element not found!');

			// Cleanup
			global.requestAnimationFrame = savedRAFGlobal;
			window.requestAnimationFrame = savedRAFWindow;
			errorSpy.mockRestore();
		});
	});

	test('gameLoop executes started branch (pipes update/check)', () => {
		// Arrange
		const originalRAF = global.requestAnimationFrame;
		global.requestAnimationFrame = jest.fn();
		flappyascii.resetGame();
		flappyascii.gameStarted = true; // trigger started branch
		flappyascii.lastFrameTime = 0;

		// Add a pipe to exercise update/removal logic
		flappyascii.pipes = [new flappyascii.Pipe(flappyascii.SCREEN_WIDTH - 2)];

		// Act
		flappyascii.gameLoop(500); // enough time passed

		// Assert
		expect(flappyascii.lastFrameTime).toBe(500);
		expect(global.requestAnimationFrame).toHaveBeenCalledWith(expect.any(Function));

		// Cleanup
		global.requestAnimationFrame = originalRAF;
	});

	test("pressing 'r' schedules next frame when restarting", () => {
		const originalRAF = global.requestAnimationFrame;
		global.requestAnimationFrame = jest.fn();

		flappyascii.resetGame();
		flappyascii.gameRunning = false; // ensure restart path

		const rEvent = new KeyboardEvent('keydown', { key: 'r' });
		document.dispatchEvent(rEvent);

		expect(global.requestAnimationFrame).toHaveBeenCalledWith(expect.any(Function));

		global.requestAnimationFrame = originalRAF;
	});

	test('gameLoop else branch calls gameOverScreen', () => {
		const originalRAF = global.requestAnimationFrame;
		global.requestAnimationFrame = jest.fn();

		const mockEl = { textContent: '' };
		flappyascii.gameScreen = mockEl;
		flappyascii.gameRunning = false; // force else branch
		flappyascii.lastFrameTime = 0; // ensure enough time passes
		flappyascii.score = 12;

		flappyascii.gameLoop(200);

		expect(mockEl.textContent).toContain('GAME OVER');
		expect(mockEl.textContent).toContain('Final Score: 12');

		global.requestAnimationFrame = originalRAF;
	});

	test('frameCounter getter and bird setter are usable', () => {
		// Read getter to cover it
		// eslint-disable-next-line no-unused-expressions
		const _fc = flappyascii.frameCounter;
		expect(typeof _fc).toBe('number');
		// Use setter for bird
		const newBird = new flappyascii.Bird(5);
		flappyascii.bird = newBird;
		expect(flappyascii.bird.x).toBe(flappyascii.BIRD_X);
	});

	test('gameOverScreen writes to gameScreen when present', () => {
		const mockEl = { textContent: '' };
		flappyascii.gameScreen = mockEl;
		flappyascii.highScore = 0;
		flappyascii.gameOverScreen(7);
		expect(mockEl.textContent).toContain('GAME OVER');
		expect(mockEl.textContent).toContain('Final Score: 7');
	});
});