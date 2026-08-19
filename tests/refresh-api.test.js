const test = require('node:test');
const assert = require('node:assert/strict');

const refreshApi = require('../api/refresh.js');
const {
  parseTelegramPreview,
  fetchChannel,
  sourceMap,
  extractOutputText,
  geminiUrl,
  geminiRequestBody,
  validateGeneratedItems,
  OUTPUT_SCHEMA,
  DEFAULT_MODEL,
} = refreshApi._test;

test('Telegram preview parser extracts source id, time and readable text', () => {
  const html = `
    <div class="tgme_widget_message" data-post="foo/10">
      <div class="tgme_widget_message_text js-message_text" dir="auto">첫 번째 <b>시장</b> 글<br>내용입니다. 테스트를 위해 충분히 긴 본문을 넣습니다.</div>
      <time datetime="2026-08-19T01:00:00+00:00"></time>
    </div>
    <div class="tgme_widget_message" data-post="foo/11">
      <div class="tgme_widget_message_text js-message_text" dir="auto">두 번째 새 글은 충분히 긴 본문을 포함합니다.</div>
      <time datetime="2026-08-19T02:00:00+00:00"></time>
    </div>`;

  const messages = parseTelegramPreview(html, 'foo');
  assert.equal(messages.length, 2);
  assert.equal(messages[0].key, 'foo/10');
  assert.match(messages[0].text, /첫 번째 시장 글/);
  assert.equal(messages[1].id, 11);
  assert.equal(messages[1].at, '2026-08-19T02:00:00+00:00');
});

test('fetchChannel returns only messages newer than the supplied cursor', async () => {
  const html = `
    <div data-post="foo/10"><div class="tgme_widget_message_text">기존 메시지 본문이 충분히 길게 있습니다.</div></div>
    <div data-post="foo/12"><div class="tgme_widget_message_text">새로운 메시지 본문이 충분히 길게 있습니다.</div></div>`;
  const fakeFetch = async () => ({ ok: true, text: async () => html });
  const result = await fetchChannel({ id: 'foo' }, 10, fakeFetch);
  assert.equal(result.maxId, 12);
  assert.deepEqual(result.fresh.map((message) => message.id), [12]);
});

test('sourceMap keeps exact Telegram source identity', () => {
  const sources = sourceMap([{ key: 'foo/12', ch: 'foo', id: 12, at: 'now', text: 'source text' }]);
  assert.deepEqual(sources['foo/12'], { ch: 'foo', id: 12, at: 'now', text: 'source text' });
});

test('Gemini output text can be extracted from candidate parts', () => {
  const text = extractOutputText({
    candidates: [{ content: { parts: [{ text: '{"items":[]}' }] } }],
  });
  assert.equal(text, '{"items":[]}');
});

test('Gemini request uses JSON structured output with the briefing schema', () => {
  const body = geminiRequestBody('hello');
  assert.equal(DEFAULT_MODEL, 'gemini-3.6-flash');
  assert.match(geminiUrl(), /gemini-3\.6-flash:generateContent$/);
  assert.equal(body.contents[0].parts[0].text, 'hello');
  assert.equal(body.generationConfig.responseFormat.text.mimeType, 'APPLICATION_JSON');
  assert.equal(body.generationConfig.responseFormat.text.schema, OUTPUT_SCHEMA);
  assert.ok(OUTPUT_SCHEMA.properties.items.items.properties.region.enum.includes('eu'));
});

test('LLM output schema stays strict-compatible while server validator enforces the item cap', () => {
  assert.equal(OUTPUT_SCHEMA.additionalProperties, false);
  assert.deepEqual(OUTPUT_SCHEMA.properties.items.items.properties.imp.enum, [1, 2, 3]);
  assert.deepEqual(OUTPUT_SCHEMA.properties.items.items.properties.metric.properties.dir.enum, ['up', 'down', 'flat', 'none']);
  assert.throws(
    () => validateGeneratedItems(Array.from({ length: 9 }, () => ({})), new Set()),
    /exceed 8/,
  );
});
