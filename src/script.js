// Theme switching functionality
/* istanbul ignore next -- in non-DOM environments, document is undefined */
const htmlElement = typeof document !== 'undefined' ? document.documentElement : null;

// Function to update the icon based on theme
function updateThemeIcon(theme, themeToggleArg, documentArg) {
    const doc = documentArg ?? globalThis.document;
    const btn = themeToggleArg ?? doc?.getElementById?.('theme-toggle');

    if (btn && doc) {
        btn.innerHTML = '';
        const icon = doc?.createElement?.('i') ?? { className: '' };
        icon.className = theme === 'light' ? 'fas fa-moon' : 'fas fa-sun';
        btn.appendChild?.(icon);
    }
}

// Function to toggle theme
function toggleTheme(htmlElementArg, updateThemeIconArg, localStorageArg, windowArg) {
    const htmlEl = htmlElementArg ?? htmlElement;
    const updateIcon = updateThemeIconArg ?? updateThemeIcon;
    const ls = localStorageArg ?? globalThis.localStorage;
    const runtime = windowArg ?? globalThis;

    if (htmlEl?.dataset == null) return;

    const currentTheme = htmlEl.dataset.theme;
    const newTheme = currentTheme === 'light' ? 'dark' : 'light';
    htmlEl.dataset.theme = newTheme;
    updateIcon(newTheme);
    ls?.setItem?.('theme', newTheme);
    runtime.updateGameColors?.();
}

function initThemeToggle(themeToggleArg, htmlElementArg, documentArg, localStorageArg, windowArg) {
    const doc = documentArg ?? globalThis.document;
    const btn = themeToggleArg ?? doc?.getElementById?.('theme-toggle');
    const htmlEl = htmlElementArg ?? doc?.documentElement ?? htmlElement;
    const ls = localStorageArg ?? globalThis.localStorage;
    const runtime = windowArg ?? globalThis;

    if (htmlEl?.dataset == null) return;

    btn?.addEventListener?.('click', () => {
        toggleTheme(htmlEl, (theme) => updateThemeIcon(theme, btn, doc), ls, runtime);
    });

    const savedTheme = ls?.getItem?.('theme');
    if (savedTheme) {
        htmlEl.dataset.theme = savedTheme;
        updateThemeIcon(savedTheme, btn, doc);
        return;
    }

    updateThemeIcon(htmlEl.dataset.theme, btn, doc);
}

// Run initialization automatically in browser contexts
/* istanbul ignore next -- auto-run only in browser runtime */
if (
    typeof globalThis.document !== 'undefined' &&
    typeof globalThis.localStorage !== 'undefined'
) {
    if (globalThis.document.readyState === 'loading') {
        globalThis.document.addEventListener('DOMContentLoaded', () => initThemeToggle());
    } else {
        initThemeToggle();
    }
}

// Export functions for Jest/node testing
/* istanbul ignore next -- browser runtime has no CommonJS exports */
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        updateThemeIcon,
        toggleTheme,
        initThemeToggle
    };
}
