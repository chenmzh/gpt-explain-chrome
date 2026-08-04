const AMBIGUOUS_STRONG = /(?<!\\)\*\*(?=\S)((?:(?!\*\*)[^\n])+?[\p{P}\p{S}])\*\*(?=[\p{L}\p{N}])/gu;

export function splitAmbiguousStrongText(value = "") {
  const text = String(value);
  const matches = [...text.matchAll(AMBIGUOUS_STRONG)];
  if (!matches.length) return null;

  const parts = [];
  let offset = 0;
  for (const match of matches) {
    if (match.index > offset) parts.push({ text: text.slice(offset, match.index) });
    parts.push({ strong: match[1] });
    offset = match.index + match[0].length;
  }
  if (offset < text.length) parts.push({ text: text.slice(offset) });
  return parts;
}
