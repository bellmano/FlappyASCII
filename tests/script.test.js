import script from "../src/script.js";

describe("Theme switching script", () => {
  test("covers all branches with minimal setup", () => {
    const themeToggleMock = {
      innerHTML: "",
      appendChild: vi.fn(),
      addEventListener: vi.fn(),
    };

    const htmlElementMock = {
      dataset: {
        theme: "dark",
      },
    };

    const documentWithCreateElement = {
      createElement: vi.fn(() => ({ className: "" })),
    };

    const localStorageMock = {
      getItem: vi.fn(),
      setItem: vi.fn(),
    };

    const windowWithUpdate = {
      updateGameColors: vi.fn(),
    };

    // savedTheme branch + btn branch
    localStorageMock.getItem.mockReturnValueOnce("light");
    script.initThemeToggle(
      themeToggleMock,
      htmlElementMock,
      documentWithCreateElement,
      localStorageMock,
      windowWithUpdate,
    );

    expect(themeToggleMock.addEventListener).toHaveBeenCalledWith(
      "click",
      expect.any(Function),
    );
    expect(themeToggleMock.appendChild).toHaveBeenCalled();

    // Execute click handler to cover callback body and updateGameColors=true branch
    const clickHandler = themeToggleMock.addEventListener.mock.calls.find(
      ([type]) => type === "click",
    )[1];
    clickHandler();
    expect(localStorageMock.setItem).toHaveBeenCalled();
    expect(windowWithUpdate.updateGameColors).toHaveBeenCalled();

    // updateGameColors=false branch + currentTheme==='dark' branch in ternary
    script.toggleTheme(htmlElementMock, vi.fn(), localStorageMock, {});

    // savedTheme=false branch
    localStorageMock.getItem.mockReturnValueOnce(null);
    script.initThemeToggle(
      themeToggleMock,
      htmlElementMock,
      documentWithCreateElement,
      localStorageMock,
      {},
    );

    // btn=false branch
    expect(() =>
      script.initThemeToggle(
        null,
        htmlElementMock,
        documentWithCreateElement,
        localStorageMock,
        {},
      ),
    ).not.toThrow();

    // htmlElement=null early return
    // Use a non-nullish object without dataset, so the guard triggers
    expect(() =>
      script.initThemeToggle(
        themeToggleMock,
        {},
        documentWithCreateElement,
        localStorageMock,
        {},
      ),
    ).not.toThrow();

    // toggleTheme() early return when dataset is missing
    const updateIconSpy = vi.fn();
    script.toggleTheme({}, updateIconSpy, localStorageMock, {});
    expect(updateIconSpy).not.toHaveBeenCalled();

    // updateThemeIcon early return when btn is null
    expect(() =>
      script.updateThemeIcon("dark", null, documentWithCreateElement),
    ).not.toThrow();

    // updateThemeIcon() branch where btn lookup falls through to null
    expect(() => script.updateThemeIcon("dark", undefined, {})).not.toThrow();

    // document.createElement fallback branch
    const themeToggleNoDoc = { innerHTML: "", appendChild: vi.fn() };
    script.updateThemeIcon("dark", themeToggleNoDoc, {});
    expect(themeToggleNoDoc.appendChild).toHaveBeenCalledWith({
      className: "fas fa-sun",
    });

    // Cover default-argument branches (module-scoped fallbacks)
    document.body.innerHTML = '<button id="theme-toggle"></button>';
    expect(() => script.updateThemeIcon("dark")).not.toThrow();

    // Cover updateThemeIcon() branch where doc is null
    expect(() => script.updateThemeIcon("dark", undefined, null)).not.toThrow();

    // Cover updateThemeIcon() branch where globalThis.document is nullish
    vi.stubGlobal("document", undefined);
    try {
      expect(() =>
        script.updateThemeIcon("dark", themeToggleMock, undefined),
      ).not.toThrow();
    } finally {
      vi.unstubAllGlobals();
    }

    // Cover initThemeToggle() branches where doc is null (btn lookup + documentElement fallback)
    expect(() =>
      script.initThemeToggle(
        undefined,
        undefined,
        null,
        localStorageMock,
        windowWithUpdate,
      ),
    ).not.toThrow();

    // Cover initThemeToggle() branch where btn is resolved via doc.getElementById
    const docWithButtonLookup = {
      getElementById: vi.fn(() => themeToggleMock),
      createElement: vi.fn(() => ({ className: "" })),
      documentElement: { dataset: { theme: "dark" } },
    };
    localStorageMock.getItem.mockReturnValueOnce(null);
    script.initThemeToggle(
      undefined,
      undefined,
      docWithButtonLookup,
      localStorageMock,
      {},
    );
    expect(docWithButtonLookup.getElementById).toHaveBeenCalledWith(
      "theme-toggle",
    );

    // Cover initThemeToggle() branch where htmlEl falls back to module-scoped htmlElement
    localStorageMock.getItem.mockReturnValueOnce(null);
    expect(() =>
      script.initThemeToggle(undefined, undefined, {}, localStorageMock, {}),
    ).not.toThrow();

    // Cover initThemeToggle() branch where globalThis.document is nullish (doc resolves to null)
    vi.stubGlobal("document", undefined);
    try {
      expect(() =>
        script.initThemeToggle(
          undefined,
          undefined,
          undefined,
          localStorageMock,
          undefined,
        ),
      ).not.toThrow();
    } finally {
      vi.unstubAllGlobals();
    }

    document.documentElement.dataset.theme = "dark";
    localStorage.removeItem("theme");
    expect(() => script.toggleTheme()).not.toThrow();
  });
});
