/* Briefing data validator.
 *
 * This is intentionally non-blocking in the browser: bad static/generated data is
 * reported loudly without taking the current prototype UI down. CI tests exercise
 * the same validation functions before automated LLM card generation is introduced.
 */
(() => {
  'use strict';

  const PROHIBITED_OPINION_PATTERNS = [
    /매수하/i,
    /매도하/i,
    /사세요/i,
    /팔아/i,
    /추천합/i,
    /유망/i,
    /오를 것으로 보/i,
    /내릴 것으로 보/i,
    /목표주가를 제시/i,
  ];

  function isNonEmptyString(value) {
    return typeof value === 'string' && value.trim().length > 0;
  }

  function validateSource(source, key) {
    const errors = [];
    if (!source || typeof source !== 'object') return [`source ${key}: object required`];
    if (!isNonEmptyString(source.ch)) errors.push(`source ${key}: ch required`);
    if (!Number.isInteger(source.id) || source.id <= 0) errors.push(`source ${key}: positive integer id required`);
    if (!isNonEmptyString(source.at)) errors.push(`source ${key}: at required`);
    if (!isNonEmptyString(source.text)) errors.push(`source ${key}: text required`);
    return errors;
  }

  function validateOpinion(text, label) {
    if (!isNonEmptyString(text)) return [`${label}: opinion required`];
    return PROHIBITED_OPINION_PATTERNS
      .filter((pattern) => pattern.test(text))
      .map((pattern) => `${label}: prohibited investment-judgement phrase (${pattern.source})`);
  }

  function validateBriefingItem(item, index, sources) {
    const label = `item ${item && (item.id || item.short || item.title) || index}`;
    const errors = [];

    if (!item || typeof item !== 'object') return [`${label}: object required`];
    if (!isNonEmptyString(item.title)) errors.push(`${label}: title required`);
    if (!item.metric || !isNonEmptyString(item.metric.value) || !isNonEmptyString(item.metric.sub)) {
      errors.push(`${label}: metric.value and metric.sub required`);
    }
    if (!Array.isArray(item.facts) || item.facts.length === 0 || item.facts.some((fact) => !isNonEmptyString(fact))) {
      errors.push(`${label}: non-empty facts array required`);
    }
    if (item.imp !== undefined && (!Number.isInteger(item.imp) || item.imp < 1 || item.imp > 3)) {
      errors.push(`${label}: imp must be an integer from 1 to 3`);
    }
    if (!Array.isArray(item.sources) || item.sources.length === 0) {
      errors.push(`${label}: at least one source required`);
    } else if (sources && typeof sources === 'object') {
      item.sources.forEach((sourceKey) => {
        if (!sources[sourceKey]) errors.push(`${label}: missing source ${sourceKey}`);
      });
    }
    if (!Array.isArray(item.notes)) errors.push(`${label}: notes array required`);
    errors.push(...validateOpinion(item.opinion, label));

    return errors;
  }

  function validateDataset({ sources = {}, items = [] } = {}) {
    const errors = [];

    Object.entries(sources).forEach(([key, source]) => {
      errors.push(...validateSource(source, key));
    });

    if (!Array.isArray(items)) {
      errors.push('items: array required');
    } else {
      items.forEach((item, index) => {
        errors.push(...validateBriefingItem(item, index, sources));
      });
    }

    return errors;
  }

  function validateCurrentPage() {
    let sources = {};
    let items = [];

    try {
      if (typeof SOURCES !== 'undefined') sources = SOURCES;
      if (typeof ISSUES !== 'undefined') items = ISSUES;
      else if (typeof CARDS !== 'undefined') items = CARDS;
    } catch {
      return [];
    }

    const errors = validateDataset({ sources, items });
    if (errors.length && typeof console !== 'undefined' && typeof console.error === 'function') {
      console.error('[briefing:data-validator]', errors);
    }
    return errors;
  }

  window.BRIEFING_VALIDATION = Object.freeze({
    prohibitedOpinionPatterns: Object.freeze([...PROHIBITED_OPINION_PATTERNS]),
    validateSource,
    validateOpinion,
    validateBriefingItem,
    validateDataset,
    validateCurrentPage,
  });

  if (typeof document !== 'undefined') {
    document.addEventListener('DOMContentLoaded', validateCurrentPage, { once: true });
  }
})();
