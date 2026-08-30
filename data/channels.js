/* Shared Telegram channel configuration.
 * Browser views and the server refresh API consume this same source of truth.
 */
(() => {
  'use strict';

  const channels = [
    { id: 'yieldnspread', name: 'YIELD & SPREAD', last: 6451 },
    { id: 'deandatbond', name: '[하나증권 해외채권] 허성우', last: 1830 },
    { id: 'hanwhastrategy', name: '한화투자증권 투자전략팀', last: 28941 },
    { id: 'redbirdstock', name: '레드버드 기업분석', last: 8759 },
    { id: 'daishinstrategy', name: '대신 전략. 돌직구', last: 6213 },
    { id: 'aetherjapanresearch', name: '에테르의 일본&미국 리서치', last: 24551 },
    { id: 'rafikiresearch', name: 'Rafiki research', last: 24303 },
  ];

  const frozen = Object.freeze(
    channels.map((channel) => Object.freeze({ ...channel })),
  );

  if (typeof window !== 'undefined') window.BRIEFING_CHANNELS = frozen;
  if (typeof module !== 'undefined' && module.exports) module.exports = frozen;
})();
