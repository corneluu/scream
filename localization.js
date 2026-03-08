// localization.js - Language switching utility
// Reads GAME_CONFIG.LANGUAGES and applies text to DOM nodes with data-i18n attributes.

const Localization = (() => {
    let _currentLang = GAME_CONFIG.DEFAULT_LANG;

    function t(key) {
        const lang = GAME_CONFIG.LANGUAGES[_currentLang] || GAME_CONFIG.LANGUAGES[GAME_CONFIG.DEFAULT_LANG];
        return lang[key] ?? `[${key}]`;
    }

    function setLang(langCode) {
        if (!GAME_CONFIG.LANGUAGES[langCode]) return;
        _currentLang = langCode;
        localStorage.setItem('scream_lang', langCode);
        applyAll();
    }

    function getLang() {
        return _currentLang;
    }

    function applyAll() {
        document.querySelectorAll('[data-i18n]').forEach(el => {
            const key = el.dataset.i18n;
            const attr = el.dataset.i18nAttr; // Optional: apply to an attribute instead of textContent
            const text = t(key);
            if (attr) {
                el.setAttribute(attr, text);
            } else {
                el.textContent = text;
            }
        });
        document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
            el.placeholder = t(el.dataset.i18nPlaceholder);
        });
        // Update lang flags
        document.querySelectorAll('.lang-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.lang === _currentLang);
        });
    }

    function init() {
        const stored = localStorage.getItem('scream_lang');
        if (stored && GAME_CONFIG.LANGUAGES[stored]) {
            _currentLang = stored;
        }
        applyAll();
    }

    return { t, setLang, getLang, applyAll, init };
})();
