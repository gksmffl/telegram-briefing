const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');

function read(name) {
  return fs.readFileSync(path.join(root, name), 'utf8');
}

function memoryStorage(initial = {}) {
  const data = new Map(Object.entries(initial));
  return {
    getItem(key) { return data.has(key) ? data.get(key) : null; },
    setItem(key, value) { data.set(key, String(value)); },
    removeItem(key) { data.delete(key); },
    dump() { return Object.fromEntries(data); },
  };
}

test('explicit rich-text renderer allows only <b> emphasis', () => {
  const document = {
    createDocumentFragment() {
      return { children: [], appendChild(node) { this.children.push(node); } };
    },
    createElement(tag) {
      return { tag, textContent: '', children: [] };
    },
    createTextNode(text) { return { text }; },
  };
  const window = {};
  const context = vm.createContext({ window, document, String, Object, RegExp, TypeError });
  vm.runInContext(read('safe-render.js'), context, { filename: 'safe-render.js' });

  const target = {
    children: [],
    replaceChildren(fragment) { this.children = fragment.children; },
  };
  const input = '<img src=x onerror=alert(1)><b>kept</b><i>literal</i>';
  window.BRIEFING_SAFE_RENDER.renderRichText(target, input);

  assert.deepEqual(target.children, [
    { text: '<img src=x onerror=alert(1)>' },
    { tag: 'b', textContent: 'kept', children: [] },
    { text: '<i>literal</i>' },
  ]);

  assert.deepEqual(
    JSON.parse(JSON.stringify(window.BRIEFING_SAFE_RENDER.tokenizeBold('a<b>b</b>c'))),
    [
      { text: 'a', bold: false },
      { text: 'b', bold: true },
      { text: 'c', bold: false },
    ],
  );
});

test('application scripts contain no innerHTML assignment sinks', () => {
  assert.doesNotMatch(read('app.js'), /\.innerHTML\s*=/);
  assert.doesNotMatch(read('v1-map/app.js'), /\.innerHTML\s*=/);
});

test('shared channels and stored cursor are applied before refresh', () => {
  const storage = memoryStorage({
    'briefing:telegram-cursors:v1': JSON.stringify({ foo: 11 }),
  });

  const responseText = [
    'https://t.me/foo/12',
    'https://t.me/foo/13',
    'https://t.me/foo/13',
  ].join('\n');

  const window = {
    BRIEFING_CHANNELS: [{ id: 'foo', name: 'Foo Research', last: 10 }],
    fetch: async () => ({
      ok: true,
      clone() {
        return { text: async () => responseText };
      },
    }),
  };

  const context = vm.createContext({
    window,
    localStorage: storage,
    Map,
    Number,
    Array,
    String,
    RegExp,
    JSON,
  });

  vm.runInContext(`
    const CHANNELS = [{ id: 'legacy', last: 1 }];
    async function refresh() {
      window.cursorAtRefreshStart = CHANNELS[0].last;
      await window.fetch('https://r.jina.ai/https://t.me/s/foo');
      window.cursorAfterFetchBeforeCommit = CHANNELS[0].last;
    }
  `, context);

  vm.runInContext(read('phase1-hardening.js'), context, { filename: 'phase1-hardening.js' });

  assert.deepEqual(
    JSON.parse(vm.runInContext('JSON.stringify(CHANNELS)', context)),
    [{ id: 'foo', name: 'Foo Research', last: 11 }],
  );
});

test('refresh persists newest Telegram id only after the current refresh finishes', async () => {
  const storage = memoryStorage({
    'briefing:telegram-cursors:v1': JSON.stringify({ foo: 11 }),
  });

  const responseText = 'https://t.me/foo/12\nhttps://t.me/foo/13';
  const window = {
    BRIEFING_CHANNELS: [{ id: 'foo', name: 'Foo Research', last: 10 }],
    fetch: async () => ({
      ok: true,
      clone() {
        return { text: async () => responseText };
      },
    }),
  };

  const context = vm.createContext({
    window,
    localStorage: storage,
    Map,
    Number,
    Array,
    String,
    RegExp,
    JSON,
  });

  vm.runInContext(`
    const CHANNELS = [{ id: 'legacy', last: 1 }];
    async function refresh() {
      window.cursorAtRefreshStart = CHANNELS[0].last;
      await window.fetch('https://r.jina.ai/https://t.me/s/foo');
      window.cursorAfterFetchBeforeCommit = CHANNELS[0].last;
      return 'refresh-result';
    }
  `, context);

  vm.runInContext(read('phase1-hardening.js'), context, { filename: 'phase1-hardening.js' });
  const result = await vm.runInContext('refresh()', context);

  assert.equal(result, 'refresh-result');
  assert.equal(window.cursorAtRefreshStart, 11);
  assert.equal(window.cursorAfterFetchBeforeCommit, 11);
  assert.equal(vm.runInContext('CHANNELS[0].last', context), 13);

  const saved = JSON.parse(storage.getItem('briefing:telegram-cursors:v1'));
  assert.equal(saved.foo, 13);
});

test('refresh wrapper does not swallow native refresh errors', async () => {
  const storage = memoryStorage();
  const window = {
    BRIEFING_CHANNELS: [{ id: 'foo', name: 'Foo Research', last: 10 }],
    fetch: async () => ({ ok: false }),
  };

  const context = vm.createContext({
    window,
    localStorage: storage,
    Map,
    Number,
    Array,
    String,
    RegExp,
    JSON,
    Error,
  });

  vm.runInContext(`
    const CHANNELS = [{ id: 'foo', last: 10 }];
    async function refresh() {
      throw new Error('refresh failed');
    }
  `, context);

  vm.runInContext(read('phase1-hardening.js'), context, { filename: 'phase1-hardening.js' });

  await assert.rejects(
    vm.runInContext('refresh()', context),
    /refresh failed/,
  );
});
