/* ============================================================
   시장 이해 지도 — app.js (프로토타입)

   섹션: 1 저장소 · 2 원문 데이터 · 3 카드 데이터 · 4 지도 데이터
         5 유틸 · 6 원문 블록 · 7 지도 렌더 · 8 팝업·패널
         9 카드(토스) 렌더 · 10 이벤트 · 초기화

   데이터는 2026-08-12~13 실제 텔레그램 공개 채널 메시지에서 가져왔다.
   세 층을 절대 섞지 않는다.
     사실   — 수집한 원문에 있는 내용만
     해설   — AI가 붙인 개념 설명·배경 (전망·판단 금지)
     의견   — AI의 해석 (투자 판단 금지)
   ============================================================ */

/* --- 1. 저장소 ---------------------------------------------- */

const STORE_DOWN = 'nb:down';    // 붐따 — 다음부터 보여주지 않음
const STORE_UP = 'nb:up';        // 따봉 — 도움됐다고 표시
const STORE_MODE = 'nb:layout';

/**
 * 원문 새로고침. 지구본 보기와 같은 사양이다.
 *
 * 텔레그램은 브라우저의 직접 요청에 CORS 헤더를 주지 않아 t.me를 바로 fetch할 수
 * 없다. 그래서 r.jina.ai 중계를 거친다. 채널 주소가 그 서비스를 지나간다는 점을
 * 화면에 명시한다.
 */
const PROXY = 'https://r.jina.ai/';
const SNAPSHOT_AT = '8/13 14:00';

const CHANNELS = [
  { id: 'yieldnspread', last: 6451 },
  { id: 'deandatbond', last: 1830 },
  { id: 'hanwhastrategy', last: 28941 },
  { id: 'redbirdstock', last: 8759 },
  { id: 'daishinstrategy', last: 6213 },
  { id: 'aetherjapanresearch', last: 24551 },
  { id: 'rafikiresearch', last: 24303 },
];

function loadSet(key) {
  try {
    const raw = localStorage.getItem(key);
    const v = raw === null ? [] : JSON.parse(raw);
    return new Set(Array.isArray(v) ? v : []);
  } catch {
    return new Set();   // 손상된 값은 빈 상태로 대체
  }
}

function saveSet(key, set) {
  try {
    localStorage.setItem(key, JSON.stringify([...set]));
    return true;
  } catch {
    toast('설정을 저장하지 못했어요. 시크릿 모드에서는 저장이 제한돼요.');
    return false;
  }
}

function loadMode() {
  // 주소의 #map · #card가 있으면 그것이 우선한다 (지구본 보기의 탭에서 넘어올 때)
  const hash = (location.hash || '').replace('#', '');
  if (hash === 'card' || hash === 'toss') return 'toss';
  if (hash === 'map') return 'map';
  try {
    const v = localStorage.getItem(STORE_MODE);
    return v === 'toss' || v === 'map' ? v : 'map';
  } catch {
    return 'map';
  }
}

function saveMode(mode) {
  try { localStorage.setItem(STORE_MODE, mode); } catch { /* 저장 실패해도 화면은 동작 */ }
}

/* --- 2. 원문 데이터 ----------------------------------------- */

/**
 * 수집한 원문 메시지. 정리된 내용이 어디서 왔는지 대조할 수 있게 그대로 보관한다.
 * t.me/s/ 웹 프리뷰로 수집했고, 요약·윤문하지 않는다.
 */
