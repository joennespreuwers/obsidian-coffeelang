import { ItemView, WorkspaceLeaf, TFile, parseYaml } from 'obsidian'
import { parsePour } from '../parser/pour'
import { parseBean } from '../parser/bean'
import { Recipe, Section, Step } from '../parser/types'

export const VIEW_TYPE_BREW_SHEET = 'coffeelang-brew-sheet'

export class BrewSheetView extends ItemView {
  private file: TFile | null = null

  constructor(leaf: WorkspaceLeaf, app: import('obsidian').App) {
    super(leaf)
  }

  getViewType(): string { return VIEW_TYPE_BREW_SHEET }
  getDisplayText(): string { return this.file ? this.file.basename : 'Brew sheet' }
  getIcon(): string { return 'coffee' }

  async onOpen(): Promise<void> {
    this.containerEl.empty()
    this.containerEl.addClass('coffeelang-view')
  }

  async setFile(file: TFile): Promise<void> {
    this.file = file
    const text = await this.app.vault.read(file)

    // Pre-load bean file asynchronously before parsing
    const beanCache: Record<string, string> = {}
    const beanRefMatch = text.match(/^bean:\s*(.+)$/m)
    if (beanRefMatch) {
      const beanPath = beanRefMatch[1].trim().replace(/^["']|["']$/g, '')
      const folder = file.parent?.path ?? ''
      const fullPath = folder ? `${folder}/${beanPath}` : beanPath
      const beanFile = this.app.vault.getAbstractFileByPath(fullPath)
      if (beanFile instanceof TFile) {
        beanCache[beanPath] = await this.app.vault.read(beanFile)
      }
    }

    const resolveBean = (beanPath: string): string | null =>
      beanCache[beanPath] ?? null

    const recipe = parsePour(text, parseYaml, resolveBean)
    this.render(recipe)
  }

  private render(recipe: Recipe): void {
    const el = this.containerEl
    el.empty()
    el.addClass('coffeelang-view')

    const sheet = el.createEl('div', { cls: 'brew-sheet' })

    // ── Header ────────────────────────────────────────────────
    const header = sheet.createEl('div', { cls: 'brew-header' })
    header.createEl('h1', { cls: 'brew-title', text: recipe.title ?? 'Untitled Recipe' })
    if (recipe.brewMethod) {
      header.createEl('span', { cls: 'brew-method-badge', text: recipe.brewMethod })
    }

    // ── Bean strip ────────────────────────────────────────────
    const bean = recipe.bean
    if (bean) {
      const strip = sheet.createEl('div', { cls: 'bean-strip' })

      const top = strip.createEl('div', { cls: 'bean-strip-top' })
      const nameBlock = top.createEl('div', { cls: 'bean-strip-name-block' })
      nameBlock.createEl('span', { cls: 'bean-strip-name', text: bean.name ?? '' })
      if (bean.roastery) {
        nameBlock.createEl('span', { cls: 'bean-strip-roastery', text: bean.roastery })
      }

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
      // Bean ref exists but didn't resolve
      sheet.createEl('div', { cls: 'bean-strip bean-strip-missing', text: `⚠ Bean file not found: ${recipe.beanRef}` })
    }

    // ── Brew params ───────────────────────────────────────────
    if (recipe.brew) {
      const brew = recipe.brew
      const params = sheet.createEl('div', { cls: 'brew-params' })

      const addParam = (label: string, value: string | undefined) => {
        if (!value) return
        const cell = params.createEl('div', { cls: 'brew-param-cell' })
        cell.createEl('div', { cls: 'param-value', text: value })
        cell.createEl('div', { cls: 'param-label', text: label })
      }

      if (brew.doseG != null) addParam('Dose', `${brew.doseG}g`)
      if (brew.yieldG != null) addParam('Yield', `${brew.yieldG}g`)
      if (brew.ratio) addParam('Ratio', brew.ratio)
      if (brew.waterTempC != null) addParam('Temp', `${Math.round(brew.waterTempC)}°C`)
      if (brew.brewTimeSec != null) addParam('Time', formatDuration(brew.brewTimeSec))
      if (brew.grindSize) addParam('Grind', brew.grindSize)
    }

    // ── Sections ──────────────────────────────────────────────
    let cumulativeWater = 0

    // Count total pours for the ✓ marker
    let totalPours = 0
    for (const s of recipe.sections) {
      for (const step of s.steps) {
        if (step.type === 'waterPour') totalPours = step.sequence
      }
    }

    for (const section of recipe.sections) {
      const sectionEl = sheet.createEl('div', { cls: 'brew-section' })

      if (section.name) {
        sectionEl.createEl('div', { cls: 'brew-section-header', text: section.name })
      }

      const stepsEl = sectionEl.createEl('div', { cls: 'brew-steps' })

      for (const step of section.steps) {
        if (step.type === 'waterPour') {
          cumulativeWater = step.cumulative ? step.amountG : cumulativeWater + step.amountG
        }
        renderStep(stepsEl, step, cumulativeWater, totalPours)
      }
    }

    // ── Warnings ──────────────────────────────────────────────
    if (recipe.warnings.length > 0) {
      const warn = sheet.createEl('div', { cls: 'brew-warnings' })
      for (const w of recipe.warnings) {
        warn.createEl('div', { cls: 'brew-warning', text: `⚠ ${w}` })
      }
    }
  }
}

function renderStep(
  parent: HTMLElement,
  step: Step,
  cumulativeWater: number,
  totalPours: number
): void {
  switch (step.type) {
    case 'waterPour': {
      const row = parent.createEl('div', { cls: 'brew-step step-pour' })
      const left = row.createEl('div', { cls: 'pour-left' })
      left.createEl('span', { cls: 'pour-dot' })
      if (step.name) left.createEl('span', { cls: 'pour-name', text: step.name })

      const mid = row.createEl('div', { cls: 'pour-mid' })
      mid.createEl('span', { cls: 'pour-amount', text: `${step.amountG}g` })
      if (step.tempC != null) {
        mid.createEl('span', { cls: 'pour-temp', text: `@ ${Math.round(step.tempC)}°C` })
      }

      const right = row.createEl('div', { cls: 'pour-right' })
      const isLast = step.sequence === totalPours
      right.createEl('span', { cls: 'pour-total', text: `→ ${cumulativeWater}g` })
      if (isLast) right.createEl('span', { cls: 'pour-check', text: '✓' })
      break
    }

    case 'timer': {
      const row = parent.createEl('div', { cls: 'brew-step step-timer' })
      row.createEl('span', { cls: 'timer-icon', text: '⏱' })
      const label = step.name ? `${step.name}  ` : ''
      row.createEl('span', { cls: 'timer-text', text: `${label}${formatDuration(step.totalSecs)}` })
      break
    }

    case 'note': {
      const row = parent.createEl('div', { cls: 'brew-step step-note' })
      row.createEl('span', { text: step.value })
      break
    }

    case 'text': {
      const trimmed = step.value.trim()
      if (trimmed) {
        const row = parent.createEl('div', { cls: 'brew-step step-text' })
        row.createEl('span', { text: trimmed })
      }
      break
    }

    case 'technique': {
      const row = parent.createEl('div', { cls: 'brew-step step-tech' })
      row.createEl('span', { cls: 'tech-name', text: step.name })
      if (step.detail) row.createEl('span', { cls: 'tech-detail', text: ` — ${step.detail}` })
      break
    }

    case 'grindSpec': {
      const row = parent.createEl('div', { cls: 'brew-step step-grind' })
      row.createEl('span', { cls: 'grind-icon', text: '⚙' })
      row.createEl('span', { text: step.description })
      break
    }

    case 'equipment':
    case 'beanRef':
    case 'inlineMetadata':
      // Skip these in the rendered view — they're editor-level detail
      break
  }
}

function formatDuration(secs: number): string {
  const m = Math.floor(secs / 60)
  const s = secs % 60
  if (m === 0) return `${s}s`
  if (s === 0) return `${m}m`
  return `${m}m ${s}s`
}
