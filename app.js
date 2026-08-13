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

const TERMS = {
  'core-cpi': { name: '근원 CPI', full: '근원 CPI (Core CPI)',
    desc: '전체 물가에서 식품과 에너지를 뺀 지표예요. 이 둘은 날씨나 유가에 따라 심하게 출렁여서, 빼고 봐야 물가의 흐름이 보인다고 봐요.' },
  'yoy-mom': { name: '전년/전월 대비', full: '전년 대비 / 전월 대비 (YoY / MoM)',
    desc: '전년 대비는 1년 전 같은 달과 비교한 값, 전월 대비는 바로 앞 달과 비교한 값이에요. 같은 지표라도 어느 쪽으로 보느냐에 따라 방향이 달라 보일 수 있어요.' },
  'rate-prob': { name: '금리 인상 확률', full: '선물시장 금리 인상 확률',
    desc: '금리 관련 선물 가격을 거꾸로 계산해 뽑아낸 숫자예요. 중앙은행이 발표한 게 아니라, 시장 참가자들이 돈을 걸고 있는 예상이에요.' },
  'bp': { name: 'bp (베이시스포인트)', full: 'bp (베이시스포인트)',
    desc: '0.01%포인트를 뜻해요. 금리가 4.20%에서 4.19%로 내려가면 1bp 하락이라고 말해요.' },
  'curve-steep': { name: '커브 스팁', full: '커브 스티프닝 (curve steepening)',
    desc: '짧은 만기 금리와 긴 만기 금리의 격차가 벌어지는 것을 말해요. 보통 단기 금리가 더 내려가거나 장기 금리가 더 오를 때 나타나요.' },
  'ktb': { name: '국고채', full: '국고채',
    desc: '한국 정부가 발행하는 채권이에요. 3년물·10년물 금리가 국내 시장금리의 기준으로 쓰여요.' },
  'dxy': { name: '달러인덱스', full: '달러인덱스 (DXY)',
    desc: '달러가 주요 6개 통화 묶음에 대해 얼마나 센지 하나의 숫자로 나타낸 지표예요. 오르면 달러가 강해졌다는 뜻이에요.' },
  'brent-wti': { name: '브렌트유 / WTI', full: '브렌트유 / WTI',
    desc: '국제 유가의 두 기준이에요. 브렌트는 북해산, WTI는 미국산 원유 가격이고, 보통 브렌트가 조금 더 높아요.' },
  'hormuz': { name: '호르무즈 해협', full: '호르무즈 해협',
    desc: '중동 산유국의 원유가 배로 나가는 좁은 통로예요. 여기가 막히면 공급 우려로 유가가 흔들리는 경우가 많아요.' },
  'foreign-net': { name: '외국인 순매수', full: '외국인 순매수 / 순매도',
    desc: '외국인 투자자가 산 금액에서 판 금액을 뺀 값이에요. 플러스면 순매수, 마이너스면 순매도라고 불러요.' },
  'kospi': { name: '코스피 / 코스닥', full: '코스피 / 코스닥',
    desc: '코스피는 국내 대형주 중심, 코스닥은 중소·기술기업 중심의 시장이에요. 두 지수가 다르게 움직이는 날이 자주 있어요.' },
  'hangseng': { name: '항셍지수', full: '항셍지수 (Hang Seng)',
    desc: '홍콩 증시의 대표 지수예요. 중국 본토 기업도 많이 포함돼 있어서 중국 시장을 보는 창구로 쓰여요.' },
  'non-gaap': { name: 'Non-GAAP', full: 'Non-GAAP',
    desc: '정해진 회계기준(GAAP)에서 일회성 비용 같은 항목을 빼고 회사가 다시 계산한 수치예요. 회사가 조정한 값이라 GAAP 수치와 다를 수 있어요.' },
  'consensus': { name: '컨센서스', full: '컨센서스 (consensus)',
    desc: '여러 증권사 애널리스트가 낸 전망치의 평균이에요. “상회”는 실제 실적이 이 평균보다 높게 나왔다는 뜻이에요.' },
  'guidance': { name: '가이던스', full: '가이던스 (guidance)',
    desc: '회사가 직접 제시하는 다음 분기 실적 전망이에요. 애널리스트가 아니라 회사가 내놓는 숫자라 시장이 특히 주의해서 봐요.' },
  'fcf': { name: 'FCF', full: 'FCF (잉여현금흐름)',
    desc: '영업으로 벌어들인 현금에서 설비 투자에 쓴 돈을 뺀 금액이에요. 공장을 크게 늘리는 시기에는 줄어드는 경우가 많아요.' },
  'target-price': { name: '목표주가 / 상승여력', full: '목표주가 · 상승여력',
    desc: '애널리스트가 적정하다고 본 주가가 목표주가이고, 현재가와의 차이가 상승여력이에요. 회사가 아니라 그 애널리스트의 견해예요.' },
  'per': { name: 'P/E (PER)', full: 'P/E · 주가수익비율',
    desc: '주가를 1주당 이익으로 나눈 값이에요. 이익 대비 주가가 몇 배에 거래되는지를 보는 지표예요.' },
  'hyperscaler': { name: '하이퍼스케일러', full: '하이퍼스케일러 (hyperscaler)',
    desc: '아주 큰 규모로 데이터센터를 운영하는 기업들을 말해요. 이들의 설비 투자 규모가 AI 관련 부품 수요를 좌우해요.' },
  'anchor': { name: '앵커 투자자', full: '앵커 투자자 (anchor investor)',
    desc: '기업공개(IPO) 때 일반 청약 전에 대량 물량을 미리 배정받기로 약속한 큰 투자자예요. 이름값이 있는 곳이 들어오면 흥행 신호로 읽히곤 해요.' },
  'disclosure': { name: '공시', full: '공시',
    desc: '상장사가 법에 따라 공식적으로 알리는 정보예요. 소문과 달리 내용에 법적 책임이 따라서, 회사들은 확인되지 않은 이야기에 “공시를 기준으로 해달라”고 답하는 경우가 많아요.' },
  'capex': { name: 'CapEx', full: 'CapEx (설비투자)',
    desc: '공장·장비·데이터센터처럼 오래 쓰는 자산에 쓰는 돈이에요. 늘리면 미래 생산능력이 커지지만 당장 현금은 줄어들어요.' },
};

