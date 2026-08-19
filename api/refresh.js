const channels = require('../data/channels.js');

const MAX_MESSAGES = 40;
const OPENAI_URL = 'https://api.openai.com/v1/responses';
const DEFAULT_MODEL = 'gpt-5.6-luna';

const OUTPUT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['items'],
  properties: {
    items: {
      type: 'array',
      maxItems: 8,
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['id', 'region', 'cat', 'imp', 'tag', 'short', 'title', 'metric', 'facts', 'note', 'sources', 'terms', 'notes', 'opinion'],
        properties: {
          id: { type: 'string', minLength: 1 },
          region: { type: 'string', enum: ['us', 'kr', 'cn', 'jp'] },
          cat: { type: 'string', enum: ['rate', 'fx', 'stock', 'corp'] },
          imp: { type: 'integer', minimum: 1, maximum: 3 },
          tag: { type: 'string', minLength: 1 },
          short: { type: 'string', minLength: 1 },
          title: { type: 'string', minLength: 1 },
          metric: {
            type: 'object',
            additionalProperties: false,
            required: ['value', 'dir', 'sub'],
            properties: {
              value: { type: 'string', minLength: 1 },
              dir: { type: 'string', enum: ['up', 'down', 'flat', 'none'] },
              sub: { type: 'string', minLength: 1 },
            },
          },
          facts: { type: 'array', minItems: 1, items: { type: 'string', minLength: 1 } },
          note: { type: 'string' },
          sources: { type: 'array', minItems: 1, uniqueItems: true, items: { type: 'string', minLength: 1 } },
          terms: {
            type: 'array',
            items: {
              type: 'object',
              additionalProperties: false,
              required: ['id', 'name', 'full', 'desc'],
              properties: {
                id: { type: 'string', minLength: 1 },
                name: { type: 'string', minLength: 1 },
                full: { type: 'string', minLength: 1 },
                desc: { type: 'string', minLength: 1 },
              },
            },
          },
          notes: { type: 'array', items: { type: 'string', minLength: 1 } },
          opinion: { type: 'string', minLength: 1 },
        },
      },
    },
  },
};

function json(res, status, body) {
  res.statusCode = status;
  res.setHeader('content-type', 'application/json; charset=utf-8');
  res.setHeader('cache-control', 'no-store');
  res.end(JSON.stringify(body));
}

function parseBody(req) {
  if (req.body && typeof req.body === 'object') return Promise.resolve(req.body);
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', (chunk) => {
      raw += chunk;
      if (raw.length > 250_000) reject(new Error('request body too large'));
    });
    req.on('end', () => {
      if (!raw) return resolve({});
      try { resolve(JSON.parse(raw)); } catch { reject(new Error('invalid JSON body')); }
    });
    req.on('error', reject);
  });
}

function decodeHtml(value) {
  const named = {
    amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ',
  };
  return String(value || '')
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&([a-z]+);/gi, (all, name) => named[name.toLowerCase()] ?? all);
}

function stripHtml(value) {
  return decodeHtml(
    String(value || '')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/p>/gi, '\n')
      .replace(/<[^>]+>/g, ''),
  )
    .replace(/\r/g, '')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function parseTelegramPreview(html, channelId) {
  const marker = new RegExp(`data-post="${channelId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\/(\\d+)"`, 'g');
  const matches = [];
  let match = marker.exec(html);
  while (match) {
    matches.push({ id: Number(match[1]), start: match.index });
    match = marker.exec(html);
  }

  return matches.map((entry, index) => {
    const end = index + 1 < matches.length ? matches[index + 1].start : html.length;
    const block = html.slice(entry.start, end);
    const textMatch = block.match(/<div class="tgme_widget_message_text[^>]*>([\s\S]*?)<\/div>/i);
    const timeMatch = block.match(/<time[^>]+datetime="([^"]+)"/i);
    const text = stripHtml(textMatch ? textMatch[1] : '');
    return {
      key: `${channelId}/${entry.id}`,
      ch: channelId,
      id: entry.id,
      at: timeMatch ? timeMatch[1] : new Date().toISOString(),
      text,
    };
  }).filter((message) => message.text.length >= 20);
}

async function fetchChannel(channel, cursor, fetchImpl = fetch) {
  const url = `https://t.me/s/${channel.id}`;
  const response = await fetchImpl(url, {
    headers: {
      'user-agent': 'Mozilla/5.0 TelegramBriefing/1.0',
      accept: 'text/html,application/xhtml+xml',
    },
  });
  if (!response.ok) throw new Error(`Telegram ${response.status}`);
  const html = await response.text();
  const messages = parseTelegramPreview(html, channel.id);
  const maxId = messages.reduce((max, message) => Math.max(max, message.id), cursor || 0);
  const fresh = messages.filter((message) => message.id > cursor).sort((a, b) => a.id - b.id);
  return { fresh, maxId };
}

function sourceMap(messages) {
  return Object.fromEntries(messages.map((message) => [message.key, {
    ch: message.ch,
    id: message.id,
    at: message.at,
    text: message.text,
  }]));
}

