/* Briefing data contract and validator.
 *
 * The JSON schema in schemas/briefing-item.schema.json documents the generated-card
 * contract. This browser-safe validator enforces the same product rules plus source
 * grounding and investment-opinion guardrails before generated content reaches UI.
 */
(() => {
  'use strict';

  const SCHEMA_VERSION = '1.0.0';
  const REGIONS = Object.freeze(['us', 'kr', 'cn', 'jp']);
  const CATEGORIES = Object.freeze(['rate', 'fx', 'stock', 'corp']);
  const DIRECTIONS = Object.freeze(['up', 'down', 'flat']);
  const SOURCE_KEY = /^[A-Za-z0-9_]+\/\d+$/;
  const UNSAFE_HTML = /<(?!\/?b\s*>)[^>]+>/i;

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

  function validateRichText(text, label) {
    if (!isNonEmptyString(text)) return [`${label}: non-empty text required`];
    return UNSAFE_HTML.test(text) ? [`${label}: only <b> rich text is allowed`] : [];
  }

  function validateSource(source, key) {
    const errors = [];
    if (!SOURCE_KEY.test(String(key))) errors.push(`source ${key}: key must be channel/messageId`);
    if (!source || typeof source !== 'object') return [...errors, `source ${key}: object required`];
    if (!isNonEmptyString(source.ch)) errors.push(`source ${key}: ch required`);
    if (!Number.isInteger(source.id) || source.id <= 0) errors.push(`source ${key}: positive integer id required`);
    if (!isNonEmptyString(source.at)) errors.push(`source ${key}: at required`);
    if (!isNonEmptyString(source.text)) errors.push(`source ${key}: text required`);
    if (isNonEmptyString(source.ch) && Number.isInteger(source.id) && `${source.ch}/${source.id}` !== key) {
      errors.push(`source ${key}: key must match ch/id`);
    }
    return errors;
  }

  function validateOpinion(text, label) {
    const errors = validateRichText(text, `${label}: opinion`);
    if (!isNonEmptyString(text)) return errors;
    return errors.concat(
      PROHIBITED_OPINION_PATTERNS
        .filter((pattern) => pattern.test(text))
        .map((pattern) => `${label}: prohibited investment-judgement phrase (${pattern.source})`),
    );
  }

  function validateTerm(term, label) {
    if (typeof term === 'string') {
      return isNonEmptyString(term) ? [] : [`${label}: term id required`];
    }
    if (!term || typeof term !== 'object') return [`${label}: term must be id string or object`];
    const errors = [];
    ['id', 'name', 'full', 'desc'].forEach((field) => {
      if (!isNonEmptyString(term[field])) errors.push(`${label}: term.${field} required`);
    });
    return errors;
  }

  function validateBriefingItem(item, index, sources) {
    const label = `item ${item && (item.id || item.short || item.title) || index}`;
    const errors = [];

    if (!item || typeof item !== 'object') return [`${label}: object required`];
    if (!isNonEmptyString(item.title)) errors.push(`${label}: title required`);
    if (item.region !== undefined && !REGIONS.includes(item.region)) errors.push(`${label}: invalid region`);
    if (item.cat !== undefined && !CATEGORIES.includes(item.cat)) errors.push(`${label}: invalid category`);
    if (item.imp !== undefined && (!Number.isInteger(item.imp) || item.imp < 1 || item.imp > 3)) {
      errors.push(`${label}: imp must be an integer from 1 to 3`);
    }

    if (!item.metric || typeof item.metric !== 'object') {
      errors.push(`${label}: metric required`);
    } else {
      if (!isNonEmptyString(item.metric.value) || !isNonEmptyString(item.metric.sub)) {
        errors.push(`${label}: metric.value and metric.sub required`);
      }
      if (!DIRECTIONS.includes(item.metric.dir)) errors.push(`${label}: metric.dir must be up, down, or flat`);
    }

    if (!Array.isArray(item.facts) || item.facts.length === 0) {
      errors.push(`${label}: non-empty facts array required`);
    } else {
      item.facts.forEach((fact, i) => errors.push(...validateRichText(fact, `${label}: facts[${i}]`)));
    }

    if (!Array.isArray(item.sources) || item.sources.length === 0) {
      errors.push(`${label}: at least one source required`);
    } else {
      if (new Set(item.sources).size !== item.sources.length) errors.push(`${label}: duplicate sources are not allowed`);
      item.sources.forEach((sourceKey) => {
        if (!SOURCE_KEY.test(String(sourceKey))) errors.push(`${label}: invalid source key ${sourceKey}`);
        if (sources && typeof sources === 'object' && !sources[sourceKey]) errors.push(`${label}: missing source ${sourceKey}`);
      });
    }

    if (item.terms !== undefined) {
      if (!Array.isArray(item.terms)) errors.push(`${label}: terms array required`);
      else item.terms.forEach((term, i) => errors.push(...validateTerm(term, `${label}: terms[${i}]`)));
    }

    if (!Array.isArray(item.notes)) {
      errors.push(`${label}: notes array required`);
    } else {
      item.notes.forEach((note, i) => errors.push(...validateRichText(note, `${label}: notes[${i}]`)));
    }

    errors.push(...validateOpinion(item.opinion, label));
    return errors;
  }

  function validateGeneratedItem(item, sources = {}) {
    return validateBriefingItem(item, 0, sources);
  }

  function validateDataset({ sources = {}, items = [] } = {}) {
    const errors = [];
    Object.entries(sources).forEach(([key, source]) => errors.push(...validateSource(source, key)));
    if (!Array.isArray(items)) errors.push('items: array required');
    else items.forEach((item, index) => errors.push(...validateBriefingItem(item, index, sources)));
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
    schemaVersion: SCHEMA_VERSION,
    regions: REGIONS,
    categories: CATEGORIES,
    directions: DIRECTIONS,
    prohibitedOpinionPatterns: Object.freeze([...PROHIBITED_OPINION_PATTERNS]),
    validateRichText,
    validateSource,
    validateOpinion,
    validateTerm,
    validateBriefingItem,
    validateGeneratedItem,
    validateDataset,
    validateCurrentPage,
  });

  if (typeof document !== 'undefined') {
    document.addEventListener('DOMContentLoaded', validateCurrentPage, { once: true });
  }
})();
