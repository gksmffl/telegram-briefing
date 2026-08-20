const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const read = (name) => fs.readFileSync(path.join(root, name), 'utf8');

function load() {
  const context = vm.createContext({ window: {}, console: { error() {} }, Object, Array, String, Number, RegExp, Set });
  vm.runInContext(read('data/briefing-data.js'), context, { filename: 'data/briefing-data.js' });
  vm.runInContext(read('data-validator.js'), context, { filename: 'data-validator.js' });
  return {
    data: context.window.BRIEFING_DATA,
    validation: context.window.BRIEFING_VALIDATION,
    schema: JSON.parse(read('schemas/briefing-item.schema.json')),
  };
}

test('schema and runtime validator expose the same core enums', () => {
  const { schema, validation } = load();
  assert.equal(schema.$schema, 'https://json-schema.org/draft/2020-12/schema');
  assert.equal(validation.schemaVersion, '1.0.0');
  assert.deepEqual([...validation.regions], schema.properties.region.enum);
  assert.ok(validation.regions.includes('eu'));
  assert.deepEqual([...validation.categories], schema.properties.cat.enum);
  assert.deepEqual([...validation.directions], schema.properties.metric.properties.dir.enum);
  assert.deepEqual(schema.required, ['title', 'metric', 'facts', 'sources', 'notes', 'opinion']);
});

test('all canonical issues and cards satisfy generated-item contract', () => {
  const { data, validation } = load();
  [...data.issues, ...data.cards].forEach((item) => {
    const errors = validation.validateGeneratedItem(item, data.sources);
    assert.equal(errors.length, 0, `${item.id || item.short || item.title}: ${errors.join('; ')}`);
  });
});

test('generated-item contract rejects invalid enums, missing grounding, unsafe html and advice', () => {
  const { validation } = load();
  const sources = {
    'foo/1': { ch: 'foo', id: 1, at: '8/19 10:00', text: 'source' },
  };
  const bad = {
    region: 'xx',
    cat: 'crypto',
    imp: 4,
    title: 'bad generated card',
    metric: { value: '1', dir: 'sideways', sub: 'bad' },
    facts: ['<script>alert(1)</script>'],
    sources: ['missing/2'],
    terms: [{ id: 'x', name: '', full: 'X', desc: 'desc' }],
    notes: ['note'],
    opinion: '이 종목은 매수하세요',
  };

  const errors = validation.validateGeneratedItem(bad, sources).join('\n');
  assert.match(errors, /invalid region/);
  assert.match(errors, /invalid category/);
  assert.match(errors, /imp must be an integer from 1 to 3/);
  assert.match(errors, /invalid metric.dir/);
  assert.match(errors, /only <b> rich text is allowed/);
  assert.match(errors, /missing source missing\/2/);
  assert.match(errors, /term.name required/);
  assert.match(errors, /prohibited investment-judgement phrase/);
});
