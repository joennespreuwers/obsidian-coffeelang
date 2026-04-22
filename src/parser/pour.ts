/**
 * Pour (recipe) parser — ported from Rust src/pour.rs
 */
import { splitFrontMatter } from './frontmatter'
import { stripBlockComments, tokenizeLine, Token, parsePourSpec, parseDuration, parseAmount } from './tokenizer'
import { BrewParameters, Recipe, Section, Step } from './types'
import { parseBean } from './bean'

/**
 * Parse the contents of a `.pour` file.
 * @param text - Raw file content
 * @param parseYaml - YAML parser function (injected to avoid obsidian dependency)
 * @param resolveBean - Optional: given a relative path, returns bean file text or null
 */
export function parsePour(
  text: string,
  parseYaml: (s: string) => Record<string, unknown>,
  resolveBean?: (path: string) => string | null
): Recipe {
  const cleaned = stripBlockComments(text)
  const [yamlStr, body] = splitFrontMatter(cleaned)

  const recipe: Recipe = {
    sections: [],
    warnings: [],
  }

  if (yamlStr !== null) {
    try {
      const map = parseYaml(yamlStr) as Record<string, unknown>
      applyFrontMatter(recipe, map, parseYaml)
    } catch (e) {
      recipe.warnings.push(`Failed to parse front matter: ${e}`)
    }
  }

  // Resolve bean reference
  if (recipe.beanRef && resolveBean) {
    const beanText = resolveBean(recipe.beanRef)
    if (beanText !== null) {
      recipe.bean = parseBean(beanText, parseYaml)
    } else {
      recipe.warnings.push(`Could not load bean file '${recipe.beanRef}'`)
    }
  } else if (recipe.beanRef && !resolveBean) {
    recipe.warnings.push(`Bean reference '${recipe.beanRef}' could not be resolved: no resolver provided`)
  }

  let pourSequence = 0
  recipe.sections = parseProseBody(body, pourSequence, recipe.warnings)
  // Re-count to update (pour_sequence is passed by reference in Rust; we handle inline)

  return recipe
}

function applyFrontMatter(
  recipe: Recipe,
  map: Record<string, unknown>,
  parseYaml: (s: string) => Record<string, unknown>
): void {
  for (const [key, val] of Object.entries(map)) {
    switch (key) {
      case 'title':
        if (typeof val === 'string') recipe.title = val
        break
      case 'bean':
        if (typeof val === 'string') recipe.beanRef = val
        break
      case 'brew_method':
        if (typeof val === 'string') recipe.brewMethod = val
        break
      case 'brew':
        recipe.brew = parseBrewParameters(val, recipe.warnings) ?? undefined
        break
      // Unknown keys silently ignored
    }
  }
}

function parseBrewParameters(val: unknown, warnings: string[]): BrewParameters | null {
  if (typeof val !== 'object' || val === null || Array.isArray(val)) return null
  const map = val as Record<string, unknown>

  const getNumber = (key: string): number | undefined => {
    const v = map[key]
    if (typeof v === 'number') return v
    if (typeof v === 'string') {
      const n = parseFloat(v)
      return isNaN(n) ? undefined : n
    }
    return undefined
  }

  const getInt = (key: string): number | undefined => {
    const v = map[key]
    if (typeof v === 'number') return Math.floor(v)
    if (typeof v === 'string') {
      const n = parseInt(v, 10)
      return isNaN(n) ? undefined : n
    }
    return undefined
  }

  const getString = (key: string): string | undefined => {
    const v = map[key]
    return typeof v === 'string' ? v : undefined
  }

  const filter = getString('filter')
  if (filter && !['paper', 'metal', 'cloth', 'none'].includes(filter)) {
    warnings.push(`Unknown filter value '${filter}'. Valid values: paper, metal, cloth, none`)
  }

  return {
    doseG: getNumber('dose_g'),
    yieldG: getNumber('yield_g'),
    ratio: getString('ratio'),
    waterTempC: getNumber('water_temp_c'),
    brewTimeSec: getInt('brew_time_sec'),
    grindSize: getString('grind_size'),
    brewer: getString('brewer'),
    grinder: getString('grinder'),
    filter,
  }
}

