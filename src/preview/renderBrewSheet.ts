import { Recipe, Step } from '../parser/types'

// A pre-processed step: pours immediately followed by a timer are merged.
type DisplayStep =
  | { kind: 'prose';  text: string }
  | { kind: 'note';   text: string }
  | { kind: 'pour';   name?: string; amountG: number; tempC?: number; waitSecs?: number; cumulativeTotal: number; isLast: boolean }
  | { kind: 'tech';   name: string; detail?: string }

export function renderBrewSheetInto(recipe: Recipe, container: HTMLElement): void {
  const sheet = container.createEl('div', { cls: 'brew-sheet' })

  // ── Header ──────────────────────────────────────────────────
  const header = sheet.createEl('div', { cls: 'brew-header' })
  header.createEl('h1', { cls: 'brew-title', text: recipe.title ?? 'Untitled Recipe' })
  if (recipe.brewMethod) {
    header.createEl('span', { cls: 'brew-method-badge', text: recipe.brewMethod })
  }

  // ── Bean strip ──────────────────────────────────────────────
  const bean = recipe.bean
  if (bean) {
    const strip = sheet.createEl('div', { cls: 'bean-strip' })
    const top = strip.createEl('div', { cls: 'bean-strip-top' })

    const nameBlock = top.createEl('div', { cls: 'bean-strip-name-block' })
    if (bean.name) nameBlock.createEl('span', { cls: 'bean-strip-name', text: bean.name })
    if (bean.roastery) nameBlock.createEl('span', { cls: 'bean-strip-roastery', text: bean.roastery })

    const badges = top.createEl('div', { cls: 'bean-strip-badges' })
    if (bean.process) badges.createEl('span', { cls: 'bean-badge process', text: bean.process })
    if (bean.roastLevel) badges.createEl('span', { cls: 'bean-badge roast', text: bean.roastLevel + ' roast' })

    if (bean.flavorNotes.length > 0) {
      const flavors = strip.createEl('div', { cls: 'bean-strip-flavors' })
      for (const note of bean.flavorNotes) {
        flavors.createEl('span', { cls: 'flavor-tag', text: note })
      }
    }
  } else if (recipe.beanRef) {
    sheet.createEl('div', {
      cls: 'bean-strip bean-strip-missing',
      text: `⚠ Bean file not found: ${recipe.beanRef}`,
    })
  }

  // ── Brew params ─────────────────────────────────────────────
  if (recipe.brew) {
    const brew = recipe.brew
    const params = sheet.createEl('div', { cls: 'brew-params' })
    const add = (label: string, value: string | undefined) => {
      if (!value) return
      const c = params.createEl('div', { cls: 'brew-param-cell' })
      c.createEl('div', { cls: 'param-value', text: value })
      c.createEl('div', { cls: 'param-label', text: label })
    }
    if (brew.doseG != null)       add('Dose',  `${brew.doseG}g`)
    if (brew.yieldG != null)      add('Yield', `${brew.yieldG}g`)
    if (brew.ratio)               add('Ratio', brew.ratio)
    if (brew.waterTempC != null)  add('Temp',  `${Math.round(brew.waterTempC)}°C`)
    if (brew.brewTimeSec != null) add('Time',  formatDuration(brew.brewTimeSec))
    if (brew.grindSize)           add('Grind', brew.grindSize)
  }

  // ── Sections ────────────────────────────────────────────────
  // Count total pours for the ✓ marker
  let totalPours = 0
  for (const s of recipe.sections) {
    for (const step of s.steps) {
      if (step.type === 'waterPour') totalPours = step.sequence
    }
  }

  let cumulativeWater = 0
  let stepNum = 0

  for (const section of recipe.sections) {
    const sectionEl = sheet.createEl('div', { cls: 'brew-section' })
    if (section.name) {
      sectionEl.createEl('div', { cls: 'brew-section-header', text: section.name })
    }

    const display = buildDisplaySteps(section.steps, cumulativeWater, totalPours)
    // Update cumulative for next section
    for (const s of section.steps) {
      if (s.type === 'waterPour') {
        cumulativeWater = s.cumulative ? s.amountG : cumulativeWater + s.amountG
      }
    }

    const stepsEl = sectionEl.createEl('div', { cls: 'brew-steps' })
    for (const ds of display) {
      if (ds.kind === 'note') {
        stepsEl.createEl('div', { cls: 'brew-note', text: ds.text })
        continue
      }

      stepNum++
      const card = stepsEl.createEl('div', { cls: `brew-step-card step-${ds.kind}` })
      card.createEl('div', { cls: 'step-num', text: String(stepNum) })
      const body = card.createEl('div', { cls: 'step-body' })

      if (ds.kind === 'pour') {
        // Left: name + amount + temp
        const left = body.createEl('span', { cls: 'pour-line' })
        if (ds.name) left.createEl('span', { cls: 'pour-name', text: ds.name })
        left.createEl('span', { cls: 'pour-amount', text: `${ds.amountG}g` })
        if (ds.tempC != null) {
          left.createEl('span', { cls: 'pour-temp', text: `@ ${Math.round(ds.tempC)}°C` })
        }
        if (ds.waitSecs != null) {
          left.createEl('span', { cls: 'pour-wait', text: `· wait ${formatDuration(ds.waitSecs)}` })
        }
        // Right: running total
        const right = card.createEl('div', { cls: 'step-right' })
        right.createEl('span', { cls: 'pour-total', text: `→ ${ds.cumulativeTotal}g` })
        if (ds.isLast) right.createEl('span', { cls: 'pour-check', text: '✓' })
      } else if (ds.kind === 'prose') {
        body.setText(ds.text)
      } else if (ds.kind === 'tech') {
        body.createEl('span', { cls: 'tech-name', text: ds.name })
        if (ds.detail) body.createEl('span', { cls: 'tech-detail', text: ` — ${ds.detail}` })
      }
    }
  }

  if (recipe.warnings.length > 0) {
    const warn = sheet.createEl('div', { cls: 'brew-warnings' })
    for (const w of recipe.warnings) warn.createEl('div', { cls: 'brew-warning', text: `⚠ ${w}` })
  }
}

