/* Shared Telegram channel configuration.
 *
 * Keep canonical channel metadata here. View-specific app.js files may still contain
 * legacy defaults during the Phase 1 migration, but phase1-hardening.js replaces
 * those arrays with this configuration at runtime.
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

  window.BRIEFING_CHANNELS = Object.freeze(
    channels.map((channel) => Object.freeze({ ...channel })),
  );
})();