const SOURCES = {
  'yieldnspread/6451': {
    ch: 'yieldnspread', id: 6451, at: '8/12 21:55',
    text: `- 7월 CPI: +3.4% YoY / +0.1% MoM

- 근원 CPI: +2.5% YoY / +0.2% MoM

- CPI와 근원 CPI의 YoY 상승률 모두 5월 4.2%·2.9% → 6월 3.5%·2.6% → 7월 3.4%·2.5%로 2개월 연속 둔화했으며, 7월 수치는 모두 시장 예상치에 부합

- CPI는 6월 -0.4%에서 7월 +0.1%로 반등했지만 에너지 -1.5%, 휘발유 -2.9%가 상승 폭을 제한한 결과. 다만 에너지와 휘발유의 YoY 상승률은 각각 +14.7%, +24.6%로 여전히 높은 수준

- 근원 CPI는 6월 0.0%에서 +0.2%로 반등. 주거비는 +0.1%에 그쳤지만 임대료와 자가주거비가 각각 +0.3%, 의료비 +0.4%, 항공료 +2.2%를 기록해 서비스물가의 잔존 압력 확인`,
  },

  'deandatbond/1830': {
    ch: 'deandatbond', id: 1830, at: '8/13 07:58',
    text: `8/13 채권시장 동향

- 7월 CPI가 양호하게 발표되면서 선물시장에서의 금리 인상 확률 소폭 하락. 미국채 금리는 단기 금리 소폭 하락하며 커브 스팁 마감

- 선물시장에서 9월 인상 확률은 39%까지 하락. 12월 한 차례 인상 반영 중

- CPI 예상치 부합. 기여도를 보면 에너지가 헤드라인을 11bp 끌어내린 반면 근원 서비스가 13bp 끌어올림

- 10년 국채 입찰 수요는 소폭 부진. 낙찰금리 4.683%. 시장 기대(WI) 4.682%보다 1bp 높게 형성. 낙찰금리는 2007년 이후 최고치 기록`,
  },

  'hanwhastrategy/28940': {
    ch: 'hanwhastrategy', id: 28940, at: '8/13 07:59',
    text: `★ 주식 아침 시황 (8/13)
- 다우지수 53,770.27pt -0.04%
  S&P500지수 7,748.50pt +0.26%
  나스닥지수 26,558.49pt +0.54%
- 뉴욕 증시는 7월 물가지표 발표 영향과 기술주 반등에 혼조 마감. 미국 7월 CPI는 전년대비 3.4% 오르며 시장 전망치에 부합. 이에 연준 금리 인상 우려 완화. 다만, 미국과 이란의 호르무즈 해협 관련 협상은 교착 상태 지속. 코어위브 등 AI 인프라 기업들의 호실적 발표에 견조한 AI 수요 재확인되며 마이크론(+4.92%), 엔비디아(+3.03%) 등 반도체 업종 전반 강세`,
  },

  'redbirdstock/8759': {
    ch: 'redbirdstock', id: 8759, at: '8/13 06:58',
    truncated: true,
    text: `제품 증설과정에서 약해진 FCF제외하고 전반적으로 양호한 실적이네요
컨콜이 중요할 것 같네요

----

[Coherent FY4Q26 실적]

*4Q FY26 실적
-매출 20.46억달러, 전년 대비 +42% pro forma, 전분기 대비 +13.3%
-FactSet 컨센서스 19.8억달러 대비 약 3.3% 상회
-Non-GAAP 매출총이익률 40.2%, 전년 38.1% 대비 +215bp
-Non-GAAP 영업이익 4.46억달러, 전분기 3.66억달러 대비 +21.9%
-Non-GAAP 영업이익률 21.8%, 전년 18.0% 대비 +380bp
-Non-GAAP EPS 1.74달러, 전년 1.00달러 대비 +74%, 전분기 1.41달러 대비 +23%
-FactSet 컨센서스 1.62달러 대비 약 7.4% 상회

*사업부별 매출
-Datacenter & Communications 매출 16.15억달러, 전년 대비 +58.6%
-전체 매출의 약 79%를 Datacenter & Communications가 차지
-Industrial 매출 4.31억달러, 전년 대비 -15.8%

*FY27 1Q 가이던스
-매출 22억~24억달러
-중간값 23억달러, FactSet 컨센서스 21.3억달러 대비 약 8.0% 상회
-Non-GAAP EPS 1.85~2.05달러`,
  },

  'redbirdstock/8758': {
    ch: 'redbirdstock', id: 8758, at: '8/12 12:56',
    text: `>>NVIDIA, Zhongji Innolight·Eoptolink 투자설…회사들 긴급 부인·확인 거부

•최근 시장에서 NVIDIA가 광모듈 업체 Zhongji Innolight에 20억 달러를 전략적으로 투자하고, Eoptolink의 홍콩 IPO에도 앵커 투자자로 참여할 것이라는 소문이 확산

•NVIDIA의 Zhongji Innolight 투자는 차세대 광모듈 연구개발과 글로벌 생산능력 확대, 태국 신공장 건설 등에 활용될 것이라는 내용

•다만 8월 12일 Zhongji Innolight 측은 해당 시장 소문에 대해 "알지 못하며 회사의 관련 공시를 기준으로 해달라"고 답변. Eoptolink 역시 해당 소문에 대해 논평하기 어렵다며 H주 관련 사항은 공시를 기준으로 확인해달라고 밝힘 현재로서는 NVIDIA의 투자설을 뒷받침하는 공식 확인은 없는 상태`,
  },
};

/* --- 3. 카드 데이터 ----------------------------------------- */