/**
 * Collapse raw Step[] into DisplayStep[]:
 * - Prose tokens (text, equipment, beanRef, grind) accumulate into one step
 * - Pour immediately followed by a timer merges into a single pour+wait step
 * - Notes stay separate and unnumbered
 */
function buildDisplaySteps(
  steps: Step[],
  initialCumulative: number,
  totalPours: number
): DisplayStep[] {
  const display: DisplayStep[] = []
  let proseParts: string[] = []
  let cumulative = initialCumulative

  const flushProse = () => {
    const text = proseParts
      .filter(Boolean)
      .join(' ')
      .replace(/\s{2,}/g, ' ')
      .replace(/\s([.,])/g, '$1')
      .trim()
    proseParts = []
    if (text) display.push({ kind: 'prose', text })
  }

  let i = 0
  while (i < steps.length) {
    const step = steps[i]

    switch (step.type) {
      case 'text': {
        const t = step.value.replace(/^[-—\s]+/, '').trim()
        if (t) proseParts.push(t)
        i++
        break
      }
      case 'equipment':
        proseParts.push(step.name)
        i++
        break
      case 'beanRef':
        proseParts.push(step.amountG != null ? `${step.name} (${step.amountG}g)` : step.name)
        i++
        break
      case 'grindSpec':
        proseParts.push(step.description)
        i++
        break
      case 'inlineMetadata':
        i++
        break
      case 'note':
        flushProse()
        display.push({ kind: 'note', text: step.value })
        i++
        break
      case 'waterPour': {
        flushProse()
        cumulative = step.cumulative ? step.amountG : cumulative + step.amountG

        // Peek ahead: merge with immediately following timer
        const next = steps[i + 1]
        const waitSecs = next?.type === 'timer' ? next.totalSecs : undefined
        if (waitSecs != null) i++ // consume the timer

        display.push({
          kind: 'pour',
          name: step.name,
          amountG: step.amountG,
          tempC: step.tempC,
          waitSecs,
          cumulativeTotal: cumulative,
          isLast: step.sequence === totalPours,
        })
        i++
        break
      }
      case 'timer': {
        // Standalone timer (not merged with a pour)
        flushProse()
        display.push({ kind: 'prose', text: `Wait ${formatDuration(step.totalSecs)}` })
        i++
        break
      }
      case 'technique': {
        flushProse()
        display.push({ kind: 'tech', name: step.name, detail: step.detail })
        i++
        break
      }
      default:
        i++
    }
  }
  flushProse()
  return display
}

function formatDuration(secs: number): string {
  const m = Math.floor(secs / 60)
  const s = secs % 60
  if (m === 0) return `${s}s`
  if (s === 0) return `${m}m`
  return `${m}m ${s}s`
}
