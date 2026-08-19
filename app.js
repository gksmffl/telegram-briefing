/* ============================================================
   텔레그램 브리핑 v2 — 지구본

   흐름: 지구본에서 지역 선택 → (선으로 이어진 팝업) 카테고리 + 헤드라인
         → 카드 클릭 → 원문·개념·배경·의견 (2단계)

   섹션: 1 저장소 · 2 용어 사전 · 3 원문 · 4 이슈 데이터
         5 지역·카테고리 · 6 유틸 · 7 지구본 · 8 패널 · 9 상세
         10 이벤트 · 초기화

   데이터는 2026-08-12~13 실제 텔레그램 공개 채널 메시지에서 가져왔다.
   세 층을 절대 섞지 않는다.
     사실 — 수집한 원문에 있는 내용만
     해설 — AI가 붙인 개념 설명·배경 (전망·판단 금지)
     의견 — AI의 해석 (투자 판단 금지)
   ============================================================ */

/* --- 1. 저장소 ---------------------------------------------- */

const STORE_UP = 'nb2:up';
const STORE_DOWN = 'nb2:down';

/**
 * 원문 새로고침.
 *
 * 텔레그램은 브라우저의 직접 요청에 CORS 헤더를 주지 않아 t.me를 바로 fetch할 수
 * 없다(실측: Failed to fetch). 그래서 r.jina.ai 중계를 거친다. 채널 주소가 그
 * 서비스를 지나간다는 점을 화면에 명시한다.
 *
 * last: 아래 이슈 카드들이 참조한 시점의 마지막 글 번호. 이보다 큰 번호가 새 글이다.
 */
const PROXY = 'https://r.jina.ai/';
const SNAPSHOT_AT = '8/13 14:00';

const CHANNELS = [
  { id: 'yieldnspread', name: 'YIELD & SPREAD', last: 6451 },
  { id: 'deandatbond', name: '[하나증권 해외채권] 허성우', last: 1830 },
  { id: 'hanwhastrategy', name: '한화투자증권 투자전략팀', last: 28941 },
  { id: 'redbirdstock', name: '레드버드 기업분석', last: 8759 },
  { id: 'daishinstrategy', name: '대신 전략. 돌직구', last: 6213 },
  { id: 'aetherjapanresearch', name: '에테르의 일본&미국 리서치', last: 24551 },
  // 이 채널은 아직 어떤 이슈 카드에도 쓰이지 않았다. 0으로 두면 전부 새 글로 세므로
  // 스냅샷 시점의 마지막 글 번호를 실측해 넣었다.
  { id: 'rafikiresearch', name: 'Rafiki research', last: 24303 },
];

function loadSet(key) {
  try {
    const raw = localStorage.getItem(key);
    const v = raw === null ? [] : JSON.parse(raw);
    return new Set(Array.isArray(v) ? v : []);
  } catch {
    return new Set();   // 손상된 값은 빈 상태로
  }
}

function saveSet(key, set) {
  try {
    localStorage.setItem(key, JSON.stringify([...set]));
  } catch {
    toast('설정을 저장하지 못했어요. 시크릿 모드에서는 저장이 제한돼요.');
  }
}

/* --- 2. 용어 사전 (해설) ------------------------------------ */

const TERMS = window.BRIEFING_DATA.terms;

/* --- 3. 원문 데이터 ----------------------------------------- */

const SOURCES = window.BRIEFING_DATA.sources;

/* --- 4. 이슈 데이터 ----------------------------------------- */

/** imp: 3 상 · 2 중 · 1 하. 카드 높이와 정렬에 쓴다. */
const ISSUES = window.BRIEFING_DATA.issues;

/* --- 5. 지역 · 카테고리 ------------------------------------- */

const REGIONS = [
  { id: 'us', name: '미국', en: 'UNITED STATES', lat: 39, lon: -98 },
  { id: 'kr', name: '한국', en: 'KOREA', lat: 36.5, lon: 127.8 },
  { id: 'cn', name: '중국', en: 'CHINA', lat: 35, lon: 105 },
  { id: 'jp', name: '일본', en: 'JAPAN', lat: 36, lon: 138 },
];

const CATS = [
  { id: 'rate', name: '금리·채권' },
  { id: 'fx', name: '환율·원자재' },
  { id: 'stock', name: '주식·시황' },
  { id: 'corp', name: '기업·실적' },
];

/**
 * 대륙 윤곽 — 실제 지형이 아니라 제가 좌표를 넣은 단순화 근사다.
 * tone은 NASA 블루마블 사진의 색조를 따라 대륙별로 다르게 칠하기 위한 값이다.
 */
