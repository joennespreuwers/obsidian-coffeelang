# obsidian-coffeelang

An Obsidian plugin that adds first-class support for the coffeelang format
(`.bean` and `.pour` files) in your vault.

**This is not pourlog.** pourlog is a future iOS app. This plugin is purely an
editor tool — it makes coffeelang files pleasant to write and read in Obsidian.

Parser reference: https://github.com/joennespreuwers/coffeelang
Language spec: https://github.com/joennespreuwers/coffeelang/blob/master/SPEC.md

---

## Features (scope)

1. **Syntax highlighting** — colour `.bean` and `.pour` files in the editor
2. **Brew sheet preview** — rendered view when opening a `.pour` file (like Obsidian's markdown preview)
3. **Bean card preview** — rendered view when opening a `.bean` file

That's it. No logging, no database, no sync — just a great editing experience.

---

## Tech stack

- TypeScript + Obsidian Plugin API
- CodeMirror 6 for syntax highlighting (Obsidian uses CM6 internally)
- esbuild for bundling
- Base: [obsidian-sample-plugin](https://github.com/obsidianmd/obsidian-sample-plugin)

---

## Repo structure

```
obsidian-coffeelang/
├── PLAN.md
├── manifest.json
├── package.json
├── tsconfig.json
├── esbuild.config.mjs
├── styles.css
├── src/
│   ├── main.ts              ← registers extensions, views, commands
│   ├── parser/
│   │   ├── types.ts         ← Bean, Recipe, Step, WaterPour, … (port from Rust)
│   │   ├── frontmatter.ts   ← split YAML front matter
│   │   ├── tokenizer.ts     ← inline marker scanner
│   │   ├── bean.ts          ← parseBean(text) → Bean
│   │   └── pour.ts          ← parsePour(text) → Recipe
│   ├── editor/
│   │   ├── BeanLanguage.ts  ← CodeMirror 6 language for .bean
│   │   └── PourLanguage.ts  ← CodeMirror 6 language for .pour
│   └── preview/
│       ├── BrewSheetView.ts ← ItemView: rendered brew sheet for .pour
│       └── BeanCardView.ts  ← ItemView: rendered bean card for .bean
└── __tests__/
    ├── fixtures/            ← copy .bean/.pour files from coffeelang/examples
    └── parser.test.ts
```

---

## Phase 1: Scaffold

Clone the sample plugin and update identifiers:

```bash
npx degit obsidianmd/obsidian-sample-plugin .
npm install
```

`manifest.json`:
```json
{
  "id": "obsidian-coffeelang",
  "name": "coffeelang",
  "version": "0.1.0",
  "minAppVersion": "1.4.0",
  "description": "Syntax highlighting and preview for .bean and .pour coffeelang files",
  "author": "joennespreuwers",
  "authorUrl": "https://github.com/joennespreuwers",
  "isDesktopOnly": false
}
```

---

## Phase 2: TypeScript parser

Port the Rust parser to TypeScript. Read `coffeelang/src/types.rs` and
`coffeelang/SPEC.md` before starting.

Key notes:
- Use Obsidian's built-in `parseYaml(str)` — no extra dependency
- `parsePour` takes an optional `resolveBean` callback:
  `(path: string) => string | null` — lets the plugin pass vault file contents
- Write Jest unit tests; copy example files from `coffeelang/examples/` as fixtures

### Token regex (same as Rust)
```
/([@#*~^+])([^\s{}\[\]]*)\{([^}]*)\}/g
```
- Group 1: symbol (`@ # * ~ ^ +`)
- Group 2: name (may be empty)
- Group 3: body

---

## Phase 3: Syntax highlighting

Register a CodeMirror 6 `ViewPlugin` or `LanguageSupport` for `.bean` and `.pour`.
Hook in via `this.registerEditorExtension(...)` in `main.ts`.

Highlight map for `.pour`:

| Pattern | Token class | Colour suggestion |
|---|---|---|
| `==...==` | heading | bold |
| `*name{...}` | keyword | blue/teal |
| `~{...}` | number | orange |
| `@Name{...}` | variable | green |
| `#Name{...}` | tag | purple |
| `^{...}` | string | yellow |
| `+name{...}` | builtin | pink |
| `>> key: val` | meta | bold key, muted value |
| `> note` | comment | italic/muted |
| `-- comment` | lineComment | muted |
| `---` front matter block | meta | muted |

`.bean` uses the same front matter + `> note` + `-- comment` rules, plus
`#roastery{...}` → tag.

---

## Phase 4: Brew sheet preview

An `ItemView` (`VIEW_TYPE_BREW_SHEET`) that renders a `.pour` file visually.

Opened automatically when a `.pour` file is active (similar to how Obsidian
opens a markdown preview alongside the editor), or via command palette:
"coffeelang: Open brew sheet".

### Rendered layout

```
────────────────────────────────────
 V60 Kasuya 4:6
────────────────────────────────────
 Bean     Ethiopia Guji Natural
 Process  Natural · Light roast
 Flavor   blueberry, jasmine, dark chocolate

 Dose  20g   Yield  300g   Ratio  1:15
 Temp  93°C  Grind  medium-fine, 25 clicks
 Time  3m 30s

── First 40% ────────────────────────
  ● bloom   50g @ 93°C   →  50g
  ⏱ 45s
  ● second  70g @ 93°C   → 120g
  ⏱ 45s

── Final 60% ────────────────────────
  ● third   60g          → 180g
  ● fourth  60g          → 240g
  ● fifth   60g          → 300g ✓
────────────────────────────────────
```

Rendered as HTML/CSS inside the ItemView. Style with `styles.css`.
The checkboxes/bullets can be interactive (tap to tick off steps while brewing).

---

## Phase 5: Bean card preview

An `ItemView` (`VIEW_TYPE_BEAN_CARD`) for `.bean` files.

```
────────────────────────────────────
 Ethiopia Guji Natural
 Onyx Coffee Lab
────────────────────────────────────
 Origin   Ethiopia · Guji Zone
 Farm     Kayon Mountain
 Variety  Heirloom
 Process  Natural
 Roast    Light
 Altitude 2200 masl
 Harvest  Oct 2025
 Roasted  15 Mar 2026  (38 days ago)

 Flavor   🫐 blueberry
          🌸 jasmine
          🍫 dark chocolate
────────────────────────────────────
 A vibrant, naturally processed Ethiopian
 with explosive berry character…
────────────────────────────────────
```

---

## Implementation order

1. Scaffold (`npx degit`, `manifest.json`, `package.json`, `tsconfig.json`, `esbuild`)
2. TypeScript parser port + Jest tests (copy example fixtures from coffeelang repo)
3. Syntax highlighting (CodeMirror 6)
4. Brew sheet preview view
5. Bean card preview view

---

## Key references

- Obsidian plugin docs: https://docs.obsidian.md/Plugins/Getting+started/Build+a+plugin
- Sample plugin: https://github.com/obsidianmd/obsidian-sample-plugin
- CM6 guide: https://codemirror.net/docs/guide/
- coffeelang SPEC: https://github.com/joennespreuwers/coffeelang/blob/master/SPEC.md
- coffeelang types (Rust): https://github.com/joennespreuwers/coffeelang/blob/master/src/types.rs
- coffeelang examples: https://github.com/joennespreuwers/coffeelang/tree/master/examples

---

## Notes for next session

- Working directory: `/Users/joenne/Documents/dev/obsidian-coffeelang`
- GitHub: `https://github.com/joennespreuwers/obsidian-coffeelang`
- Start with Phase 1 (scaffold), then Phase 2 (parser)
- Read coffeelang SPEC.md and src/types.rs before writing any parser code
- Obsidian's built-in YAML: `import { parseYaml } from 'obsidian'`
- This plugin does NOT do brew logging — that's pourlog (future iOS app)