const CARDS = [
  {
    tag: '시장 전반 · 물가',
    short: '미국 7월 CPI 발표',
    title: '미국 7월 물가가 시장 예상과 같게 나왔어요',
    metric: { value: '+3.4%', dir: 'flat', sub: '7월 CPI, 전년 대비 · 예상치 부합' },
    facts: [
      '7월 CPI는 전년 대비 <b>+3.4%</b>, 전월 대비 +0.1%. 근원 CPI는 +2.5% / +0.2%로 <b>모두 시장 예상치에 부합</b>했어요.',
      'CPI와 근원 CPI의 전년 대비 상승률은 5월 4.2%·2.9% → 6월 3.5%·2.6% → 7월 3.4%·2.5%로 <b>2개월 연속 둔화</b>했어요.',
      '선물시장의 <b>9월 금리 인상 확률은 39%까지 하락</b>했어요. 12월 한 차례 인상이 반영돼 있어요.',
      '뉴욕 증시는 혼조 마감했어요. 나스닥 +0.54%, S&P500 +0.26%, 다우 −0.04%.',
    ],
    sources: ['yieldnspread/6451', 'deandatbond/1830', 'hanwhastrategy/28940'],
    terms: [
      { id: 'core-cpi', name: '근원 CPI', full: '근원 CPI (Core CPI)',
        desc: '전체 물가에서 식품과 에너지를 뺀 지표예요. 이 둘은 날씨나 유가에 따라 심하게 출렁여서, 빼고 봐야 물가의 흐름이 보인다고 봐요.' },
      { id: 'yoy-mom', name: '전년 대비 / 전월 대비', full: '전년 대비 / 전월 대비 (YoY / MoM)',
        desc: '전년 대비는 1년 전 같은 달과 비교한 값, 전월 대비는 바로 앞 달과 비교한 값이에요. 같은 지표라도 어느 쪽으로 보느냐에 따라 방향이 달라 보일 수 있어요.' },
      { id: 'rate-prob', name: '금리 인상 확률', full: '선물시장 금리 인상 확률',
        desc: '금리 관련 선물 가격을 거꾸로 계산해 뽑아낸 숫자예요. 중앙은행이 발표한 게 아니라, 시장 참가자들이 돈을 걸고 있는 예상이에요.' },
    ],
    notes: [
      '물가 지표가 나오는 날 채권과 주식이 함께 크게 움직이는 이유는, 물가가 중앙은행 금리 결정의 주요 입력값이기 때문이에요.',
      '시장은 숫자 자체보다 <b>예상치와의 차이</b>를 봐요. 같은 3.4%라도 예상이 3.2%였는지 3.6%였는지에 따라 반응이 달라져요.',
      '미국 CPI는 매달 중순에 발표돼요.',
    ],
    opinion: '예상치에 부합했다는 건, 시장이 이미 이 정도를 반영해두고 있었다는 뜻이에요. 그래서 지수가 크게 움직이지 않았어요. 다만 헤드라인 3.4%만 보면 놓치는 게 있어요 — 원문을 보면 에너지·휘발유의 전년 대비 상승률이 각각 +14.7%, +24.6%로 여전히 높고, 서비스물가(임대료·의료비·항공료)도 오르고 있다고 적혀 있어요. 두 힘이 서로 상쇄된 결과가 "예상 부합"입니다. 어느 쪽이 더 오래 갈지는 이 원문만으로 알 수 없어요.',
  },

  {
    tag: '내 종목 · 실적',
    short: 'Coherent 실적발표',
    title: 'Coherent 4분기 실적이 시장 예상을 넘었어요',
    metric: { value: '+42%', dir: 'up', sub: '4분기 매출, 전년 대비 · 20.46억달러' },
    facts: [
      '4분기 매출 <b>20.46억달러</b>(약 28,992억원). 전년 대비 +42%로, 컨센서스 19.8억달러를 <b>3.3% 넘었어요</b>.',
      'Non-GAAP EPS는 1.74달러. 컨센서스 1.62달러를 7.4% 넘었어요.',
      '데이터센터·통신 부문이 16.15억달러로 <b>전체 매출의 79%</b>를 차지했어요. 산업 부문은 전년 대비 −15.8%였어요.',
      '다음 분기 가이던스는 매출 22억~24억달러. 중간값 23억달러로 컨센서스 21.3억달러를 약 8.0% 넘었어요.',
      '채널은 “증설 과정에서 약해진 FCF를 빼면 전반적으로 양호한 실적”이라고 평했어요.',
    ],
    sources: ['redbirdstock/8759'],
    note: '20.46억달러 × 1,417원/달러 = 28,992억원 (환율은 8/13 채널 보도치)',
    terms: [
      { id: 'non-gaap', name: 'Non-GAAP', full: 'Non-GAAP',
        desc: '정해진 회계기준(GAAP)에서 일회성 비용 같은 항목을 빼고 회사가 다시 계산한 수치예요. 회사가 조정한 값이라 GAAP 수치와 다를 수 있어요.' },
      { id: 'consensus', name: '컨센서스', full: '컨센서스 (consensus)',
        desc: '여러 증권사 애널리스트가 낸 전망치의 평균이에요. “상회”는 실제 실적이 이 평균보다 높게 나왔다는 뜻이에요.' },
      { id: 'guidance', name: '가이던스', full: '가이던스 (guidance)',
        desc: '회사가 직접 제시하는 다음 분기 실적 전망이에요. 애널리스트가 아니라 회사가 내놓는 숫자라 시장이 특히 주의해서 봐요.' },
      { id: 'fcf', name: 'FCF', full: 'FCF (잉여현금흐름)',
        desc: '영업으로 벌어들인 현금에서 설비 투자에 쓴 돈을 뺀 금액이에요. 공장을 크게 늘리는 시기에는 줄어드는 경우가 많아요.' },
    ],
    notes: [
      '실적 발표에서 시장이 보는 건 대체로 세 가지예요. 매출·이익이 컨센서스를 넘었는지, 다음 분기 가이던스가 컨센서스보다 높은지, 성장이 어느 사업부에서 나왔는지.',
      'InP·CPO·실리콘 포토닉스는 광통신 부품에 쓰이는 기술 이름이에요.',
      'CHIPS Act는 미국이 자국 내 반도체 생산시설 투자에 보조금을 주는 법이에요.',
    ],
    opinion: '숫자는 네 군데 모두 컨센서스를 넘겼는데, 원문을 올린 채널이 굳이 집어 언급한 건 FCF와 컨콜이에요. 실적이 좋은데도 "컨콜이 중요하다"고 쓴 건, 발표된 숫자보다 회사가 설명할 내용에 무게를 뒀다는 뜻으로 읽혀요. 매출의 79%가 데이터센터·통신 한 부문에서 나오고 산업 부문은 −15.8%라, 성장이 한쪽에 몰려 있다는 점도 원문에 그대로 적혀 있어요. 이게 강점인지 편중인지는 원문만으로 판단할 수 없어요.',
  },

  {
    tag: '내 종목 · 확인되지 않은 소문',
    short: '엔비디아 투자설?',
    title: 'NVIDIA 투자설이 돌았지만 회사들이 확인해주지 않았어요',
    metric: { value: '확인 안 됨', dir: 'none', sub: '공식 확인 없음 · 소문 단계' },
    facts: [
      'NVIDIA가 광모듈 업체 <b>Zhongji Innolight에 20억 달러를 투자</b>하고, Eoptolink의 홍콩 IPO에 앵커 투자자로 참여한다는 소문이 시장에 돌았어요.',
      '8월 12일 Zhongji Innolight는 <b>“알지 못하며 회사의 공시를 기준으로 해달라”</b>고 답했어요.',
      'Eoptolink도 <b>논평하기 어렵다</b>며 공시를 기준으로 확인해달라고 밝혔어요.',
      '현재까지 이 투자설을 뒷받침하는 <b>공식 확인은 없어요</b>.',
    ],
    sources: ['redbirdstock/8758'],
    terms: [
      { id: 'anchor', name: '앵커 투자자', full: '앵커 투자자 (anchor investor)',
        desc: '기업공개(IPO) 때 일반 청약 전에 대량 물량을 미리 배정받기로 약속한 큰 투자자예요. 이름값이 있는 곳이 들어오면 흥행 신호로 읽히곤 해요.' },
      { id: 'disclosure', name: '공시', full: '공시',
        desc: '상장사가 법에 따라 공식적으로 알리는 정보예요. 소문과 달리 내용에 법적 책임이 따라서, 회사들은 확인되지 않은 이야기에 “공시를 기준으로 해달라”고 답하는 경우가 많아요.' },
    ],
    notes: [
      '회사가 “알지 못한다”고 답하는 것은 부인과 다를 수 있어요. 사실이 아니라는 뜻일 수도 있고, 지금은 확인해줄 수 없다는 뜻일 수도 있어요.',
      '큰 기업의 투자설은 관련 부품사 주가를 먼저 움직이는 경우가 있어서, 확인 전에 소문만으로 퍼지기 쉬워요.',
      '홍콩 IPO에서 앵커 투자자 명단은 공모 절차 중 공개돼요.',
    ],
    opinion: '이 건의 핵심은 "아직 아무것도 확정되지 않았다"예요. 회사가 "알지 못한다"고 답한 것과 "사실이 아니다"라고 부인한 것은 다른데, 이번은 전자예요. 그래서 지금 확실한 사실은 두 가지뿐입니다 — 소문이 돌았다, 그리고 두 회사가 확인을 거부했다. 20억 달러라는 숫자도 소문 안에 있는 값이고 어디서도 확인되지 않았어요. 공시가 나오기 전까지는 소문 단계로 두는 게 맞아 보여요.',
  },
];