const LAND = [
  { tone: 'temperate', pts: [[-168, 65], [-155, 58], [-130, 55], [-125, 48], [-120, 35], [-110, 23], [-97, 16],
    [-90, 20], [-82, 23], [-80, 32], [-70, 44], [-60, 47], [-55, 52], [-65, 60],
    [-80, 70], [-95, 72], [-125, 70], [-140, 70], [-155, 71]] },
  { tone: 'tropical', pts: [[-80, 8], [-70, 10], [-60, 5], [-50, 0], [-35, -8], [-38, -22], [-48, -25],
    [-58, -35], [-62, -42], [-70, -52], [-75, -45], [-72, -35], [-70, -20], [-78, -8], [-80, 0]] },
  { tone: 'desert', pts: [[-17, 15], [-10, 22], [0, 32], [10, 35], [25, 32], [35, 25], [43, 12], [51, 12],
    [48, 0], [40, -12], [35, -22], [25, -34], [18, -34], [12, -18], [8, 4], [-5, 5], [-10, 10]] },
  { tone: 'temperate', pts: [[-10, 36], [0, 40], [10, 45], [20, 40], [28, 37], [35, 37], [45, 40], [50, 45],
    [60, 45], [75, 40], [90, 25], [100, 20], [105, 10], [110, 20], [120, 32], [125, 40],
    [130, 45], [140, 50], [155, 60], [170, 65], [180, 68], [160, 70], [140, 72],
    [120, 75], [100, 77], [80, 75], [60, 70], [40, 68], [30, 70], [20, 70], [10, 60],
    [5, 58], [0, 55], [-5, 50], [-8, 44]] },
  { tone: 'desert', pts: [[113, -22], [122, -18], [130, -12], [137, -12], [143, -11], [147, -19], [153, -25],
    [150, -37], [140, -38], [130, -32], [118, -34], [114, -28]] },
  { tone: 'ice', pts: [[-45, 60], [-30, 68], [-25, 75], [-35, 82], [-55, 82], [-70, 78], [-58, 68]] },
  { tone: 'temperate', pts: [[129, 35], [130, 38], [128, 41], [126, 38], [126, 35]] },
  { tone: 'temperate', pts: [[130, 32], [136, 34], [141, 40], [141, 45], [138, 37], [133, 34]] },
];

/* 블루마블 사진에서 고른 대륙 색조 */
const LAND_TONE = {
  temperate: { fill: 'rgba(104, 138, 92, .82)', line: 'rgba(150, 186, 132, .5)' },
  tropical: { fill: 'rgba(74, 126, 74, .84)', line: 'rgba(128, 180, 122, .5)' },
  desert: { fill: 'rgba(168, 142, 96, .84)', line: 'rgba(206, 182, 138, .5)' },
  ice: { fill: 'rgba(226, 234, 242, .86)', line: 'rgba(245, 250, 255, .6)' },
};

/* --- 6. 상태 · 유틸 ----------------------------------------- */

const state = {
  up: loadSet(STORE_UP),
  down: loadSet(STORE_DOWN),
  region: null,
  cat: null,
  issue: null,
  lon0: -40,        // 지구본 회전 각
  vel: 0,           // 끌었을 때 남는 관성
  target: null,     // 특정 지역을 앞으로 돌릴 때의 목표 각
  autoSpin: true,
  link: null,       // 팝업으로 이어지는 선의 접점
  refreshing: false,
  raf: 0,
};

/** 마우스로 끌어서 돌리기 */
const drag = { on: false, lastX: 0, moved: 0, id: null };

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function issuesOf(region, cat) {
  return ISSUES
    .filter((x) => x.region === region && (!cat || x.cat === cat))
    .sort((a, b) => b.imp - a.imp);
}

function catName(id) {
  const c = CATS.find((x) => x.id === id);
  return c ? c.name : id;
}

let toastTimer = null;
function toast(message) {
  const box = document.getElementById('toast');
  box.textContent = message;
  box.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { box.hidden = true; }, 2600);
}

/* --- 7. 지구본 ---------------------------------------------- */

const TILT = 20 * Math.PI / 180;
const D2R = Math.PI / 180;

/**
 * cx·r은 목표값(cxT·rT)으로 부드럽게 따라간다.
 * 지역을 고르면 지구본이 왼쪽으로 물러나 팝업 자리를 만든다.
 * CSS transform이 아니라 캔버스 좌표를 옮기므로 마커와 연결선이 그대로 붙는다.
 */
const globe = {
  cv: null, ctx: null, cx: 0, cy: 0, r: 0, dpr: 1, cxT: 0, rT: 0, w: 0, h: 0,
};

function project(lat, lon, lon0) {
  const base = lon0 === undefined ? state.lon0 : lon0;
  const p = lat * D2R;
  const l = (lon - base) * D2R;
  const cosP = Math.cos(p);
  const x = cosP * Math.sin(l);
  const y = Math.cos(TILT) * Math.sin(p) - Math.sin(TILT) * cosP * Math.cos(l);
  const z = Math.sin(TILT) * Math.sin(p) + Math.cos(TILT) * cosP * Math.cos(l);
  return { sx: globe.cx + x * globe.r, sy: globe.cy - y * globe.r, front: z > 0 };
}

function sizeGlobe() {
  const wrap = document.getElementById('globe-wrap');
  const cv = globe.cv;
  const w = wrap.clientWidth;
  const h = wrap.clientHeight;
  if (!w || !h) return;

  globe.dpr = Math.min(window.devicePixelRatio || 1, 2);
  cv.width = Math.round(w * globe.dpr);
  cv.height = Math.round(h * globe.dpr);
  cv.style.width = w + 'px';
  cv.style.height = h + 'px';
  globe.ctx.setTransform(globe.dpr, 0, 0, globe.dpr, 0, 0);

  globe.w = w;
  globe.h = h;
  globe.cy = h / 2;
  aimGlobe();
  // 첫 배치는 바로 목표값으로 맞춘다 (애니메이션 없이)
  globe.cx = globe.cxT;
  globe.r = globe.rT;
}

