import { ItemView, WorkspaceLeaf, TFile, ViewStateResult, parseYaml } from 'obsidian'
import { parsePour } from '../parser/pour'
import { Recipe, Step } from '../parser/types'

export const VIEW_TYPE_BREW_SHEET = 'coffeelang-brew-sheet'

export class BrewSheetView extends ItemView {
  private file: TFile | null = null

  constructor(leaf: WorkspaceLeaf, app: import('obsidian').App) {
    super(leaf)
  }

  getViewType(): string { return VIEW_TYPE_BREW_SHEET }
  getDisplayText(): string { return this.file ? this.file.basename : 'Brew sheet' }
  getIcon(): string { return 'coffee' }

  getState(): Record<string, unknown> {
    return { file: this.file?.path ?? '' }
  }

  async setState(state: unknown, result: ViewStateResult): Promise<void> {
    const s = state as { file?: string }
    if (s?.file) {
      const f = this.app.vault.getAbstractFileByPath(s.file)
      if (f instanceof TFile) await this.setFile(f)
    }
    await super.setState(state, result)
  }

  async onOpen(): Promise<void> {
    this.containerEl.empty()
    this.containerEl.addClass('coffeelang-view')
    // "Edit source" action in the pane header
    this.addAction('pencil', 'Edit source', () => {
      if (this.file) this.app.workspace.getLeaf('split').openFile(this.file)
    })
  }

