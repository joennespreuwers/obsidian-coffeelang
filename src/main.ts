import { Plugin, TFile, parseYaml } from 'obsidian'
import { VIEW_TYPE_BREW_SHEET, BrewSheetView } from './preview/BrewSheetView'
import { VIEW_TYPE_BEAN_CARD, BeanCardView } from './preview/BeanCardView'
import { createCoffeelangExtension } from './editor/CoffeelangHighlighter'
import { parsePour } from './parser/pour'
import { parseBean } from './parser/bean'
import { renderBrewSheetInto } from './preview/renderBrewSheet'
import { renderBeanCardInto } from './preview/renderBeanCard'

export default class CoffeelangPlugin extends Plugin {
  async onload() {
    // Register split-pane views (used by ribbon / commands)
    this.registerView(VIEW_TYPE_BREW_SHEET, (leaf) => new BrewSheetView(leaf, this.app))
    this.registerView(VIEW_TYPE_BEAN_CARD,  (leaf) => new BeanCardView(leaf, this.app))

    // Syntax highlighting in the editor
    this.registerEditorExtension(createCoffeelangExtension(this.app))

    // Register file extensions so Obsidian opens them as text (editable)
    this.registerExtensions(['pour', 'bean'], 'markdown')

    // Reading mode: intercept preview rendering for .pour and .bean files
    this.registerMarkdownPostProcessor(async (element, context) => {
      const path = context.sourcePath
      if (!path.endsWith('.pour') && !path.endsWith('.bean')) return

      const file = this.app.vault.getAbstractFileByPath(path)
      if (!(file instanceof TFile)) return

      element.empty()
      element.addClass('coffeelang-reading-view')

      if (file.extension === 'pour') {
        const text = await this.app.vault.read(file)
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
        renderBrewSheetInto(recipe, element)
      } else {
        const text = await this.app.vault.read(file)
        const bean = parseBean(text, parseYaml)
        renderBeanCardInto(bean, element)
      }
    })

    // Ribbon + commands for split-pane preview
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