/** 팝업이 열려 있으면 지구본을 왼쪽으로 물리고 조금 줄인다 */
function aimGlobe() {
  const w = globe.w;
  const h = globe.h;
  if (!w || !h) return;

  const open = !!state.region;
  const narrow = w < 1000;

  if (open && !narrow) {
    globe.rT = Math.min(w, h) * 0.30;
    globe.cxT = w * 0.26;
  } else {
    globe.rT = Math.min(w, h) * 0.38;
    globe.cxT = w / 2;
  }
}

function drawGlobe() {
  const g = globe.ctx;
  const { cx, cy, r } = globe;
  g.clearRect(0, 0, globe.cv.width, globe.cv.height);

  // 대기 발광
  const halo = g.createRadialGradient(cx, cy, r * 0.9, cx, cy, r * 1.35);
  halo.addColorStop(0, 'rgba(92, 156, 232, .34)');
  halo.addColorStop(.45, 'rgba(72, 122, 208, .12)');
  halo.addColorStop(1, 'rgba(60, 100, 180, 0)');
  g.fillStyle = halo;
  g.beginPath();
  g.arc(cx, cy, r * 1.35, 0, Math.PI * 2);
  g.fill();

  // 바다 — 블루마블의 짙은 청색 톤
  const sea = g.createRadialGradient(cx - r * .32, cy - r * .38, r * .08, cx, cy, r);
  sea.addColorStop(0, '#3f7cc4');
  sea.addColorStop(.42, '#1e5493');
  sea.addColorStop(.78, '#123a6d');
  sea.addColorStop(1, '#0a1f42');
  g.fillStyle = sea;
  g.beginPath();
  g.arc(cx, cy, r, 0, Math.PI * 2);
  g.fill();

  // 대륙 (격자보다 아래에 둬서 격자가 지구 위에 얹힌 것처럼 보이게)
  g.lineWidth = .8;
  LAND.forEach(drawLand);

  // 극지 얼음 — 북극이 앞면일 때만
  drawPolarCap();

  // 위경도 격자
  g.strokeStyle = 'rgba(214, 236, 255, .16)';
  g.lineWidth = .7;
  for (let lat = -60; lat <= 60; lat += 30) drawParallel(lat);
  for (let lon = 0; lon < 360; lon += 30) drawMeridian(lon);

  // 안쪽 그림자로 구형감 + 명암 경계
  const sh = g.createRadialGradient(cx - r * .28, cy - r * .32, r * .15, cx, cy, r * 1.02);
  sh.addColorStop(0, 'rgba(255,255,255,.06)');
  sh.addColorStop(.5, 'rgba(0,0,0,0)');
  sh.addColorStop(.82, 'rgba(2, 8, 20, .28)');
  sh.addColorStop(1, 'rgba(1, 5, 14, .72)');
  g.fillStyle = sh;
  g.beginPath();
  g.arc(cx, cy, r, 0, Math.PI * 2);
  g.fill();

  // 테두리 (대기 경계)
  g.strokeStyle = 'rgba(170, 220, 255, .5)';
  g.lineWidth = 1;
  g.beginPath();
  g.arc(cx, cy, r, 0, Math.PI * 2);
  g.stroke();

  drawLink();
  drawPins();
}

/** 북극 주변을 흰 번짐으로 처리해 만년설처럼 보이게 한다 */
function drawPolarCap() {
  const g = globe.ctx;
  const p = project(90, 0);
  if (!p.front) return;
  const grad = g.createRadialGradient(p.sx, p.sy, 1, p.sx, p.sy, globe.r * 0.42);
  grad.addColorStop(0, 'rgba(236, 244, 252, .72)');
  grad.addColorStop(.55, 'rgba(226, 238, 250, .22)');
  grad.addColorStop(1, 'rgba(226, 238, 250, 0)');
  g.save();
  g.beginPath();
  g.arc(globe.cx, globe.cy, globe.r, 0, Math.PI * 2);
  g.clip();
  g.fillStyle = grad;
  g.beginPath();
  g.arc(p.sx, p.sy, globe.r * 0.42, 0, Math.PI * 2);
  g.fill();
  g.restore();
}

/** F1 중계처럼 마커에서 꺾인 선이 팝업까지 이어진다 */
function drawLink() {
  if (!state.region || !state.link) return;
  const rg = REGIONS.find((x) => x.id === state.region);
  if (!rg) return;
  const p = project(rg.lat, rg.lon);
  if (!p.front) return;

  const g = globe.ctx;
  const toRight = state.link.x > p.sx;
  const elbow = p.sx + (toRight ? 1 : -1) * Math.abs(state.link.x - p.sx) * 0.42;

  g.beginPath();
  g.moveTo(p.sx, p.sy);
  g.lineTo(elbow, state.link.y);
  g.lineTo(state.link.x, state.link.y);
  g.strokeStyle = 'rgba(255, 209, 102, .8)';
  g.lineWidth = 1.3;
  g.stroke();

  g.beginPath();
  g.arc(state.link.x, state.link.y, 3.4, 0, Math.PI * 2);
  g.fillStyle = '#ffd166';
  g.fill();
}