/* --- 4. 지도 데이터 ----------------------------------------- */

/**
 * 사건 하나가 중심이고, 원문·개념·배경·의견이 가지로 뻗는다.
 * child가 있으면 그 가지에서 한 단 더 이어진다 (관련개념 → 관련 설명 → 추가 설명).
 */
const GRAPH = [
  {
    card: 0,
    branches: [
      { kind: 'source', label: '텔레그램 원문', sub: '3건' },
      {
        kind: 'term', term: 'core-cpi',
        child: { kind: 'term', term: 'yoy-mom', child: { kind: 'term', term: 'rate-prob' } },
      },
      { kind: 'context', label: '알아두면 좋은 것', sub: '3가지' },
      { kind: 'opinion', label: '제 생각은' },
    ],
  },
  {
    card: 1,
    branches: [
      { kind: 'source', label: '텔레그램 원문', sub: '1건' },
      { kind: 'term', term: 'non-gaap', child: { kind: 'term', term: 'consensus' } },
      { kind: 'term', term: 'guidance', child: { kind: 'term', term: 'fcf' } },
      { kind: 'context', label: '알아두면 좋은 것', sub: '3가지' },
      { kind: 'opinion', label: '제 생각은' },
    ],
  },
  {
    card: 2,
    branches: [
      { kind: 'source', label: '텔레그램 원문', sub: '1건' },
      { kind: 'term', term: 'anchor', child: { kind: 'term', term: 'disclosure' } },
      { kind: 'context', label: '찌라시 배경', sub: '3가지' },
      { kind: 'opinion', label: '제 생각은' },
    ],
  },
];

/* --- 5. 상태 · 유틸 ----------------------------------------- */

const state = {
  index: 0,
  down: loadSet(STORE_DOWN),
  up: loadSet(STORE_UP),
  mode: loadMode(),
  nodes: [],
  raf: 0,
  panelCard: 0,
  pop: null,
  refreshing: false,
};

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

/** 모든 카드의 용어를 한 곳에 모은다 (id → {term, card}) */
const TERM_INDEX = (() => {
  const map = new Map();
  CARDS.forEach((c, ci) => {
    c.terms.forEach((t) => { if (!map.has(t.id)) map.set(t.id, { term: t, card: ci }); });
  });
  return map;
})();

let toastTimer = null;
function toast(message) {
  const box = document.getElementById('toast');
  box.textContent = message;
  box.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { box.hidden = true; }, 2600);
}

/* --- 6. 원문 블록 ------------------------------------------- */

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

/* --- 7. 지도 렌더 ------------------------------------------- */

const KIND_LABEL = {
  event: '사건',
  source: '원문',
  term: '개념',
  context: '배경',
  opinion: 'AI 의견',
};

/** 가지 하나를 노드 목록으로 펼친다 (child 체인 포함) */
function flattenBranch(branch, cluster, parent, level, out) {
  const node = {
    kind: branch.kind,
    card: cluster.card,
    level,
    parent,
    term: branch.term,
    label: branch.label,
    sub: branch.sub,
  };

  if (branch.kind === 'term') {
    const entry = TERM_INDEX.get(branch.term);
    node.label = entry ? entry.term.name : branch.term;
    node.id = 'term:' + branch.term;
  } else {
    node.id = branch.kind + ':' + cluster.card;
  }

  out.push(node);
  if (branch.child) flattenBranch(branch.child, cluster, node, level + 1, out);
  return node;
}

function buildNodes() {
  const out = [];
  GRAPH.forEach((cluster) => {
    const card = CARDS[cluster.card];
    const ev = {
      kind: 'event',
      card: cluster.card,
      level: 0,
      parent: null,
      id: 'event:' + cluster.card,
      label: card.short,
      value: card.metric.value,
      dir: card.metric.dir,
      roots: [],
    };
    out.push(ev);
    cluster.branches.forEach((b) => {
      ev.roots.push(flattenBranch(b, cluster, ev, 1, out));
    });
  });
  return out;
}

function renderGraph() {
  const box = document.getElementById('graph');
  box.textContent = '';
  state.nodes = buildNodes();

  state.nodes.forEach((n, i) => {
    // 사건 카드는 <ul>을 품으므로 button 대신 role=button을 쓴다 (button 안에 목록은 올 수 없다)
    const b = el('div', 'nd nd-' + n.kind);
    b.setAttribute('role', 'button');
    b.tabIndex = 0;
    b.dataset.i = String(i);

    b.appendChild(el('span', 'nd-kind', KIND_LABEL[n.kind]));

    if (n.kind === 'event') {
      const card = CARDS[n.card];
      b.appendChild(el('h2', 'nd-title', card.title));

      const m = el('div', 'nd-metric');
      m.appendChild(el('span', 'nd-val ' + card.metric.dir, card.metric.value));
      m.appendChild(el('span', 'nd-msub', card.metric.sub));
      b.appendChild(m);

      const ul = el('ul', 'nd-facts');
      card.facts.forEach((text) => {
        const li = el('li');
        li.innerHTML = text;     // 강조 태그만 든 고정 문자열
        ul.appendChild(li);
      });
      if (card.note) {
        const li = el('li', 'calc-note');
        li.textContent = card.note;
        ul.appendChild(li);
      }
      b.appendChild(ul);

      b.appendChild(el('span', 'nd-more',
        '원문 ' + card.sources.length + '건 · 용어 ' + card.terms.length + '개 — 자세히 보기'));
    } else {
      b.appendChild(el('span', 'nd-label', n.label));
      if (n.sub) b.appendChild(el('span', 'nd-sub', n.sub));
    }

    if (state.down.has(n.id)) b.classList.add('is-down');
    if (state.up.has(n.id)) b.classList.add('is-up');

    n.node = b;
    n.phase = (i * 1.9) % 6.283;
    n.speed = 0.00016 + (i % 5) * 0.00004;
    n.ampX = 3 + (i % 3) * 1.6;
    n.ampY = 2.5 + (i % 4) * 1.4;
    box.appendChild(b);
  });

  layoutGraph();
  startDrift();

  /**
   * 첫 페인트 시점에는 글꼴이 아직 자리잡지 않아 카드 높이를 작게 잰다.
   * 그 값으로 밴드를 계산하면 카드가 무대를 벗어난다. 그래서 다시 잰다.
   */
  requestAnimationFrame(() => { if (state.mode === 'map') layoutGraph(); });
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(() => { if (state.mode === 'map') layoutGraph(); });
  }
}