function extractOutputText(response) {
  if (typeof response.output_text === 'string' && response.output_text.trim()) return response.output_text;
  const chunks = [];
  for (const item of response.output || []) {
    if (item.type !== 'message') continue;
    for (const content of item.content || []) {
      if (content.type === 'output_text' && typeof content.text === 'string') chunks.push(content.text);
    }
  }
  return chunks.join('\n');
}

async function generateItems(messages, existingItems, fetchImpl = fetch) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return { configured: false, items: [] };

  const compactExisting = (Array.isArray(existingItems) ? existingItems : []).slice(-30).map((item) => ({
    id: item.id,
    title: item.title,
    region: item.region,
    cat: item.cat,
  }));

  const input = [
    '다음은 금융시장 텔레그램 채널에서 새로 수집한 원문이다.',
    '같은 사건을 다룬 메시지는 하나의 이슈로 묶고 중요하지 않은 잡음은 제외한다.',
    '반드시 한국어로 작성한다.',
    'facts는 제공된 원문에 직접 있는 내용만 쓴다. 없는 숫자나 사실을 만들지 않는다.',
    'terms/notes는 개념과 배경 설명만 하며 전망을 만들지 않는다.',
    'opinion은 왜 중요한지 해석하되 매수·매도·추천·목표주가 등 투자판단을 하지 않는다.',
    'facts/notes/opinion에서 강조가 필요하면 <b>...</b>만 사용할 수 있다.',
    'sources에는 아래 SOURCE_KEY 중 실제 근거로 사용한 키만 넣는다.',
    '기존 생성 이슈와 같은 사건의 후속 내용이면 가능하면 기존 id를 유지한다.',
    '',
    `기존 생성 이슈: ${JSON.stringify(compactExisting)}`,
    '',
    '새 원문:',
    ...messages.map((message) => `SOURCE_KEY=${message.key}\n${message.text}`),
  ].join('\n\n');

  const response = await fetchImpl(OPENAI_URL, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${apiKey}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL || DEFAULT_MODEL,
      input,
      text: {
        format: {
          type: 'json_schema',
          name: 'telegram_briefing_refresh',
          strict: true,
          schema: OUTPUT_SCHEMA,
        },
      },
    }),
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`OpenAI ${response.status}: ${detail.slice(0, 300)}`);
  }

  const payload = await response.json();
  const text = extractOutputText(payload);
  if (!text) throw new Error('OpenAI response did not contain structured output');
  const parsed = JSON.parse(text);
  const allowedSources = new Set(messages.map((message) => message.key));
  const items = Array.isArray(parsed.items) ? parsed.items : [];

  items.forEach((item) => {
    item.sources.forEach((key) => {
      if (!allowedSources.has(key)) throw new Error(`generated item referenced unknown source ${key}`);
    });
  });

  return { configured: true, items };
}

async function handler(req, res) {
  if (req.method !== 'POST') return json(res, 405, { error: 'POST required' });

  try {
    const body = await parseBody(req);
    const cursors = body.cursors && typeof body.cursors === 'object' ? body.cursors : {};
    const rows = [];
    const allFresh = [];
    const candidateCursors = {};

    for (const channel of channels) {
      const cursor = Math.max(channel.last, Number(cursors[channel.id]) || 0);
      try {
        const result = await fetchChannel(channel, cursor);
        const fresh = result.fresh.slice(-MAX_MESSAGES);
        allFresh.push(...fresh);
        candidateCursors[channel.id] = result.maxId;
        rows.push({
          id: channel.id,
          name: channel.name,
          ok: true,
          count: fresh.length,
          preview: fresh.length ? fresh[fresh.length - 1].text.slice(0, 300) : '',
        });
      } catch (error) {
        candidateCursors[channel.id] = cursor;
        rows.push({ id: channel.id, name: channel.name, ok: false, count: 0, preview: '', error: error.message });
      }
    }

    const limitedFresh = allFresh
      .sort((a, b) => a.at.localeCompare(b.at) || a.id - b.id)
      .slice(-MAX_MESSAGES);

    if (limitedFresh.length === 0) {
      return json(res, 200, {
        ok: true,
        processed: true,
        llmConfigured: Boolean(process.env.OPENAI_API_KEY),
        rows,
        cursors: candidateCursors,
        sources: {},
        items: [],
      });
    }

    const generated = await generateItems(limitedFresh, body.existingItems);
    if (!generated.configured) {
      return json(res, 200, {
        ok: true,
        processed: false,
        llmConfigured: false,
        reason: 'OPENAI_API_KEY is not configured',
        rows,
        cursors,
        candidateCursors,
        sources: sourceMap(limitedFresh),
        items: [],
      });
    }

    return json(res, 200, {
      ok: true,
      processed: true,
      llmConfigured: true,
      rows,
      cursors: candidateCursors,
      sources: sourceMap(limitedFresh),
      items: generated.items,
    });
  } catch (error) {
    return json(res, 500, { ok: false, error: error && error.message ? error.message : 'refresh failed' });
  }
}

module.exports = handler;
module.exports._test = {
  decodeHtml,
  stripHtml,
  parseTelegramPreview,
  fetchChannel,
  sourceMap,
  extractOutputText,
  OUTPUT_SCHEMA,
};
