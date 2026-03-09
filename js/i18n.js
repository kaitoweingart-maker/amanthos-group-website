/**
 * Amanthos Group - i18n Engine
 * Supports DE (default) and EN
 */
(function () {
  'use strict';

  var SUPPORTED_LANGS = {
    de: { name: 'German', native: 'DE' },
    en: { name: 'English', native: 'EN' }
  };

  var DEFAULT_LANG = 'de';
  var STORAGE_KEY = 'amanthos_lang';
  var currentLang = DEFAULT_LANG;
  var translations = {};
  var basePath = '';

  /**
   * Detect the base path to the translation JSON files.
   * Looks for the script tag that loaded i18n.js and resolves
   * the sibling `lang/` directory relative to the js/ folder.
   */
  function detectBasePath() {
    var scripts = document.getElementsByTagName('script');
    for (var i = 0; i < scripts.length; i++) {
      var src = scripts[i].getAttribute('src') || '';
      if (src.indexOf('i18n.js') !== -1) {
        basePath = src.replace(/js\/i18n\.js.*$/, '');
        return;
      }
    }
    basePath = '';
  }

  /**
   * Determine the user's preferred language.
   * Priority: URL parameter > localStorage > navigator.language > default (DE)
   */
  function detectLanguage() {
    // 1. URL parameter ?lang=xx
    var urlParams = new URLSearchParams(window.location.search);
    var urlLang = urlParams.get('lang');
    if (urlLang && SUPPORTED_LANGS[urlLang]) {
      return urlLang;
    }

    // 2. localStorage
    var stored = null;
    try {
      stored = localStorage.getItem(STORAGE_KEY);
    } catch (e) {
      // localStorage may be unavailable
    }
    if (stored && SUPPORTED_LANGS[stored]) {
      return stored;
    }

    // 3. navigator.language
    if (navigator.language) {
      var browserLang = navigator.language.substring(0, 2).toLowerCase();
      if (SUPPORTED_LANGS[browserLang]) {
        return browserLang;
      }
    }

    // 4. Default
    return DEFAULT_LANG;
  }

  /**
   * Load a translation JSON file via XMLHttpRequest.
   * @param {string} lang - Language code (de | en)
   * @param {function} callback - Called with (error, data)
   */
  function loadTranslation(lang, callback) {
    var url = basePath + 'locales/' + lang + '.json';
    var xhr = new XMLHttpRequest();
    xhr.open('GET', url, true);
    xhr.onreadystatechange = function () {
      if (xhr.readyState !== 4) return;
      if (xhr.status === 200) {
        try {
          var data = JSON.parse(xhr.responseText);
          callback(null, data);
        } catch (e) {
          callback(new Error('Failed to parse ' + url + ': ' + e.message), null);
        }
      } else {
        callback(new Error('Failed to load ' + url + ' (HTTP ' + xhr.status + ')'), null);
      }
    };
    xhr.send();
  }

  /**
   * Retrieve a nested value from an object using dot-notation.
   * e.g. getNestedValue(obj, "nav.about") => obj.nav.about
   */
  function getNestedValue(obj, key) {
    if (!obj || !key) return undefined;
    var parts = key.split('.');
    var current = obj;
    for (var i = 0; i < parts.length; i++) {
      if (current === undefined || current === null) return undefined;
      current = current[parts[i]];
    }
    return current;
  }

  /**
   * Walk the DOM and apply translations to annotated elements.
   * Handles:
   *   [data-i18n]             - textContent
   *   [data-i18n-placeholder] - placeholder attribute
   *   [data-i18n-aria]        - aria-label attribute
   * Also updates <html lang>, document.title, and meta description.
   */
  function applyTranslations() {
    var lang = currentLang;
    var dict = translations[lang] || translations[DEFAULT_LANG] || {};

    // html lang attribute
    document.documentElement.setAttribute('lang', lang);

    // Page title
    var titleKey = getNestedValue(dict, 'meta.title');
    if (titleKey) {
      document.title = titleKey;
    }

    // Meta description
    var descKey = getNestedValue(dict, 'meta.description');
    if (descKey) {
      var metaDesc = document.querySelector('meta[name="description"]');
      if (metaDesc) {
        metaDesc.setAttribute('content', descKey);
      }
    }

    // [data-i18n] - text content
    var elements = document.querySelectorAll('[data-i18n]');
    for (var i = 0; i < elements.length; i++) {
      var key = elements[i].getAttribute('data-i18n');
      var value = getNestedValue(dict, key);
      if (value !== undefined) {
        elements[i].textContent = value;
      }
    }

    // [data-i18n-placeholder] - placeholder attribute
    var placeholders = document.querySelectorAll('[data-i18n-placeholder]');
    for (var j = 0; j < placeholders.length; j++) {
      var pKey = placeholders[j].getAttribute('data-i18n-placeholder');
      var pValue = getNestedValue(dict, pKey);
      if (pValue !== undefined) {
        placeholders[j].setAttribute('placeholder', pValue);
      }
    }

    // [data-i18n-aria] - aria-label attribute
    var ariaEls = document.querySelectorAll('[data-i18n-aria]');
    for (var k = 0; k < ariaEls.length; k++) {
      var aKey = ariaEls[k].getAttribute('data-i18n-aria');
      var aValue = getNestedValue(dict, aKey);
      if (aValue !== undefined) {
        ariaEls[k].setAttribute('aria-label', aValue);
      }
    }
  }

  /**
   * Switch to a different language. Loads the translation if needed,
   * applies it, persists the choice, and dispatches a CustomEvent.
   * @param {string} lang - Target language code
   */
  function switchLanguage(lang) {
    if (!SUPPORTED_LANGS[lang]) return;
    if (lang === currentLang && translations[lang]) return;

    currentLang = lang;

    // Persist choice
    try {
      localStorage.setItem(STORAGE_KEY, lang);
    } catch (e) {
      // Ignore storage errors
    }

    if (translations[lang]) {
      applyTranslations();
      updateSelector();
      dispatchChange(lang);
    } else {
      loadTranslation(lang, function (err, data) {
        if (!err && data) {
          translations[lang] = data;
        }
        applyTranslations();
        updateSelector();
        dispatchChange(lang);
      });
    }
  }

  /**
   * Dispatch a 'languageChanged' CustomEvent on the document.
   */
  function dispatchChange(lang) {
    var event;
    try {
      event = new CustomEvent('languageChanged', { detail: { lang: lang } });
    } catch (e) {
      // IE fallback
      event = document.createEvent('CustomEvent');
      event.initCustomEvent('languageChanged', true, true, { lang: lang });
    }
    document.dispatchEvent(event);
  }

  /**
   * Build the language-selector dropdown UI inside #langSelector.
   */
  function buildSelector() {
    var container = document.getElementById('langSelector');
    if (!container) return;

    var html = '<button class="lang-toggle" type="button" aria-label="Select language" aria-expanded="false">';
    html += '<span class="lang-current">' + SUPPORTED_LANGS[currentLang].native + '</span>';
    html += '<svg width="10" height="6" viewBox="0 0 10 6" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="M1 1l4 4 4-4"/></svg>';
    html += '</button>';
    html += '<div class="lang-dropdown" role="listbox" aria-label="Language selection">';

    var keys = Object.keys(SUPPORTED_LANGS);
    for (var i = 0; i < keys.length; i++) {
      var code = keys[i];
      var isActive = code === currentLang ? ' active' : '';
      html += '<button class="lang-option' + isActive + '" type="button" data-lang="' + code + '" role="option"';
      html += code === currentLang ? ' aria-selected="true"' : ' aria-selected="false"';
      html += '>' + SUPPORTED_LANGS[code].native + '</button>';
    }
    html += '</div>';
    container.innerHTML = html;

    // Toggle dropdown
    var toggle = container.querySelector('.lang-toggle');
    var dropdown = container.querySelector('.lang-dropdown');

    toggle.addEventListener('click', function (e) {
      e.stopPropagation();
      var isOpen = dropdown.classList.toggle('open');
      toggle.setAttribute('aria-expanded', String(isOpen));
    });

    // Language option clicks
    var options = container.querySelectorAll('.lang-option');
    for (var j = 0; j < options.length; j++) {
      options[j].addEventListener('click', function () {
        var lang = this.getAttribute('data-lang');
        switchLanguage(lang);
        dropdown.classList.remove('open');
        toggle.setAttribute('aria-expanded', 'false');
      });
    }

    // Close on outside click
    document.addEventListener('click', function () {
      dropdown.classList.remove('open');
      toggle.setAttribute('aria-expanded', 'false');
    });
  }

  /**
   * Update the active state of language-selector buttons.
   */
  function updateSelector() {
    var container = document.getElementById('langSelector');
    if (!container) return;

    var currentEl = container.querySelector('.lang-current');
    if (currentEl) {
      currentEl.textContent = SUPPORTED_LANGS[currentLang].native;
    }

    var buttons = container.querySelectorAll('.lang-option');
    for (var i = 0; i < buttons.length; i++) {
      var code = buttons[i].getAttribute('data-lang');
      if (code === currentLang) {
        buttons[i].classList.add('active');
        buttons[i].setAttribute('aria-selected', 'true');
      } else {
        buttons[i].classList.remove('active');
        buttons[i].setAttribute('aria-selected', 'false');
      }
    }
  }

  /**
   * Global translate function.
   * @param {string} key - Dot-notation translation key
   * @param {Object} [replacements] - Key/value pairs for interpolation {{key}}
   * @returns {string} Translated string or the key itself as fallback
   */
  window.t = function (key, replacements) {
    var dict = translations[currentLang] || {};
    var value = getNestedValue(dict, key);

    // Fallback to German
    if (value === undefined && currentLang !== 'de') {
      var fallbackDict = translations['de'] || {};
      value = getNestedValue(fallbackDict, key);
    }

    // Ultimate fallback: return the key
    if (value === undefined) return key;

    // Interpolation: replace {{placeholder}} tokens
    if (replacements && typeof value === 'string') {
      var rKeys = Object.keys(replacements);
      for (var i = 0; i < rKeys.length; i++) {
        value = value.replace(
          new RegExp('\\{\\{' + rKeys[i] + '\\}\\}', 'g'),
          replacements[rKeys[i]]
        );
      }
    }

    return value;
  };

  /**
   * Global getter for the current language code.
   * @returns {string}
   */
  window.getLang = function () {
    return currentLang;
  };

  /**
   * Initialise the i18n system.
   * Loads DE (fallback) first, then the user's detected language.
   */
  function init() {
    detectBasePath();

    var userLang = detectLanguage();

    // Always load DE as the fallback base
    loadTranslation(DEFAULT_LANG, function (err, data) {
      if (!err && data) {
        translations[DEFAULT_LANG] = data;
      }

      if (userLang !== DEFAULT_LANG) {
        // Load the user's preferred language on top
        loadTranslation(userLang, function (err2, data2) {
          if (!err2 && data2) {
            translations[userLang] = data2;
          }
          currentLang = userLang;

          // Persist
          try {
            localStorage.setItem(STORAGE_KEY, currentLang);
          } catch (e) { /* ignore */ }

          applyTranslations();
          buildSelector();
        });
      } else {
        currentLang = DEFAULT_LANG;
        applyTranslations();
        buildSelector();
      }
    });
  }

  // Expose switchLanguage for programmatic use
  window.switchLanguage = switchLanguage;

  // Boot
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
