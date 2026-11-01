export function createCodeBlock(text, language) {
  const box = document.createElement('section'); box.className = 'code-panel';
  const bar = document.createElement('div'); bar.className = 'code-toolbar';
  const label = document.createElement('span'); label.textContent = language; bar.append(label);
  const pre = document.createElement('pre'); pre.className = 'fmt-code-block';
  const button = (label, action) => { const b = document.createElement('button'); b.type = 'button'; b.textContent = label; b.onclick = () => action(b); bar.append(b); return b; };
  button('Копировать', async b => {
    try { await navigator.clipboard.writeText(text); b.textContent = 'Скопировано'; }
    catch { b.textContent = 'Не удалось скопировать'; }
    setTimeout(() => b.textContent = 'Копировать', 1800);
  });
  button('Скачать', () => {
    const extensions = { javascript: 'js', typescript: 'ts', python: 'py', bash: 'sh', csharp: 'cs', plaintext: 'txt', markdown: 'md' };
    const url = URL.createObjectURL(new Blob([text], { type: 'text/plain;charset=utf-8' }));
    const a = document.createElement('a'); a.href = url; a.download = 'code.' + (extensions[language] || language.replace(/[^a-z0-9]/gi, '') || 'txt'); a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  });
  const wrap = button('Перенос строк', b => { const enabled = box.classList.toggle('code-wrap'); b.setAttribute('aria-pressed', String(enabled)); }); wrap.setAttribute('aria-pressed', 'false');
  if (text.split('\n').length > 16) {
    box.classList.add('code-collapsed');
    const collapse = button('Развернуть', b => { const collapsed = box.classList.toggle('code-collapsed'); b.textContent = collapsed ? 'Развернуть' : 'Свернуть'; b.setAttribute('aria-expanded', String(!collapsed)); }); collapse.setAttribute('aria-expanded', 'false');
  }
  const code = document.createElement('code'); code.className = 'language-' + language;
  text.split('\n').forEach((line, i) => {
    const row = document.createElement('span'); row.className = 'code-line'; row.dataset.line = i + 1;
    if (language === 'diff') {
      if (line.startsWith('+') && !line.startsWith('+++')) row.classList.add('diff-added');
      if (line.startsWith('-') && !line.startsWith('---')) row.classList.add('diff-removed');
    }
    const content = document.createElement('span'); content.textContent = line || ' ';
    row.append(content); code.append(row);
  });
  // Подсветка целого блока сохраняет контекст многострочных строк и комментариев.
  if (globalThis.hljs?.getLanguage(language)) {
    try {
      const highlighted = globalThis.hljs.highlight(text, { language }).value;
      const template = document.createElement('template'); template.innerHTML = highlighted;
      // Распределяем DOM подсветки по строкам, сохраняя вложенные span.
      let lineIndex = 0;
      const targets = [...code.children].map(row => { const target = row.firstChild; target.textContent = ''; return target; });
      function distribute(node, ancestors = []) {
        if (node.nodeType === 3) {
          node.textContent.split('\n').forEach((part, i) => {
            if (i) lineIndex++;
            if (!targets[lineIndex]) return;
            let parent = targets[lineIndex];
            for (const ancestor of ancestors) { const clone = ancestor.cloneNode(false); parent.append(clone); parent = clone; }
            parent.append(document.createTextNode(part));
          });
        } else for (const child of node.childNodes) distribute(child, node.nodeType === 1 ? [...ancestors, node] : ancestors);
      }
      distribute(template.content);
    } catch (error) { console.warn('Подсветка кода недоступна', error); }
  }
  pre.append(code); box.append(bar, pre); return box;
}
