/* Shared localStorage compatibility layer.
 *
 * The globe view historically used nb2:* while the map/card view used nb:*.
 * This file keeps both legacy keys working while sharing one canonical feedback state.
 * It is loaded before app.js so existing code does not need to know about the migration.
 */
(() => {
  'use strict';

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
