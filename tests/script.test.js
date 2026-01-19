const script = require('../src/script.js');

describe('Theme switching script', () => {
    test('covers all branches with minimal setup', () => {
        const themeToggleMock = {
            innerHTML: '',
            appendChild: jest.fn(),
            addEventListener: jest.fn(),
        };

        const htmlElementMock = {
            dataset: {
                theme: 'dark'
            },
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
        // Use a non-nullish object without dataset, so the guard triggers
        expect(() => script.initThemeToggle(themeToggleMock, {}, documentWithCreateElement, localStorageMock, {})).not.toThrow();

        // toggleTheme() early return when dataset is missing
        const updateIconSpy = jest.fn();
        script.toggleTheme({}, updateIconSpy, localStorageMock, {});
        expect(updateIconSpy).not.toHaveBeenCalled();

        // updateThemeIcon early return when btn is null
        expect(() => script.updateThemeIcon('dark', null, documentWithCreateElement)).not.toThrow();

        // updateThemeIcon() branch where btn lookup falls through to null
        expect(() => script.updateThemeIcon('dark', undefined, {})).not.toThrow();

        // document.createElement fallback branch
        const themeToggleNoDoc = { innerHTML: '', appendChild: jest.fn() };
        script.updateThemeIcon('dark', themeToggleNoDoc, {});
        expect(themeToggleNoDoc.appendChild).toHaveBeenCalledWith({ className: 'fas fa-sun' });

        // Cover default-argument branches (module-scoped fallbacks)
        document.body.innerHTML = '<button id="theme-toggle"></button>';
        expect(() => script.updateThemeIcon('dark')).not.toThrow();

        // Cover updateThemeIcon() branch where doc is null
        expect(() => script.updateThemeIcon('dark', undefined, null)).not.toThrow();

        // Cover updateThemeIcon() branch where globalThis.document is nullish
        const originalDocument = globalThis.document;
        try {
            globalThis.document = undefined;
            expect(() => script.updateThemeIcon('dark', themeToggleMock, undefined)).not.toThrow();
        } finally {
            globalThis.document = originalDocument;
        }

        // Cover initThemeToggle() branches where doc is null (btn lookup + documentElement fallback)
        expect(() => script.initThemeToggle(undefined, undefined, null, localStorageMock, windowWithUpdate)).not.toThrow();

        // Cover initThemeToggle() branch where btn is resolved via doc.getElementById
        const docWithButtonLookup = {
            getElementById: jest.fn(() => themeToggleMock),
            createElement: jest.fn(() => ({ className: '' })),
            documentElement: { dataset: { theme: 'dark' } },
        };
        localStorageMock.getItem.mockReturnValueOnce(null);
        script.initThemeToggle(undefined, undefined, docWithButtonLookup, localStorageMock, {});
        expect(docWithButtonLookup.getElementById).toHaveBeenCalledWith('theme-toggle');

        // Cover initThemeToggle() branch where htmlEl falls back to module-scoped htmlElement
        localStorageMock.getItem.mockReturnValueOnce(null);
        expect(() => script.initThemeToggle(undefined, undefined, {}, localStorageMock, {})).not.toThrow();

        // Cover initThemeToggle() branch where globalThis.document is nullish (doc resolves to null)
        const originalDocument2 = globalThis.document;
        try {
            globalThis.document = undefined;
            expect(() => script.initThemeToggle(undefined, undefined, undefined, localStorageMock, undefined)).not.toThrow();
        } finally {
            globalThis.document = originalDocument2;
        }

        document.documentElement.dataset.theme = 'dark';
        localStorage.removeItem('theme');
        expect(() => script.toggleTheme()).not.toThrow();
    });
});
