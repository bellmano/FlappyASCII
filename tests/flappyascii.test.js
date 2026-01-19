// Polyfill for TextEncoder in Node.js (required by jsdom)
const { TextEncoder, TextDecoder } = require('util');
global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder;

const { JSDOM } = require('jsdom');

// Mock localStorage (stable + controllable across isolateModules)
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

let flappyascii;

beforeAll(() => {
	flappyascii = require('../src/flappyascii.js');
});

beforeEach(() => {
	const dom = new JSDOM('<!DOCTYPE html><div id="game-screen"></div>');
	global.document = dom.window.document;
	global.window = dom.window;
	flappyascii.gameScreen = document.getElementById('game-screen');
});

describe('FlappyASCII (minimal coverage suite)', () => {
	beforeEach(() => {
		flappyascii.resetGame();
		global.requestAnimationFrame = jest.fn();
		if (typeof localStorage.clear === 'function') localStorage.clear();
	});

	test('covers rendering, theming, pipes, scoring, and game-over output', () => {
		// Bird.constructor(): cover bounds clamping
		expect(new flappyascii.Bird(0).y).toBe(1);
		expect(new flappyascii.Bird(flappyascii.SCREEN_HEIGHT).y).toBe(flappyascii.SCREEN_HEIGHT - 2);

		// Bird.update(): started bounds + idle hover branches
		const physicsBird = new flappyascii.Bird(10);
		physicsBird.y = 0;
		physicsBird.velocity = -10;
		physicsBird.update(true);
		physicsBird.y = flappyascii.SCREEN_HEIGHT;
		physicsBird.velocity = 10;
		physicsBird.update(true);

		const hoverBird = new flappyascii.Bird(10);
		hoverBird.animationOffset = 0.6;
		hoverBird.animationDirection = 0.1;
		hoverBird.update(false);
		const hoverBirdNoFlip = new flappyascii.Bird(10);
		hoverBirdNoFlip.animationOffset = 0.4;
		hoverBirdNoFlip.animationDirection = 0.05;
		hoverBirdNoFlip.update(false);

		// Pipe.isCollision(): true + false branches
		const collisionPipe = new flappyascii.Pipe(flappyascii.BIRD_X);
		collisionPipe.x = flappyascii.BIRD_X;
		const testBird = new flappyascii.Bird(collisionPipe.gap_y - flappyascii.PIPE_GAP_SIZE);
		testBird.x = flappyascii.BIRD_X;
		expect(collisionPipe.isCollision(testBird)).toBe(true);
		testBird.y = collisionPipe.gap_y;
		expect(collisionPipe.isCollision(testBird)).toBe(false);

		// drawGame to DOM
		const mockEl = { textContent: '' };
		flappyascii.gameScreen = mockEl;
		flappyascii.drawGame(new flappyascii.Bird(10), [new flappyascii.Pipe(50)], 3, false);
		expect(mockEl.textContent).toContain('Score: 3');

		// drawPipes(): cover the in-bounds write branch
		const grid = Array.from({ length: flappyascii.SCREEN_HEIGHT }, () =>
			Array(flappyascii.SCREEN_WIDTH).fill(flappyascii.EMPTY_CHAR)
		);
		const paintPipe = new flappyascii.Pipe(10);
		paintPipe.x = 10;
		paintPipe.gap_y = 10;
		flappyascii.drawPipes(grid, [paintPipe]);
		expect(grid[0][10]).toBe(flappyascii.PIPE_CHAR);
		paintPipe.x = -1;
		flappyascii.drawPipes(grid, [paintPipe]);

		// updateGameColors dark + light branches
		flappyascii.gameRunning = true;
		flappyascii.gameStarted = false;
		flappyascii.bird = new flappyascii.Bird(10);
		flappyascii.pipes = [];
		flappyascii.score = 7;
		mockEl.textContent = '';
		document.documentElement.setAttribute('data-theme', 'dark');
		flappyascii.updateGameColors();
		expect(flappyascii.BIRD_CHAR).toBe('■');
		expect(mockEl.textContent).toContain('Score: 7');

		// cover the no-redraw branch (gameRunning && gameScreen is false)
		flappyascii.gameRunning = false;
		flappyascii.gameScreen = null;
		document.documentElement.setAttribute('data-theme', 'light');
		flappyascii.updateGameColors();
		expect(flappyascii.BIRD_CHAR).toBe('@');
		flappyascii.gameScreen = mockEl;

		// gameOverScreen high score branches + localStorage persistence
		flappyascii.highScore = 0;
		flappyascii.gameOverScreen(10);
		expect(mockEl.textContent).toContain('GAME OVER');
		expect(localStorage.getItem('flappyBirdHighScore')).toBe('10');
		flappyascii.highScore = 20;
		flappyascii.gameOverScreen(5);
		expect(flappyascii.highScore).toBe(20);

		// cover gameOverScreen render-guard false branch
		flappyascii.gameScreen = null;
		expect(() => flappyascii.gameOverScreen(1)).not.toThrow();

		// drawGame with missing gameScreen (null/undefined) should not throw
		flappyascii.gameScreen = null;
		expect(() => flappyascii.drawGame(new flappyascii.Bird(10), [], 0, false)).not.toThrow();
		flappyascii.gameScreen = undefined;
		expect(() => flappyascii.drawGame(new flappyascii.Bird(10), [], 0, false)).not.toThrow();
	});

	test('covers game loop timing, started branch, and else branch', () => {
		// addPipeIfNeeded(): hit the push-on-frequency branch
		flappyascii.resetGame();
		flappyascii.frameCounter = flappyascii.PIPE_FREQUENCY - 1;
		flappyascii.addPipeIfNeeded();
		expect(flappyascii.pipes.length).toBe(1);

		// updatePipesAndCheckCollisions(): cover score++, collision->gameRunning=false, and offscreen removal
		flappyascii.resetGame();
		flappyascii.score = 0;
		flappyascii.gameRunning = true;

		const scoringPipe = new flappyascii.Pipe(flappyascii.BIRD_X - 1);
		scoringPipe.passed = false;

		const collidePipe = new flappyascii.Pipe(flappyascii.BIRD_X + 1);
		collidePipe.x = flappyascii.BIRD_X + 1;
		flappyascii.bird.y = Math.floor(collidePipe.gap_y - flappyascii.PIPE_GAP_SIZE / 2) - 1;

		const offscreenPipe = new flappyascii.Pipe(0);
		offscreenPipe.x = 0;

		flappyascii.pipes = [scoringPipe, collidePipe, offscreenPipe];
		flappyascii.updatePipesAndCheckCollisions();
		expect(flappyascii.score).toBeGreaterThanOrEqual(1);
		expect(flappyascii.gameRunning).toBe(false);
		expect(flappyascii.pipes.length).toBe(2);

		// checkGroundCollision(): cover ground-hit branch
		flappyascii.resetGame();
		flappyascii.bird.y = flappyascii.SCREEN_HEIGHT - 1;
		flappyascii.checkGroundCollision();
		expect(flappyascii.gameRunning).toBe(false);

		// early return path schedules next frame
		flappyascii.gameRunning = true;
		flappyascii.lastFrameTime = 200;
		global.requestAnimationFrame.mockReturnValue(123);
		flappyascii.gameLoop(250);
		expect(global.requestAnimationFrame).toHaveBeenCalledWith(expect.any(Function));
		expect(flappyascii.lastFrameTime).toBe(200);

		// started branch (pipes update/check + scheduling)
		global.requestAnimationFrame.mockClear();
		flappyascii.resetGame();
		flappyascii.gameStarted = true;
		flappyascii.lastFrameTime = 0;
		flappyascii.pipes = [new flappyascii.Pipe(flappyascii.SCREEN_WIDTH - 2)];
		flappyascii.gameLoop(500);
		expect(flappyascii.lastFrameTime).toBe(500);
		expect(global.requestAnimationFrame).toHaveBeenCalledWith(expect.any(Function));

		// else branch renders GAME OVER
		const mockEl = { textContent: '' };
		flappyascii.gameScreen = mockEl;
		flappyascii.gameRunning = false;
		flappyascii.gameStarted = false;
		flappyascii.lastFrameTime = 0;
		flappyascii.score = 12;
		flappyascii.gameLoop(200);
		expect(mockEl.textContent).toContain('GAME OVER');
		expect(mockEl.textContent).toContain('Final Score: 12');
	});

	test('covers keyboard event listeners and exported setters/getters', () => {
		// Space starts + flaps (preventDefault branch)
		flappyascii.resetGame();
		flappyascii.gameRunning = true;
		flappyascii.gameStarted = false;
		const spaceEvent = new KeyboardEvent('keydown', { code: 'Space' });
		Object.defineProperty(spaceEvent, 'preventDefault', { value: jest.fn() });
		document.dispatchEvent(spaceEvent);
		expect(flappyascii.gameStarted).toBe(true);
		expect(flappyascii.bird.velocity).toBe(flappyascii.FLAP_STRENGTH);

		// Space while stopped does not flap
		flappyascii.gameRunning = false;
		flappyascii.bird.velocity = 0;
		const spaceWhileStopped = new KeyboardEvent('keydown', { code: 'Space' });
		Object.defineProperty(spaceWhileStopped, 'preventDefault', { value: jest.fn() });
		document.dispatchEvent(spaceWhileStopped);
		expect(flappyascii.bird.velocity).toBe(0);

		// 'r' restarts when game over
		global.requestAnimationFrame.mockClear();
		flappyascii.gameRunning = false;
		document.dispatchEvent(new KeyboardEvent('keydown', { key: 'r' }));
		expect(global.requestAnimationFrame).toHaveBeenCalledWith(expect.any(Function));
		expect(flappyascii.gameRunning).toBe(true);

		// other keys do nothing
		const initialState = { gameRunning: flappyascii.gameRunning, gameStarted: flappyascii.gameStarted };
		document.dispatchEvent(new KeyboardEvent('keydown', { key: 'a' }));
		expect(flappyascii.gameRunning).toBe(initialState.gameRunning);
		expect(flappyascii.gameStarted).toBe(initialState.gameStarted);

		// cover exported accessors
		// eslint-disable-next-line no-unused-expressions
		const _fc = flappyascii.frameCounter;
		expect(typeof _fc).toBe('number');
		const newBird = new flappyascii.Bird(5);
		flappyascii.bird = newBird;
		expect(flappyascii.bird.x).toBe(flappyascii.BIRD_X);

		// cover gameScreen setter + global.gameScreen write
		const mockEl = { textContent: '' };
		flappyascii.gameScreen = mockEl;
		expect(global.gameScreen).toBe(mockEl);
	});

	test('covers init() branches (saved high score present/absent, element present/missing)', () => {
		// saved high score present + game-screen exists
		jest.isolateModules(() => {
			const dom = new JSDOM('<!DOCTYPE html><html><body><div id="game-screen"></div></body></html>');
			global.window = dom.window;
			global.document = dom.window.document;
			global.requestAnimationFrame = jest.fn();
			localStorage.setItem('flappyBirdHighScore', '123');
			const mod = require('../src/flappyascii.js');
			const originalGet = document.getElementById;
			document.getElementById = jest.fn().mockReturnValue({ textContent: '' });
			mod.init();
			expect(mod.highScore).toBe(123);
			expect(mod.gameScreen.textContent).toContain('Score: 0');
			document.getElementById = originalGet;
		});

		// no saved high score + missing element logs error via load handler
		jest.isolateModules(() => {
			const dom = new JSDOM('<!DOCTYPE html><html><body><div id="other"></div></body></html>');
			global.window = dom.window;
			global.document = dom.window.document;
			const rafMock = jest.fn();
			global.requestAnimationFrame = rafMock;
			window.requestAnimationFrame = rafMock;
			if (typeof localStorage.clear === 'function') localStorage.clear();

			const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
			require('../src/flappyascii.js');
			window.dispatchEvent(new window.Event('load'));
			expect(errorSpy).toHaveBeenCalledWith('Game screen element not found!');
			errorSpy.mockRestore();
		});
	});
});