function drawParallel(lat) {
  const g = globe.ctx;
  let started = false;
  g.beginPath();
  for (let lon = -180; lon <= 180; lon += 4) {
    const p = project(lat, lon);
    if (!p.front) { started = false; continue; }
    if (!started) { g.moveTo(p.sx, p.sy); started = true; } else g.lineTo(p.sx, p.sy);
  }
  g.stroke();
}

function drawMeridian(lon) {
  const g = globe.ctx;
  let started = false;
  g.beginPath();
  for (let lat = -90; lat <= 90; lat += 3) {
    const p = project(lat, lon);
    if (!p.front) { started = false; continue; }
    if (!started) { g.moveTo(p.sx, p.sy); started = true; } else g.lineTo(p.sx, p.sy);
  }
  g.stroke();
}

/** 지평선에 걸린 부분은 끊어서 그린다 */
function drawLand(land) {
  const g = globe.ctx;
  const tone = LAND_TONE[land.tone] || LAND_TONE.temperate;
  g.fillStyle = tone.fill;
  g.strokeStyle = tone.line;
  const closed = land.pts.concat([land.pts[0]]);
  let run = [];

  const flush = () => {
    if (run.length > 2) {
      g.beginPath();
      g.moveTo(run[0].sx, run[0].sy);
      for (let i = 1; i < run.length; i += 1) g.lineTo(run[i].sx, run[i].sy);
      g.closePath();
      g.fill();
      g.stroke();
    }
    run = [];
  };

  closed.forEach(([lon, lat]) => {
    const p = project(lat, lon);
    if (p.front) run.push(p);
    else flush();
  });
  flush();
}

/** 마커 + 지역 라벨. 라벨은 DOM으로 얹어 클릭·호버를 받는다 */
function drawPins() {
  const g = globe.ctx;
  const t = Date.now() / 1000;

  REGIONS.forEach((rg) => {
    const p = project(rg.lat, rg.lon);
    const node = document.getElementById('pin-' + rg.id);
    if (!node) return;
    syncRegionList(rg.id, p.front);

    if (!p.front) {
      node.classList.add('is-back');
      node.style.left = '-999px';
      return;
    }

    node.classList.remove('is-back');
    node.style.left = p.sx + 'px';
    node.style.top = p.sy + 'px';

    const on = state.region === rg.id;
    const pulse = (Math.sin(t * 2 + rg.lon) + 1) / 2;

    g.beginPath();
    g.arc(p.sx, p.sy, 3.2, 0, Math.PI * 2);
    g.fillStyle = on ? '#ffd166' : '#8fdcff';
    g.fill();

    g.beginPath();
    g.arc(p.sx, p.sy, 6 + pulse * 7, 0, Math.PI * 2);
    g.strokeStyle = on
      ? 'rgba(255, 209, 102, ' + (0.5 - pulse * 0.35) + ')'
      : 'rgba(143, 220, 255, ' + (0.42 - pulse * 0.3) + ')';
    g.lineWidth = 1.2;
    g.stroke();
  });
}

function buildPins() {
  const box = document.getElementById('pins');
  const list = document.getElementById('regions-list');
  box.textContent = '';
  list.textContent = '';

  REGIONS.forEach((rg) => {
    const n = issuesOf(rg.id).length;

    const b = el('button', 'pin');
    b.type = 'button';
    b.id = 'pin-' + rg.id;
    b.dataset.region = rg.id;
    b.appendChild(el('span', 'pin-name', rg.name));
    b.appendChild(el('span', 'pin-count', n + '건'));
    box.appendChild(b);

    // 목록 항목 — 지구본 뒷면이어도 여기서는 누를 수 있다
    const r = el('button', 'rg');
    r.type = 'button';
    r.id = 'rg-' + rg.id;
    r.dataset.region = rg.id;
    r.appendChild(el('span', 'rg-name', rg.name));
    r.appendChild(el('span', 'rg-en', rg.en));
    r.appendChild(el('span', 'rg-count', String(n)));
    list.appendChild(r);
  });
}

/** 지구본 앞면에 있는 지역을 목록에서도 표시. 바뀔 때만 클래스를 만진다. */
function syncRegionList(id, front) {
  const node = document.getElementById('rg-' + id);
  if (!node) return;
  if (node.classList.contains('is-front') !== front) {
    node.classList.toggle('is-front', front);
  }
}

/** −180~180 범위에서 더 짧은 회전 방향을 고른다 */
function shortestDelta(from, to) {
  let d = (to - from) % 360;
  if (d > 180) d -= 360;
  if (d < -180) d += 360;
  return d;
}

