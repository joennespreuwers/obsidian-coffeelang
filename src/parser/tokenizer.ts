/**
 * Tokenizer — ported from Rust src/tokenizer.rs
 */

export type Token =
  | { type: 'text'; value: string }
  | { type: 'bean'; name: string; body: string }
  | { type: 'equip'; name: string; body: string }
  | { type: 'pour'; name?: string; body: string }
  | { type: 'timer'; name?: string; body: string }
  | { type: 'grind'; body: string }
  | { type: 'tech'; name: string; body: string }

// Matches inline markers: @name{body}, #name{body}, *name?{body},
// ~name?{body}, ^{body}, +name{body}
// Group 1: symbol (@#*~^+)
// Group 2: name (optional for * and ~, absent for ^)
// Group 3: body (inside {})
const MARKER_RE = /([@#*~^+])([^\s{}\[\]]*)\{([^}]*)\}/g

/** Strip `--` line comments (from `--` to end of line). */
export function stripLineComment(line: string): string {
  const pos = line.indexOf('--')
  if (pos !== -1) {
    return line.slice(0, pos).trimEnd()
  }
  return line
}

/** Strip block comments `[- ... -]` from a full text. */
export function stripBlockComments(text: string): string {
  let result = ''
  let remaining = text

  while (true) {
    const start = remaining.indexOf('[-')
    if (start === -1) break

    result += remaining.slice(0, start)
    const closeIdx = remaining.indexOf('-]', start)
    if (closeIdx === -1) {
      // Unclosed block comment — consume the rest
      break
    }
    // Preserve newlines that were inside the block comment
    const block = remaining.slice(start, closeIdx + 2)
    const newlineCount = (block.match(/\n/g) || []).length
    result += '\n'.repeat(newlineCount)
    remaining = remaining.slice(closeIdx + 2)
  }

  result += remaining
  return result
}

/** Tokenize a single line of prose into a sequence of tokens. */
export function tokenizeLine(line: string): Token[] {
  const stripped = stripLineComment(line)
  if (!stripped) return []

  const tokens: Token[] = []
  let lastEnd = 0

  // Reset regex state
  MARKER_RE.lastIndex = 0

  let match: RegExpExecArray | null
  // We need a new regex each call since we use exec with global flag
  const re = new RegExp(MARKER_RE.source, 'g')

  while ((match = re.exec(stripped)) !== null) {
    const fullStart = match.index
    const fullEnd = fullStart + match[0].length
    const symbol = match[1]
    const nameStr = match[2]
    const body = match[3].trim()

    // Push any text before this marker
    const pre = stripped.slice(lastEnd, fullStart).trimEnd()
    if (pre) {
      tokens.push({ type: 'text', value: pre })
    }

    switch (symbol) {
      case '@':
        tokens.push({ type: 'bean', name: nameStr, body })
        break
      case '#':
        tokens.push({ type: 'equip', name: nameStr, body })
        break
      case '*':
        tokens.push({ type: 'pour', name: nameStr || undefined, body })
        break
      case '~':
        tokens.push({ type: 'timer', name: nameStr || undefined, body })
        break
      case '^':
        tokens.push({ type: 'grind', body })
        break
      case '+':
        tokens.push({ type: 'tech', name: nameStr, body })
        break
    }

    lastEnd = fullEnd
  }

  // Push trailing text
  const tail = stripped.slice(lastEnd).trimEnd()
  if (tail) {
    tokens.push({ type: 'text', value: tail })
  }

  return tokens
}

export interface PourSpec { amountG: number; cumulative: boolean; tempC?: number }

/** Parse a water pour body like "50g @93c", "=250g", "60g" */
export function parsePourSpec(body: string): PourSpec | null {
  const trimmed = body.trim()
  let cumulative = false
  let rest = trimmed

  if (trimmed.startsWith('=')) {
    cumulative = true
    rest = trimmed.slice(1)
  }

  // Split on first space: first token is amount, optional second is @temp
  const spaceIdx = rest.indexOf(' ')
  const amountStr = spaceIdx === -1 ? rest : rest.slice(0, spaceIdx)
  const tempStr = spaceIdx === -1 ? undefined : rest.slice(spaceIdx + 1).trim()

  const amountG = parseAmount(amountStr)
  if (amountG === null) return null

  let tempC: number | undefined
  if (tempStr && tempStr.startsWith('@')) {
    const parsed = parseTemp(tempStr.slice(1))
    if (parsed !== null) tempC = parsed
  }

  return { amountG, cumulative, tempC }
}

/** Parse an amount like "50g", "200ml", "7oz" → grams */
export function parseAmount(s: string): number | null {
  const trimmed = s.trim().toLowerCase()
  if (trimmed.endsWith('ml')) {
    const n = parseFloat(trimmed.slice(0, -2).trim())
    return isNaN(n) ? null : n
  } else if (trimmed.endsWith('oz')) {
    const n = parseFloat(trimmed.slice(0, -2).trim())
    return isNaN(n) ? null : n * 28.3495
  } else if (trimmed.endsWith('g')) {
    const n = parseFloat(trimmed.slice(0, -1).trim())
    return isNaN(n) ? null : n
  } else {
    const n = parseFloat(trimmed)
    return isNaN(n) ? null : n
  }
}

/** Parse a temperature string like "93c", "200f" → Celsius */
export function parseTemp(s: string): number | null {
  const trimmed = s.trim().toLowerCase()
  if (trimmed.endsWith('c')) {
    const n = parseFloat(trimmed.slice(0, -1).trim())
    return isNaN(n) ? null : n
  } else if (trimmed.endsWith('f')) {
    const n = parseFloat(trimmed.slice(0, -1).trim())
    return isNaN(n) ? null : (n - 32) * 5 / 9
  } else {
    const n = parseFloat(trimmed)
    return isNaN(n) ? null : n
  }
}

/** Parse a duration string like "45s", "2m 30s", "1:30" → total seconds */
export function parseDuration(s: string): number | null {
  const trimmed = s.trim()

  // Format: "Xm Ys" or "Xm"
  if (trimmed.includes('m')) {
    const parts = trimmed.split('m', 2)
    const mins = parseInt(parts[0].trim(), 10)
    if (isNaN(mins)) return null
    let secs = 0
    if (parts[1]) {
      const secPart = parts[1].trim().replace(/s$/, '').trim()
      if (secPart) {
        secs = parseInt(secPart, 10)
        if (isNaN(secs)) return null
      }
    }
    return mins * 60 + secs
  }

  // Format: "M:SS"
  if (trimmed.includes(':')) {
    const parts = trimmed.split(':', 2)
    const mins = parseInt(parts[0].trim(), 10)
    const secs = parseInt((parts[1] || '0').trim(), 10)
    if (isNaN(mins) || isNaN(secs)) return null
    return mins * 60 + secs
  }

  // Format: "Xs"
  if (trimmed.endsWith('s')) {
    const n = parseInt(trimmed.slice(0, -1).trim(), 10)
    return isNaN(n) ? null : n
  }

  // Special: "24h"
  if (trimmed.endsWith('h')) {
    const n = parseInt(trimmed.slice(0, -1).trim(), 10)
    return isNaN(n) ? null : n * 3600
  }

  const n = parseInt(trimmed, 10)
  return isNaN(n) ? null : n
}
