/**
 * Split file text into [yamlString | null, body].
 * Looks for a leading `---\n ... \n---` block.
 */
export function splitFrontMatter(text: string): [string | null, string] {
  // Must start with ---
  if (!text.startsWith('---')) {
    return [null, text]
  }

  // Find end of first line
  const firstNewline = text.indexOf('\n')
  if (firstNewline === -1) {
    return [null, text]
  }

  // Search for closing --- on its own line
  const rest = text.slice(firstNewline + 1)
  // Match `---` at start of a line (possibly with trailing whitespace)
  const closeMatch = rest.match(/^---[ \t]*$/m)
  if (!closeMatch || closeMatch.index === undefined) {
    return [null, text]
  }

  const yamlStr = rest.slice(0, closeMatch.index)
  const afterClose = rest.slice(closeMatch.index + closeMatch[0].length)
  // Skip leading newline after closing ---
  const body = afterClose.startsWith('\n') ? afterClose.slice(1) : afterClose

  return [yamlStr, body]
}
