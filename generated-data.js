(() => {
  'use strict';
  // v0.5 starts from the 2026-08-31 canonical snapshot. Do not merge legacy v1
  // browser-generated items that were created on top of the 2026-08-13 prototype.
  const STORE = 'briefing:generated:v2';

  function load() {
    try {
      const parsed = JSON.parse(localStorage.getItem(STORE) || '{}');
      return {
        sources: parsed.sources && typeof parsed.sources === 'object' ? parsed.sources : {},
        items: Array.isArray(parsed.items) ? parsed.items : [],
        generatedAt: parsed.generatedAt || null,
      };
    } catch {
      return { sources: {}, items: [], generatedAt: null };
    }
  }

  function save(payload) {
    const current = load();
    const byId = new Map(current.items.map((item) => [item.id, item]));
    (payload.items || []).forEach((item) => { if (item && item.id) byId.set(item.id, item); });
    const next = {
      sources: { ...current.sources, ...(payload.sources || {}) },
      items: [...byId.values()],
      generatedAt: new Date().toISOString(),
    };
    localStorage.setItem(STORE, JSON.stringify(next));
    return next;
  }

  function merge(snapshot) {
    const data = window.BRIEFING_DATA;
    if (!data) return;
    Object.assign(data.sources, snapshot.sources || {});
    const issueIndex = new Map(data.issues.map((item, index) => [item.id, index]));
    const cardIndex = new Map(data.cards.map((item, index) => [item.id, index]));

    (snapshot.items || []).forEach((item) => {
      const termIds = [];
      const cardTerms = [];
      (item.terms || []).forEach((term) => {
        if (!term || !term.id) return;
        termIds.push(term.id);
        data.terms[term.id] = { name: term.name, full: term.full, desc: term.desc };
        cardTerms.push({ ...term });
      });
      const issue = { ...item, terms: termIds };
      const card = { ...item, terms: cardTerms };
      if (issueIndex.has(item.id)) data.issues[issueIndex.get(item.id)] = issue;
      else data.issues.push(issue);
      if (cardIndex.has(item.id)) data.cards[cardIndex.get(item.id)] = card;
      else data.cards.push(card);
    });
  }

  merge(load());
  window.BRIEFING_GENERATED = Object.freeze({ storageKey: STORE, load, save, merge });
})();