function layoutGraph(pass) {
  const box = document.getElementById('graph');
  const w = box.clientWidth;
  if (!w) return;

  state.nodes.forEach((n) => {
    n.hw = n.node.offsetWidth / 2;
    n.hh = n.node.offsetHeight / 2;
  });

  /**
   * 사건 카드가 전체 내용을 담으면서 높이가 제각각이 됐다.
   * 밴드를 균등하게 나누면 큰 카드가 밴드를 넘어 옆 사건 영역을 침범한다.
   * 그래서 클러스터마다 필요한 높이를 재고 무대 높이를 거기에 맞춘다.
   */
  const bandH = GRAPH.map((cluster) => {
    const ev = state.nodes.find((n) => n.kind === 'event' && n.card === cluster.card);
    const rows = Math.ceil(ev.roots.length / 2);
    return Math.max(ev.node.offsetHeight + 64, rows * 86 + 56);
  });
  const needed = bandH.reduce((a, b) => a + b, 0);

  // flex:1의 flex-basis:0%가 height를 덮어쓰므로 min-height로 늘린다
  document.querySelector('.map-stage').style.minHeight = needed + 'px';

  /**
   * 높이를 늘리면 세로 스크롤바가 생겨 가로 폭이 줄어든다.
   * 위에서 쓴 w는 스크롤바가 없던 시점의 값이라 그만큼 오른쪽으로 넘친다.
   * 폭이 달라졌으면 한 번만 다시 잰다.
   */
  if (!pass && box.clientWidth !== w) { layoutGraph(1); return; }

  const h = box.clientHeight || needed;

  // 화면이 더 크면 남는 높이를 클러스터에 비례 배분한다
  const scale = h > needed ? h / needed : 1;
  bandH.forEach((v, i) => { bandH[i] = v * scale; });

  const bandTop = [];
  bandH.reduce((acc, v, i) => { bandTop[i] = acc; return acc + v; }, 0);

  GRAPH.forEach((cluster, ci) => {
    const band = bandH[ci];
    const top = bandTop[ci];
    const cy = top + band / 2;
    // 사건 박스를 좌우로 번갈아 놓아 지그재그로 읽히게 한다
    const dir = ci % 2 === 0 ? 1 : -1;
    const ev = state.nodes.find((n) => n.kind === 'event' && n.card === cluster.card);
    ev.bx = dir === 1 ? w * 0.19 : w * 0.81;
    ev.by = cy;

    const roots = ev.roots;
    // 가지를 두 열로 엇갈리게 놓아 필요한 세로 높이를 절반으로 줄인다
    const rows = Math.ceil(roots.length / 2);

    roots.forEach((r, i) => {
      const row = Math.floor(i / 2);
      const colOffset = i % 2 === 0 ? 0.45 : 0.53;
      const t = rows === 1 ? 0.5 : row / (rows - 1);
      r.by = cy + (t - 0.5) * band * 0.62;
      r.bx = dir === 1 ? w * colOffset : w * (1 - colOffset);

      let cur = r;
      let lvl = 1;
      while (cur) {
        const next = state.nodes.find((x) => x.parent === cur);
        if (!next) break;
        next.bx = r.bx + dir * w * 0.115 * lvl;
        next.by = cur.by + (lvl % 2 === 1 ? -26 : 26);
        cur = next;
        lvl += 1;
      }
    });

    // 이 클러스터의 노드는 자기 밴드를 벗어나지 않게 묶어둔다
    [ev, ...state.nodes.filter((n) => n.card === cluster.card && n !== ev)]
      .forEach((n) => { n.bandTop = top; n.bandBottom = top + band; });
  });

  separate(w, h);
  state.nodes.forEach((n) => place(n, 0));
  drawLinks();
}

/** 겹친 박스를 밀어낸다. 흔들림 폭까지 감안해 여유를 둔다. */
function separate(w, h) {
  const items = state.nodes;

  for (let pass = 0; pass < 90; pass += 1) {
    let moved = false;

    for (let i = 0; i < items.length; i += 1) {
      for (let j = i + 1; j < items.length; j += 1) {
        const a = items[i];
        const b = items[j];
        const gapX = a.hw + b.hw + a.ampX + b.ampX + 14;
        const gapY = a.hh + b.hh + a.ampY + b.ampY + 12;
        const dx = b.bx - a.bx;
        const dy = b.by - a.by;
        const overX = gapX - Math.abs(dx);
        const overY = gapY - Math.abs(dy);
        if (overX <= 0 || overY <= 0) continue;

        moved = true;
        if (overX / gapX < overY / gapY) {
          const push = (overX / 2) * (dx < 0 ? -1 : 1);
          a.bx -= push;
          b.bx += push;
        } else {
          const push = (overY / 2) * (dy < 0 ? -1 : 1);
          a.by -= push;
          b.by += push;
        }
      }
    }

    // 가로는 무대 안, 세로는 자기 클러스터 밴드 안으로 되돌린다.
    // 밴드를 안 묶으면 옆 사건 영역으로 밀려나 어느 사건의 가지인지 알 수 없게 된다.
    items.forEach((it) => {
      const mx = it.hw + it.ampX + 6;
      const my = it.hh + it.ampY + 6;
      it.bx = Math.min(Math.max(it.bx, mx), w - mx);

      const lo = (it.bandTop === undefined ? 0 : it.bandTop) + my;
      const hi = (it.bandBottom === undefined ? h : it.bandBottom) - my;
      it.by = lo > hi ? (lo + hi) / 2 : Math.min(Math.max(it.by, lo), hi);
    });

    if (!moved) break;
  }
}

