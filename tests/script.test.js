const script = require('../src/script.js');

describe('Theme switching script', () => {
    test('covers all branches with minimal setup', () => {
        const themeToggleMock = {
            innerHTML: '',
            appendChild: jest.fn(),
            addEventListener: jest.fn(),
        };

        let currentTheme = 'dark';
        const htmlElementMock = {
            getAttribute: jest.fn(() => currentTheme),
            setAttribute: jest.fn((key, value) => {
                if (key === 'data-theme') currentTheme = value;
            }),
        };

        const documentWithCreateElement = {
            createElement: jest.fn(() => ({ className: '' })),
        };

        const localStorageMock = {
            getItem: jest.fn(),
            setItem: jest.fn(),
        };

        const windowWithUpdate = {
            updateGameColors: jest.fn(),
        };

        // savedTheme branch + btn branch
        localStorageMock.getItem.mockReturnValueOnce('light');
        script.initThemeToggle(
            themeToggleMock,
            htmlElementMock,
            documentWithCreateElement,
            localStorageMock,
            windowWithUpdate
        );

        expect(themeToggleMock.addEventListener).toHaveBeenCalledWith('click', expect.any(Function));
        expect(themeToggleMock.appendChild).toHaveBeenCalled();

        // Execute click handler to cover callback body and updateGameColors=true branch
        const clickHandler = themeToggleMock.addEventListener.mock.calls.find(([type]) => type === 'click')[1];
        clickHandler();
        expect(localStorageMock.setItem).toHaveBeenCalled();
        expect(windowWithUpdate.updateGameColors).toHaveBeenCalled();

        // updateGameColors=false branch + currentTheme==='dark' branch in ternary
        script.toggleTheme(htmlElementMock, jest.fn(), localStorageMock, {});

        // savedTheme=false branch
        localStorageMock.getItem.mockReturnValueOnce(null);
        script.initThemeToggle(
            themeToggleMock,
            htmlElementMock,
            documentWithCreateElement,
            localStorageMock,
            {}
        );

        // btn=false branch
        expect(() =>
            script.initThemeToggle(null, htmlElementMock, documentWithCreateElement, localStorageMock, {})
        ).not.toThrow();

        // htmlElement=null early return
        expect(() => script.initThemeToggle(themeToggleMock, null, documentWithCreateElement, localStorageMock, {})).not.toThrow();

        // updateThemeIcon early return when btn is null
        expect(() => script.updateThemeIcon('dark', null, documentWithCreateElement)).not.toThrow();

        // document.createElement fallback branch
        const themeToggleNoDoc = { innerHTML: '', appendChild: jest.fn() };
        script.updateThemeIcon('dark', themeToggleNoDoc, {});
        expect(themeToggleNoDoc.appendChild).toHaveBeenCalledWith({ className: 'fas fa-sun' });

        // Cover default-argument branches (module-scoped fallbacks)
        document.body.innerHTML = '<button id="theme-toggle"></button>';
        expect(() => script.updateThemeIcon('dark')).not.toThrow();

        // Cover updateThemeIcon() branch where doc is null
        expect(() => script.updateThemeIcon('dark', undefined, null)).not.toThrow();

        // Cover initThemeToggle() branches where doc is null (btn lookup + documentElement fallback)
        expect(() => script.initThemeToggle(undefined, undefined, null, localStorageMock, windowWithUpdate)).not.toThrow();

        document.documentElement.setAttribute('data-theme', 'dark');
        localStorage.removeItem('theme');
        expect(() => script.toggleTheme()).not.toThrow();
    });
});
