/* Phase 1 hardening
 * - Shares Telegram refresh cursors across globe/map/card views.
 * - Prevents the same Telegram posts from being reported as "new" on every refresh.
 * - Applies one shared Telegram channel configuration to every view.
 * - Reflows the relationship map into a mobile-first vertical graph on narrow screens.
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

  function commitPendingCursors() {
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

  function installResponsiveStyles() {
    if (document.getElementById('briefing-responsive-hardening')) return;
    const style = document.createElement('style');
    style.id = 'briefing-responsive-hardening';
    style.textContent = `
      @media (max-width: 700px) {
        html, body { max-width: 100%; overflow-x: hidden; }

        body.mode-map .view-map {
          overflow-x: hidden !important;
          min-width: 0 !important;
        }

        body.mode-map .map-stage {
          width: auto !important;
          min-width: 0 !important;
          margin: 112px 10px 0 !important;
        }

        body.mode-map .links { overflow: hidden !important; }

        body.mode-map .nd {
          width: calc(100% - 32px) !important;
          max-width: 360px !important;
          padding: 12px 14px !important;
        }

        body.mode-map .nd-event {
          width: calc(100% - 8px) !important;
          max-width: 420px !important;
          padding: 20px 18px 18px !important;
        }

        body.mode-map .nd:hover,
        body.mode-map .nd:focus-visible {
          transform: translate(-50%, -50%) !important;
        }

        body.mode-map .nd-title { font-size: 16px !important; }
        body.mode-map .nd-val { font-size: 28px !important; }
        body.mode-map .nd-val.none { font-size: 20px !important; }
        body.mode-map .nd-facts li { font-size: 13px !important; line-height: 1.62 !important; }
        body.mode-map .hint-mobile { display: none !important; }
        body.mode-map .map-hint { padding: 14px 14px 22px !important; text-align: center !important; }

        body.mode-map .pop,
        body.mode-map .panel {
          align-items: flex-end !important;
          padding: 72px 0 0 !important;
          overflow: hidden !important;
        }

        body.mode-map .pop-in,
        body.mode-map .pn {
          max-width: none !important;
          max-height: calc(100dvh - 72px) !important;
          overflow-y: auto !important;
          overscroll-behavior: contain;
          padding: 22px 16px calc(20px + env(safe-area-inset-bottom)) !important;
          border-radius: 22px 22px 0 0 !important;
        }

        body.mode-map .pn-close { top: 14px !important; right: 14px !important; }
        body.mode-map .pn-title { padding-right: 42px !important; }
        body.mode-map .pn-metric { padding: 18px 16px !important; }
        body.mode-map .pn-value { font-size: 34px !important; }
        body.mode-map .pn-sec-ai,
        body.mode-map .pn-sec-op { padding: 16px 14px !important; }

        body.mode-map .src-head {
          min-width: 0;
          flex-wrap: wrap;
          align-items: flex-start;
        }

        body.mode-map .src-ch {
          min-width: 0;
          overflow-wrap: anywhere;
        }

        body.mode-map .src-open { margin-left: auto; }

        body.mode-toss .phone { width: 100%; max-width: 100%; }
        body.mode-toss .card-area { padding-left: 14px; padding-right: 14px; }
      }

      @media (max-width: 420px) {
        body.mode-map .app-top,
        body.mode-toss .app-top {
          flex-wrap: nowrap !important;
          padding: 10px 10px 8px !important;
        }

        body.mode-map .app-top .brand,
        body.mode-toss .app-top .brand { display: none !important; }

        body.mode-map .app-top .tools,
        body.mode-toss .app-top .tools {
          width: 100%;
          min-width: 0;
          justify-content: space-between;
          gap: 6px;
        }

        body.mode-map .app-top .seg,
        body.mode-toss .app-top .seg { flex: 1; min-width: 0; }

        body.mode-map .app-top .seg-btn,
        body.mode-toss .app-top .seg-btn {
          flex: 1;
          min-width: 0;
          padding: 7px 5px !important;
          text-align: center;
        }

        body.mode-map .legend {
          top: 56px !important;
          left: 10px !important;
          right: 10px !important;
          display: grid !important;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 6px 10px !important;
          padding: 8px 10px !important;
        }

        body.mode-map .map-stage { margin-top: 128px !important; }
        body.mode-map .nd { width: calc(100% - 20px) !important; }
        body.mode-map .nd-event { width: 100% !important; }

        #stage .top {
          flex-wrap: nowrap !important;
          padding: 10px 10px 8px !important;
        }

        #stage .top .brand { display: none !important; }
        #stage .top .tools { width: 100%; min-width: 0; justify-content: space-between; gap: 6px; }
        #stage .top .seg { flex: 1; min-width: 0; }
        #stage .top .seg-btn { flex: 1; min-width: 0; padding: 7px 5px !important; text-align: center; }
        #stage .regions { left: 10px !important; right: 10px !important; max-width: none !important; }
      }
    `;
    document.head.appendChild(style);
  }

  function hardenMobileMap() {
    if (!document.getElementById('view-map')) return;
    if (typeof layoutGraph !== 'function' || typeof drawLinks !== 'function' || typeof startDrift !== 'function') return;
    if (typeof state === 'undefined' || typeof GRAPH === 'undefined') return;

    const nativeLayoutGraph = layoutGraph;
    const nativeDrawLinks = drawLinks;
    const nativeStartDrift = startDrift;

    function isMobileGraph() {
      const box = document.getElementById('graph');
      return Boolean(box && box.clientWidth > 0 && box.clientWidth <= 700);
    }

    function setExactPosition(node) {
      node.x = node.bx;
      node.y = node.by;
      node.node.style.left = node.x + 'px';
      node.node.style.top = node.y + 'px';
    }

    function childOf(node) {
      return state.nodes.find((candidate) => candidate.parent === node) || null;
    }

    function mobileLayoutGraph() {
      const box = document.getElementById('graph');
      const stage = document.querySelector('.map-stage');
      const w = box.clientWidth;
      if (!w || !stage) return;

      cancelAnimationFrame(state.raf);
      state.raf = 0;

      state.nodes.forEach((node) => {
        node.hw = node.node.offsetWidth / 2;
        node.hh = node.node.offsetHeight / 2;
        node.ampX = 0;
        node.ampY = 0;
      });

      let cursorY = 12;

      GRAPH.forEach((cluster) => {
        const event = state.nodes.find((node) => node.kind === 'event' && node.card === cluster.card);
        if (!event) return;

        const clusterNodes = state.nodes.filter((node) => node.card === cluster.card);
        const bandTop = cursorY;

        cursorY += event.hh;
        event.bx = w / 2;
        event.by = cursorY;
        cursorY += event.hh + 30;

        event.roots.forEach((root) => {
          let current = root;
          while (current) {
            cursorY += current.hh;
            current.bx = w / 2;
            current.by = cursorY;
            cursorY += current.hh + 16;
            current = childOf(current);
          }
          cursorY += 8;
        });

        const bandBottom = cursorY + 12;
        clusterNodes.forEach((node) => {
          node.bandTop = bandTop;
          node.bandBottom = bandBottom;
        });
        cursorY = bandBottom + 22;
      });

      stage.style.minHeight = Math.ceil(cursorY + 8) + 'px';
      state.nodes.forEach(setExactPosition);
      drawLinks();
    }

    layoutGraph = function responsiveLayoutGraph(pass) {
      if (isMobileGraph()) {
        mobileLayoutGraph();
        return;
      }

      const result = nativeLayoutGraph(pass);
      if (state.mode === 'map' && !state.raf && window.innerWidth > 700) nativeStartDrift();
      return result;
    };

    drawLinks = function responsiveDrawLinks() {
      if (!isMobileGraph()) return nativeDrawLinks();

      const svg = document.getElementById('links');
      const box = document.getElementById('graph');
      const w = box.clientWidth;
      const h = box.clientHeight;
      svg.setAttribute('viewBox', '0 0 ' + w + ' ' + h);

      let d = '';
      state.nodes.forEach((node) => {
        if (!node.parent) return;
        const parent = node.parent;
        const x1 = parent.x;
        const y1 = parent.y + parent.hh;
        const x2 = node.x;
        const y2 = node.y - node.hh;
        const my = (y1 + y2) / 2;
        d += 'M' + x1 + ' ' + y1 + ' C ' + x1 + ' ' + my + ', ' + x2 + ' ' + my + ', ' + x2 + ' ' + y2 + ' ';
      });

      svg.replaceChildren();
      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      path.setAttribute('class', 'link');
      path.setAttribute('d', d);
      svg.appendChild(path);
    };

    startDrift = function responsiveStartDrift() {
      if (!isMobileGraph()) return nativeStartDrift();
      cancelAnimationFrame(state.raf);
      state.raf = 0;
      state.nodes.forEach(setExactPosition);
      drawLinks();
    };
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

  installResponsiveStyles();
  applySharedChannels();
  applyStoredCursors();
  hardenMobileMap();

  // app.js binds the refresh function during DOMContentLoaded. Reassigning it here means
  // the existing UI keeps working while cursors are committed only after a full refresh run.
  if (typeof refresh === 'function') {
    const nativeRefresh = refresh;
    refresh = async function hardenedRefresh(...args) {
      pendingCursors.clear();
      try {
        return await nativeRefresh.apply(this, args);
      } finally {
        // Never return from finally: doing so would swallow nativeRefresh return values/errors.
        commitPendingCursors();
      }
    };
  }
})();