function place(n, t) {
  n.x = n.bx + n.ampX * Math.sin(t * n.speed + n.phase);
  n.y = n.by + n.ampY * Math.sin(t * n.speed * 1.41 + n.phase * 1.7);
  n.node.style.left = n.x + 'px';
  n.node.style.top = n.y + 'px';
}

/** 부모 박스 가장자리에서 자식 박스 가장자리로 곡선을 잇는다 */
function drawLinks() {
  const svg = document.getElementById('links');
  const box = document.getElementById('graph');
  const w = box.clientWidth;
  const h = box.clientHeight;
  svg.setAttribute('viewBox', '0 0 ' + w + ' ' + h);

  let d = '';
  state.nodes.forEach((n) => {
    if (!n.parent) return;
    const p = n.parent;
    const right = n.x > p.x;
    const x1 = p.x + (right ? p.hw : -p.hw);
    const x2 = n.x + (right ? -n.hw : n.hw);
    const mx = (x1 + x2) / 2;
    d += 'M' + x1 + ' ' + p.y + ' C ' + mx + ' ' + p.y + ', ' + mx + ' ' + n.y + ', ' + x2 + ' ' + n.y + ' ';
  });

  svg.innerHTML = '<path class="link" d="' + d + '" />';
}

function startDrift() {
  cancelAnimationFrame(state.raf);
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    drawLinks();
    return;
  }
  const step = (t) => {
    state.nodes.forEach((n) => place(n, t));
    drawLinks();
    state.raf = requestAnimationFrame(step);
  };
  state.raf = requestAnimationFrame(step);
}

function stopDrift() {
  cancelAnimationFrame(state.raf);
  state.raf = 0;
}

/* --- 8. 팝업 · 상세 패널 ------------------------------------ */

function openPop(node) {
  const pop = document.getElementById('pop');
  const card = CARDS[node.card];
  const body = pop.querySelector('.pop-body');
  const feed = pop.querySelector('.pop-feed');

  pop.className = 'pop tone-' + node.kind;
  pop.querySelector('.pop-kind').textContent = KIND_LABEL[node.kind];
  body.textContent = '';
  state.pop = node;

  if (node.kind === 'source') {
    pop.querySelector('.pop-name').textContent = '수집한 원문 ' + card.sources.length + '건';
    card.sources.forEach((key) => body.appendChild(sourceNode(key)));
    const first = body.querySelector('.src-head');
    if (first) toggleSource(first);
    feed.hidden = true;
  }

  if (node.kind === 'term') {
    const entry = TERM_INDEX.get(node.term);
    pop.querySelector('.pop-name').textContent = entry.term.full;
    body.appendChild(el('p', 'pop-note', 'AI가 붙인 설명이에요. 실제 뉴스가 아니에요.'));
    body.appendChild(el('p', 'pop-text', entry.term.desc));
    feed.hidden = false;
  }

  if (node.kind === 'context') {
    pop.querySelector('.pop-name').textContent = node.label;
    body.appendChild(el('p', 'pop-note', 'AI가 붙인 설명이에요. 실제 뉴스가 아니에요.'));
    const ul = el('ul', 'pop-list');
    card.notes.forEach((text) => {
      const li = el('li');
      li.innerHTML = text;
      ul.appendChild(li);
    });
    body.appendChild(ul);
    feed.hidden = false;
  }

  if (node.kind === 'opinion') {
    pop.querySelector('.pop-name').textContent = card.short + ' — 제 생각은';
    body.appendChild(el('p', 'pop-note', 'AI 의견이에요. 사실도 아니고 투자 판단도 아니에요.'));
    body.appendChild(el('p', 'pop-text', card.opinion));
    feed.hidden = false;
  }

  markFeedButtons(node.id);
  pop.hidden = false;
}

function markFeedButtons(id) {
  document.querySelectorAll('.feed-btn').forEach((b) => {
    const isUp = b.dataset.vote === 'up';
    const on = isUp ? state.up.has(id) : state.down.has(id);
    b.classList.toggle('is-on', on);
  });
}

function closePop() {
  document.getElementById('pop').hidden = true;
  state.pop = null;
}

function openPanel(cardIndex) {
  const card = CARDS[cardIndex];
  if (!card) return;
  state.panelCard = cardIndex;

  const panel = document.getElementById('panel');
  panel.querySelector('.pn-tag').textContent = card.tag;
  panel.querySelector('.pn-title').textContent = card.title;

  const v = panel.querySelector('.pn-value');
  v.textContent = card.metric.value;
  v.className = 'pn-value ' + card.metric.dir;
  panel.querySelector('.pn-sub').textContent = card.metric.sub;

  const body = panel.querySelector('.pn-body');
  body.textContent = '';
  const frag = document.getElementById('tpl-pn-body').content.cloneNode(true);

  const facts = frag.querySelector('.pn-facts');
  card.facts.forEach((text) => {
    const li = el('li');
    li.innerHTML = text;
    facts.appendChild(li);
  });
  if (card.note) {
    const li = el('li', 'calc-note');
    li.textContent = card.note;
    facts.appendChild(li);
  }

  frag.querySelector('.pn-src-head').textContent = '수집한 원문 ' + card.sources.length + '건';
  const srcBox = frag.querySelector('.pn-src');
  card.sources.forEach((key) => srcBox.appendChild(sourceNode(key)));

  const terms = frag.querySelector('.pn-terms');
  const shown = card.terms.filter((t) => !state.down.has('term:' + t.id));
  shown.forEach((t) => {
    const wrap = el('div', 'pn-term');
    wrap.appendChild(el('p', 'pn-term-name', t.full));
    wrap.appendChild(el('p', 'pn-term-desc', t.desc));
    const btn = el('button', 'know-btn', '필요 없어요');
    btn.type = 'button';
    btn.dataset.term = t.id;
    wrap.appendChild(btn);
    terms.appendChild(wrap);
  });
  if (shown.length === 0) frag.querySelector('.pn-terms-empty').hidden = false;

  const notes = frag.querySelector('.pn-notes');
  card.notes.forEach((text) => {
    const li = el('li');
    li.innerHTML = text;
    notes.appendChild(li);
  });

  frag.querySelector('.pn-opinion').textContent = card.opinion;

  body.appendChild(frag);
  panel.hidden = false;
  panel.scrollTop = 0;
}

