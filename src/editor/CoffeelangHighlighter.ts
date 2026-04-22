import { App } from 'obsidian'
import { ViewPlugin, DecorationSet, EditorView, ViewUpdate, Decoration } from '@codemirror/view'
import { RangeSetBuilder, Extension } from '@codemirror/state'

// Highlight rule: [regex, className]
const HIGHLIGHT_RULES: Array<[RegExp, string]> = [
  [/==.+?==/g, 'cm-coffeelang-section'],
  [/\*\w*\{[^}]*\}/g, 'cm-coffeelang-pour'],
  [/~\w*\{[^}]*\}/g, 'cm-coffeelang-timer'],
  [/@\w[^\s{]*\{[^}]*\}/g, 'cm-coffeelang-bean'],
  [/#\w[^\s{]*\{[^}]*\}/g, 'cm-coffeelang-equip'],
  [/\^\{[^}]*\}/g, 'cm-coffeelang-grind'],
  [/\+\w[^\s{]*\{[^}]*\}/g, 'cm-coffeelang-tech'],
  [/--.*$/g, 'cm-coffeelang-comment'],
]

// Line-start rules applied to full line content
const LINE_START_RULES: Array<[RegExp, string]> = [
  [/^>>.*/, 'cm-coffeelang-meta'],
  [/^>(?!>).*/, 'cm-coffeelang-note'],
]

class CoffeelangHighlighterPlugin {
  decorations: DecorationSet
  private app: App

  constructor(view: EditorView, app: App) {
    this.app = app
    this.decorations = this.buildDecorations(view)
  }

  update(update: ViewUpdate) {
    if (update.docChanged || update.viewportChanged || update.selectionSet) {
      this.decorations = this.buildDecorations(update.view)
    }
  }

  private isCoffeelangFile(): boolean {
    const ext = this.app.workspace.getActiveFile()?.extension
    return ext === 'pour' || ext === 'bean'
  }

  private buildDecorations(view: EditorView): DecorationSet {
    if (!this.isCoffeelangFile()) {
      return Decoration.none
    }

    const builder = new RangeSetBuilder<Decoration>()
    const decorations: Array<{ from: number; to: number; cls: string }> = []

    for (const { from, to } of view.visibleRanges) {
      let pos = from
      while (pos <= to) {
        const line = view.state.doc.lineAt(pos)
        const lineText = line.text

        // Apply inline highlight rules
        for (const [regex, cls] of HIGHLIGHT_RULES) {
          regex.lastIndex = 0
          let match: RegExpExecArray | null
          while ((match = regex.exec(lineText)) !== null) {
            decorations.push({
              from: line.from + match.index,
              to: line.from + match.index + match[0].length,
              cls,
            })
          }
        }

        // Apply line-start rules
        for (const [regex, cls] of LINE_START_RULES) {
          if (regex.test(lineText)) {
            decorations.push({ from: line.from, to: line.to, cls })
          }
        }

        if (line.to >= to) break
        pos = line.to + 1
      }
    }

    // Sort by from position, then to position (required by RangeSetBuilder)
    decorations.sort((a, b) => a.from - b.from || a.to - b.to)

    // Remove overlapping ranges (keep first)
    const seen: Array<{ from: number; to: number; cls: string }> = []
    for (const d of decorations) {
      const last = seen[seen.length - 1]
      if (last && d.from < last.to) {
        // Overlapping — skip
        continue
      }
      seen.push(d)
    }

    for (const { from, to, cls } of seen) {
      builder.add(from, to, Decoration.mark({ class: cls }))
    }

    return builder.finish()
  }
}

export function createCoffeelangExtension(app: App): Extension {
  return ViewPlugin.define(
    (view) => new CoffeelangHighlighterPlugin(view, app),
    { decorations: (v) => v.decorations }
  )
}
