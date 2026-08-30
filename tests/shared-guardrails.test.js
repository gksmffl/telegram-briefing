const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const read = (name) => fs.readFileSync(path.join(root, name), 'utf8');

class FakeStorage {
  constructor(initial = {}) {
    this.data = new Map(Object.entries(initial));
  }
  getItem(key) { return this.data.has(String(key)) ? this.data.get(String(key)) : null; }
  setItem(key, value) { this.data.set(String(key), String(value)); }
  removeItem(key) { this.data.delete(String(key)); }
}

test('shared storage migrates and mirrors feedback across nb and nb2 keys', () => {
  const localStorage = new FakeStorage({
    'nb:up': JSON.stringify(['term-a']),
    'nb2:up': JSON.stringify(['term-b']),
    'nb:down': JSON.stringify(['term-c']),
  });
  const window = { localStorage };
  const context = vm.createContext({ window, Storage: FakeStorage, JSON, Set, String, Array });

  vm.runInContext(read('shared-storage.js'), context, { filename: 'shared-storage.js' });

  assert.deepEqual(JSON.parse(localStorage.getItem('nb:up')).sort(), ['term-a', 'term-b']);
  assert.deepEqual(JSON.parse(localStorage.getItem('nb2:up')).sort(), ['term-a', 'term-b']);
  assert.deepEqual(JSON.parse(localStorage.getItem('briefing:feedback:up:v1')).sort(), ['term-a', 'term-b']);

  localStorage.setItem('nb2:down', JSON.stringify(['term-x']));
  assert.equal(localStorage.getItem('nb:down'), JSON.stringify(['term-x']));
  assert.equal(localStorage.getItem('briefing:feedback:down:v1'), JSON.stringify(['term-x']));

  localStorage.removeItem('nb:up');
  assert.equal(localStorage.getItem('nb:up'), null);
  assert.equal(localStorage.getItem('nb2:up'), null);
  assert.equal(localStorage.getItem('briefing:feedback:up:v1'), null);
});

test('data validator accepts a grounded, non-advisory briefing item', () => {
  const window = {};
  const context = vm.createContext({ window, console, document: undefined, Object, Array, Number, String, RegExp, Set });
  vm.runInContext(read('data-validator.js'), context, { filename: 'data-validator.js' });

  const errors = window.BRIEFING_VALIDATION.validateDataset({
    sources: {
      'foo/1': { ch: 'foo', id: 1, at: '8/19 10:00', text: 'source text' },
    },
    items: [{
      id: 'item-1',
      title: '테스트 이슈',
      metric: { value: '+1.0%', dir: 'up', sub: '테스트 지표' },
      facts: ['원문에 있는 사실'],
      imp: 2,
      sources: ['foo/1'],
      notes: ['배경 설명'],
      opinion: '이 변화는 시장의 관심 포인트를 보여줘요.',
    }],
  });

  assert.deepEqual(Array.from(errors), []);
});

test('data validator catches missing sources and investment-judgement phrasing', () => {
  const window = {};
  const context = vm.createContext({ window, console, document: undefined, Object, Array, Number, String, RegExp, Set });
  vm.runInContext(read('data-validator.js'), context, { filename: 'data-validator.js' });

  const errors = Array.from(window.BRIEFING_VALIDATION.validateDataset({
    sources: {},
    items: [{
      title: '잘못된 이슈',
      metric: { value: '1', dir: 'flat', sub: 'x' },
      facts: ['사실'],
      imp: 4,
      sources: ['missing/99'],
      notes: [],
      opinion: '이 종목은 유망하니 매수하는 것이 좋습니다.',
    }],
  }));

  assert.ok(errors.some((error) => error.includes('imp must be an integer from 1 to 3')));
  assert.ok(errors.some((error) => error.includes('missing source missing/99')));
  assert.ok(errors.some((error) => error.includes('prohibited investment-judgement phrase')));
});