function closePanel() {
  document.getElementById('panel').hidden = true;
}

/* --- 9. 카드(토스) 렌더 ------------------------------------- */

function renderCard() {
  const card = CARDS[state.index];
  const frag = document.getElementById('tpl-card').content.cloneNode(true);

  frag.querySelector('.tag').textContent = card.tag;
  frag.querySelector('.title').textContent = card.title;

  const value = frag.querySelector('.metric-value');
  value.textContent = card.metric.value;
  value.classList.add(card.metric.dir);
  frag.querySelector('.metric-sub').textContent = card.metric.sub;

  const facts = frag.querySelector('.facts');
  card.facts.forEach((text) => {
    const li = el('li');
    li.innerHTML = text;
    facts.appendChild(li);
  });
  if (card.note) {
    const li = el('li', 'calc-note');
    li.textContent = card.note;
    facts.appendChild(li);
  }

  const srcBtn = frag.querySelector('.btn-sources');
  srcBtn.textContent = '수집한 원문 ' + card.sources.length + '건 보기';
  const srcList = frag.querySelector('.sources');
  card.sources.forEach((key) => srcList.appendChild(sourceNode(key)));

  const terms = frag.querySelector('.terms');
  const shown = card.terms.filter((t) => !state.down.has('term:' + t.id));
  shown.forEach((t) => {
    const node = document.getElementById('tpl-term').content.cloneNode(true);
    node.querySelector('.term-name').textContent = t.full;
    node.querySelector('.term-desc').textContent = t.desc;
    node.querySelector('.know-btn').dataset.term = t.id;
    terms.appendChild(node);
  });
  if (shown.length === 0) frag.querySelector('.terms-empty').hidden = false;

  const notes = frag.querySelector('.notes');
  card.notes.forEach((text) => {
    const li = el('li');
    li.innerHTML = text;
    notes.appendChild(li);
  });

  frag.querySelector('.opinion').textContent = card.opinion;

  const area = document.getElementById('card-area');
  area.textContent = '';
  area.appendChild(frag);

  document.getElementById('progress-text').textContent =
    (state.index + 1) + ' / ' + CARDS.length;
  document.getElementById('bar-fill').style.width =
    ((state.index + 1) / CARDS.length * 100) + '%';
  document.getElementById('btn-prev').disabled = state.index === 0;
  document.getElementById('btn-next').textContent =
    state.index === CARDS.length - 1 ? '처음으로' : '다음 카드';
}

function go(next) {
  state.index = (next + CARDS.length) % CARDS.length;
  renderCard();
  window.scrollTo(0, 0);
}

/* --- 9-b. 원문 새로고침 ------------------------------------- */