/* --- 3. 원문 데이터 ----------------------------------------- */

const SOURCES = {
  'yieldnspread/6451': { ch: 'yieldnspread', id: 6451, at: '8/12 21:55',
    text: `- 7월 CPI: +3.4% YoY / +0.1% MoM

- 근원 CPI: +2.5% YoY / +0.2% MoM

- CPI와 근원 CPI의 YoY 상승률 모두 5월 4.2%·2.9% → 6월 3.5%·2.6% → 7월 3.4%·2.5%로 2개월 연속 둔화했으며, 7월 수치는 모두 시장 예상치에 부합

- CPI는 6월 -0.4%에서 7월 +0.1%로 반등했지만 에너지 -1.5%, 휘발유 -2.9%가 상승 폭을 제한한 결과. 다만 에너지와 휘발유의 YoY 상승률은 각각 +14.7%, +24.6%로 여전히 높은 수준

- 근원 CPI는 6월 0.0%에서 +0.2%로 반등. 주거비는 +0.1%에 그쳤지만 임대료와 자가주거비가 각각 +0.3%, 의료비 +0.4%, 항공료 +2.2%를 기록해 서비스물가의 잔존 압력 확인` },

  'deandatbond/1830': { ch: 'deandatbond', id: 1830, at: '8/13 07:58',
    text: `8/13 채권시장 동향

- 7월 CPI가 양호하게 발표되면서 선물시장에서의 금리 인상 확률 소폭 하락. 미국채 금리는 단기 금리 소폭 하락하며 커브 스팁 마감

- 선물시장에서 9월 인상 확률은 39%까지 하락. 12월 한 차례 인상 반영 중

- CPI 예상치 부합. 기여도를 보면 에너지가 헤드라인을 11bp 끌어내린 반면 근원 서비스가 13bp 끌어올림

- 10년 국채 입찰 수요는 소폭 부진. 낙찰금리 4.683%. 시장 기대(WI) 4.682%보다 1bp 높게 형성. 낙찰금리는 2007년 이후 최고치 기록` },

  'deandatbond/1829': { ch: 'deandatbond', id: 1829, at: '8/13 07:57',
    text: `8/13 Daily recap 공유드립니다

1️⃣채권
미국 2년 4.20% (-1.3bp)
미국 10년 4.69% (+0.4bp)
한국 3년 3.79% (-1.7bp)
한국 10년 4.29% (-0.7bp)

2️⃣FX
달러인덱스 100.0pt (+0.2%)
달러-원 1417.0원 (+0.4%)
달러-엔 159.4엔 (+0.1%)

3️⃣원자재
브렌트유 89.0 ($/bbl) (+0.1%)
금 4400.2 ($/oz) (+0.7%)` },

  'hanwhastrategy/28940': { ch: 'hanwhastrategy', id: 28940, at: '8/13 07:59',
    text: `★ 주식 아침 시황 (8/13)
- 다우지수 53,770.27pt -0.04%
  S&P500지수 7,748.50pt +0.26%
  나스닥지수 26,558.49pt +0.54%
- 뉴욕 증시는 7월 물가지표 발표 영향과 기술주 반등에 혼조 마감. 미국 7월 CPI는 전년대비 3.4% 오르며 시장 전망치에 부합. 이에 연준 금리 인상 우려 완화. 다만, 미국과 이란의 호르무즈 해협 관련 협상은 교착 상태 지속. 코어위브 등 AI 인프라 기업들의 호실적 발표에 견조한 AI 수요 재확인되며 마이크론(+4.92%), 엔비디아(+3.03%) 등 반도체 업종 전반 강세` },

  'hanwhastrategy/28941': { ch: 'hanwhastrategy', id: 28941, at: '8/13 07:59',
    text: `★ 환율 아침 시황 (8/13)
- 원/달러 환율 1,417.0원 +5.9원
  달러인덱스 100.01pt +0.19pt
- 원/달러 환율은 수급과 지정학적 리스크 영향 이어지며 상승 마감. 주간 장중 외국인의 코스피 순매수와 달러 선물 순매도 전환 영향 등으로 원화 강세 압력 지속. 다만 역내 저가 매수 심리에 따른 실수요로 원화 강세 폭은 다소 제한. 미국 7월 물가지표가 예상치에 부합한 가운데, 시장의 시선이 지정학적 리스크에 따른 유가 불확실성으로 이동하며 달러가 강해졌고 환율도 반등. 사우디 매체는 15일 이전 미국과 이란의 휴전 연장 가능성 보도` },

  'redbirdstock/8759': { ch: 'redbirdstock', id: 8759, at: '8/13 06:58', truncated: true,
    text: `제품 증설과정에서 약해진 FCF제외하고 전반적으로 양호한 실적이네요
컨콜이 중요할 것 같네요

----

[Coherent FY4Q26 실적]

*4Q FY26 실적
-매출 20.46억달러, 전년 대비 +42% pro forma, 전분기 대비 +13.3%
-FactSet 컨센서스 19.8억달러 대비 약 3.3% 상회
-Non-GAAP 매출총이익률 40.2%, 전년 38.1% 대비 +215bp
-Non-GAAP 영업이익률 21.8%, 전년 18.0% 대비 +380bp
-Non-GAAP EPS 1.74달러, 전년 1.00달러 대비 +74%
-FactSet 컨센서스 1.62달러 대비 약 7.4% 상회

*사업부별 매출
-Datacenter & Communications 매출 16.15억달러, 전년 대비 +58.6%
-전체 매출의 약 79%를 Datacenter & Communications가 차지
-Industrial 매출 4.31억달러, 전년 대비 -15.8%

*FY27 1Q 가이던스
-매출 22억~24억달러
-중간값 23억달러, FactSet 컨센서스 21.3억달러 대비 약 8.0% 상회
-Non-GAAP EPS 1.85~2.05달러` },

  'redbirdstock/8758': { ch: 'redbirdstock', id: 8758, at: '8/12 12:56',
    text: `>>NVIDIA, Zhongji Innolight·Eoptolink 투자설…회사들 긴급 부인·확인 거부

•최근 시장에서 NVIDIA가 광모듈 업체 Zhongji Innolight에 20억 달러를 전략적으로 투자하고, Eoptolink의 홍콩 IPO에도 앵커 투자자로 참여할 것이라는 소문이 확산

•NVIDIA의 Zhongji Innolight 투자는 차세대 광모듈 연구개발과 글로벌 생산능력 확대, 태국 신공장 건설 등에 활용될 것이라는 내용

•다만 8월 12일 Zhongji Innolight 측은 해당 시장 소문에 대해 "알지 못하며 회사의 관련 공시를 기준으로 해달라"고 답변. Eoptolink 역시 해당 소문에 대해 논평하기 어렵다며 H주 관련 사항은 공시를 기준으로 확인해달라고 밝힘 현재로서는 NVIDIA의 투자설을 뒷받침하는 공식 확인은 없는 상태` },

  'daishinstrategy/6212': { ch: 'daishinstrategy', id: 6212, at: '8/13 14:35', truncated: true,
    text: `[장 중 시황] 반도체가 주도한 증시, 실적주도 상승 대열 합류 [FICC리서치부 전략/시황: 이경민]

- 국내 증시 수익률(14시 30분): KOSPI +3.64% 상승 / 6,576.21pt
 (KOSDAQ: +0.09% 상승 / 858.60pt)
- 원/달러 환율 1414.6원 (+1.6원, 종가대비)
- 업종 Top3: 전기·전자(+5.74%), 제조(+4.46%), 기계·장비(+2.18%)
- 업종 Bottom3: 제약(-3.19%), 음식료·담배(-2.24%), 종이·목재(-1.35%)

코스피: 외국인 +23,683 억원 순매수 / 기관 +9,563 억원 순매수 / 개인 -31,344 억원 순매도
코스닥: 외국인 -1,486 억원 순매도 / 기관 -1,443 억원 순매도 / 개인 +2,990 억원 순매수

*코스피200선물: 외국인 +6,294 억원 순매수 / 기관 -11,490 억원 순매도 / 개인 +3,757 억원 순매수
*국고채3년선물: 외국인 -7,396 억원 순매도 / 기관 +7,308 억원 순매수 / 개인 +87 억원 순매수

- 국내 증시는 대형 반도체가 급등하며 강세 전개. 다만 반도체로의 쏠림은 제한적이었으며, 화장품, 전력기기, 방산 등 비반도체 업종도 동반 강세

반도체 업종은 빅테크의 실적 발표로 투자심리 고조되며 강세. 삼성전자(+6.4%), SK하이닉스(+5.1%), SK스퀘어(+7.9%) 등 상승

화장품 업종도 실적 발표로 이익 모멘텀 부각되며 상승. 한국콜마(+21.7%), 코스맥스(+17.4%), 달바글로벌(+5.7%), 에이피알(+2.5%) 강세

방산 업종은 저가매수세 유입되며 상승. 한화에어로스페이스(+7.8%), LIG디펜스앤에어로스페이스(+5.1%) 등 전반적으로 강세

반면, 제약/바이오 업종은 차익실현 매물 출회되며 하락. 셀트리온(-4.0%), 삼성바이오로직스(-3.2%) 등 약세

- 해외증시 오후장 흐름 및 코멘트

미국S&P500선물(+0.08%)
: 5천억달러 투자지원' 엔비디아, 건당 최대 25% 지원

중국상해종합지수(+0.23%), 홍콩항셍지수(-1.17%)
: 메타의 마누스 인수 백지화…미중 AI경쟁 심화 속 中당국 제동

일본니케이225(+0.74%)
: 日, 53조원대 외자 유치로 '반도체 패권' 재현 총력

WTI 선물이 배럴당 83달러 수준까지 상승했으나, 미국채 금리는 CPI 발표를 앞둔 경계감 속 상승폭 제한` },

  'daishinstrategy/6213': { ch: 'daishinstrategy', id: 6213, at: '8/13 08:10', truncated: true,
    text: `[8월 13일 주요국 이슈]

# 미국
도널드 트럼프 미국 대통령, 미국이 호르무즈 해협을 장악하고 있다고 주장. 지속해서 장악력을 유지할 것이라고 생각하며, 이란은 미국의 해상 봉쇄에 대해 아무 것도 할 수가 없다고 강조. 중재국들의 호르무즈 해협 관련 협상이 진전됐다는 관측 이어졌지만, 대외적으로 미국과 이란은 강경한 입장 고수.

한편 미 백악관, 미국 정부 관공서 기기에서 '틱톡' 사용 전면 금지 조치를 공식적으로 해제. 이는 바이트댄스가 미국 내 사업 통제권을 미국 주도의 합작 투자사에 넘기는 대규모 구조조정을 단행하여 국가 안보 위협 요소가 해소되었다고 판단.

# 중국
중국, 인도와의 국경 문제로 군사적 긴장이 고조. 인도 외교부, 1주일 사이 2번 중국과의 국경 평화를 강조. 다만, 중국군은 이달 초 다시 해당 지역에 출현하여 텐트 2개를 설치.

# 한국
정부, 7대 시드 프로젝트를 추진. SMR, 핵융합, 재생에너지, 양자, 우주항공, 첨단 바이오, 첨단 공급망 분야로 구성. SMR 경수형은 2035년 부산 기장군에 상용화하고, 비경수형은 2030년대 건설 착수를 목표로 개발.

# 경제지표
한국, 실업률 (7월): 2.8 (예상치: -, 이전치: 2.7)
미국, CPI (7월) (MoM/YoY): 0.1/3.4 (예상치: 0.1/3.4, 이전치: -0.4/3.5)
미국, 근원 CPI (7월) (MoM/YoY): 0.2/2.5 (예상치: 0.2/2.5, 이전치: 0.0/2.6)` },

  'aetherjapanresearch/24551': { ch: 'aetherjapanresearch', id: 24551, at: '8/13 09:20', truncated: true,
    text: `골드만삭스) NVDA 2분기 프리뷰 요약 (2026년 8월 11일, James Schneider 외)

골드만삭스는 이번 실적 발표에서 투자자들의 관심이 엔비디아가 최근 발표한 5,000억 달러 규모의 파트너 금융 플랫폼 세부 내용, 하반기 Rubin 제품 램프의 형태, 향후 총마진 추이, 그리고 에이전틱 AI에 따른 CPU 업사이드 네 가지에 집중될 것으로 보았습니다. 타이트한 GPU 수급을 바탕으로 가이던스를 의미 있게 상회하는 견조한 분기를 예상하지만, 주가가 2주간 12% 상승한 만큼 눈높이는 이미 높아져 있다고 평가했습니다. CY26/27 추정치는 컨센서스를 각각 6%, 19% 상회하며, 매수 의견과 목표주가 285달러를 유지했습니다.

구체적으로 FY2Q27 매출은 930.5억 달러(컨센서스 920.1억 달러 대비 1% 상회), 총마진 75.0%, EPS 2.18달러(2.05달러 대비 6% 상회)를 제시했으며, 데이터센터는 865.3억 달러를 전망했습니다.

총마진과 투입 비용: 엔비디아는 지난 두 분기 75% 이상의 강한 총마진을 보고했으나, 특히 HBM 메모리를 중심으로 투입 비용에 상당한 상승 압력이 있는 만큼 경영진이 향후 1년간의 총마진 전망을 어떻게 제시할지가 관건이라고 지적했습니다. 골드만삭스의 체크에 따르면 회사는 일부 Rubin 기반 서버에서 HBM 탑재량을 최대 50%까지 줄이는 방안을 모색하고 있는 것으로 파악됩니다.

밸류에이션과 관련해 골드만삭스는 12개월 목표주가 285달러를 정상화 EPS 추정치 9.50달러에 P/E 30배를 적용해 산출했습니다. 8월 10일 종가 217.55달러 기준 상승여력은 31.0%이며, 시가총액은 5.3조 달러입니다. 주요 하방 리스크로는 AI 인프라 지출 둔화, 경쟁 심화에 따른 점유율 잠식, 경쟁 심화로 인한 마진 잠식, 공급 제약을 제시했습니다.` },
};

