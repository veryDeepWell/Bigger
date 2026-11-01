let state = null;
export function canFollowMessages() { return !state?.restoring && !document.hidden; }
const rows = () => [...document.querySelectorAll('#messages .message')];
function persist(s) { try { localStorage.setItem(s.key, s.last || ''); } catch { /* Чат работает и при недоступном localStorage. */ } }
function refresh(s) {
  if (state !== s || s.restoring) return;
  const messages = rows();
  const unread = messages.filter(m => !m.classList.contains('my-message') && m.dataset.id > (s.last || ''));
  s.badge.textContent = unread.length ? 'Непрочитано: ' + unread.length + ' ↓' : 'К новым сообщениям ↓';
  s.badge.hidden = !unread.length;
  const firstNew = s.boundary && messages.find(m => m.dataset.id > s.boundary && !m.classList.contains('my-message'));
  if (firstNew) firstNew.before(s.divider);
  else s.divider.remove();
}
function schedule(s) {
  if (state !== s || s.restoring) return;
  refresh(s); clearTimeout(s.timer);
  s.timer = setTimeout(() => {
    if (state !== s || s.restoring || document.hidden || document.getElementById('chatScreen').classList.contains('hidden')) return;
    const rect = s.box.getBoundingClientRect();
    for (const m of rows()) {
      const r = m.getBoundingClientRect();
      if (r.bottom > rect.top + 4 && r.bottom <= rect.bottom + 2 && m.dataset.id > (s.last || '')) s.last = m.dataset.id;
    }
    persist(s); refresh(s);
  }, 400);
}
export function startReading(user) {
  stopReading();
  const key = 'chat_last_read_v1:' + user;
  let saved = ''; try { saved = localStorage.getItem(key) || ''; } catch {}
  const s = { key, last: saved, boundary: saved, restoring: true, box: document.getElementById('messages') }; state = s;
  s.divider = document.createElement('div'); s.divider.className = 'unread-divider'; s.divider.textContent = 'Новые сообщения'; s.divider.setAttribute('role', 'separator');
  s.badge = document.createElement('button'); s.badge.className = 'unread-counter'; s.badge.hidden = true; s.badge.type = 'button';
  s.badge.onclick = () => {
    const first = rows().find(m => !m.classList.contains('my-message') && m.dataset.id > (s.last || ''));
    first?.scrollIntoView({ block: 'start', behavior: 'smooth' });
  };
  s.box.after(s.badge);
  s.onScroll = () => schedule(s); s.onVisibility = () => schedule(s);
  s.box.addEventListener('scroll', s.onScroll); document.addEventListener('visibilitychange', s.onVisibility);
  s.observer = new MutationObserver(records => { if (records.some(r => [...r.addedNodes, ...r.removedNodes].some(n => n.nodeType === 1 && (n.matches?.('.message') || n.closest?.('.message'))))) schedule(s); });
  s.observer.observe(s.box, { childList: true, subtree: true });
  s.resize = new ResizeObserver(() => schedule(s)); s.resize.observe(s.box);
}
export async function restoreReading(loadOlder) {
  const s = state; if (!s || !s.restoring) return;
  if (s.last) {
    while (state === s) {
      const first = rows()[0];
      if (!first || first.dataset.id <= s.last) break;
      if (!await loadOlder()) break;
    }
  }
  if (state !== s) return;
  // Дожидаемся размеров уже загруженных изображений перед расчётом scrollTop.
  const images = [...(s.box.querySelectorAll?.('img') || [])].filter(img => !img.complete && typeof img.decode === 'function');
  if (images.length) {
    let timeout;
    await Promise.race([
      Promise.all(images.map(img => img.decode().catch(() => {}))),
      new Promise(resolve => { timeout = setTimeout(resolve, 1500); })
    ]);
    clearTimeout(timeout);
  }
  if (state !== s) return;
  s.restoring = false; refresh(s);
  const anchor = rows().find(m => m.dataset.id === s.boundary);
  const next = rows().find(m => m.dataset.id > s.boundary);
  if (s.boundary && (anchor || next)) {
    // Позиция относительно контейнера не прокручивает всю страницу.
    const target = anchor || next;
    s.box.scrollTop += target.getBoundingClientRect().top - s.box.getBoundingClientRect().top;
  } else s.box.scrollTop = s.box.scrollHeight;
  schedule(s);
}
export function stopReading() {
  const s = state; if (!s) return;
  clearTimeout(s.timer); s.observer.disconnect(); s.resize.disconnect();
  s.box.removeEventListener('scroll', s.onScroll); document.removeEventListener('visibilitychange', s.onVisibility);
  s.badge.remove(); s.divider.remove(); persist(s); state = null;
}
