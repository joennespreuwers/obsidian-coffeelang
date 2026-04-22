import { Plugin, TFile } from 'obsidian'
import { VIEW_TYPE_BREW_SHEET, BrewSheetView } from './preview/BrewSheetView'
import { VIEW_TYPE_BEAN_CARD, BeanCardView } from './preview/BeanCardView'
import { createCoffeelangExtension } from './editor/CoffeelangHighlighter'

export default class CoffeelangPlugin extends Plugin {
  async onload() {
    // Register views
    this.registerView(VIEW_TYPE_BREW_SHEET, (leaf) => new BrewSheetView(leaf, this.app))
    this.registerView(VIEW_TYPE_BEAN_CARD,  (leaf) => new BeanCardView(leaf, this.app))

    // Syntax highlighting for the text editor
    this.registerEditorExtension(createCoffeelangExtension(this.app))

    // Register file extensions — Obsidian opens them as text by default
    this.registerExtensions(['pour', 'bean'], 'markdown')

    // Auto-render: when a .pour or .bean file is opened in a markdown leaf,
    // replace that leaf with our rendered view automatically.
    this.registerEvent(
      this.app.workspace.on('file-open', async (file) => {
        if (!file) return
        if (file.extension !== 'pour' && file.extension !== 'bean') return

        const leaf = this.app.workspace.getMostRecentLeaf()
        if (!leaf) return

        // Only replace markdown leaves — don't interfere if already our view
        if (leaf.view.getViewType() !== 'markdown') return

        const viewType = file.extension === 'pour' ? VIEW_TYPE_BREW_SHEET : VIEW_TYPE_BEAN_CARD
        await leaf.setViewState({
          type: viewType,
          state: { file: file.path },
          active: true,
        })
      })
    )

    // Keep commands + ribbon as fallback
    this.addRibbonIcon('coffee', 'Open coffeelang preview', () => {
      const file = this.app.workspace.getActiveFile()
      if (file) this.openPreview(file)
    })

    this.addCommand({
      id: 'open-brew-sheet',
      name: 'Open brew sheet',
      checkCallback: (checking) => {
        const file = this.app.workspace.getActiveFile()
        if (file?.extension === 'pour') {
          if (!checking) this.openPreview(file)
          return true
        }
        return false
      },
    })

    this.addCommand({
      id: 'open-bean-card',
      name: 'Open bean card',
      checkCallback: (checking) => {
        const file = this.app.workspace.getActiveFile()
        if (file?.extension === 'bean') {
          if (!checking) this.openPreview(file)
          return true
        }
        return false
      },
    })
  }

  async openPreview(file: TFile): Promise<void> {
    const viewType = file.extension === 'pour' ? VIEW_TYPE_BREW_SHEET : VIEW_TYPE_BEAN_CARD

    // Reuse existing view if already open
    const existing = this.app.workspace.getLeavesOfType(viewType)
    for (const leaf of existing) {
      const view = leaf.view
      if (view instanceof BrewSheetView || view instanceof BeanCardView) {
        this.app.workspace.revealLeaf(leaf)
        await (view as BrewSheetView | BeanCardView).setFile(file)
        return
      }
    }

    const leaf = this.app.workspace.getLeaf('split')
    await leaf.setViewState({ type: viewType, state: { file: file.path }, active: true })
    this.app.workspace.revealLeaf(leaf)
  }

  async onunload() {
    this.app.workspace.detachLeavesOfType(VIEW_TYPE_BREW_SHEET)
    this.app.workspace.detachLeavesOfType(VIEW_TYPE_BEAN_CARD)
  }
}
