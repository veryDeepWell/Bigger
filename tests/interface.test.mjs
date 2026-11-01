import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';
const root = new URL('../', import.meta.url);
const source = path => fs.readFile(new URL(path, root), 'utf8');
const filter = new vm.SourceTextModule(await source('modules/searchFilters.js'));
await filter.link(() => {}); await filter.evaluate();
const { matchesSearch } = filter.namespace;
const sample = { name: 'Макс', text: 'Отчёт', timestamp: new Date('2026-11-01T12:00:00').getTime(), attachment: { name: 'Report.PDF' } };
assert(matchesSearch(sample, '', { author: 'макс', type: 'pdf', from: '2026-10-26', to: '2026-11-01' }));
assert(!matchesSearch(sample, '', { author: 'Друг' }));
assert(!matchesSearch(sample, '', { to: '2026-10-31' }));
assert(!matchesSearch(sample, '', { from: '2026-11-02' }));
assert(!matchesSearch(sample, '', { code: true }));
assert(matchesSearch({ ...sample, text: '```js\nlet x = 1;\n```' }, '', { code: true }));
assert(!matchesSearch({ ...sample, timestamp: null }, '', { from: '2026-10-26' }));
assert(matchesSearch(sample, 'report', {}));
assert(!matchesSearch(sample, '', { type: 'image' }));
// Проверяем, что фильтры проходят через настоящий поиск и работают за первой страницей.
const records = Array.from({ length: 95 }, (_, i) => ({ key: String(i).padStart(4, '0'), val: () => i === 2 ? sample : { name: 'Друг', text: 'обычное сообщение' } }));
const dummy = () => {};
const backend = { push: dummy, onChildAdded: dummy, onChildChanged: dummy, onChildRemoved: dummy, serverTimestamp: dummy, ref: dummy, update: dummy, onValue: dummy,
  query: (_, ...parts) => parts, orderByKey: () => ({}), endAt: key => ({ end: key }), limitToLast: limit => ({ limit }),
  get: async parts => { const end = parts.find(p => p.end)?.end; const limit = parts.find(p => p.limit).limit; const page = records.filter(r => !end || r.key <= end).slice(-limit); return { forEach: fn => page.forEach(fn) }; }
};
function synthetic(values) { return new vm.SyntheticModule(Object.keys(values), function () { for (const [key, value] of Object.entries(values)) this.setExport(key, value); }); }
const chat = new vm.SourceTextModule(await source('modules/chat.js'));
await chat.link(specifier => {
  if (specifier.endsWith('searchFilters.js')) return filter;
  if (specifier.endsWith('reading.js')) return synthetic({ startReading: dummy, restoreReading: dummy, stopReading: dummy });
  if (specifier.endsWith('firebase.js')) return synthetic({ db: {}, messagesRef: {} });
  if (specifier.startsWith('https:')) return synthetic(backend);
  if (specifier.endsWith('ui.js')) return synthetic({ displayMessage: dummy, updateMessageStatus: dummy });
  if (specifier.endsWith('notifications.js')) return synthetic({ showNotification: dummy });
  throw Error(specifier);
});
await chat.evaluate();
const results = await chat.namespace.searchMessages('', { filters: { author: 'Макс', type: 'pdf', from: '2026-10-26', to: '2026-11-01' } });
assert.equal(results.length, 1); assert.equal(results[0].id, '0002');
assert.equal((await chat.namespace.searchMessages('', { filters: {} })).length, 0);
assert.equal((await chat.namespace.searchMessages('обычное', { maxResults: 3 })).length, 3);
// Синтаксис всех модулей.
for (const file of ['app.js', ...(await fs.readdir(new URL('modules/', root))).filter(n => n.endsWith('.js')).map(n => 'modules/' + n)]) new vm.SourceTextModule(await source(file));
// Проверяем локальное чтение: подгрузку старой позиции, скрытую вкладку и очистку сессии.
let rendered = [], timer, stored = '0002', pageLoads = 0;
const events = new Map();
const makeElement = () => ({ className: '', textContent: '', hidden: false, type: '',
  setAttribute() {}, remove() {}, before() {}, after() {},
  addEventListener(name, fn) { events.set(name, fn); }, removeEventListener(name) { events.delete(name); },
  classList: { contains: () => false }, getBoundingClientRect: () => ({ top: 0, bottom: 45 }) });
const box = Object.assign(makeElement(), { scrollTop: 0, scrollHeight: 400 });
const row = i => Object.assign(makeElement(), { dataset: { id: String(i).padStart(4, '0') }, getBoundingClientRect: () => ({ top: i * 10, bottom: i * 10 + 10 }) });
rendered = Array.from({ length: 20 }, (_, i) => row(i + 20));
const documentStub = { hidden: false, querySelectorAll: () => rendered, createElement: makeElement,
  getElementById: id => id === 'messages' ? box : makeElement(), addEventListener: (name, fn) => events.set(name, fn), removeEventListener: name => events.delete(name) };
const context = vm.createContext({ document: documentStub, localStorage: { getItem: () => stored, setItem: (_, value) => stored = value },
  MutationObserver: class { observe() {} disconnect() {} }, ResizeObserver: class { observe() {} disconnect() {} },
  setTimeout: fn => { timer = fn; return 1; }, clearTimeout: () => { timer = undefined; } });
const reading = new vm.SourceTextModule(await source('modules/reading.js'), { context }); await reading.link(() => {}); await reading.evaluate();
reading.namespace.startReading('Макс'); assert.equal(reading.namespace.canFollowMessages(), false);
await reading.namespace.restoreReading(async () => { pageLoads++; rendered = [...Array.from({ length: 20 }, (_, i) => row(i)), ...rendered]; return true; });
assert.equal(pageLoads, 1); assert.equal(box.scrollTop, 20); assert.equal(stored, '0002');
documentStub.hidden = true; timer(); assert.equal(stored, '0002');
documentStub.hidden = false; events.get('visibilitychange')(); timer(); assert.equal(stored, '0003');
reading.namespace.stopReading(); assert.equal(events.has('scroll'), false);
// Размеры картинок должны быть известны до восстановления позиции.
let releaseImage;
box.querySelectorAll = () => [{ complete: false, decode: () => new Promise(resolve => { releaseImage = resolve; }) }];
reading.namespace.startReading('Макс');
const restoringImages = reading.namespace.restoreReading(async () => false);
assert.equal(reading.namespace.canFollowMessages(), false);
releaseImage(); await restoringImages;
assert.equal(reading.namespace.canFollowMessages(), true);
reading.namespace.stopReading();
console.log('Проверки фильтров, пагинации, локального чтения, загрузки изображений и синтаксиса пройдены.');
