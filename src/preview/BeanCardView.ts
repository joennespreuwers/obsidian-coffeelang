import { ItemView, WorkspaceLeaf, TFile, ViewStateResult, parseYaml } from 'obsidian'
import { parseBean } from '../parser/bean'
import { renderBeanCardInto } from './renderBeanCard'

export const VIEW_TYPE_BEAN_CARD = 'coffeelang-bean-card'

export class BeanCardView extends ItemView {
  private file: TFile | null = null

  constructor(leaf: WorkspaceLeaf, app: import('obsidian').App) { super(leaf) }

  getViewType()    { return VIEW_TYPE_BEAN_CARD }
  getDisplayText() { return this.file ? this.file.basename : 'Bean card' }
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
    const bean = parseBean(text, parseYaml)
    const el = this.containerEl
    el.empty()
    el.addClass('coffeelang-view')
    renderBeanCardInto(bean, el)
  }
}