function parseProseBody(body: string, pourSequence: number, warnings: string[]): Section[] {
  const sections: Section[] = [{ name: undefined, steps: [] }]

  for (const rawLine of body.split('\n')) {
    const line = rawLine.trimEnd()

    // Section header ==Name==
    if (line.startsWith('==') && line.endsWith('==') && line.length > 4) {
      const name = line.slice(2, -2).trim()
      sections.push({ name, steps: [] })
      continue
    }

    // Note line > text (but not >>)
    if (line.startsWith('>') && !line.startsWith('>>')) {
      const note = line.slice(1).trim()
      if (note) {
        sections[sections.length - 1].steps.push({ type: 'note', value: note })
      }
      continue
    }

    // Inline override >> key: value
    if (line.startsWith('>>')) {
      const rest = line.slice(2).trim()
      const colonIdx = rest.indexOf(':')
      if (colonIdx !== -1) {
        const k = rest.slice(0, colonIdx).trim()
        const v = rest.slice(colonIdx + 1).trim()
        sections[sections.length - 1].steps.push({ type: 'inlineMetadata', key: k, value: v })
      }
      continue
    }

    // Strip line comment
    const commentIdx = line.indexOf('--')
    const cleanLine = commentIdx !== -1 ? line.slice(0, commentIdx).trimEnd() : line

    if (!cleanLine.trim()) continue

    const tokens = tokenizeLine(cleanLine)
    if (tokens.length === 0) continue

    const steps = tokensToSteps(tokens, pourSequence, warnings)
    // Update pourSequence from steps (count waterPour steps)
    for (const step of steps) {
      if (step.type === 'waterPour') {
        pourSequence = step.sequence
      }
    }
    sections[sections.length - 1].steps.push(...steps)
  }

  // Remove empty leading section if it has no steps
  if (sections.length > 1 && sections[0].steps.length === 0 && sections[0].name === undefined) {
    sections.shift()
  }

  return sections
}

function tokensToSteps(tokens: Token[], pourSequence: number, warnings: string[]): Step[] {
  const steps: Step[] = []
  const textParts: string[] = []

  const flushText = () => {
    if (textParts.length > 0) {
      steps.push({ type: 'text', value: textParts.join(' ') })
      textParts.length = 0
    }
  }

  for (const token of tokens) {
    if (token.type === 'text') {
      // Trim leading dashes/em-dashes
      const t = token.value.replace(/^[—\-]+/, '').trim()
      if (t) textParts.push(t)
    } else {
      flushText()
      const result = tokenToStep(token, pourSequence, warnings)
      if (result !== null) {
        if (result.type === 'waterPour') pourSequence = result.sequence
        steps.push(result)
      }
    }
  }

  flushText()
  return steps
}

function tokenToStep(token: Token, pourSequence: number, warnings: string[]): Step | null {
  switch (token.type) {
    case 'pour': {
      const spec = parsePourSpec(token.body)
      if (!spec) {
        warnings.push(`Could not parse pour spec: '${token.body}'`)
        return null
      }
      pourSequence++
      return {
        type: 'waterPour',
        name: token.name,
        amountG: spec.amountG,
        cumulative: spec.cumulative,
        tempC: spec.tempC,
        sequence: pourSequence,
      }
    }
    case 'timer': {
      const secs = parseDuration(token.body)
      if (secs === null) {
        warnings.push(`Could not parse duration: '${token.body}'`)
        return null
      }
      return { type: 'timer', name: token.name, totalSecs: secs }
    }
    case 'grind':
      return { type: 'grindSpec', description: token.body }
    case 'tech':
      return { type: 'technique', name: token.name, detail: token.body || undefined }
    case 'equip':
      return { type: 'equipment', name: token.name, detail: token.body || undefined }
    case 'bean': {
      const amountG = token.body ? (parseAmount(token.body) ?? undefined) : undefined
      return { type: 'beanRef', name: token.name, amountG }
    }
    default:
      return null
  }
}
