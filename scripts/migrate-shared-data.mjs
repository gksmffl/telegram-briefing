import fs from 'node:fs';
import vm from 'node:vm';

const ROOT_APP = 'app.js';
const MAP_APP = 'v1-map/app.js';
const ROOT_HTML = 'index.html';
const MAP_HTML = 'v1-map/index.html';
const DATA_FILE = 'data/briefing-data.js';

function read(file) {
  return fs.readFileSync(file, 'utf8');
}

function write(file, content) {
  fs.writeFileSync(file, content.replace(/\r\n/g, '\n'));
}

function scanExpression(source, start) {
  let quote = null;
  let escaped = false;
  let lineComment = false;
  let blockComment = false;
  let paren = 0;
  let bracket = 0;
  let brace = 0;

  for (let i = start; i < source.length; i += 1) {
    const ch = source[i];
    const next = source[i + 1];

    if (lineComment) {
      if (ch === '\n') lineComment = false;
      continue;
    }
    if (blockComment) {
      if (ch === '*' && next === '/') {
        blockComment = false;
        i += 1;
      }
      continue;
    }
    if (quote) {
      if (escaped) {
        escaped = false;
        continue;
      }
      if (ch === '\\') {
        escaped = true;
        continue;
      }
      if (ch === quote) quote = null;
      continue;
    }

    if (ch === '/' && next === '/') {
      lineComment = true;
      i += 1;
      continue;
    }
    if (ch === '/' && next === '*') {
      blockComment = true;
      i += 1;
      continue;
    }
    if (ch === "'" || ch === '"' || ch === '`') {
      quote = ch;
      continue;
    }

    if (ch === '(') paren += 1;
    else if (ch === ')') paren -= 1;
    else if (ch === '[') bracket += 1;
    else if (ch === ']') bracket -= 1;
    else if (ch === '{') brace += 1;
    else if (ch === '}') brace -= 1;
    else if (ch === ';' && paren === 0 && bracket === 0 && brace === 0) return i;
  }

  throw new Error('Could not find declaration terminator');
}

function extractConst(source, name) {
  const marker = `const ${name} =`;
  const start = source.indexOf(marker);
  if (start < 0) throw new Error(`Missing ${marker}`);

  const exprStart = start + marker.length;
  const end = scanExpression(source, exprStart);
  const expression = source.slice(exprStart, end).trim();

  return { start, end: end + 1, expression };
}

function evaluateLiteral(expression, label) {
  try {
    return vm.runInNewContext(`(${expression})`, Object.create(null), { timeout: 1000 });
  } catch (error) {
    throw new Error(`Failed to evaluate ${label}: ${error.message}`);
  }
}

function replaceConst(source, name, replacement) {
  const declaration = extractConst(source, name);
  return source.slice(0, declaration.start)
    + `const ${name} = ${replacement};`
    + source.slice(declaration.end);
}

function stableJson(value) {
  return JSON.stringify(value, null, 2);
}

function sameIdentity(a, b) {
  return a && b && a.ch === b.ch && a.id === b.id && a.at === b.at;
}

function mergeSourceVersions(a, b, key) {
  if (!sameIdentity(a, b)) {
    throw new Error(`Source ${key} identity differs between globe and map/card data`);
  }

  const aText = typeof a.text === 'string' ? a.text : '';
  const bText = typeof b.text === 'string' ? b.text : '';
  const preferred = bText.length > aText.length ? b : a;

  return {
    ...preferred,
    ch: a.ch,
    id: a.id,
    at: a.at,
    text: bText.length > aText.length ? bText : aText,
    ...(a.truncated || b.truncated ? { truncated: true } : {}),
  };
}

function mergeSources(primary, secondary) {
  const merged = { ...primary };
  for (const [key, value] of Object.entries(secondary)) {
    if (!(key in merged)) {
      merged[key] = value;
      continue;
    }
    merged[key] = mergeSourceVersions(merged[key], value, key);
  }
  return merged;
}

function insertScriptBefore(html, beforeSrc, scriptTag) {
  if (html.includes(scriptTag)) return html;
  const before = `<script src="${beforeSrc}"></script>`;
  if (!html.includes(before)) throw new Error(`Could not find script anchor ${before}`);
  return html.replace(before, `${scriptTag}\n${before}`);
}

function insertScriptAfter(html, afterSrc, scriptTag) {
  if (html.includes(scriptTag)) return html;
  const after = `<script src="${afterSrc}"></script>`;
  if (!html.includes(after)) throw new Error(`Could not find script anchor ${after}`);
  return html.replace(after, `${after}\n${scriptTag}`);
}

const rootSource = read(ROOT_APP);
const mapSource = read(MAP_APP);

const terms = evaluateLiteral(extractConst(rootSource, 'TERMS').expression, 'TERMS');
const rootSources = evaluateLiteral(extractConst(rootSource, 'SOURCES').expression, 'root SOURCES');
const mapSources = evaluateLiteral(extractConst(mapSource, 'SOURCES').expression, 'map SOURCES');
const issues = evaluateLiteral(extractConst(rootSource, 'ISSUES').expression, 'ISSUES');
const cards = evaluateLiteral(extractConst(mapSource, 'CARDS').expression, 'CARDS');
const sources = mergeSources(rootSources, mapSources);

const dataModule = `/* Canonical static briefing dataset.\n * Generated from the legacy inline prototype data by scripts/migrate-shared-data.mjs.\n * Edit briefing content here going forward; both views consume this same module.\n */\n(() => {\n  'use strict';\n\n  const data = ${stableJson({ terms, sources, issues, cards })};\n\n  window.BRIEFING_DATA = Object.freeze({\n    terms: data.terms,\n    sources: data.sources,\n    issues: data.issues,\n    cards: data.cards,\n  });\n})();\n`;

let nextRoot = rootSource;
nextRoot = replaceConst(nextRoot, 'TERMS', 'window.BRIEFING_DATA.terms');
nextRoot = replaceConst(nextRoot, 'SOURCES', 'window.BRIEFING_DATA.sources');
nextRoot = replaceConst(nextRoot, 'ISSUES', 'window.BRIEFING_DATA.issues');

let nextMap = mapSource;
nextMap = replaceConst(nextMap, 'SOURCES', 'window.BRIEFING_DATA.sources');
nextMap = replaceConst(nextMap, 'CARDS', 'window.BRIEFING_DATA.cards');

let rootHtml = read(ROOT_HTML);
rootHtml = insertScriptBefore(rootHtml, 'app.js', '<script src="data/briefing-data.js"></script>');
rootHtml = insertScriptAfter(rootHtml, 'phase1-hardening.js', '<script src="data-validator.js"></script>');

let mapHtml = read(MAP_HTML);
mapHtml = insertScriptBefore(mapHtml, 'app.js', '<script src="../data/briefing-data.js"></script>');
mapHtml = insertScriptAfter(mapHtml, '../phase1-hardening.js', '<script src="../data-validator.js"></script>');

write(DATA_FILE, dataModule);
write(ROOT_APP, nextRoot);
write(MAP_APP, nextMap);
write(ROOT_HTML, rootHtml);
write(MAP_HTML, mapHtml);

console.log(JSON.stringify({
  terms: Object.keys(terms).length,
  sources: Object.keys(sources).length,
  issues: issues.length,
  cards: cards.length,
}, null, 2));