  async setFile(file: TFile): Promise<void> {
    this.file = file
    const text = await this.app.vault.read(file)

    // Pre-load bean file before parsing (vault reads are async)
    const beanCache: Record<string, string> = {}
    const beanRefMatch = text.match(/^bean:\s*(.+)$/m)
    if (beanRefMatch) {
      const beanPath = beanRefMatch[1].trim().replace(/^["']|["']$/g, '')
      const parentPath = file.parent?.path ?? ''
      const folder = parentPath === '/' ? '' : parentPath
      const fullPath = folder ? `${folder}/${beanPath}` : beanPath
      const beanFile = this.app.vault.getAbstractFileByPath(fullPath)
      if (beanFile instanceof TFile) {
        beanCache[beanPath] = await this.app.vault.read(beanFile)
      }
    }

    const recipe = parsePour(text, parseYaml, (p) => beanCache[p] ?? null)
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

    // ── Brew params ───────────────────────────────────────────
    if (recipe.brew) {
      const brew = recipe.brew
      const params = sheet.createEl('div', { cls: 'brew-params' })
      const add = (label: string, value: string | undefined) => {
        if (!value) return
        const c = params.createEl('div', { cls: 'brew-param-cell' })
        c.createEl('div', { cls: 'param-value', text: value })
        c.createEl('div', { cls: 'param-label', text: label })
      }
      if (brew.doseG != null)      add('Dose',  `${brew.doseG}g`)
      if (brew.yieldG != null)     add('Yield', `${brew.yieldG}g`)
      if (brew.ratio)              add('Ratio', brew.ratio)
      if (brew.waterTempC != null) add('Temp',  `${Math.round(brew.waterTempC)}°C`)
      if (brew.brewTimeSec != null) add('Time', formatDuration(brew.brewTimeSec))
      if (brew.grindSize)          add('Grind', brew.grindSize)
    }

    // Count total pours for ✓ marker
    let totalPours = 0
    for (const s of recipe.sections) {
      for (const step of s.steps) {
        if (step.type === 'waterPour') totalPours = step.sequence
      }
    }

    // ── Sections ──────────────────────────────────────────────
    const state = { cumulativeWater: 0, stepNum: 0 }

    for (const section of recipe.sections) {
      const sectionEl = sheet.createEl('div', { cls: 'brew-section' })
      if (section.name) {
        sectionEl.createEl('div', { cls: 'brew-section-header', text: section.name })
      }
      const stepsEl = sectionEl.createEl('div', { cls: 'brew-steps' })
      this.renderSteps(stepsEl, section.steps, state, totalPours)
    }

    // ── Warnings ──────────────────────────────────────────────
    if (recipe.warnings.length > 0) {
      const warn = sheet.createEl('div', { cls: 'brew-warnings' })
      for (const w of recipe.warnings) {
        warn.createEl('div', { cls: 'brew-warning', text: `⚠ ${w}` })
      }
    }
  }

  private renderSteps(
    el: HTMLElement,
    steps: Step[],
    state: { cumulativeWater: number; stepNum: number },
    totalPours: number
  ): void {
    // Accumulate prose tokens (text, equipment, beanRef) into a single step card.
    // Equipment and beanRef names are included inline so prose reads naturally.
    // Flush prose as a numbered card when a structural step is hit.
    let proseParts: string[] = []

    const flushProse = () => {
      const text = proseParts
        .filter(Boolean)
        .join(' ')
        .replace(/\s{2,}/g, ' ')
        .replace(/\s([.,])/g, '$1')
        .trim()
      proseParts = []
      if (!text) return
      state.stepNum++
      const card = el.createEl('div', { cls: 'brew-step-card step-text' })
      card.createEl('div', { cls: 'step-num', text: String(state.stepNum) })
      card.createEl('div', { cls: 'step-body', text })
    }

    for (const step of steps) {
      switch (step.type) {

        case 'text': {
          // Drop short trailing fragments that are annotations on a pour line (start with —)
          const t = step.value.replace(/^[-—\s]+/, '').trim()
          if (t) proseParts.push(t)
          break
        }

        case 'equipment':
          // Include equipment name naturally in prose
          proseParts.push(step.name)
          break

        case 'beanRef':
          // Include bean name (+ amount if present) in prose
          proseParts.push(step.amountG != null ? `${step.name} (${step.amountG}g)` : step.name)
          break

        case 'grindSpec':
          proseParts.push(step.description)
          break

        case 'inlineMetadata':
          break

        case 'waterPour': {
          flushProse()
          state.cumulativeWater = step.cumulative
            ? step.amountG
            : state.cumulativeWater + step.amountG
          state.stepNum++

          const card = el.createEl('div', { cls: 'brew-step-card step-pour' })

          const numEl = card.createEl('div', { cls: 'step-num pour-num' })
          numEl.createEl('span', { cls: 'pour-dot-inner' })

          const body = card.createEl('div', { cls: 'step-body pour-body' })
          if (step.name) body.createEl('span', { cls: 'pour-name', text: step.name })
          body.createEl('span', { cls: 'pour-amount', text: `${step.amountG}g` })
          if (step.tempC != null) {
            body.createEl('span', { cls: 'pour-temp', text: `@ ${Math.round(step.tempC)}°C` })
          }

          const right = card.createEl('div', { cls: 'step-right' })
          right.createEl('span', { cls: 'pour-total', text: `→ ${state.cumulativeWater}g` })
          if (step.sequence === totalPours) {
            right.createEl('span', { cls: 'pour-check', text: '✓' })
          }
          break
        }

        case 'timer': {
          flushProse()
          state.stepNum++
          const card = el.createEl('div', { cls: 'brew-step-card step-timer' })
          card.createEl('div', { cls: 'step-num timer-num', text: String(state.stepNum) })
          const body = card.createEl('div', { cls: 'step-body' })
          body.createEl('span', { cls: 'timer-icon', text: '⏱' })
          body.createEl('span', { cls: 'timer-text', text: formatDuration(step.totalSecs) })
          break
        }

        case 'note':
          // Notes are not numbered — they appear as asides between cards
          flushProse()
          el.createEl('div', { cls: 'brew-note', text: step.value })
          break

        case 'technique': {
          flushProse()
          state.stepNum++
          const card = el.createEl('div', { cls: 'brew-step-card step-tech' })
          card.createEl('div', { cls: 'step-num', text: String(state.stepNum) })
          const body = card.createEl('div', { cls: 'step-body' })
          body.createEl('span', { cls: 'tech-name', text: step.name })
          if (step.detail) body.createEl('span', { cls: 'tech-detail', text: ` — ${step.detail}` })
          break
        }
      }
    }
    flushProse()
  }
}

function formatDuration(secs: number): string {
  const m = Math.floor(secs / 60)
  const s = secs % 60
  if (m === 0) return `${s}s`
  if (s === 0) return `${m}m`
  return `${m}m ${s}s`
}
