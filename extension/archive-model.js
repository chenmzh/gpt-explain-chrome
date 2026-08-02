const MAX_TITLE_LENGTH = 72;
const MAX_ANCHOR_CONTEXT = 160;

function compactText(value = "") {
  return String(value).replace(/\s+/g, " ").trim();
}

export function archiveTitle(state = {}) {
  const source = compactText(state.source?.text);
  if (source) return source.length > MAX_TITLE_LENGTH
    ? `${source.slice(0, MAX_TITLE_LENGTH - 1)}…`
    : source;
  return compactText(state.source?.title) || "未命名解释";
}

export function sourceDomain(url = "") {
  try { return new URL(url).hostname; } catch { return ""; }
}

export function searchableRecordText(state = {}) {
  return [
    state.source?.text,
    state.source?.title,
    sourceDomain(state.source?.url),
    ...(state.messages || []).map((message) => message.text)
  ].filter(Boolean).join("\n").toLocaleLowerCase();
}

export function makeArchiveRecord(state = {}) {
  if (!state.resultId) throw new Error("Archive record requires resultId");
  return {
    ...state,
    id: state.resultId,
    title: archiveTitle(state),
    sourceDomain: sourceDomain(state.source?.url),
    searchableText: searchableRecordText(state),
    archivedAt: Date.now()
  };
}

export function normalizeSelectionAnchor(anchor = {}) {
  const quote = String(anchor.quote || "").trim().slice(0, 2_000);
  if (!quote) return null;
  return {
    messageId: String(anchor.messageId || "source").slice(0, 180),
    startOffset: Number.isInteger(anchor.startOffset) && anchor.startOffset >= 0
      ? anchor.startOffset
      : null,
    endOffset: Number.isInteger(anchor.endOffset) && anchor.endOffset >= 0
      ? anchor.endOffset
      : null,
    quote,
    prefix: String(anchor.prefix || "").slice(-MAX_ANCHOR_CONTEXT),
    suffix: String(anchor.suffix || "").slice(0, MAX_ANCHOR_CONTEXT)
  };
}

export function locateSelectionAnchor(text = "", anchor = {}) {
  const quote = String(anchor.quote || "");
  if (!quote) return null;
  const startOffset = Number.isInteger(anchor.startOffset) ? anchor.startOffset : -1;
  const endOffset = Number.isInteger(anchor.endOffset) ? anchor.endOffset : -1;
  if (startOffset >= 0 && endOffset > startOffset
    && text.slice(startOffset, endOffset).trim() === quote.trim()) {
    return { startOffset, endOffset };
  }

  const matches = [];
  let from = 0;
  while (from <= text.length - quote.length) {
    const index = text.indexOf(quote, from);
    if (index < 0) break;
    const prefix = String(anchor.prefix || "");
    const suffix = String(anchor.suffix || "");
    let score = 0;
    if (prefix && text.slice(Math.max(0, index - prefix.length), index).endsWith(prefix)) score += 2;
    if (suffix && text.slice(index + quote.length, index + quote.length + suffix.length).startsWith(suffix)) score += 2;
    if (startOffset >= 0) score -= Math.abs(index - startOffset) / Math.max(text.length, 1);
    matches.push({ startOffset: index, endOffset: index + quote.length, score });
    from = index + Math.max(quote.length, 1);
  }
  matches.sort((a, b) => b.score - a.score);
  return matches[0] || null;
}

export function makeRelationEdge(parentRecordId, childRecordId, anchor, createdAt = Date.now()) {
  if (!parentRecordId || !childRecordId) return null;
  return {
    id: `${parentRecordId}::${childRecordId}`,
    fromRecordId: parentRecordId,
    toRecordId: childRecordId,
    relationType: "explains-selection",
    anchor: normalizeSelectionAnchor(anchor) || {
      messageId: "source",
      startOffset: null,
      endOffset: null,
      quote: "选中的内容",
      prefix: "",
      suffix: ""
    },
    createdAt
  };
}

export function filterArchiveRecords(records = [], query = "") {
  const needle = compactText(query).toLocaleLowerCase();
  if (!needle) return [...records];
  return records.filter((record) => String(record.searchableText || "").includes(needle));
}

export function layoutArchiveGraph(records = [], edges = []) {
  const recordsById = new Map(records.map((record) => [record.id, record]));
  const validEdges = edges.filter((edge) => (
    recordsById.has(edge.fromRecordId) && recordsById.has(edge.toRecordId)
  ));
  const incoming = new Map(records.map((record) => [record.id, 0]));
  const children = new Map(records.map((record) => [record.id, []]));
  for (const edge of validEdges) {
    incoming.set(edge.toRecordId, (incoming.get(edge.toRecordId) || 0) + 1);
    children.get(edge.fromRecordId)?.push(edge.toRecordId);
  }

  const depth = new Map();
  const queue = records
    .filter((record) => incoming.get(record.id) === 0)
    .sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0))
    .map((record) => record.id);
  if (!queue.length && records.length) queue.push(records[0].id);
  for (const id of queue) depth.set(id, 0);
  while (queue.length) {
    const id = queue.shift();
    for (const childId of children.get(id) || []) {
      const nextDepth = (depth.get(id) || 0) + 1;
      if (nextDepth >= records.length) continue;
      if (!depth.has(childId) || nextDepth > depth.get(childId)) depth.set(childId, nextDepth);
      if (!queue.includes(childId)) queue.push(childId);
    }
  }
  for (const record of records) if (!depth.has(record.id)) depth.set(record.id, 0);

  const layers = new Map();
  for (const record of records) {
    const level = Math.min(depth.get(record.id) || 0, Math.max(records.length - 1, 0));
    if (!layers.has(level)) layers.set(level, []);
    layers.get(level).push(record);
  }
  for (const layer of layers.values()) {
    layer.sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
  }

  const nodes = [];
  let maxLayerSize = 1;
  for (const [level, layer] of layers.entries()) {
    maxLayerSize = Math.max(maxLayerSize, layer.length);
    layer.forEach((record, index) => nodes.push({
      id: record.id,
      record,
      depth: level,
      x: 120 + level * 250,
      y: 85 + index * 132
    }));
  }
  const maxDepth = Math.max(0, ...nodes.map((node) => node.depth));
  return {
    nodes,
    edges: validEdges,
    width: Math.max(820, 340 + maxDepth * 250),
    height: Math.max(520, 120 + maxLayerSize * 132)
  };
}
