import { Bean } from '../parser/types'

export function renderBeanCardInto(bean: Bean, container: HTMLElement): void {
  const card = container.createEl('div', { cls: 'bean-card' })

  const header = card.createEl('div', { cls: 'bean-card-header' })
  header.createEl('h1', { text: bean.name ?? 'Unknown Bean' })
  if (bean.roastery) header.createEl('div', { cls: 'bean-roastery', text: bean.roastery })

  const body = card.createEl('div', { cls: 'bean-card-body' })
  const addField = (label: string, value: string | undefined) => {
    if (!value) return
    const row = body.createEl('div', { cls: 'bean-field' })
    row.createEl('span', { cls: 'field-label', text: label })
    row.createEl('span', { cls: 'field-value', text: value })
  }

  const origin = [bean.originCountry, bean.originRegion].filter(Boolean).join(', ')
  addField('Origin', origin || undefined)
  addField('Farm', bean.farm)
  addField('Variety', bean.variety)
  addField('Process', bean.process)
  addField('Roast level', bean.roastLevel)

  if (bean.altitudeMasl) {
    const alt = bean.altitudeMasl.min === bean.altitudeMasl.max
      ? `${bean.altitudeMasl.min}m`
      : `${bean.altitudeMasl.min}–${bean.altitudeMasl.max}m`
    addField('Altitude', alt)
  }

  addField('Harvest', bean.harvestDate)

  if (bean.roastDate) {
    const daysAgo = computeDaysAgo(bean.roastDate)
    addField('Roasted', daysAgo != null ? `${bean.roastDate} · ${daysAgo} days ago` : bean.roastDate)
  }

  if (bean.pricePer100g != null) {
    addField('Price / 100g', `€${bean.pricePer100g.toFixed(2)}`)
  }

  if (bean.flavorNotes.length > 0) {
    const notesEl = body.createEl('div', { cls: 'bean-flavor-notes-section' })
    notesEl.createEl('span', { cls: 'field-label', text: 'Flavor notes' })
    const tags = notesEl.createEl('div', { cls: 'flavor-notes-tags' })
    for (const note of bean.flavorNotes) {
      tags.createEl('span', { cls: 'flavor-note', text: note })
    }
  }

  if (bean.notes) {
    const notesSection = card.createEl('div', { cls: 'bean-card-notes' })
    notesSection.createEl('h3', { text: 'Notes' })
    for (const para of bean.notes.split(/\n\n+/)) {
      if (para.trim()) notesSection.createEl('p', { text: para.trim() })
    }
  }

  if (bean.warnings.length > 0) {
    const warn = card.createEl('div', { cls: 'bean-warnings' })
    for (const w of bean.warnings) warn.createEl('div', { cls: 'bean-warning', text: `⚠ ${w}` })
  }
}

function computeDaysAgo(dateStr: string): number | null {
  const date = new Date(dateStr)
  if (isNaN(date.getTime())) return null
  return Math.floor((Date.now() - date.getTime()) / 86400000)
}