/* --- 4. 이슈 데이터 ----------------------------------------- */

/** imp: 3 상 · 2 중 · 1 하. 카드 높이와 정렬에 쓴다. */
const ISSUES = [
  /* ===== 미국 ===== */
  {
    id: 'us-cpi', region: 'us', cat: 'rate', imp: 3,
    title: '미국 7월 물가가 시장 예상과 같게 나왔어요',
    metric: { value: '+3.4%', dir: 'flat', sub: '7월 CPI, 전년 대비 · 예상치 부합' },
    facts: [
      '7월 CPI는 전년 대비 <b>+3.4%</b>, 전월 대비 +0.1%. 근원 CPI는 +2.5% / +0.2%로 <b>모두 시장 예상치에 부합</b>했어요.',
      'CPI와 근원 CPI의 전년 대비 상승률은 5월 4.2%·2.9% → 6월 3.5%·2.6% → 7월 3.4%·2.5%로 <b>2개월 연속 둔화</b>했어요.',
      '에너지 −1.5%, 휘발유 −2.9%가 상승 폭을 제한했지만, 두 항목의 전년 대비 상승률은 각각 +14.7%, +24.6%로 여전히 높아요.',
      '선물시장의 <b>9월 금리 인상 확률은 39%까지 하락</b>했어요. 12월 한 차례 인상이 반영돼 있어요.',
      '미국채는 단기 금리가 소폭 내리며 커브 스팁으로 마감했어요.',
    ],
    sources: ['yieldnspread/6451', 'deandatbond/1830', 'hanwhastrategy/28940'],
    terms: ['core-cpi', 'yoy-mom', 'rate-prob', 'curve-steep'],
    notes: [
      '물가 지표가 나오는 날 채권과 주식이 함께 크게 움직이는 이유는, 물가가 중앙은행 금리 결정의 주요 입력값이기 때문이에요.',
      '시장은 숫자 자체보다 <b>예상치와의 차이</b>를 봐요. 같은 3.4%라도 예상이 3.2%였는지 3.6%였는지에 따라 반응이 달라져요.',
      '미국 CPI는 매달 중순에 발표돼요.',
    ],
    opinion: '예상치에 부합했다는 건 시장이 이미 이 정도를 반영해두고 있었다는 뜻이에요. 그래서 지수가 크게 움직이지 않았어요. 다만 헤드라인 3.4%만 보면 놓치는 게 있어요 — 원문에는 에너지·휘발유의 전년 대비 상승률이 각각 +14.7%, +24.6%로 높고, 서비스물가(임대료·의료비·항공료)도 오르고 있다고 적혀 있어요. 두 힘이 상쇄된 결과가 "예상 부합"입니다. 어느 쪽이 더 오래 갈지는 이 원문만으로 알 수 없어요.',
  },
  {
    id: 'us-auction', region: 'us', cat: 'rate', imp: 1,
    title: '미국 10년 국채 입찰 수요가 소폭 부진했어요',
    metric: { value: '4.683%', dir: 'up', sub: '낙찰금리 · 2007년 이후 최고' },
    facts: [
      '10년 국채 입찰의 <b>낙찰금리는 4.683%</b>로, 시장 기대(WI) 4.682%보다 1bp 높게 형성됐어요.',
      '이 낙찰금리는 <b>2007년 이후 최고치</b>예요.',
      '같은 날 미국 10년물 금리는 4.69%로 0.4bp 올랐고, 2년물은 4.20%로 1.3bp 내렸어요.',
    ],
    sources: ['deandatbond/1830', 'deandatbond/1829'],
    terms: ['bp', 'curve-steep'],
    notes: [
      '국채 입찰에서 낙찰금리가 시장 기대보다 높게 나오면 수요가 약했다는 신호로 읽혀요. 사려는 사람이 적으면 더 높은 금리를 줘야 팔리기 때문이에요.',
      'WI(when-issued)는 입찰 전에 미리 거래되는 가격에서 나온 시장 기대치예요.',
    ],
    opinion: '1bp 차이는 작은 숫자지만, 원문이 "2007년 이후 최고 낙찰금리"라고 짚은 건 수준 자체가 높다는 뜻이에요. 물가는 예상에 부합했는데 장기 금리는 내려오지 않은 하루였습니다. 이 둘이 왜 갈렸는지는 이 원문만으로는 알 수 없어요.',
  },
  {
    id: 'us-stock', region: 'us', cat: 'stock', imp: 2,
    title: '뉴욕 증시는 혼조 마감, 반도체가 강했어요',
    metric: { value: '+0.54%', dir: 'up', sub: '나스닥 26,558.49pt' },
    facts: [
      '나스닥 +0.54%(26,558.49pt), S&P500 +0.26%(7,748.50pt), <b>다우 −0.04%</b>(53,770.27pt)로 혼조 마감했어요.',
      '7월 CPI가 전망치에 부합해 <b>연준 금리 인상 우려가 완화</b>됐다고 원문은 설명해요.',
      '코어위브 등 AI 인프라 기업 호실적에 <b>마이크론 +4.92%, 엔비디아 +3.03%</b> 등 반도체 업종이 전반적으로 강했어요.',
      '미국과 이란의 호르무즈 해협 협상은 교착 상태가 이어졌어요.',
    ],
    sources: ['hanwhastrategy/28940'],
    terms: ['hyperscaler'],
    notes: [
      '세 지수가 다르게 움직이는 건 구성 종목이 다르기 때문이에요. 나스닥은 기술주 비중이 크고 다우는 30개 대형주만 담아요.',
      '"혼조"는 오른 지수와 내린 지수가 섞여 있다는 뜻이에요.',
    ],
    opinion: '같은 날 물가는 안심 재료였는데 다우만 내렸어요. 원문을 보면 상승 동력이 반도체·AI 인프라에 몰려 있었고, 그 종목들이 다우에는 적게 담겨 있습니다. "시장이 올랐다"보다 "AI 관련만 올랐다"가 이 하루를 더 정확히 설명해요.',
  },
  {
    id: 'us-coherent', region: 'us', cat: 'corp', imp: 3,
    title: 'Coherent 4분기 실적이 시장 예상을 넘었어요',
    metric: { value: '+42%', dir: 'up', sub: '4분기 매출, 전년 대비 · 20.46억달러' },
    facts: [
      '4분기 매출 <b>20.46억달러</b>(약 28,992억원). 전년 대비 +42%로, 컨센서스 19.8억달러를 <b>3.3% 넘었어요</b>.',
      'Non-GAAP EPS는 1.74달러로 전년 1.00달러 대비 +74%. 컨센서스 1.62달러를 7.4% 넘었어요.',
      '데이터센터·통신 부문이 16.15억달러로 <b>전체 매출의 79%</b>. 산업 부문은 전년 대비 −15.8%였어요.',
      '다음 분기 가이던스는 매출 22억~24억달러. 중간값 23억달러로 컨센서스 21.3억달러를 약 8.0% 넘었어요.',
      '채널은 “증설 과정에서 약해진 FCF를 빼면 전반적으로 양호한 실적”이라고 평했어요.',
    ],
    note: '20.46억달러 × 1,417원/달러 = 28,992억원 (환율은 8/13 채널 보도치)',
    sources: ['redbirdstock/8759'],
    terms: ['non-gaap', 'consensus', 'guidance', 'fcf'],
    notes: [
      '실적 발표에서 시장이 보는 건 대체로 세 가지예요. 매출·이익이 컨센서스를 넘었는지, 다음 분기 가이던스가 컨센서스보다 높은지, 성장이 어느 사업부에서 나왔는지.',
      'InP·CPO·실리콘 포토닉스는 광통신 부품에 쓰이는 기술 이름이에요.',
    ],
    opinion: '숫자는 네 군데 모두 컨센서스를 넘겼는데, 원문을 올린 채널이 굳이 집어 언급한 건 FCF와 컨콜이에요. 실적이 좋은데도 "컨콜이 중요하다"고 쓴 건, 발표된 숫자보다 회사가 설명할 내용에 무게를 뒀다는 뜻으로 읽혀요. 매출의 79%가 데이터센터·통신 한 부문에서 나오고 산업 부문은 −15.8%라, 성장이 한쪽에 몰려 있다는 점도 원문에 그대로 적혀 있어요.',
  },
  {
    id: 'us-nvda', region: 'us', cat: 'corp', imp: 2,
    title: '골드만삭스가 엔비디아 실적 프리뷰를 냈어요',
    metric: { value: '285달러', dir: 'flat', sub: '골드만삭스 12개월 목표주가 · 상승여력 31.0%' },
    facts: [
      '골드만삭스는 <b>매수 의견과 목표주가 285달러를 유지</b>했어요. 8월 10일 종가 217.55달러 기준 상승여력은 31.0%예요.',
      '목표주가는 정상화 EPS 9.50달러에 <b>P/E 30배</b>를 적용해 산출했다고 밝혔어요.',
      'FY2Q27 매출은 930.5억달러(컨센서스 920.1억달러 대비 1% 상회), EPS 2.18달러(2.05달러 대비 6% 상회)를 제시했어요.',
      '다만 <b>주가가 2주간 12% 올라 눈높이가 이미 높아져 있다</b>고 평가했어요.',
      'HBM 메모리를 중심으로 투입 비용 상승 압력이 있고, 회사가 일부 Rubin 서버에서 HBM 탑재량을 최대 50% 줄이는 방안을 모색 중인 것으로 파악됐다고 적었어요.',
      '하방 리스크로는 AI 인프라 지출 둔화, 점유율 잠식, 마진 잠식, 공급 제약을 들었어요.',
    ],
    sources: ['aetherjapanresearch/24551'],
    terms: ['target-price', 'per', 'consensus', 'hyperscaler'],
    notes: [
      '프리뷰는 실적 발표 전에 증권사가 미리 내는 전망 보고서예요. 발표된 실적이 아니라 예상치예요.',
      '목표주가는 "적정 이익 추정치 × 적용 배수"로 계산되는 경우가 많아요. 여기서는 EPS 9.50달러 × 30배 = 285달러입니다.',
    ],
    opinion: '이건 실적이 아니라 <b>한 증권사의 전망</b>이라는 점이 가장 중요해요. 목표주가 285달러도 골드만삭스의 견해고, 같은 원문에 "주가가 이미 2주간 12% 올라 눈높이가 높다"와 하방 리스크 네 가지가 함께 적혀 있어요. 상승여력 31%라는 숫자만 떼어 보면 원문이 담은 조건들이 사라집니다.',
  },
  {
    id: 'us-oil', region: 'us', cat: 'fx', imp: 2,
    title: '호르무즈 해협 협상이 교착되며 유가가 올랐어요',
    metric: { value: '$89.0', dir: 'up', sub: '브렌트유 · WTI는 배럴당 83달러 수준' },
    facts: [
      '브렌트유 <b>89.0달러/배럴(+0.1%)</b>, 금 4,400.2달러/온스(+0.7%)로 마감했어요.',
      '<b>WTI 선물은 배럴당 83달러 수준까지 상승</b>했다고 원문은 적었어요.',
      '트럼프 대통령은 미국이 호르무즈 해협을 장악하고 있다고 주장했고, 미국과 이란은 강경한 입장을 고수했어요.',
      '사우디 매체는 15일 이전 미국과 이란의 휴전 연장 가능성을 보도했어요.',
      '달러인덱스는 100.0pt로 0.2% 올랐어요.',
    ],
    sources: ['deandatbond/1829', 'daishinstrategy/6213', 'hanwhastrategy/28941'],
    terms: ['brent-wti', 'hormuz', 'dxy'],
    notes: [
      '유가는 실제 공급이 끊기지 않아도 "끊길 수 있다"는 우려만으로 움직이는 경우가 많아요.',
      '브렌트와 WTI 가격이 다른 건 생산지와 운송 조건이 달라서예요.',
    ],
    opinion: '원문 세 건이 같은 방향을 가리켜요 — 물가 지표가 지나가자 시장의 관심이 유가와 지정학으로 옮겨갔다는 것입니다. 다만 브렌트는 +0.1%로 거의 안 움직였고 WTI만 83달러까지 올랐다고 적혀 있어, 이 하루의 유가 반응이 얼마나 컸는지는 원문만으로는 단정하기 어려워요.',
  },

  /* ===== 한국 ===== */
  {
    id: 'kr-kospi', region: 'kr', cat: 'stock', imp: 3,
    title: '코스피가 3.64% 급등했어요. 반도체가 이끌었어요',
    metric: { value: '+3.64%', dir: 'up', sub: '코스피 6,576.21pt · 14시 30분 기준' },
    facts: [
      '코스피 <b>+3.64%(6,576.21pt)</b>, 코스닥 +0.09%(858.60pt)로 격차가 크게 벌어졌어요.',
      '업종 Top3는 전기·전자(+5.74%), 제조(+4.46%), 기계·장비(+2.18%)였어요.',
      '코스피에서 <b>외국인이 23,683억원, 기관이 9,563억원 순매수</b>했고 개인은 31,344억원 순매도했어요.',
      '삼성전자 +6.4%, SK하이닉스 +5.1%, SK스퀘어 +7.9% 등 대형 반도체가 급등했어요.',
      '반면 제약·바이오는 차익실현에 하락했어요. 셀트리온 −4.0%, 삼성바이오로직스 −3.2%.',
      '원/달러 환율은 1,414.6원(종가 대비 +1.6원)이었어요.',
    ],
    sources: ['daishinstrategy/6212'],
    terms: ['kospi', 'foreign-net'],
    notes: [
      '코스피와 코스닥이 크게 다르게 움직이면, 상승이 특정 대형주에 몰렸다는 신호로 보는 경우가 많아요.',
      '외국인·기관·개인 순매수 금액의 합은 대체로 0에 가까워요. 누군가 사면 누군가 팔기 때문이에요.',
    ],
    opinion: '지수는 3.64% 올랐지만 코스닥은 0.09%였어요. 원문을 보면 상승이 전기·전자 한 업종과 삼성전자·SK하이닉스에 집중돼 있습니다. 그리고 외국인·기관이 합쳐 3.3조원을 사고 개인이 3.1조원을 팔았어요. "시장 전체가 좋았다"기보다 "특정 대형주에 외국인 자금이 들어온 하루"로 읽는 게 원문에 더 가까워요.',
  },
  {
    id: 'kr-cosmetics', region: 'kr', cat: 'corp', imp: 2,
    title: '화장품 업종이 실적 발표에 크게 올랐어요',
    metric: { value: '+21.7%', dir: 'up', sub: '한국콜마 · 업종 전반 강세' },
    facts: [
      '<b>한국콜마 +21.7%, 코스맥스 +17.4%</b>, 달바글로벌 +5.7%, 에이피알 +2.5%로 강세였어요.',
      '원문은 <b>실적 발표로 이익 모멘텀이 부각</b>된 결과라고 설명해요.',
      '같은 날 방산 업종도 저가매수세에 올랐어요. 한화에어로스페이스 +7.8%.',
      '반도체 쏠림은 제한적이었고 화장품·전력기기·방산 등 비반도체 업종도 동반 강세였다고 적혀 있어요.',
    ],
    sources: ['daishinstrategy/6212'],
    terms: ['consensus'],
    notes: [
      '"이익 모멘텀"은 이익이 늘어나는 흐름이 확인됐다는 뜻으로 쓰이는 표현이에요.',
      '같은 업종 종목들이 함께 움직이면 개별 회사 이슈보다 업종 전체에 걸친 이유가 있는 경우가 많아요.',
    ],
    opinion: '하루 +21.7%는 큰 폭입니다. 다만 원문에는 "실적 발표로 이익 모멘텀 부각"이라는 한 줄만 있고, 어떤 수치가 어떻게 나왔는지는 적혀 있지 않아요. 이 카드로는 <b>얼마나 좋았는지 알 수 없습니다.</b> 판단하려면 해당 회사 실적 자료를 따로 봐야 해요.',
  },
  {
    id: 'kr-fx', region: 'kr', cat: 'fx', imp: 2,
    title: '원/달러 환율이 5.9원 올라 1,417원에 마감했어요',
    metric: { value: '+5.9원', dir: 'up', sub: '원/달러 1,417.0원 · 달러-원 +0.4%' },
    facts: [
      '원/달러 환율은 <b>1,417.0원으로 5.9원 상승</b> 마감했어요. 달러인덱스는 100.01pt(+0.19pt)였어요.',
      '장중에는 외국인의 코스피 순매수와 달러 선물 순매도 전환으로 원화 강세 압력이 이어졌어요.',
      '다만 역내 저가 매수 실수요로 원화 강세 폭은 제한됐다고 원문은 설명해요.',
      '물가 지표가 예상에 부합한 뒤 <b>시장의 시선이 유가 불확실성으로 옮겨가며 달러가 강해졌</b>고, 환율도 반등했어요.',
    ],
    sources: ['hanwhastrategy/28941', 'deandatbond/1829'],
    terms: ['dxy'],
    notes: [
      '원/달러 환율이 오르면 원화가 약해진 것이고, 같은 달러를 사려면 원화가 더 많이 필요해요.',
      '외국인이 국내 주식을 사면 달러를 원화로 바꾸므로 원화 강세 쪽으로 작용하는 경우가 많아요.',
    ],
    opinion: '이 카드는 방향이 두 번 뒤집히는 하루를 담고 있어요. 장중에는 외국인 순매수로 원화가 강해질 압력이 있었는데, 결과는 5.9원 상승(원화 약세)이었습니다. 원문은 그 이유를 "시선이 유가로 옮겨가며 달러가 강해졌다"로 설명해요. 같은 날 코스피 급등과 환율 상승이 같이 나온 배경입니다.',
  },
  {
    id: 'kr-bond', region: 'kr', cat: 'rate', imp: 1,
    title: '한국 국고채 금리가 소폭 내렸어요',
    metric: { value: '−1.7bp', dir: 'down', sub: '국고 3년 3.79% · 10년 4.29%' },
    facts: [
      '한국 3년물 <b>3.79%(−1.7bp)</b>, 10년물 4.29%(−0.7bp)로 마감했어요.',
      '같은 날 미국 2년물은 4.20%(−1.3bp), 10년물은 4.69%(+0.4bp)였어요.',
      '국고채3년선물에서 외국인은 7,396억원 순매도, 기관은 7,308억원 순매수했어요.',
    ],
    sources: ['deandatbond/1829', 'daishinstrategy/6212'],
    terms: ['ktb', 'bp'],
    notes: [
      '한국 국채 금리는 미국 금리 흐름을 따라가는 경향이 있어요. 다만 국내 수급이나 정책에 따라 갈라지기도 해요.',
      '금리가 내리면 채권 가격은 오릅니다. 둘은 반대로 움직여요.',
    ],
    opinion: '움직임 자체는 1~2bp로 작습니다. 눈에 띄는 건 방향이 갈렸다는 점이에요 — 한국은 3년·10년 모두 내렸는데 미국 10년은 올랐습니다. 국고채3년선물에서 외국인이 7,396억원 팔고 기관이 그만큼 산 것도 같은 날 기록이에요. 이 갈림이 일시적인지는 하루치 원문으로 알 수 없어요.',
  },

  /* ===== 중국 ===== */
  {
    id: 'cn-nvda-rumor', region: 'cn', cat: 'corp', imp: 3,
    title: 'NVIDIA 투자설이 돌았지만 중국 광모듈 2社가 확인을 거부했어요',
    metric: { value: '확인 안 됨', dir: 'none', sub: '공식 확인 없음 · 소문 단계' },
    facts: [
      'NVIDIA가 광모듈 업체 <b>Zhongji Innolight에 20억 달러를 투자</b>하고, Eoptolink의 홍콩 IPO에 앵커 투자자로 참여한다는 소문이 시장에 돌았어요.',
      '소문에는 투자금이 차세대 광모듈 연구개발, 글로벌 생산능력 확대, 태국 신공장 건설에 쓰인다는 내용이 담겼어요.',
      '8월 12일 Zhongji Innolight는 <b>“알지 못하며 회사의 공시를 기준으로 해달라”</b>고 답했어요.',
      'Eoptolink도 <b>논평하기 어렵다</b>며 공시를 기준으로 확인해달라고 밝혔어요.',
      '현재까지 이 투자설을 뒷받침하는 <b>공식 확인은 없어요</b>.',
    ],
    sources: ['redbirdstock/8758'],
    terms: ['anchor', 'disclosure'],
    notes: [
      '회사가 “알지 못한다”고 답하는 것은 부인과 다를 수 있어요. 사실이 아니라는 뜻일 수도 있고, 지금은 확인해줄 수 없다는 뜻일 수도 있어요.',
      '큰 기업의 투자설은 관련 부품사 주가를 먼저 움직이는 경우가 있어서, 확인 전에 소문만으로 퍼지기 쉬워요.',
      '홍콩 IPO에서 앵커 투자자 명단은 공모 절차 중 공개돼요.',
    ],
    opinion: '이 건의 핵심은 "아직 아무것도 확정되지 않았다"예요. 회사가 "알지 못한다"고 답한 것과 "사실이 아니다"라고 부인한 것은 다른데, 이번은 전자입니다. 그래서 지금 확실한 사실은 두 가지뿐이에요 — 소문이 돌았다, 두 회사가 확인을 거부했다. 20억 달러라는 숫자도 소문 안에 있는 값이고 어디서도 확인되지 않았어요.',
  },
  {
    id: 'cn-hk', region: 'cn', cat: 'stock', imp: 2,
    title: '상해는 올랐지만 홍콩은 1.17% 내렸어요',
    metric: { value: '−1.17%', dir: 'down', sub: '홍콩 항셍 · 상해종합은 +0.23%' },
    facts: [
      '중국 상해종합지수 +0.23%, <b>홍콩 항셍지수 −1.17%</b>로 방향이 갈렸어요.',
      '원문은 배경으로 “메타의 마누스 인수 백지화 — 미중 AI 경쟁 심화 속 中당국 제동”을 적었어요.',
      '같은 시간 미국 S&P500 선물은 +0.08%, 일본 니케이225는 +0.74%였어요.',
    ],
    sources: ['daishinstrategy/6212'],
    terms: ['hangseng'],
    notes: [
      '상해종합은 중국 본토 시장, 항셍은 홍콩 시장이에요. 참여하는 투자자와 규제가 달라 같은 날에도 다르게 움직여요.',
      '홍콩 증시에는 중국 기술기업이 많이 상장돼 있어 규제 뉴스에 민감한 편이에요.',
    ],
    opinion: '본토는 오르고 홍콩만 1.17% 내렸어요. 원문이 붙인 배경은 규제 관련 한 줄뿐이라, 이 하락이 그 뉴스 때문인지 다른 이유인지는 확인할 수 없습니다. 다만 같은 아시아 시간대에 니케이가 +0.74%였다는 점을 보면 지역 전체의 흐름은 아니었어요.',
  },

  /* ===== 일본 ===== */
  {
    id: 'jp-nikkei', region: 'jp', cat: 'stock', imp: 2,
    title: '니케이225가 0.74% 올랐어요',
    metric: { value: '+0.74%', dir: 'up', sub: '일본 니케이225' },
    facts: [
      '일본 <b>니케이225 +0.74%</b>로 마감했어요.',
      '원문이 붙인 배경은 “日, 53조원대 외자 유치로 반도체 패권 재현 총력”이었어요.',
      '같은 시간 중국 상해종합 +0.23%, 홍콩 항셍 −1.17%, 미국 S&P500 선물 +0.08%였어요.',
    ],
    sources: ['daishinstrategy/6212'],
    terms: [],
    notes: [
      '니케이225는 일본 대표 225개 종목으로 만든 지수예요. 가격가중 방식이라 주가가 높은 종목의 영향이 큽니다.',
      '아시아 증시는 같은 시간대에 열려 서로 영향을 주고받는 경우가 많아요.',
    ],
    opinion: '이 카드의 정보는 지수 한 줄과 배경 한 줄뿐입니다. 원문이 시황 요약의 일부로 짧게 언급한 것이라 <b>왜 올랐는지는 여기서 알 수 없어요.</b> 반도체 외자 유치와 연결짓고 싶어지지만, 원문은 그 인과를 적지 않았습니다.',
  },
  {
    id: 'jp-semi', region: 'jp', cat: 'corp', imp: 2,
    title: '일본이 53조원대 외자를 유치해 반도체에 투입한다고 해요',
    metric: { value: '53조원대', dir: 'flat', sub: '외자 유치 규모 · 원문 표기' },
    facts: [
      '원문은 <b>“日, 53조원대 외자 유치로 ‘반도체 패권’ 재현 총력”</b>이라고 적었어요.',
      '이 내용은 해외 증시 코멘트에서 니케이225(+0.74%)의 배경으로 한 줄 언급됐어요.',
      '금액·기간·참여 주체 등 세부 내용은 이 원문에 담겨 있지 않아요.',
    ],
    sources: ['daishinstrategy/6212'],
    terms: ['capex'],
    notes: [
      '각국이 반도체 생산시설을 자국에 두려는 흐름이 몇 년째 이어지고 있어요. 미국 CHIPS Act가 대표적인 예예요.',
      '"외자 유치"는 해외 자본을 자국 투자로 끌어오는 것을 말해요.',
    ],
    opinion: '이 카드는 <b>정보가 거의 없다는 것 자체가 정보</b>예요. 53조원대라는 숫자만 있고 어떤 기업이 얼마를 언제 투자하는지가 원문에 없습니다. 헤드라인만 보고 규모를 짐작하기 쉬운데, 확인된 건 "그런 방향의 보도가 있었다"까지입니다.',
  },
  {
    id: 'jp-yen', region: 'jp', cat: 'fx', imp: 1,
    title: '달러-엔이 159.4엔으로 소폭 올랐어요',
    metric: { value: '159.4엔', dir: 'up', sub: '달러-엔 +0.1%' },
    facts: [
      '달러-엔은 <b>159.4엔(+0.1%)</b>으로 마감했어요.',
      '같은 날 달러인덱스는 100.0pt(+0.2%), 달러-원은 1,417.0원(+0.4%)이었어요.',
      '세 통화 모두 달러 대비 약해진 방향이었어요.',
    ],
    sources: ['deandatbond/1829'],
    terms: ['dxy'],
    notes: [
      '달러-엔이 오르면 엔화가 약해진 것이에요. 1달러를 사는 데 엔이 더 많이 필요하다는 뜻이에요.',
      '달러인덱스가 오르는 날에는 여러 통화가 함께 약해지는 경우가 많아요.',
    ],
    opinion: '엔은 +0.1%, 원은 +0.4%로 같은 방향이었지만 폭이 달랐어요. 달러인덱스가 +0.2% 오른 날이라 달러 강세가 공통 원인으로 보이지만, 원화가 네 배 더 움직인 이유는 이 원문에 없습니다.',
  },
];

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