function loop() {
  if (state.target !== null) {
    // 특정 지역을 앞으로 돌리는 중
    const d = shortestDelta(state.lon0, state.target);
    if (Math.abs(d) < 0.4) { state.lon0 = state.target; state.target = null; }
    else state.lon0 += d * 0.11;
  } else if (!drag.on) {
    if (Math.abs(state.vel) > 0.02) {
      state.lon0 += state.vel;
      state.vel *= 0.957;            // 관성 감쇠
    } else {
      state.vel = 0;
      if (state.autoSpin) state.lon0 += 0.055;
    }
  }

  state.lon0 = ((state.lon0 + 180) % 360 + 360) % 360 - 180;

  // 지구본 위치·크기를 목표값으로 부드럽게 이동
  const dcx = globe.cxT - globe.cx;
  const dr = globe.rT - globe.r;
  if (Math.abs(dcx) > 0.4 || Math.abs(dr) > 0.4) {
    globe.cx += dcx * 0.12;
    globe.r += dr * 0.12;
    if (state.region) placePopup();     // 지구본이 움직이면 선 접점도 다시 잡는다
  } else {
    globe.cx = globe.cxT;
    globe.r = globe.rT;
  }

  drawGlobe();
  state.raf = requestAnimationFrame(loop);
}

/* --- 8. 지역 팝업 (1단계) ----------------------------------- */

function openRegion(id) {
  const rg = REGIONS.find((x) => x.id === id);
  if (!rg) return;

  state.region = id;
  const all = issuesOf(id);
  state.cat = all.length ? all[0].cat : null;

  // 그 지역이 앞면 왼쪽에 오도록 돌린다. 팝업은 오른쪽에 붙는다.
  state.target = rg.lon + 34;
  state.autoSpin = false;
  state.vel = 0;

  document.getElementById('pop-region').textContent = rg.name;
  document.getElementById('pop-en').textContent = rg.en + ' · 이슈 ' + all.length + '건';
  document.getElementById('pop').hidden = false;
  document.getElementById('globe-hint').hidden = true;

  renderCats();
  renderHeads();
  aimGlobe();
  placePopup();

  document.querySelectorAll('.pin, .rg').forEach((p) => {
    p.classList.toggle('is-on', p.dataset.region === id);
  });
}

/** 팝업 위치와 선의 접점을 정한다. 목표 회전각 기준으로 계산한다. */
function placePopup() {
  const rg = REGIONS.find((x) => x.id === state.region);
  const pop = document.getElementById('pop');
  const wrap = document.getElementById('globe-wrap');
  if (!rg || pop.hidden) return;

  const W = wrap.clientWidth;
  const H = wrap.clientHeight;

  // 좁은 화면에서는 팝업이 아래쪽 시트로 붙는다(CSS). 선을 그리면 엉뚱한 데로 간다.
  if (W < 1000) {
    pop.style.left = '';
    pop.style.top = '';
    state.link = null;
    return;
  }

  const at = state.target === null ? state.lon0 : state.target;
  const p = project(rg.lat, rg.lon, at);

  const popW = pop.offsetWidth;
  const popH = pop.offsetHeight;
  const toRight = p.sx <= globe.cx;

  let x = toRight ? globe.cx + globe.r + 54 : globe.cx - globe.r - 54 - popW;
  x = Math.min(Math.max(x, 16), Math.max(16, W - popW - 16));

  let y = p.sy - popH * 0.3;
  y = Math.min(Math.max(y, 88), Math.max(88, H - popH - 20));

  pop.style.left = x + 'px';
  pop.style.top = y + 'px';

  state.link = { x: toRight ? x : x + popW, y: y + 46 };
}

function closeRegion() {
  state.region = null;
  state.cat = null;
  state.link = null;
  state.autoSpin = true;
  document.getElementById('pop').hidden = true;
  document.getElementById('globe-hint').hidden = false;
  aimGlobe();
  document.querySelectorAll('.pin, .rg').forEach((p) => p.classList.remove('is-on'));
}

function renderCats() {
  const box = document.getElementById('cats');
  box.textContent = '';

  CATS.forEach((c) => {
    const list = issuesOf(state.region, c.id);
    const frag = document.getElementById('tpl-cat').content.cloneNode(true);
    const btn = frag.querySelector('.cat');
    btn.dataset.cat = c.id;
    frag.querySelector('.cat-name').textContent = c.name;
    frag.querySelector('.cat-count').textContent = list.length ? list.length + '건' : '없음';

    // 막대 높이 = 이 카테고리 이슈의 중요도 합 (최대 3단)
    const weight = list.reduce((a, x) => a + x.imp, 0);
    btn.style.setProperty('--w', Math.min(weight, 6));

    if (!list.length) btn.classList.add('is-empty');
    if (c.id === state.cat) btn.classList.add('is-on');
    box.appendChild(frag);
  });
}

function renderHeads() {
  const box = document.getElementById('heads');
  box.textContent = '';

  const list = issuesOf(state.region, state.cat);
  if (!list.length) {
    box.appendChild(el('p', 'heads-empty', '이 카테고리는 오늘 수집된 이슈가 없어요.'));
    return;
  }

  list.forEach((it) => {
    const frag = document.getElementById('tpl-head').content.cloneNode(true);
    const btn = frag.querySelector('.head');
    btn.dataset.id = it.id;
    btn.classList.add('imp-' + it.imp);

    frag.querySelector('.head-cat').textContent = catName(it.cat);
    frag.querySelector('.head-imp').textContent = '●'.repeat(it.imp);
    frag.querySelector('.head-title').textContent = it.title;

    const v = frag.querySelector('.head-value');
    v.textContent = it.metric.value;
    v.classList.add(it.metric.dir);
    frag.querySelector('.head-msub').textContent = it.metric.sub;

    // 중요도가 높을수록 사실을 더 많이 미리 보여준다 (imp 3 → 2줄, 2 → 1줄, 1 → 없음)
    const peek = frag.querySelector('.head-peek');
    const peekCount = it.imp >= 3 ? 2 : (it.imp === 2 ? 1 : 0);
    if (peekCount === 0) {
      peek.remove();
    } else {
      peek.hidden = false;
      it.facts.slice(0, peekCount).forEach((text) => {
        const line = el('span', 'peek-line');
        line.innerHTML = text;      // 강조 태그만 든 고정 문자열
        peek.appendChild(line);
      });
    }

    frag.querySelector('.head-foot').textContent =
      '원문 ' + it.sources.length + '건 · 용어 ' + it.terms.length + '개 — 자세히 보기';

    box.appendChild(frag);
  });
}

