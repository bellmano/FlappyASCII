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