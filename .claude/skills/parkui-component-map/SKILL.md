---
name: parkui-component-map
description: >
  Ensures correct usage of Park UI, Ark UI, Panda CSS, and zag-js when writing
  UI components. Use this skill BEFORE writing or modifying ANY component that
  touches Park UI components, Panda CSS styling, or interactive behavior. Triggers
  on: creating or editing components, adding css() calls, using any Park UI
  primitive (Button, Dialog, Select, Table, Card, Field, Toast, Tabs, Menu,
  Popover, Tooltip, Accordion, Checkbox, Combobox, Drawer, Switch, RadioGroup,
  NumberInput, DatePicker, TagsInput, Progress, Slider), fixing styling issues,
  or any mention of Park UI / Ark UI / Panda CSS / zag-js. Also triggers when
  the user says "fix the styling", "it looks wrong", "use the right component",
  or "stop hardcoding".
---

# Park UI Component Map

You are working in a stack where behavior, components, and styling are split
across three layers:

- **zag-js** — state machines that handle all interactive behavior
- **Ark UI** — React components that bind zag-js machines to the DOM
- **Park UI** — Panda CSS recipes that style the Ark UI components

Your tendency is to guess at APIs and recipe defaults instead of looking them up.
This causes you to hardcode styles the recipe already provides, reimplement
behavior the zag machine already handles, and use raw HTML where Park UI
components exist.

The fix is simple: **look things up before you write code.**

## Mandatory Lookup Procedure

Before writing or modifying ANY Park UI component, do these three steps.
Do not skip them. Do not guess.

### Step 1: Read the project's recipe file

```
cat src/theme/recipes/<component>.ts
```

This tells you exactly what the recipe styles for each slot. List out every
CSS property the recipe sets for the slot you're about to touch. If your
`className={css(...)}` contains ANY property from that list, remove it —
the recipe already handles it.

### Step 2: Read the UI component source

```
cat src/components/ui/<component>.tsx
```

This tells you what compound parts exist, which parts are `styled()` with
the recipe applied, what props are forwarded, and the correct nesting structure.
Use this instead of guessing the API.

For deeper reference on props and usage patterns, query Context7:

```
resolve-library-id: "ark-ui" → /llmstxt/ark-ui_llms_txt
query-docs: "<component name> React component parts props API"
```

### Step 3: Check what the zag machine handles

For interactive components (Dialog, Select, Menu, Toast, Combobox, Tabs,
Accordion, Tooltip, Popover, Slider, NumberInput, DatePicker, Carousel,
TagsInput, Checkbox, Switch, ToggleGroup, PinInput):

```
cat node_modules/@zag-js/<name>/dist/<name>.connect.mjs
```

This tells you what the machine handles automatically — the props and handlers
it exposes. If the machine has a prop or behavior for what you're about to
implement manually, use the machine instead.

For deeper reference, query Context7:

```
resolve-library-id: "zag-js" → /chakra-ui/zag
query-docs: "<component> machine props connect API built-in behaviors"
```

### Step 4: Only then write code

Now you know:

- What the recipe already styles (don't duplicate)
- What parts exist and how they compose (don't invent wrappers)
- What behavior the machine handles (don't reimplement)

## What Goes Wrong When You Skip the Lookup

### Duplicating recipe styles (most common)

```tsx
// WRONG — the table recipe already sets all of this
<Table.Header className={css({ fontSize: 'xs', fontWeight: '600', px: '4', py: '2.5' })}>

// RIGHT — the recipe handles it, you checked in Step 1
<Table.Header>
```

### Adding borders manually

```tsx
// WRONG — borders don't belong in css() for Park UI components
<div className={css({ border: '1px solid', borderColor: 'border.subtle' })}>

// RIGHT — Card.Root has border in its recipe (variant: outline is the default)
<Card.Root>
```

### Reimplementing zag behavior

```tsx
// WRONG — you didn't check Step 3, zag toast machine has pauseOnInteraction
const [paused, setPaused] = useState(false)
onMouseEnter={() => setPaused(true)}
useEffect(() => { if (!paused) { /* timer */ } }, [paused])

// RIGHT — the machine handles this, you confirmed in Step 3
createToaster({ pauseOnInteraction: true })
```

### Using raw HTML instead of Park UI components

```tsx
// WRONG
<label className={css({ fontSize: 'sm' })}>Name</label>
<p className={css({ color: 'fg.error' })}>{error}</p>

// RIGHT
<Field.Root invalid={!!error}>
  <Field.Label>Name</Field.Label>
  <Field.ErrorText>{error}</Field.ErrorText>
</Field.Root>
```

## Decision Tree

When you need to render something:

1. **Is there a Park UI component for this?** → Use it. Check `src/components/ui/`.
2. **Does the recipe already style what I'm about to add?** → Read the recipe file. Don't add it.
3. **Does the zag machine handle this behavior?** → Query Context7. Don't reimplement.
4. **Am I adding `className={css(...)}`?** → Is it layout (width, margin, alignment, gap)? OK.
   Is it visual (color, padding, border, font)? Probably wrong — read the recipe first.
5. **Am I adding event handlers or useEffect?** → Does the machine expose this? Check the connect file.

## Quick Rules

- `Table.Root interactive` gives you hover rows. Don't add `_hover` to Table.Row.
- `Card.Body` has `pb: 6, px: 6` but NO `pt`. Only add `pt: 6` if there's no Card.Header.
- `Field.Label` auto-connects to the input. No `htmlFor`/`id` needed.
- `Field.ErrorText` only shows when `Field.Root` has `invalid={true}`.
- `Select.Indicator` MUST be inside `Select.Trigger`.
- Never add `className` to `Select.ItemGroupLabel` — recipe handles it.
- Never use raw `<label>`, `<select>`, `<table>`, `<input>` — use Park UI equivalents.
- Never use `border`, `borderWidth`, `borderColor` in `css()` — use Card.Root or let the recipe handle it.
- Never use hex colors (`#xxx`), `rgb()`, or pixel values in `css()` — use Panda CSS tokens.
- In theme config files, token references need curly braces: `'{colors.border.subtle}'` not `'colors.border.subtle'`.
- Semantic financial colors: `color: 'income'` / `color: 'expense'` with `.muted` variants for backgrounds.