/* --- 9. 상세 (2단계) ---------------------------------------- */

function sourceNode(key) {
  const s = SOURCES[key];
  const frag = document.getElementById('tpl-source').content.cloneNode(true);
  if (!s) {
    frag.querySelector('.src-ch').textContent = '출처 정보 없음';
    return frag;
  }
  frag.querySelector('.src-ch').textContent = '@' + s.ch;
  frag.querySelector('.src-at').textContent = s.at;
  frag.querySelector('.src-text').textContent = s.text;
  if (s.truncated) frag.querySelector('.src-trunc').hidden = false;
  frag.querySelector('.src-link').href = 'https://t.me/' + s.ch + '/' + s.id;
  return frag;
}

function toggleSource(head) {
  const raw = head.parentElement.querySelector('.src-raw');
  raw.hidden = !raw.hidden;
  head.querySelector('.src-open').textContent = raw.hidden ? '원문 보기' : '원문 접기';
  head.classList.toggle('open', !raw.hidden);
}

function openDetail(id) {
  const it = ISSUES.find((x) => x.id === id);
  if (!it) return;
  state.issue = id;

  const dt = document.getElementById('detail');
  dt.querySelector('.dt-tag').textContent =
    (REGIONS.find((r) => r.id === it.region) || {}).name + ' · ' + catName(it.cat);
  dt.querySelector('.dt-title').textContent = it.title;

  const v = dt.querySelector('.dt-value');
  v.textContent = it.metric.value;
  v.className = 'dt-value ' + it.metric.dir;
  dt.querySelector('.dt-sub').textContent = it.metric.sub;

  const body = dt.querySelector('.dt-body');
  body.textContent = '';
  const frag = document.getElementById('tpl-detail-body').content.cloneNode(true);

  const facts = frag.querySelector('.dt-facts');
  it.facts.forEach((text) => {
    const li = el('li');
    li.innerHTML = text;          // 강조 태그만 든 고정 문자열
    facts.appendChild(li);
  });
  if (it.note) {
    const li = el('li', 'calc-note');
    li.textContent = it.note;
    facts.appendChild(li);
  }

  frag.querySelector('.dt-src-head').textContent = '수집한 원문 ' + it.sources.length + '건';
  const srcBox = frag.querySelector('.dt-src');
  it.sources.forEach((key) => srcBox.appendChild(sourceNode(key)));

  const termsBox = frag.querySelector('.dt-terms');
  const shown = it.terms.filter((tid) => !state.down.has(tid));
  shown.forEach((tid) => {
    const t = TERMS[tid];
    if (!t) return;
    const node = document.getElementById('tpl-term').content.cloneNode(true);
    node.querySelector('.term-name').textContent = t.full;
    node.querySelector('.term-desc').textContent = t.desc;
    node.querySelectorAll('.feed-btn').forEach((b) => {
      b.dataset.term = tid;
      const on = b.dataset.vote === 'up' ? state.up.has(tid) : state.down.has(tid);
      b.classList.toggle('is-on', on);
    });
    termsBox.appendChild(node);
  });
  if (shown.length === 0) frag.querySelector('.dt-terms-empty').hidden = false;

  const notes = frag.querySelector('.dt-notes');
  it.notes.forEach((text) => {
    const li = el('li');
    li.innerHTML = text;
    notes.appendChild(li);
  });

  const op = frag.querySelector('.dt-opinion');
  op.innerHTML = it.opinion;

  body.appendChild(frag);
  dt.hidden = false;
  dt.scrollTop = 0;
}

function closeDetail() {
  document.getElementById('detail').hidden = true;
  state.issue = null;
}

/* --- 9-b. 원문 새로고침 ------------------------------------- */

