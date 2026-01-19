// Theme switching functionality
/* istanbul ignore next -- in non-DOM environments, document is undefined */
const htmlElement = typeof document !== 'undefined' ? document.documentElement : null;

// Function to update the icon based on theme
function updateThemeIcon(theme, themeToggleArg, documentArg) {
    const doc = documentArg !== undefined
        ? documentArg
        : globalThis.document;
    const btn = themeToggleArg !== undefined
        ? themeToggleArg
        : (doc && doc.getElementById ? doc.getElementById('theme-toggle') : null);
    if (!btn || !doc) return;
    btn.innerHTML = '';
    const icon = doc.createElement ? doc.createElement('i') : { className: '' };
    if (theme === 'light') {
        icon.className = 'fas fa-moon';
    } else {
        icon.className = 'fas fa-sun';
    }
    btn.appendChild(icon);
}

// Function to toggle theme
function toggleTheme(htmlElementArg, updateThemeIconArg, localStorageArg, windowArg) {
    const htmlEl = htmlElementArg !== undefined ? htmlElementArg : htmlElement;
    const updateIcon = updateThemeIconArg !== undefined ? updateThemeIconArg : updateThemeIcon;
    const ls = localStorageArg !== undefined ? localStorageArg : localStorage;
    const win = windowArg !== undefined ? windowArg : window;
    const currentTheme = htmlEl.getAttribute('data-theme');
    const newTheme = currentTheme === 'light' ? 'dark' : 'light';
    htmlEl.setAttribute('data-theme', newTheme);
    updateIcon(newTheme);
    ls.setItem('theme', newTheme);
    if (win.updateGameColors) {
        win.updateGameColors();
    }
}

function initThemeToggle(themeToggleArg, htmlElementArg, documentArg, localStorageArg, windowArg) {
    const doc = documentArg !== undefined ? documentArg : document;
    const btn = themeToggleArg !== undefined ? themeToggleArg : (doc && doc.getElementById ? doc.getElementById('theme-toggle') : null);
    const htmlEl = htmlElementArg !== undefined ? htmlElementArg : (doc ? doc.documentElement : htmlElement);
    const ls = localStorageArg !== undefined ? localStorageArg : localStorage;
    const win = windowArg !== undefined ? windowArg : window;

    if (!htmlEl) return;

    if (btn) {
        btn.addEventListener('click', () => {
            toggleTheme(htmlEl, (theme) => updateThemeIcon(theme, btn, doc), ls, win);
        });
    }

    const savedTheme = ls.getItem('theme');
    if (savedTheme) {
        htmlEl.setAttribute('data-theme', savedTheme);
        updateThemeIcon(savedTheme, btn, doc);
    } else {
        const initialTheme = htmlEl.getAttribute('data-theme');
        updateThemeIcon(initialTheme, btn, doc);
    }
}

// Run initialization automatically in browser contexts
/* istanbul ignore next -- auto-run only in browser runtime */
if (
    typeof window !== 'undefined' &&
    typeof document !== 'undefined' &&
    typeof localStorage !== 'undefined'
) {
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => initThemeToggle());
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
