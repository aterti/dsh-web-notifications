// Plain-text rendering of assistant markdown for notification bodies.
// Pure string helpers: no I/O, no dependencies.

// Fenced code blocks are dropped: a one-line preview of prose answers should
// not spend its budget on code. Images become noise without their alt text.
const FENCE = /```[\s\S]*?```/g
const IMAGE = /!\[[^\]]*\]\([^)]*\)/g
// Links keep their label, inline code keeps its content.
const LINK = /\[([^\]]*)\]\([^)]*\)/g
const INLINE_CODE = /`([^`]*)`/g
const EMPHASIS = /(\*\*|__|\*|_)/g
const HEADING = /^#{1,6}\s+/gm
const QUOTE = /^>\s?/gm
const LIST_ITEM = /^\s*(?:[-*+]|\d+\.)\s+/gm
const TABLE_DIVIDER = /^\s*\|?[\s:|-]+\|?\s*$/gm

/**
 * Collapse markdown into a single trimmed line and truncate it to at most
 * `maxChars` characters (including the ellipsis) on a word boundary.
 * @param markdown - raw assistant text.
 * @param maxChars - hard character cap for the result.
 * @returns the notification body.
 */
export function plainLine(markdown, maxChars) {
  let text = String(markdown ?? '')
  text = text.replace(FENCE, ' ').replace(IMAGE, ' ')
  text = text.replace(LINK, '$1').replace(INLINE_CODE, '$1')
  text = text.replace(EMPHASIS, '').replace(HEADING, '').replace(QUOTE, '')
  text = text.replace(LIST_ITEM, '').replace(TABLE_DIVIDER, '')
  text = text.replace(/\s+/g, ' ').trim()
  return truncateAtWord(text, maxChars)
}

/**
 * Truncate text to at most `maxChars` characters (including the ellipsis),
 * cutting at the last word boundary when one falls in the later half of the
 * cut window; otherwise hard-cut so long unbroken tokens still fit the cap.
 * @param text - text to truncate.
 * @param maxChars - hard character cap.
 * @returns the truncated text.
 */
export function truncateAtWord(text, maxChars) {
  if (text.length <= maxChars) return text
  const cut = text.slice(0, Math.max(maxChars - 1, 0))
  const boundary = cut.lastIndexOf(' ')
  const head = boundary > cut.length * 0.5 ? cut.slice(0, boundary) : cut
  return `${head.trimEnd()}…`
}