/** 마크다운 링크·이미지를 벗겨 읽을 수 있는 글로 만든다 */
function stripMarkdown(s) {
  let out = s
    .replace(/^[^\n]*\n/, '')                  // 블록 첫 줄(이미지 링크)
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')      // 이미지
    // 채널명 링크는 [[이름] 사람](url) 형태라 대괄호가 겹친다. 짝을 맞춰 벗긴다.
    .replace(/\[\[([^[\]]*)\]([^[\]]*)\]\([^)]*\)/g, '[$1]$2');

  // 링크는 중첩 대괄호가 있어 한 번에 안 벗겨진다. 더 이상 줄지 않을 때까지 반복한다.
  for (let i = 0; i < 5; i += 1) {
    const next = out.replace(/\[([^[\]]*)\]\((?:[^()]|\([^()]*\))*\)/g, '$1');
    if (next === out) break;
    out = next;
  }

  return out
    .replace(/\]\((?:https?:)?\/\/[^\s)]*\)/g, '')   // 못 벗긴 링크 꼬리
    .replace(/\]\([^)]*\)/g, '')
    .replace(/https?:\/\/\S+/g, '')                  // 맨 URL
    // [장 중 시황] 처럼 짝이 맞는 대괄호는 본문이므로 건드리지 않는다
    .replace(/_([^_\n]{0,4})_/g, '$1')               // 이모지 감싼 강조
    .replace(/[*`>#]/g, '')
    .replace(/\\_/g, '_')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\n{2,}/g, '\n')
    .trim();
}

/** 리액션 집계·구독 안내처럼 본문이 아닌 줄 */
function isNoiseBlock(s) {
  if (s.length < 60) return true;
  if (/^[A-Z][a-z]+ \d{1,2}$/.test(s)) return true;         // "August 13"
  if (/^(\p{Extended_Pictographic}|\d|\s)+$/u.test(s)) return true;  // 이모지·숫자만
  return false;
}

/** 날짜 구분선 같은 짧은 블록은 건너뛰고, 뒤에서부터 본문다운 블록을 찾는다 */
function lastBlock(text) {
  const blocks = text.split(/\n\[_!\[Image/);
  for (let i = blocks.length - 1; i >= 0; i -= 1) {
    const body = stripMarkdown(blocks[i]);
    if (!isNoiseBlock(body)) return body.slice(0, 300);
  }
  const tail = stripMarkdown(blocks[blocks.length - 1]);
  return tail ? tail.slice(0, 300) : '(본문을 읽지 못했어요)';
}

function openRefresh() {
  document.getElementById('rf').hidden = false;
  document.getElementById('rf').scrollTop = 0;
}

function renderRefresh(rows, done) {
  const box = document.getElementById('rf-list');
  box.textContent = '';

  rows.forEach((row) => {
    const frag = document.getElementById('tpl-rf-row').content.cloneNode(true);
    frag.querySelector('.rf-ch').textContent = '@' + row.ch.id;

    const badge = frag.querySelector('.rf-new');
    if (row.pending) {
      badge.textContent = '확인 중…';
      badge.classList.add('is-wait');
    } else if (!row.ok) {
      badge.textContent = '실패';
      badge.classList.add('is-fail');
      frag.querySelector('.rf-preview').textContent = row.error;
    } else {
      badge.textContent = row.count > 0 ? '새 글 ' + row.count + '건' : '새 글 없음';
      if (row.count > 0) badge.classList.add('is-new');
      frag.querySelector('.rf-preview').textContent =
        row.preview || '(본문을 읽지 못했어요)';
    }

    frag.querySelector('.rf-link').href = 'https://t.me/s/' + row.ch.id;
    box.appendChild(frag);
  });

  const total = rows.filter((r) => r.ok).reduce((a, r) => a + r.count, 0);
  const failed = rows.filter((r) => r.ok === false).length;
  document.getElementById('rf-note').textContent = done
    ? '채널 ' + rows.length + '개 확인 완료 · 새 글 ' + total + '건'
      + (failed ? ' · 실패 ' + failed + '개' : '')
      + ' · 카드 정리 시점은 ' + SNAPSHOT_AT + '이에요.'
    : '채널을 하나씩 확인하고 있어요…';
}

async function refresh() {
  if (state.refreshing) return;
  state.refreshing = true;

  const btn = document.getElementById('btn-refresh');
  btn.classList.add('is-busy');
  btn.disabled = true;

  const rows = CHANNELS.map((ch) => ({ ch, pending: true, count: 0 }));
  openRefresh();
  renderRefresh(rows, false);

  for (let i = 0; i < rows.length; i += 1) {
    const row = rows[i];
    try {
      // 무료 중계라 요청 한도가 있다. 채널 사이에 간격을 둔다.
      if (i > 0) await new Promise((r) => setTimeout(r, 500));

      const res = await fetch(PROXY + 'https://t.me/s/' + row.ch.id);
      if (res.status === 429) throw new Error('중계 서비스 요청 한도에 걸렸어요. 1~2분 뒤 다시 시도해주세요.');
      if (!res.ok) throw new Error('중계 서비스가 ' + res.status + '로 답했어요.');
      const text = await res.text();

      const re = new RegExp('t\\.me/' + row.ch.id + '/(\\d+)', 'g');
      const ids = [];
      let m = re.exec(text);
      while (m) { ids.push(Number(m[1])); m = re.exec(text); }

      const fresh = [...new Set(ids)].filter((n) => n > row.ch.last);
      row.pending = false;
      row.ok = true;
      row.maxId = ids.length ? Math.max(...ids) : 0;
      row.count = fresh.length;
      row.preview = lastBlock(text);
    } catch (err) {
      row.pending = false;
      row.ok = false;
      row.error = err && err.message
        ? err.message
        : '네트워크에 연결하지 못했어요.';
    }
    renderRefresh(rows, false);
  }

  renderRefresh(rows, true);
  btn.classList.remove('is-busy');
  btn.disabled = false;
  state.refreshing = false;

  const okRows = rows.filter((r) => r.ok);
  const total = okRows.reduce((a, r) => a + r.count, 0);
  const failed = rows.length - okRows.length;

  if (failed === rows.length) toast('가져오지 못했어요. 아래 사유를 확인해주세요.');
  else if (total > 0) toast('새 원문 ' + total + '건을 찾았어요. 카드 정리는 아직 서버가 필요해요.');
  else toast('새로 올라온 글이 없어요.');
}

/* --- 10. 이벤트 · 초기화 ------------------------------------ */

function vote(id, kind) {
  if (kind === 'up') {
    state.down.delete(id);
    if (state.up.has(id)) state.up.delete(id); else state.up.add(id);
  } else {
    state.up.delete(id);
    if (state.down.has(id)) state.down.delete(id); else state.down.add(id);
  }
  saveSet(STORE_UP, state.up);
  saveSet(STORE_DOWN, state.down);
}

function initEvents() {
  /* 지구본 마커 */
  const pins = document.getElementById('pins');

  pins.addEventListener('click', (e) => {
    const pin = e.target.closest('.pin');
    if (pin) openRegion(pin.dataset.region);
  });

  document.getElementById('regions-list').addEventListener('click', (e) => {
    const rg = e.target.closest('.rg');
    if (rg) openRegion(rg.dataset.region);
  });

  /* 지구본 끌어서 돌리기 */
  const wrap = document.getElementById('globe-wrap');

  wrap.addEventListener('pointerdown', (e) => {
    if (e.target.closest('.pin, .pop')) return;   // 마커·팝업 조작은 방해하지 않는다
    drag.on = true;
    drag.lastX = e.clientX;
    drag.moved = 0;
    state.target = null;
    state.vel = 0;
    wrap.classList.add('is-grabbing');
    if (wrap.setPointerCapture) { try { wrap.setPointerCapture(e.pointerId); } catch { /* 무시 */ } }
  });

  wrap.addEventListener('pointermove', (e) => {
    if (!drag.on) return;
    const dx = e.clientX - drag.lastX;
    drag.lastX = e.clientX;
    drag.moved += Math.abs(dx);
    const step = dx * 0.32;
    state.lon0 -= step;
    state.vel = -step * 0.55;          // 놓았을 때 이어질 속도
  });

  const endDrag = () => {
    if (!drag.on) return;
    drag.on = false;
    wrap.classList.remove('is-grabbing');
    // 거의 안 움직였으면 "누른 것"으로 보고 한 바퀴 굴려준다
    if (drag.moved < 5) state.vel = -1.6;
    state.autoSpin = !state.region;
  };

  wrap.addEventListener('pointerup', endDrag);
  wrap.addEventListener('pointercancel', endDrag);

  /* 새로고침 (탭은 <a>라 별도 처리가 필요 없다) */
  document.getElementById('btn-refresh').addEventListener('click', refresh);
  document.getElementById('rf-close').addEventListener('click', () => {
    document.getElementById('rf').hidden = true;
  });
  document.getElementById('rf').addEventListener('click', (e) => {
    if (e.target.id === 'rf') document.getElementById('rf').hidden = true;
  });

  /* 팝업 */
  document.getElementById('pop-close').addEventListener('click', closeRegion);

  document.getElementById('cats').addEventListener('click', (e) => {
    const c = e.target.closest('.cat');
    if (!c) return;
    state.cat = c.dataset.cat;
    renderCats();
    renderHeads();
  });

  document.getElementById('heads').addEventListener('click', (e) => {
    const h = e.target.closest('.head');
    if (h) openDetail(h.dataset.id);
  });

  /* 상세 */
  const dt = document.getElementById('detail');
  document.getElementById('dt-close').addEventListener('click', closeDetail);

  dt.addEventListener('click', (e) => {
    if (e.target === dt) { closeDetail(); return; }

    const head = e.target.closest('.src-head');
    if (head) { toggleSource(head); return; }

    const fb = e.target.closest('.feed-btn');
    if (fb) {
      const tid = fb.dataset.term;
      vote(tid, fb.dataset.vote);
      openDetail(state.issue);
      toast(state.down.has(tid)
        ? '앞으로 이 용어는 설명하지 않을게요.'
        : (state.up.has(tid) ? '도움됐다고 기억해둘게요.' : '표시를 지웠어요.'));
    }
  });

  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    if (!document.getElementById('rf').hidden) document.getElementById('rf').hidden = true;
    else if (!document.getElementById('detail').hidden) closeDetail();
    else if (state.region) closeRegion();
  });

  let rt = null;
  window.addEventListener('resize', () => {
    clearTimeout(rt);
    rt = setTimeout(() => { sizeGlobe(); placePopup(); drawGlobe(); }, 100);
  });
}

function init() {
  globe.cv = document.getElementById('globe');
  globe.ctx = globe.cv.getContext('2d');

  document.getElementById('stat-issues').textContent = ISSUES.length;
  document.getElementById('stat-snap').textContent = SNAPSHOT_AT;

  buildPins();
  initEvents();
  sizeGlobe();
  loop();
}

document.addEventListener('DOMContentLoaded', init);
