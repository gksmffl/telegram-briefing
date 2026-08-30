(() => {
  'use strict';
  // v0.5 cursor baseline: all posts through the 2026-08-31 snapshot are already represented.
  const channels = [
  {
    "id": "yieldnspread",
    "name": "YIELD & SPREAD",
    "last": 6508
  },
  {
    "id": "deandatbond",
    "name": "[하나증권 해외채권] 허성우",
    "last": 1896
  },
  {
    "id": "hanwhastrategy",
    "name": "한화투자증권 투자전략팀",
    "last": 29012
  },
  {
    "id": "redbirdstock",
    "name": "레드버드 기업분석",
    "last": 8869
  },
  {
    "id": "daishinstrategy",
    "name": "대신 전략. 돌직구",
    "last": 6251
  },
  {
    "id": "aetherjapanresearch",
    "name": "에테르의 일본&미국 리서치",
    "last": 24867
  },
  {
    "id": "rafikiresearch",
    "name": "Rafiki research",
    "last": 24743
  }
];
  const frozen = Object.freeze(channels.map((channel) => Object.freeze({ ...channel })));
  if (typeof window !== 'undefined') window.BRIEFING_CHANNELS = frozen;
  if (typeof module !== 'undefined' && module.exports) module.exports = frozen;
})();
