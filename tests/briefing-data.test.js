const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');

function runBrowserScript(file, context) {
  const code = fs.readFileSync(path.join(root, file), 'utf8');
  vm.runInContext(code, context, { filename: file });
}

function loadDatasetAndValidator() {
  const context = vm.createContext({
    window: {},
    console: { error() {} },
  });

  runBrowserScript('data/briefing-data.js', context);
  runBrowserScript('data-validator.js', context);

  return {
    data: context.window.BRIEFING_DATA,
    validator: context.window.BRIEFING_VALIDATION,
  };
}

test('canonical briefing dataset has the expected top-level collections', () => {
  const { data } = loadDatasetAndValidator();

  assert.ok(data && typeof data === 'object');
  assert.ok(data.terms && typeof data.terms === 'object');
  assert.ok(data.sources && typeof data.sources === 'object');
  assert.ok(Array.isArray(data.issues));
  assert.ok(Array.isArray(data.cards));

  assert.ok(Object.keys(data.terms).length > 0);
  assert.ok(Object.keys(data.sources).length > 0);
  assert.ok(data.issues.length > 0);
  assert.ok(data.cards.length > 0);
});

test('canonical issues and cards pass the briefing validator', () => {
  const { data, validator } = loadDatasetAndValidator();

  const issueErrors = validator.validateDataset({
    sources: data.sources,
    items: data.issues,
  });
  const cardErrors = validator.validateDataset({
    sources: data.sources,
    items: data.cards,
  });

  assert.equal(issueErrors.length, 0, issueErrors.join('\n'));
  assert.equal(cardErrors.length, 0, cardErrors.join('\n'));
});

test('every referenced source exists and issue ids are unique', () => {
  const { data } = loadDatasetAndValidator();
  const sourceKeys = new Set(Object.keys(data.sources));

  [...data.issues, ...data.cards].forEach((item) => {
    assert.ok(Array.isArray(item.sources) && item.sources.length > 0);
    item.sources.forEach((key) => assert.ok(sourceKeys.has(key), `missing source: ${key}`));
  });

  const issueIds = data.issues.map((issue) => issue.id);
  assert.equal(new Set(issueIds).size, issueIds.length);
});