/** 마크다운 링크·이미지를 벗겨 읽을 수 있는 글로 만든다 */
function stripMarkdown(s) {
  let out = s
    .replace(/^[^\n]*\n/, '')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
    .replace(/\[\[([^[\]]*)\]([^[\]]*)\]\([^)]*\)/g, '[$1]$2');

  for (let i = 0; i < 5; i += 1) {
    const next = out.replace(/\[([^[\]]*)\]\((?:[^()]|\([^()]*\))*\)/g, '$1');
    if (next === out) break;
    out = next;
  }

  return out
    .replace(/\]\((?:https?:)?\/\/[^\s)]*\)/g, '')
    .replace(/\]\([^)]*\)/g, '')
    .replace(/https?:\/\/\S+/g, '')
    .replace(/_([^_\n]{0,4})_/g, '$1')
    .replace(/[*`>#]/g, '')
    .replace(/\\_/g, '_')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\n{2,}/g, '\n')
    .trim();
}

function isNoiseBlock(s) {
  if (s.length < 60) return true;
  if (/^[A-Z][a-z]+ \d{1,2}$/.test(s)) return true;
  if (/^(\p{Extended_Pictographic}|\d|\s)+$/u.test(s)) return true;
  return false;
}

function lastBlock(text) {
  const blocks = text.split(/\n\[_!\[Image/);
  for (let i = blocks.length - 1; i >= 0; i -= 1) {
    const body = stripMarkdown(blocks[i]);
    if (!isNoiseBlock(body)) return body.slice(0, 300);
  }
  const tail = stripMarkdown(blocks[blocks.length - 1]);
  return tail ? tail.slice(0, 300) : '(본문을 읽지 못했어요)';
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
      frag.querySelector('.rf-preview').textContent = row.preview || '(본문을 읽지 못했어요)';
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
  document.getElementById('rf').hidden = false;
  renderRefresh(rows, false);

  for (let i = 0; i < rows.length; i += 1) {
    const row = rows[i];
    try {
      if (i > 0) await new Promise((r) => setTimeout(r, 500));
      const res = await fetch(PROXY + 'https://t.me/s/' + row.ch.id);
      if (res.status === 429) throw new Error('중계 서비스 요청 한도에 걸렸어요. 1~2분 뒤 다시 시도해주세요.');
      if (!res.ok) throw new Error('중계 서비스가 ' + res.status + '로 답했어요.');
      const text = await res.text();

      const re = new RegExp('t\\.me/' + row.ch.id + '/(\\d+)', 'g');
      const ids = [];
      let m = re.exec(text);
      while (m) { ids.push(Number(m[1])); m = re.exec(text); }

      row.pending = false;
      row.ok = true;
      row.count = [...new Set(ids)].filter((n) => n > row.ch.last).length;
      row.preview = lastBlock(text);
    } catch (err) {
      row.pending = false;
      row.ok = false;
      row.error = err && err.message ? err.message : '네트워크에 연결하지 못했어요.';
    }
    renderRefresh(rows, false);
  }

  renderRefresh(rows, true);
  btn.classList.remove('is-busy');
  btn.disabled = false;
  state.refreshing = false;

  const okRows = rows.filter((r) => r.ok);
  const total = okRows.reduce((a, r) => a + r.count, 0);
  if (okRows.length === 0) toast('가져오지 못했어요. 아래 사유를 확인해주세요.');
  else if (total > 0) toast('새 원문 ' + total + '건을 찾았어요. 카드 정리는 아직 서버가 필요해요.');
  else toast('새로 올라온 글이 없어요.');
}

/* --- 10. 모드 전환 · 이벤트 · 초기화 ------------------------ */

function applyMode(mode) {
  state.mode = mode;
  document.body.classList.toggle('mode-map', mode === 'map');
  document.body.classList.toggle('mode-toss', mode === 'toss');
  document.querySelectorAll('.seg-btn').forEach((b) => {
    if (!b.dataset.mode) return;      // '지구본'은 다른 페이지 링크
    b.classList.toggle('is-on', b.dataset.mode === mode);
  });
  // 범례는 지도에서만 의미가 있다
  document.getElementById('legend').hidden = mode !== 'map';
  saveMode(mode);

  if (mode === 'map') {
    closePanel();
    closePop();
    renderGraph();
  } else {
    stopDrift();
    renderCard();
  }
  window.scrollTo(0, 0);
}

function vote(id, kind) {
  if (kind === 'up') {
    state.down.delete(id);
    if (state.up.has(id)) state.up.delete(id);
    else state.up.add(id);
  } else {
    state.up.delete(id);
    if (state.down.has(id)) state.down.delete(id);
    else state.down.add(id);
  }
  saveSet(STORE_UP, state.up);
  saveSet(STORE_DOWN, state.down);
}

function initEvents() {
  document.querySelector('.seg').addEventListener('click', (e) => {
    const btn = e.target.closest('.seg-btn');
    if (btn && btn.dataset.mode) applyMode(btn.dataset.mode);
  });

  document.getElementById('btn-refresh').addEventListener('click', refresh);
  document.getElementById('rf-close').addEventListener('click', () => {
    document.getElementById('rf').hidden = true;
  });
  document.getElementById('rf').addEventListener('click', (e) => {
    if (e.target.id === 'rf') document.getElementById('rf').hidden = true;
  });

  /* 지도 */
  const openNode = (nd) => {
    const n = state.nodes[Number(nd.dataset.i)];
    if (!n) return;
    if (n.kind === 'event') openPanel(n.card);
    else openPop(n);
  };

  const graphBox = document.getElementById('graph');

  graphBox.addEventListener('click', (e) => {
    const nd = e.target.closest('.nd');
    if (nd) openNode(nd);
  });

  // role=button이므로 키보드 조작을 직접 붙인다
  graphBox.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    const nd = e.target.closest('.nd');
    if (!nd) return;
    e.preventDefault();
    openNode(nd);
  });

  /* 팝업 */
  const pop = document.getElementById('pop');
  document.getElementById('pop-close').addEventListener('click', closePop);
  pop.addEventListener('click', (e) => {
    if (e.target === pop) { closePop(); return; }

    const head = e.target.closest('.src-head');
    if (head) { toggleSource(head); return; }

    const fb = e.target.closest('.feed-btn');
    if (fb && state.pop) {
      const id = state.pop.id;
      vote(id, fb.dataset.vote);
      markFeedButtons(id);
      renderGraph();
      toast(state.down.has(id)
        ? '앞으로 이 설명은 접어둘게요.'
        : (state.up.has(id) ? '도움됐다고 기억해둘게요.' : '표시를 지웠어요.'));
    }
  });

  /* 상세 패널 */
  const panel = document.getElementById('panel');
  document.getElementById('pn-close').addEventListener('click', closePanel);
  panel.addEventListener('click', (e) => {
    if (e.target === panel) { closePanel(); return; }

    const head = e.target.closest('.src-head');
    if (head) { toggleSource(head); return; }

    const know = e.target.closest('.know-btn');
    if (know) {
      vote('term:' + know.dataset.term, 'down');
      renderGraph();
      openPanel(state.panelCard);
      toast('앞으로 이 용어는 설명하지 않을게요.');
    }
  });

  /* 카드 */
  document.getElementById('btn-next').addEventListener('click', () => go(state.index + 1));
  document.getElementById('btn-prev').addEventListener('click', () => go(state.index - 1));

  document.getElementById('btn-reset').addEventListener('click', () => {
    state.down = new Set();
    state.up = new Set();
    saveSet(STORE_DOWN, state.down);
    saveSet(STORE_UP, state.up);
    renderCard();
    toast('표시해둔 피드백을 모두 되돌렸어요.');
  });

  document.getElementById('card-area').addEventListener('click', (e) => {
    const head = e.target.closest('.src-head');
    if (head) { toggleSource(head); return; }

    const know = e.target.closest('.know-btn');
    if (know) {
      vote('term:' + know.dataset.term, 'down');
      renderCard();
      toast('앞으로 이 용어는 설명하지 않을게요.');
      return;
    }

    const src = e.target.closest('.btn-sources');
    if (src) {
      const list = src.parentElement.querySelector('.sources');
      list.hidden = !list.hidden;
      src.textContent = list.hidden
        ? '수집한 원문 ' + list.children.length + '건 보기'
        : '원문 목록 접기';
      return;
    }

    const more = e.target.closest('.more-toggle');
    if (more) {
      const mb = more.parentElement.querySelector('.more-body');
      mb.hidden = !mb.hidden;
      more.classList.toggle('open', !mb.hidden);
    }
  });

  /* 공통 */
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (!document.getElementById('rf').hidden) { document.getElementById('rf').hidden = true; return; }
      closePop(); closePanel(); return;
    }
    if (state.mode !== 'toss') return;
    if (e.key === 'ArrowRight') go(state.index + 1);
    if (e.key === 'ArrowLeft') go(state.index - 1);
  });

  let resizeTimer = null;
  window.addEventListener('resize', () => {
    if (state.mode !== 'map') return;
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(layoutGraph, 120);
  });
}

function init() {
  document.getElementById('stat-issues').textContent = CARDS.length;
  document.getElementById('stat-snap').textContent = SNAPSHOT_AT;
  initEvents();
  applyMode(state.mode);
}

document.addEventListener('DOMContentLoaded', init);
