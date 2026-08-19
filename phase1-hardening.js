/* Phase 1 hardening
 * - Shares Telegram refresh cursors across globe/map/card views.
 * - Prevents the same Telegram posts from being reported as "new" on every refresh.
 * - Applies one shared Telegram channel configuration to every view.
 *
 * Loaded after each view's app.js and before DOMContentLoaded.
 */
(() => {
  'use strict';

  const CURSOR_STORE = 'briefing:telegram-cursors:v1';
  const pendingCursors = new Map();

  function loadCursors() {
    try {
      const raw = localStorage.getItem(CURSOR_STORE);
      const parsed = raw ? JSON.parse(raw) : {};
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
    } catch {
      return {};
    }
  }

  function saveCursors(cursors) {
    try {
      localStorage.setItem(CURSOR_STORE, JSON.stringify(cursors));
      return true;
    } catch {
      return false;
    }
  }

  function applySharedChannels() {
    if (typeof CHANNELS === 'undefined' || !Array.isArray(CHANNELS)) return;
    if (!Array.isArray(window.BRIEFING_CHANNELS)) return;

    CHANNELS.splice(
      0,
      CHANNELS.length,
      ...window.BRIEFING_CHANNELS.map((channel) => ({ ...channel })),
    );
  }

  function applyStoredCursors() {
    if (typeof CHANNELS === 'undefined' || !Array.isArray(CHANNELS)) return;
    const stored = loadCursors();

    CHANNELS.forEach((channel) => {
      const saved = Number(stored[channel.id]);
      if (Number.isFinite(saved) && saved > channel.last) channel.last = saved;
    });
  }

  function telegramChannelFromProxyUrl(url) {
    const value = String(url || '');
    const match = value.match(/https:\/\/t\.me\/s\/([A-Za-z0-9_]+)/);
    return match ? match[1] : null;
  }

  function maxTelegramMessageId(text, channelId) {
    const escaped = channelId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const re = new RegExp('t\\.me/' + escaped + '/(\\d+)', 'g');
    let max = 0;
    let match = re.exec(text);
    while (match) {
      max = Math.max(max, Number(match[1]) || 0);
      match = re.exec(text);
    }
    return max;
  }

  // Observe successful Telegram proxy responses, but do not advance CHANNELS yet.
  // The current refresh still needs the old cursor in order to count fresh posts correctly.
  if (typeof window.fetch === 'function') {
    const nativeFetch = window.fetch.bind(window);
    window.fetch = async (...args) => {
      const response = await nativeFetch(...args);
      const requestUrl = typeof args[0] === 'string' ? args[0] : args[0] && args[0].url;
      const channelId = telegramChannelFromProxyUrl(requestUrl);

      if (channelId && response.ok) {
        try {
          const text = await response.clone().text();
          const maxId = maxTelegramMessageId(text, channelId);
          if (maxId > 0) pendingCursors.set(channelId, maxId);
        } catch {
          // Cursor persistence is best-effort; refresh itself should still succeed.
        }
      }

      return response;
    };
  }

  applySharedChannels();
  applyStoredCursors();

  // app.js binds the refresh function during DOMContentLoaded. Reassigning it here means
  // the existing UI keeps working while cursors are committed only after a full refresh run.
  if (typeof refresh === 'function') {
    const nativeRefresh = refresh;
    refresh = async function hardenedRefresh(...args) {
      pendingCursors.clear();
      try {
        return await nativeRefresh.apply(this, args);
      } finally {
        if (pendingCursors.size === 0) return;

        const stored = loadCursors();
        pendingCursors.forEach((maxId, channelId) => {
          const previous = Number(stored[channelId]) || 0;
          if (maxId > previous) stored[channelId] = maxId;

          if (typeof CHANNELS !== 'undefined' && Array.isArray(CHANNELS)) {
            const channel = CHANNELS.find((item) => item.id === channelId);
            if (channel && maxId > channel.last) channel.last = maxId;
          }
        });
        saveCursors(stored);
        pendingCursors.clear();
      }
    };
  }
})();
