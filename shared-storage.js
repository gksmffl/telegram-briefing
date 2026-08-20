/* Shared localStorage compatibility layer.
 *
 * The globe view historically used nb2:* while the map/card view used nb:*.
 * This file keeps both legacy keys working while sharing one canonical feedback state.
 * It is loaded before app.js so existing code does not need to know about the migration.
 */
(() => {
  'use strict';

  if (typeof document !== 'undefined' && document.head && !document.getElementById('briefing-typography')) {
    const link = document.createElement('link');
    link.id = 'briefing-typography';
    link.rel = 'stylesheet';
    link.href = '/typography.css';
    document.head.appendChild(link);
  }

  function installRound2UiFeedback() {
    if (typeof document === 'undefined') return;

    if (document.head && !document.getElementById('briefing-round2-ui')) {
      const style = document.createElement('style');
      style.id = 'briefing-round2-ui';
      style.textContent = `
        /* East Asia pins overlap at dashboard scale. Korea is the default top card. */
        #pins .pin { z-index: 10; }
        #pins .pin[data-region="cn"] { z-index: 40; }
        #pins .pin[data-region="jp"] { z-index: 50; }
        #pins .pin[data-region="kr"] { z-index: 60; }

        /* Any region the user is pointing at or has selected comes to the front. */
        #pins .pin.is-on { z-index: 110 !important; }
        #pins .pin:hover,
        #pins .pin:focus-visible,
        #pins .pin:active { z-index: 120 !important; }
      `;
      document.head.appendChild(style);
    }

    const normalizeLabel = (node) => {
      if (!node || node.nodeType !== 1) return;
      const candidates = [];
      if (node.matches && node.matches('.feed-btn, .know-btn')) candidates.push(node);
      if (node.querySelectorAll) candidates.push(...node.querySelectorAll('.feed-btn, .know-btn'));

      candidates.forEach((button) => {
        const current = button.textContent || '';
        const normalized = current
          .replace(/도움됐어요/g, '도움 됐어요')
          .replace(/필요없어요/g, '필요 없어요');
        if (normalized !== current) button.textContent = normalized;
      });
    };

    const normalizeTemplates = () => {
      document.querySelectorAll('template').forEach((template) => {
        if (template.content) normalizeLabel(template.content.firstElementChild || template.content);
        if (template.content && template.content.querySelectorAll) {
          template.content.querySelectorAll('.feed-btn, .know-btn').forEach(normalizeLabel);
        }
      });
    };

    normalizeLabel(document.body);
    normalizeTemplates();

    if (typeof MutationObserver !== 'undefined' && document.body) {
      const observer = new MutationObserver((records) => {
        records.forEach((record) => {
          record.addedNodes.forEach((node) => normalizeLabel(node));
        });
      });
      observer.observe(document.body, { childList: true, subtree: true });
    }
  }

  installRound2UiFeedback();

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
