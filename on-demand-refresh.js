(() => {
  'use strict';

  const CURSOR_STORE = 'briefing:telegram-cursors:v1';

  // app.js defines REGIONS in the shared classic-script scope. This file is loaded
  // after app.js but before DOMContentLoaded, so Europe is present when buildPins() runs.
  if (typeof REGIONS !== 'undefined' && !REGIONS.some((region) => region.id === 'eu')) {
    REGIONS.push({ id: 'eu', name: '유럽', en: 'EUROPE', lat: 50.5, lon: 10 });
  }

  function loadCursors() {
    try {
      const parsed = JSON.parse(localStorage.getItem(CURSOR_STORE) || '{}');
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
    } catch {
      return {};
    }
  }

  function saveCursors(cursors) {
    try { localStorage.setItem(CURSOR_STORE, JSON.stringify(cursors || {})); } catch { /* best effort */ }
  }

  function updateGeneratedTimestamp() {
    if (!window.BRIEFING_GENERATED) return;
    const snapshot = window.BRIEFING_GENERATED.load();
    if (!snapshot.generatedAt) return;
    const date = new Date(snapshot.generatedAt);
    if (!Number.isFinite(date.getTime())) return;
    const label = `${date.getMonth() + 1}/${date.getDate()} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
    const stat = document.getElementById('stat-snap');
    if (stat) stat.textContent = label;
  }

  refresh = async function onDemandRefresh() {
    if (state.refreshing) return;
    state.refreshing = true;

    const btn = document.getElementById('btn-refresh');
    btn.classList.add('is-busy');
    btn.disabled = true;
    toast('새 Telegram 글을 확인하고 있어요.');

    try {
      const existing = window.BRIEFING_GENERATED ? window.BRIEFING_GENERATED.load() : { items: [] };
      const response = await fetch('/api/refresh', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          cursors: loadCursors(),
          existingItems: existing.items || [],
        }),
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload.ok) throw new Error(payload.error || `새로고침 API가 ${response.status}로 답했어요.`);

      const rows = Array.isArray(payload.rows) ? payload.rows : [];
      const total = rows.filter((row) => row.ok).reduce((sum, row) => sum + (row.count || 0), 0);

      if (!payload.processed && total > 0) {
        toast('새 원문은 찾았지만 Gemini 설정이 아직 없어요. Vercel에 GEMINI_API_KEY를 설정해주세요.');
        return;
      }

      if (payload.processed) saveCursors(payload.cursors || loadCursors());

      if (payload.items && payload.items.length && window.BRIEFING_GENERATED) {
        window.BRIEFING_GENERATED.save({ sources: payload.sources || {}, items: payload.items });
        toast(`새 이슈 ${payload.items.length}개를 지구본에 반영했어요.`);
        setTimeout(() => location.reload(), 300);
        return;
      }

      if (total > 0) toast(`새 원문 ${total}건을 확인했지만 새 이슈로 정리할 내용은 없었어요.`);
      else toast('새로 올라온 글이 없어요.');
    } catch (error) {
      const message = error && error.message ? error.message : '알 수 없는 오류';
      toast(`새로고침에 실패했어요: ${message.slice(0, 180)}`);
    } finally {
      btn.classList.remove('is-busy');
      btn.disabled = false;
      state.refreshing = false;
    }
  };

  document.addEventListener('DOMContentLoaded', updateGeneratedTimestamp);
})();
