/**
 * Bean parser — ported from Rust src/bean.rs
 */
import { splitFrontMatter } from './frontmatter'
import { stripBlockComments, stripLineComment } from './tokenizer'
import { AltitudeRange, Bean, isValidProcess, isValidRoastLevel } from './types'

export function parseBean(
  text: string,
  parseYaml: (s: string) => Record<string, unknown>
): Bean {
  const cleaned = stripBlockComments(text)
  const [yamlStr, body] = splitFrontMatter(cleaned)

  const bean: Bean = {
    flavorNotes: [],
    notes: '',
    warnings: [],
  }

  if (yamlStr !== null) {
    try {
      const map = parseYaml(yamlStr) as Record<string, unknown>
      applyFrontMatter(bean, map)
    } catch (e) {
      bean.warnings.push(`Failed to parse front matter: ${e}`)
    }
  }

  bean.notes = parseProseBody(body)
  return bean
}

function applyFrontMatter(bean: Bean, map: Record<string, unknown>): void {
  for (const [key, val] of Object.entries(map)) {
    switch (key) {
      case 'name':
        if (typeof val === 'string') bean.name = val
        break
      case 'roastery':
        if (typeof val === 'string') bean.roastery = val
        break
      case 'origin_country':
        if (typeof val === 'string') bean.originCountry = val
        break
      case 'origin_region':
        if (typeof val === 'string') bean.originRegion = val
        break
      case 'farm':
        if (typeof val === 'string') bean.farm = val
        break
      case 'variety':
        if (typeof val === 'string') bean.variety = val
        break
      case 'process': {
        const s = typeof val === 'string' ? val : ''
        if (s) {
          if (!isValidProcess(s)) {
            bean.warnings.push(
              `Unknown process value '${s}'. Valid values: washed, natural, honey, anaerobic natural, anaerobic washed, carbonic maceration, extended fermentation, double fermented, lactic fermentation, koji fermentation, wine process, thermal shock, wet-hulled`
            )
          }
          bean.process = s
        }
        break
      }
      case 'roast_level': {
        const s = typeof val === 'string' ? val : ''
        if (s) {
          if (!isValidRoastLevel(s)) {
            bean.warnings.push(
              `Unknown roast_level value '${s}'. Valid values: ultra light, light, light-medium, medium, medium-dark, dark, very dark`
            )
          }
          bean.roastLevel = s
        }
        break
      }
      case 'altitude_masl':
        bean.altitudeMasl = parseAltitude(val, bean.warnings) ?? undefined
        break
      case 'harvest_date':
        bean.harvestDate = yamlValToString(val)
        break
      case 'roast_date':
        bean.roastDate = yamlValToString(val)
        break
      case 'flavor_notes':
        if (Array.isArray(val)) {
          bean.flavorNotes = val.filter((v): v is string => typeof v === 'string')
        } else if (typeof val === 'string') {
          bean.flavorNotes = [val]
        }
        break
      case 'price_per_100g':
        if (typeof val === 'number') {
          bean.pricePer100g = val
        } else if (typeof val === 'string') {
          const n = parseFloat(val)
          if (!isNaN(n)) bean.pricePer100g = n
        }
        break
      // Unknown keys are silently ignored (no extras map in TS version)
    }
  }
}

function parseAltitude(val: unknown, warnings: string[]): AltitudeRange | null {
  if (typeof val === 'number') {
    return { min: val, max: val }
  }
  if (typeof val === 'string') {
    // Try "1800-2200" range format
    const dashIdx = val.indexOf('-')
    if (dashIdx > 0) {
      const minStr = val.slice(0, dashIdx).trim()
      const maxStr = val.slice(dashIdx + 1).trim()
      const min = parseInt(minStr, 10)
      const max = parseInt(maxStr, 10)
      if (!isNaN(min) && !isNaN(max)) return { min, max }
    }
    const n = parseInt(val.trim(), 10)
    if (!isNaN(n)) return { min: n, max: n }
    warnings.push(`Could not parse altitude_masl: '${val}'`)
    return null
  }
  warnings.push(`Unexpected altitude_masl type: ${typeof val}`)
  return null
}

function yamlValToString(val: unknown): string {
  if (typeof val === 'string') return val
  if (typeof val === 'number' || typeof val === 'boolean') return String(val)
  return ''
}

function parseProseBody(body: string): string {
  const lines = body.split('\n').map(line => stripLineComment(line.trimEnd()))
  return lines.join('\n').trim()
}
