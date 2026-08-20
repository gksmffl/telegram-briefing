/* Shared localStorage compatibility layer.
 *
 * The globe view historically used nb2:* while the map/card view used nb:*.
 * This file keeps both legacy keys working while sharing one canonical feedback state.
 * It is loaded before app.js so existing code does not need to know about the migration.
 */
(() => {
  'use strict';

  function installTypography() {
    if (typeof document === 'undefined' || !document.head) return;
    if (document.getElementById('briefing-pretendard-typography')) return;

    const style = document.createElement('style');
    style.id = 'briefing-pretendard-typography';
    style.textContent = `
      @font-face {
        font-family: 'Pretendard';
        src: url('https://cdn.jsdelivr.net/gh/projectnoonnu/pretendard@1.0/Pretendard-Thin.woff2') format('woff2');
        font-weight: 100;
        font-display: swap;
      }

      @font-face {
        font-family: 'Pretendard';
        src: url('https://cdn.jsdelivr.net/gh/projectnoonnu/pretendard@1.0/Pretendard-ExtraLight.woff2') format('woff2');
        font-weight: 200;
        font-display: swap;
      }

      @font-face {
        font-family: 'Pretendard';
        src: url('https://cdn.jsdelivr.net/gh/projectnoonnu/pretendard@1.0/Pretendard-Light.woff2') format('woff2');
        font-weight: 300;
        font-display: swap;
      }

      @font-face {
        font-family: 'Pretendard';
        src: url('https://cdn.jsdelivr.net/gh/projectnoonnu/pretendard@1.0/Pretendard-Regular.woff2') format('woff2');
        font-weight: 400;
        font-display: swap;
      }

      @font-face {
        font-family: 'Pretendard';
        src: url('https://cdn.jsdelivr.net/gh/projectnoonnu/pretendard@1.0/Pretendard-Medium.woff2') format('woff2');
        font-weight: 500;
        font-display: swap;
      }

      @font-face {
        font-family: 'Pretendard';
        src: url('https://cdn.jsdelivr.net/gh/projectnoonnu/pretendard@1.0/Pretendard-SemiBold.woff2') format('woff2');
        font-weight: 600;
        font-display: swap;
      }

      @font-face {
        font-family: 'Pretendard';
        src: url('https://cdn.jsdelivr.net/gh/projectnoonnu/pretendard@1.0/Pretendard-Bold.woff2') format('woff2');
        font-weight: 700;
        font-display: swap;
      }

      @font-face {
        font-family: 'Pretendard';
        src: url('https://cdn.jsdelivr.net/gh/projectnoonnu/pretendard@1.0/Pretendard-ExtraBold.woff2') format('woff2');
        font-weight: 800;
        font-display: swap;
      }

      @font-face {
        font-family: 'Pretendard';
        src: url('https://cdn.jsdelivr.net/gh/projectnoonnu/pretendard@1.0/Pretendard-Black.woff2') format('woff2');
        font-weight: 900;
        font-display: swap;
      }

      :root {
        --font-ui: 'Pretendard', -apple-system, BlinkMacSystemFont,
                   'Segoe UI', 'Malgun Gothic', 'Apple SD Gothic Neo', 'Noto Sans KR', sans-serif;
        --num: var(--font-ui);
        --m-num: var(--font-ui);
      }

      html, body,
      button, input, textarea, select {
        font-family: var(--font-ui) !important;
      }
    `;
    document.head.appendChild(style);
  }

  installTypography();

  if (typeof window === 'undefined' || typeof Storage === 'undefined' || !window.localStorage) return;

  const GROUPS = [
    {
      canonical: 'briefing:feedback:up:v1',
      aliases: ['nb:up', 'nb2:up'],
    },
    {
      canonical: 'briefing:feedback:down:v1',
      aliases: ['nb:down', 'nb2:down'],
    },
  ];

  const storage = window.localStorage;
  const nativeGet = Storage.prototype.getItem;
  const nativeSet = Storage.prototype.setItem;
  const nativeRemove = Storage.prototype.removeItem;

  function parseArray(value) {
    if (value === null) return [];
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed.filter((item) => typeof item === 'string') : [];
    } catch {
      return [];
    }
  }

  function unique(values) {
    return [...new Set(values)];
  }

  function writeGroup(group, value) {
    nativeSet.call(storage, group.canonical, value);
    group.aliases.forEach((key) => nativeSet.call(storage, key, value));
  }

  function migrateGroup(group) {
    const values = [group.canonical, ...group.aliases]
      .flatMap((key) => parseArray(nativeGet.call(storage, key)));

    const merged = unique(values);
    if (merged.length === 0) return;
    writeGroup(group, JSON.stringify(merged));
  }

  GROUPS.forEach(migrateGroup);

  function findGroup(key) {
    const name = String(key);
    return GROUPS.find((group) => group.canonical === name || group.aliases.includes(name)) || null;
  }

  Storage.prototype.getItem = function sharedGetItem(key) {
    if (this !== storage) return nativeGet.call(this, key);
    const group = findGroup(key);
    if (!group) return nativeGet.call(this, key);

    const canonical = nativeGet.call(storage, group.canonical);
    if (canonical !== null) return canonical;

    const merged = unique(group.aliases.flatMap((alias) => parseArray(nativeGet.call(storage, alias))));
    if (merged.length === 0) return null;
    const value = JSON.stringify(merged);
    writeGroup(group, value);
    return value;
  };

  Storage.prototype.setItem = function sharedSetItem(key, value) {
    if (this !== storage) return nativeSet.call(this, key, value);
    const group = findGroup(key);
    if (!group) return nativeSet.call(this, key, value);

    writeGroup(group, String(value));
  };

  Storage.prototype.removeItem = function sharedRemoveItem(key) {
    if (this !== storage) return nativeRemove.call(this, key);
    const group = findGroup(key);
    if (!group) return nativeRemove.call(this, key);

    nativeRemove.call(storage, group.canonical);
    group.aliases.forEach((alias) => nativeRemove.call(storage, alias));
  };

  window.BRIEFING_STORAGE = Object.freeze({
    groups: GROUPS.map((group) => Object.freeze({
      canonical: group.canonical,
      aliases: Object.freeze([...group.aliases]),
    })),
  });
})();
