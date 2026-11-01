export function matchesSearch(data, needle, filters = {}) {
  const searchable = [data.name, data.text, data.attachment?.name].filter(Boolean).join(' ').toLocaleLowerCase();
  if (needle && !searchable.includes(needle)) return false;
  if (filters.author && String(data.name || '').toLocaleLowerCase() !== filters.author.toLocaleLowerCase()) return false;
  const time = Number(data.timestamp);
  if ((filters.from || filters.to) && (!Number.isFinite(time) || !time)) return false;
  if (filters.from && time < new Date(filters.from + 'T00:00:00').getTime()) return false;
  if (filters.to && time >= new Date(new Date(filters.to + 'T00:00:00').setDate(new Date(filters.to + 'T00:00:00').getDate() + 1)).getTime()) return false;
  if (filters.code && !/^\s*```[a-zA-Z0-9_+.-]*\s*$/m.test(data.text || '')) return false;
  const type = filters.type;
  if (type === 'image' && !data.image) return false;
  if (type === 'file' && !data.attachment) return false;
  if (type && !['image', 'file'].includes(type)) {
    const ext = String(data.attachment?.name || '').split('.').pop().toLowerCase();
    const groups = { pdf: ['pdf'], document: ['doc', 'docx'], spreadsheet: ['xls', 'xlsx', 'csv'], text: ['txt', 'md', 'markdown', 'json', 'xml', 'yaml', 'yml', 'log'] };
    if (!data.attachment || !groups[type]?.includes(ext)) return false;
  }
  return true;
}
