# obsidian-coffeelang

An [Obsidian](https://obsidian.md) plugin that adds first-class support for [coffeelang](https://github.com/joennespreuwers/coffeelang) — a plain-text language for specialty coffee.

Opens and highlights `.bean` (coffee lot definitions) and `.pour` (brew recipes) files directly in your vault.

---

## Features

- **Syntax highlighting** for `.bean` and `.pour` files in the editor
- **Brew sheet preview** — rendered view of a `.pour` recipe (open via ribbon icon or command palette)
- **Bean card preview** — rendered view of a `.bean` file

---

## Example

Drop a `.pour` file in your vault:

```
---
title: V60 Kasuya 4:6
bean: ethiopia-guji-natural.bean
brew:
  dose_g: 20
  yield_g: 300
  ratio: "1:15"
  water_temp_c: 93
  filter: paper
---

==First 40%==

*bloom{50g @93c}
~{45s}
*second{70g @93c}
~{45s}

==Final 60%==

*third{60g}
*fourth{60g}
*fifth{60g}
```

Open the brew sheet via the coffee icon in the ribbon or `Cmd+P` → "Open brew sheet".

---

## Installation

### Community plugins (recommended)

Search "coffeelang" in Settings → Community plugins → Browse.

### Manual

1. Download `main.js`, `manifest.json`, `styles.css` from the [latest release](https://github.com/joennespreuwers/obsidian-coffeelang/releases/latest)
2. Copy them to `<vault>/.obsidian/plugins/obsidian-coffeelang/`
3. Enable the plugin in Settings → Community plugins

---

## Language reference

See the [coffeelang spec](https://github.com/joennespreuwers/coffeelang/blob/master/SPEC.md) for the full grammar.

### Inline markers — `.pour`

| Symbol | Meaning | Example |
|---|---|---|
| `@` | Bean / dose | `@Ethiopia Guji{20g}` |
| `#` | Equipment | `#V60{}` |
| `*` | Water pour | `*bloom{50g @93c}` |
| `~` | Timer | `~{45s}` |
| `^` | Grind spec | `^{medium-fine, 25 clicks}` |
| `+` | Technique | `+stir{}` |
| `>>` | Metadata override | `>> water_temp_c: 96` |

### Front matter — `.bean`

```yaml
---
name: Ethiopia Guji Natural
roastery: Onyx Coffee Lab
origin_country: Ethiopia
process: natural          # washed | natural | honey | ...
roast_level: light        # light | medium | dark | ...
flavor_notes: [blueberry, jasmine, dark chocolate]
roast_date: 2026-03-15
---
```

---

## Development

```bash
git clone https://github.com/joennespreuwers/obsidian-coffeelang
cd obsidian-coffeelang
npm install
npm run dev    # watch mode — rebuilds on save
```

Symlink into your vault for live testing:
```bash
ln -s $(pwd) /path/to/vault/.obsidian/plugins/obsidian-coffeelang
```

---

## Related

- [coffeelang](https://github.com/joennespreuwers/coffeelang) — the language spec and Rust CLI parser

---

## License

MIT
