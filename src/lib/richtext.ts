/**
 * Minimal rich-text helpers for the notepad's bold/italic/underline
 * formatting. Notes are stored as a tiny HTML subset inside the save file;
 * anything outside the whitelist is stripped on every write AND before
 * rendering, so a hand-edited (or hostile) save file can never inject
 * markup beyond b/i/u and line structure.
 */

const ALLOWED = ['b', 'i', 'u', 'strong', 'em', 'br', 'div', 'p'] as const;
const ALLOWED_SET = new Set<string>(ALLOWED);
/** Matches a '<' that does NOT start a clean, attribute-free allowed tag. */
const STRAY_LT = new RegExp(`<(?!\\/?(?:${ALLOWED.join('|')})>)`, 'gi');

/** Reduce arbitrary HTML to the allowed subset: bare allowed tags survive
 *  (attributes dropped), everything else keeps only its text content. */
export function sanitizeRichText(html: string): string {
  let out = html.replace(/<!--[\s\S]*?-->/g, '');
  // Normalize every well-formed tag: allowed names → bare tag, rest → gone.
  out = out.replace(/<\s*(\/?)\s*([a-zA-Z][a-zA-Z0-9]*)((?:"[^"]*"|'[^']*'|[^>])*)>/g, (_m, slash: string, name: string) => {
    const n = name.toLowerCase();
    return ALLOWED_SET.has(n) ? `<${slash}${n}>` : '';
  });
  // Any remaining '<' can't be one of our bare tags — neutralize it.
  return out.replace(STRAY_LT, '&lt;');
}

export function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

const LOOKS_RICH = new RegExp(`<(?:${ALLOWED.join('|')})[\\s/>]`, 'i');

/** Stored value → contentEditable HTML. Pre-formatting notepads were plain
 *  text, so anything without our tags is escaped and newline-converted. */
export function toEditableHtml(value: string): string {
  if (!value) return '';
  return LOOKS_RICH.test(value) ? sanitizeRichText(value) : escapeHtml(value).replace(/\n/g, '<br>');
}

/** True when the HTML holds no visible text (empty editor showing a placeholder). */
export function isRichEmpty(html: string): boolean {
  return html.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim() === '';
}
