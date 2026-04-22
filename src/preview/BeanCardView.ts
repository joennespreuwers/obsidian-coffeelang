import { ItemView, WorkspaceLeaf, TFile, parseYaml } from 'obsidian'
import { parseBean } from '../parser/bean'
import { Bean } from '../parser/types'

export const VIEW_TYPE_BEAN_CARD = 'coffeelang-bean-card'

export class BeanCardView extends ItemView {
  private file: TFile | null = null

  constructor(leaf: WorkspaceLeaf, app: import('obsidian').App) {
    super(leaf)
  }

  getViewType(): string {
    return VIEW_TYPE_BEAN_CARD
  }

  getDisplayText(): string {
    return this.file ? `Bean card: ${this.file.basename}` : 'Bean card'
  }

  getIcon(): string {
    return 'coffee'
  }

  async onOpen(): Promise<void> {
    this.containerEl.empty()
    this.containerEl.addClass('coffeelang-view')
  }

  async setFile(file: TFile): Promise<void> {
    this.file = file
    const text = await this.app.vault.read(file)

    const bean = parseBean(text, parseYaml)
    this.render(bean)
  }

  private render(bean: Bean): void {
    const container = this.containerEl
    container.empty()
    container.addClass('coffeelang-view')

    const card = container.createEl('div', { cls: 'bean-card' })

    // Header
    const header = card.createEl('div', { cls: 'bean-card-header' })
    header.createEl('h1', { text: bean.name ?? 'Unknown Bean' })
    if (bean.roastery) {
      header.createEl('div', { cls: 'bean-roastery', text: bean.roastery })
    }

    // Body
    const body = card.createEl('div', { cls: 'bean-card-body' })

    const addField = (label: string, value: string | undefined) => {
      if (!value) return
      const row = body.createEl('div', { cls: 'bean-field' })
      row.createEl('span', { cls: 'field-label', text: `${label}: ` })
      row.createEl('span', { cls: 'field-value', text: value })
    }

    // Origin
    const origin = [bean.originCountry, bean.originRegion].filter(Boolean).join(', ')
    addField('Origin', origin || undefined)
    addField('Farm', bean.farm)
    addField('Variety', bean.variety)
    addField('Process', bean.process)
    addField('Roast level', bean.roastLevel)

    // Altitude
    if (bean.altitudeMasl) {
      const alt = bean.altitudeMasl.min === bean.altitudeMasl.max
        ? `${bean.altitudeMasl.min}m`
        : `${bean.altitudeMasl.min}–${bean.altitudeMasl.max}m`
      addField('Altitude', alt)
    }

    addField('Harvest date', bean.harvestDate)

    // Roast date with "X days ago"
    if (bean.roastDate) {
      const daysAgo = computeDaysAgo(bean.roastDate)
      const roastStr = daysAgo !== null ? `${bean.roastDate} (${daysAgo} days ago)` : bean.roastDate
      addField('Roast date', roastStr)
    }

    // Price
    if (bean.pricePer100g !== undefined) {
      addField('Price / 100g', `€${bean.pricePer100g.toFixed(2)}`)
    }

    // Flavor notes
    if (bean.flavorNotes.length > 0) {
      const notesEl = body.createEl('div', { cls: 'bean-flavor-notes-section' })
      notesEl.createEl('span', { cls: 'field-label', text: 'Flavor notes: ' })
      const tags = notesEl.createEl('span', { cls: 'flavor-notes-tags' })
      for (const note of bean.flavorNotes) {
        tags.createEl('span', { cls: 'flavor-note', text: note })
      }
    }

    // Prose notes
    if (bean.notes) {
      const notesSection = card.createEl('div', { cls: 'bean-card-notes' })
      notesSection.createEl('h3', { text: 'Notes' })
      // Render each paragraph
      for (const para of bean.notes.split(/\n\n+/)) {
        if (para.trim()) {
          notesSection.createEl('p', { text: para.trim() })
        }
      }
    }

    // Warnings
    if (bean.warnings.length > 0) {
      const warnEl = card.createEl('div', { cls: 'bean-warnings' })
      for (const w of bean.warnings) {
        warnEl.createEl('div', { cls: 'bean-warning', text: `⚠ ${w}` })
      }
    }
  }
}

function computeDaysAgo(dateStr: string): number | null {
  // Try parsing YYYY-MM-DD or similar
  const date = new Date(dateStr)
  if (isNaN(date.getTime())) return null
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  return Math.floor(diffMs / (1000 * 60 * 60 * 24))
}
