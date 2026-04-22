import { ItemView, WorkspaceLeaf, TFile, ViewStateResult, parseYaml } from 'obsidian'
import { parsePour } from '../parser/pour'
import { renderBrewSheetInto } from './renderBrewSheet'

export const VIEW_TYPE_BREW_SHEET = 'coffeelang-brew-sheet'

export class BrewSheetView extends ItemView {
  private file: TFile | null = null

  constructor(leaf: WorkspaceLeaf, app: import('obsidian').App) { super(leaf) }

  getViewType()    { return VIEW_TYPE_BREW_SHEET }
  getDisplayText() { return this.file ? this.file.basename : 'Brew sheet' }
  getIcon()        { return 'coffee' }

  getState(): Record<string, unknown> { return { file: this.file?.path ?? '' } }

  async setState(state: unknown, result: ViewStateResult): Promise<void> {
    const s = state as { file?: string }
    if (s?.file) {
      const f = this.app.vault.getAbstractFileByPath(s.file)
      if (f instanceof TFile) await this.setFile(f)
    }
    await super.setState(state, result)
  }

  async onOpen() {
    this.containerEl.empty()
    this.containerEl.addClass('coffeelang-view')
    this.addAction('pencil', 'Edit source', () => {
      if (this.file) this.app.workspace.getLeaf('split').openFile(this.file)
    })
  }

  async setFile(file: TFile): Promise<void> {
    this.file = file
    const text = await this.app.vault.read(file)

    const beanCache: Record<string, string> = {}
    const beanRefMatch = text.match(/^bean:\s*(.+)$/m)
    if (beanRefMatch) {
      const beanPath = beanRefMatch[1].trim().replace(/^["']|["']$/g, '')
      const parentPath = file.parent?.path ?? ''
      const folder = parentPath === '/' ? '' : parentPath
      const fullPath = folder ? `${folder}/${beanPath}` : beanPath
      const beanFile = this.app.vault.getAbstractFileByPath(fullPath)
      if (beanFile instanceof TFile) beanCache[beanPath] = await this.app.vault.read(beanFile)
    }

    const recipe = parsePour(text, parseYaml, (p) => beanCache[p] ?? null)
    const el = this.containerEl
    el.empty()
    el.addClass('coffeelang-view')
    renderBrewSheetInto(recipe, el)
  }
}
