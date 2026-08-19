(() => {
  'use strict';

  const CURSOR_STORE = 'briefing:telegram-cursors:v1';

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

  function rowForUi(row) {
    const ch = CHANNELS.find((channel) => channel.id === row.id) || { id: row.id, name: row.name || row.id, last: 0 };
    return {
      ch,
      pending: false,
      ok: row.ok,
      count: row.count || 0,
      preview: row.preview || '',
      error: row.error || '',
    };
  }

  function openPanel() {
    const panel = document.getElementById('rf');
    if (panel) panel.hidden = false;
  }

  refresh = async function onDemandRefresh() {
    if (state.refreshing) return;
    state.refreshing = true;

    const btn = document.getElementById('btn-refresh');
    btn.classList.add('is-busy');
    btn.disabled = true;

    const pendingRows = CHANNELS.map((ch) => ({ ch, pending: true, count: 0 }));
    openPanel();
    renderRefresh(pendingRows, false);

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

      const rows = (payload.rows || []).map(rowForUi);
      renderRefresh(rows, true);
      const total = rows.filter((row) => row.ok).reduce((sum, row) => sum + row.count, 0);

      if (!payload.processed && total > 0) {
        toast('새 원문은 찾았지만 LLM 설정이 아직 없어요. Vercel에 OPENAI_API_KEY를 설정해주세요.');
        return;
      }

      if (payload.processed) saveCursors(payload.cursors || loadCursors());

      if (payload.items && payload.items.length && window.BRIEFING_GENERATED) {
        window.BRIEFING_GENERATED.save({ sources: payload.sources || {}, items: payload.items });
        toast(`새 이슈 ${payload.items.length}개를 정리했어요. 화면을 업데이트합니다.`);
        setTimeout(() => location.reload(), 450);
        return;
      }

      if (total > 0) toast(`새 원문 ${total}건을 확인했지만 새 이슈로 정리할 내용은 없었어요.`);
      else toast('새로 올라온 글이 없어요.');
    } catch (error) {
      const rows = CHANNELS.map((ch) => ({
        ch,
        pending: false,
        ok: false,
        count: 0,
        error: error && error.message ? error.message : '새로고침에 실패했어요.',
      }));
      renderRefresh(rows, true);
      toast('새로고침에 실패했어요. 아래 사유를 확인해주세요.');
    } finally {
      btn.classList.remove('is-busy');
      btn.disabled = false;
      state.refreshing = false;
    }
  };
})();
