---
name: panda-token-enforcer
description: >
  Validates that code follows Panda CSS and Park UI conventions — catches hardcoded
  styles, duplicated recipe properties, raw HTML elements that should be Park UI
  components, and manual behavior reimplementation. Use this skill AFTER writing or
  editing any .tsx or .ts file that contains UI code, styling, css() calls, or Park UI
  components. Also use when reviewing code, when the user says "check my styles",
  "find hardcoded values", "audit the CSS", "enforce tokens", or after completing
  any UI implementation task. This skill should trigger on any mention of style
  violations, token enforcement, Panda CSS anti-patterns, or Park UI misuse. Use it
  proactively after writing component code — don't wait to be asked.
---

# Panda CSS Token Enforcer

This skill validates UI code against Park UI and Panda CSS conventions. Run it
after writing or editing component code to catch violations before they accumulate.

## When to Use This Skill

Run enforcement after ANY of these:

- Writing a new component
- Editing an existing component's JSX or styling
- Adding `css()` calls or `className` props
- Modifying anything in `src/components/`, `src/routes/`, or theme files

## Enforcement Process

### Step 1: Run the Scanner

Execute the anti-pattern scanner on the files you just wrote or edited:

```bash
python3 .claude/skills/panda-token-enforcer/scripts/check-antipatterns.py src/components/path/to/file.tsx
```

Or scan a whole directory:

```bash
python3 .claude/skills/panda-token-enforcer/scripts/check-antipatterns.py src/components/dashboard/
```

The script outputs violations grouped by category with file, line number, the
offending code, and a suggested fix.

### Step 2: Review Each Violation

The scanner catches patterns that are LIKELY wrong, not guaranteed wrong. For
each violation, decide:

**Fix it** if the scanner is right — the most common case. The suggested fix
will point you to the correct token, component, or prop.

**Ignore it** only if you have a specific, articulable reason. Valid reasons:

- Layout properties (width, maxWidth, margin, gap) are not recipe territory
- `textAlign` on Table cells is legitimate
- `pt: '6'` on Card.Body with no Card.Header above it is correct
- `border: 'none'` on native buttons (removing browser default) is OK

If you're unsure whether to ignore, assume the scanner is right.

### Step 3: Apply Fixes

Fix violations in order of severity:

1. **Critical**: Raw HTML replacing Park UI components (raw `<label>`, `<p>` for errors)
2. **High**: Hardcoded colors, borders, manual behavior reimplementation
3. **Medium**: Duplicated recipe styles (padding, font sizes on Table/Card/Field)
4. **Low**: Style token suggestions (using `gray.500` instead of `fg.muted`)

## Anti-Pattern Categories

### Category 1: Hardcoded Values (HIGH severity)

Raw hex colors, rgb values, or pixel values that should be tokens.

```tsx
// VIOLATION
className={css({ color: '#666', bg: '#f5f5f5', fontSize: '14px' })}

// FIX — use semantic tokens
className={css({ color: 'fg.muted', bg: 'bg.subtle', fontSize: 'sm' })}
```

**Detection**: Any `#` hex, `rgb(`, `rgba(`, or `px` values inside `css()` calls.

**Exception**: None inside css(). Pixel values belong in tokens.

### Category 2: Manual Borders (HIGH severity)

Adding border styles in `css()` when a Card or Table recipe handles them.

```tsx
// VIOLATION
<div className={css({ border: '1px solid', borderColor: 'border.subtle', borderRadius: 'md', p: '4' })}>

// FIX — use Card.Root
<Card.Root>
  <Card.Body className={css({ pt: '6' })}>
```

**Detection**: `border:`, `borderWidth`, `borderBottom`, `borderTop`, `borderColor`,
`borderLeft`, `borderRight` inside `css()` calls.

**Exception**: `border: 'none'` on native elements to remove browser defaults is OK.

### Category 3: Duplicated Recipe Styles (MEDIUM severity)

Adding styles that the component's recipe already provides.

```tsx
// VIOLATION — Table recipe already handles all of this
<Table.Header className={css({ fontSize: 'xs', fontWeight: '600', px: '4', py: '2.5', color: 'fg.muted' })}>

// FIX — remove the className entirely
<Table.Header>
```

**Detection**: `fontSize`, `fontWeight`, `px`, `py`, `color` on Table.Header/Cell;
`p` on Card.Header/Body/Footer; `fontSize`, `fontWeight` on Field.Label.

**Key rule**: If the property appears in the component's recipe for that slot,
it should NOT appear in className.

### Category 4: Raw HTML Elements (CRITICAL severity)

Using raw HTML elements that have Park UI equivalents.

```tsx
// VIOLATION
<label className={css({ fontSize: 'sm', fontWeight: 'medium' })}>Name</label>
<p className={css({ color: 'fg.error', fontSize: 'xs' })}>{error}</p>
<div className={css({ display: 'flex', gap: '2' })}>
  <input className={css({ borderWidth: '1px' })} />
</div>

// FIX
<Field.Root invalid={!!error}>
  <Field.Label>Name</Field.Label>
  <Input />
  <Field.ErrorText>{error}</Field.ErrorText>
</Field.Root>
```

**Detection**: Raw `<label`, `<select`, `<table`, `<input` (not from Park UI imports)
with className containing css() calls.

### Category 5: Manual Behavior (HIGH severity)

Reimplementing behavior that zag-js state machines handle.

**Detection patterns**:

- `useState` + `onMouseEnter`/`onMouseLeave` near toast/tooltip components
- `useEffect` with `setTimeout`/`setInterval` near dismissible components
- `addEventListener('mousedown'` or `addEventListener('click'` for outside-click
- `addEventListener('keydown'` for Escape handling near dialogs/menus/selects
- `document.body.style.overflow` for scroll lock
- Manual `focus()` calls near dialog/popover/menu opens
- `getBoundingClientRect` for positioning near floating components

### Category 6: Inline Styles (HIGH severity)

Using `style={}` attribute instead of `css()`.

```tsx
// VIOLATION
<div style={{ padding: '16px', color: 'red' }}>

// FIX
<div className={css({ p: '4', color: 'fg.error' })}>
```

**Detection**: `style={` or `style =` on JSX elements.

**Exception**: Dynamic styles that must be computed at runtime (e.g., `style={{ width: `${percent}%` }}`).
Even then, prefer Panda CSS variables when possible.

### Category 7: Token Syntax in Config (MEDIUM severity)

Missing curly braces in token references inside theme config files.

```ts
// VIOLATION
'--global-color-border': 'colors.border.subtle'

// FIX
'--global-color-border': '{colors.border.subtle}'
```

**Detection**: Token-like paths (e.g., `colors.`, `spacing.`, `fontSizes.`) inside
string values in theme files that aren't wrapped in `{...}`.

## Severity Levels and Actions

| Severity | Action Required                                                               |
| -------- | ----------------------------------------------------------------------------- |
| CRITICAL | Must fix before committing. These cause functional bugs.                      |
| HIGH     | Should fix immediately. These cause visual inconsistency or maintenance debt. |
| MEDIUM   | Fix when touching the file. These are style convention violations.            |
| LOW      | Consider fixing. These are suggestions for better token usage.                |

## Post-Fix Verification

After fixing violations, run the scanner again to confirm all issues are resolved.
If a file passes with zero violations, you're done.
