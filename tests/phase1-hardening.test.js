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

test('safe renderer preserves only <b> markup for HTML elements', () => {
  class FakeElement {
    constructor(namespaceURI = 'http://www.w3.org/1999/xhtml') {
      this.namespaceURI = namespaceURI;
      this._html = '';
    }
  }
  Object.defineProperty(FakeElement.prototype, 'innerHTML', {
    configurable: true,
    enumerable: true,
    get() { return this._html; },
    set(value) { this._html = String(value); },
  });

  const window = {};
  const context = vm.createContext({ window, Element: FakeElement });
  vm.runInContext(read('safe-render.js'), context, { filename: 'safe-render.js' });

  const input = '<img src=x onerror=alert(1)><b>kept</b><i>escaped</i>';
  const html = new FakeElement();
  html.innerHTML = input;

  assert.equal(
    html.innerHTML,
    '&lt;img src=x onerror=alert(1)&gt;<b>kept</b>&lt;i&gt;escaped&lt;/i&gt;',
  );

  const svg = new FakeElement('http://www.w3.org/2000/svg');
  svg.innerHTML = '<path d="M0 0L1 1" />';
  assert.equal(svg.innerHTML, '<path d="M0 0L1 1" />');
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
    }
  `, context);

  vm.runInContext(read('phase1-hardening.js'), context, { filename: 'phase1-hardening.js' });
  await vm.runInContext('refresh()', context);

  assert.equal(window.cursorAtRefreshStart, 11);
  assert.equal(window.cursorAfterFetchBeforeCommit, 11);
  assert.equal(vm.runInContext('CHANNELS[0].last', context), 13);

  const saved = JSON.parse(storage.getItem('briefing:telegram-cursors:v1'));
  assert.equal(saved.foo, 13);
});
