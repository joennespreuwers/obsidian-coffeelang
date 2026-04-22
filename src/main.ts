import { Plugin, TFile, WorkspaceLeaf } from 'obsidian'
import { VIEW_TYPE_BREW_SHEET, BrewSheetView } from './preview/BrewSheetView'
import { VIEW_TYPE_BEAN_CARD, BeanCardView } from './preview/BeanCardView'
import { createCoffeelangExtension } from './editor/CoffeelangHighlighter'

export default class CoffeelangPlugin extends Plugin {
  async onload() {
    // 1. Register views
    this.registerView(VIEW_TYPE_BREW_SHEET, (leaf) => new BrewSheetView(leaf, this.app))
    this.registerView(VIEW_TYPE_BEAN_CARD, (leaf) => new BeanCardView(leaf, this.app))

    // 2. Register syntax highlighting
    this.registerEditorExtension(createCoffeelangExtension(this.app))

    // 3. Register file extensions so Obsidian opens them in the editor
    this.registerExtensions(['pour', 'bean'], 'markdown')

    // 4. Ribbon icon — opens preview for active file
    this.addRibbonIcon('coffee', 'Open coffeelang preview', () => {
      const file = this.app.workspace.getActiveFile()
      if (file) this.openPreview(file)
    })

    // 5. Commands
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

    // Check if a view for this file already exists
    const existing = this.app.workspace.getLeavesOfType(viewType)
    for (const leaf of existing) {
      const view = leaf.view
      if (view instanceof BrewSheetView || view instanceof BeanCardView) {
        this.app.workspace.revealLeaf(leaf)
        await (view as BrewSheetView | BeanCardView).setFile(file)
        return
      }
    }

    // Open in a new split leaf
    const leaf = this.app.workspace.getLeaf('split')
    if (viewType === VIEW_TYPE_BREW_SHEET) {
      await leaf.setViewState({ type: VIEW_TYPE_BREW_SHEET, active: true })
      const view = leaf.view as BrewSheetView
      await view.setFile(file)
    } else {
      await leaf.setViewState({ type: VIEW_TYPE_BEAN_CARD, active: true })
      const view = leaf.view as BeanCardView
      await view.setFile(file)
    }

    this.app.workspace.revealLeaf(leaf)
  }

  async onunload() {
    this.app.workspace.detachLeavesOfType(VIEW_TYPE_BREW_SHEET)
    this.app.workspace.detachLeavesOfType(VIEW_TYPE_BEAN_CARD)
  }
}
