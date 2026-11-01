let gallery = [], index = 0, scale = 1, x = 0, y = 0, previousFocus;
const el = id => document.getElementById(id);
function transform() { el('viewerImage').style.transform = `translate(${x}px, ${y}px) scale(${scale})`; el('viewerZoom').textContent = Math.round(scale * 100) + '%'; }
function show() {
  const item = gallery[index];
  scale = 1; x = y = 0; transform();
  el('viewerImage').src = item.src;
  el('viewerCaption').textContent = item.caption;
  el('viewerCount').textContent = `${index + 1} / ${gallery.length}`;
  el('viewerDownload').href = item.src;
  const mime = item.src.match(/^data:image\/([^;,]+)/)?.[1] || 'png';
  el('viewerDownload').download = 'image-' + (index + 1) + '.' + (mime === 'jpeg' ? 'jpg' : (mime === 'svg+xml' ? 'svg' : mime.replace(/[^a-z0-9]/gi, '')));
  el('viewerPrev').disabled = index === 0;
  el('viewerNext').disabled = index === gallery.length - 1;
}
function close() { el('imageViewer').classList.add('hidden'); el('viewerImage').removeAttribute('src'); gallery = []; previousFocus?.focus(); }
export function initImageViewer() {
  const viewer = el('imageViewer');
  // Выносим из stacking context основного контейнера, чтобы шапка не перекрывала панель.
  document.body.appendChild(viewer);
  viewer.setAttribute('role', 'dialog'); viewer.setAttribute('aria-modal', 'true'); viewer.setAttribute('aria-label', 'Просмотр изображения');
  viewer.innerHTML = '<div class="viewer-toolbar"><span id="viewerCount"></span><button id="viewerOut" aria-label="Уменьшить">−</button><button id="viewerZoom" title="Сбросить масштаб">100%</button><button id="viewerIn" aria-label="Увеличить">+</button><a id="viewerDownload" download>Скачать</a><button id="viewerClose" aria-label="Закрыть">✕</button></div><button id="viewerPrev" class="viewer-nav viewer-prev" aria-label="Предыдущее изображение">‹</button><div id="viewerStage"><img id="viewerImage" alt="Просмотр" draggable="false"></div><button id="viewerNext" class="viewer-nav viewer-next" aria-label="Следующее изображение">›</button><p id="viewerCaption"></p>';
  const zoom = factor => { scale = Math.max(1, Math.min(8, scale * factor)); if (scale === 1) x = y = 0; transform(); };
  el('viewerClose').onclick = close;
  el('viewerPrev').onclick = () => { if (index > 0) { index--; show(); } };
  el('viewerNext').onclick = () => { if (index < gallery.length - 1) { index++; show(); } };
  el('viewerIn').onclick = () => zoom(1.25); el('viewerOut').onclick = () => zoom(.8);
  el('viewerZoom').onclick = () => { scale = 1; x = y = 0; transform(); };
  const stage = el('viewerStage'); let drag = null;
  stage.addEventListener('wheel', e => { e.preventDefault(); zoom(e.deltaY < 0 ? 1.15 : 1 / 1.15); }, { passive: false });
  stage.onpointerdown = e => { if (scale <= 1 || e.button !== 0) return; drag = { id: e.pointerId, x: e.clientX - x, y: e.clientY - y }; stage.setPointerCapture(e.pointerId); };
  stage.onpointermove = e => { if (drag?.id !== e.pointerId) return; x = e.clientX - drag.x; y = e.clientY - drag.y; transform(); };
  stage.onpointerup = stage.onpointercancel = () => { drag = null; };
  document.addEventListener('keydown', e => {
    if (viewer.classList.contains('hidden')) return;
    if (e.key === 'Escape') close();
    if (e.key === 'ArrowLeft') el('viewerPrev').click();
    if (e.key === 'ArrowRight') el('viewerNext').click();
    if (e.key === 'Tab') {
      const focusable = [...viewer.querySelectorAll('button:not(:disabled), a[href]')];
      const first = focusable[0], last = focusable.at(-1);
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  });
}
export function openImageViewer(imageSrc, messageId) {
  gallery = [...document.querySelectorAll('#messages .message > img')].map(img => ({ src: img.src, id: img.closest('.message').dataset.id, caption: img.dataset.caption || '' }));
  index = gallery.findIndex(item => messageId ? item.id === messageId : item.src === imageSrc);
  if (index < 0) { gallery = [{ src: imageSrc, caption: '' }]; index = 0; }
  previousFocus = document.activeElement;
  el('imageViewer').classList.remove('hidden'); show(); el('viewerClose').focus();
}
