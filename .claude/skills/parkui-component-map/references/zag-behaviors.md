# Zag-js Built-in Behaviors Reference

This file documents what each zag-js state machine ALREADY handles. If a behavior
is listed here, you MUST NOT reimplement it with custom hooks, effects, or handlers.

## How to Read This File

Each component section shows:

- **Machine props**: Configuration options you pass to the machine (via Ark UI Root props)
- **Built-in behaviors**: Things the machine handles automatically
- **Common reimplementation mistakes**: Specific patterns you tend to write that are unnecessary

> **IMPORTANT**: For the authoritative source, read the actual machine files:
> `node_modules/@zag-js/<name>/dist/<name>.connect.mjs` — public API
> `node_modules/@zag-js/<name>/dist/<name>.machine.mjs` — states/transitions

---

## Toast

**Machine props (pass via createToaster or toast.create):**

- `duration` — auto-dismiss timer (ms)
- `placement` — screen position (top, top-start, top-end, bottom, bottom-start, bottom-end)
- `gap` — spacing between toasts
- `max` — maximum visible toasts
- `pauseOnPageIdle` — pause timers when page loses focus
- `pauseOnInteraction` — pause timers on hover/focus (THIS IS THE BIG ONE)
- `removeDelay` — delay before unmounting after dismiss (for exit animations)

**Built-in behaviors — DO NOT reimplement:**

- Auto-dismiss timer with configurable duration
- Pause on hover / focus (via `pauseOnInteraction`)
- Pause when page/tab is not visible (via `pauseOnPageIdle`)
- Resume timer on mouse leave / blur
- Stack positioning and reflow when toasts are added/removed
- Dismiss individual or all toasts
- Toast type (success, error, info, warning, loading)
- Promise-based toasts (loading → success/error)
- Swipe to dismiss (on touch devices)
- ARIA live region announcements

**Common mistakes:**

```tsx
// WRONG — reimplementing pause-on-hover
const [paused, setPaused] = useState(false)
onMouseEnter={() => setPaused(true)}
onMouseLeave={() => setPaused(false)}
useEffect(() => {
  if (!paused) {
    const timer = setTimeout(() => dismiss(), duration)
    return () => clearTimeout(timer)
  }
}, [paused])

// RIGHT — zag handles all of this
// Just pass pauseOnInteraction: true to createToaster (it's often the default)
const toaster = createToaster({
  placement: 'bottom-end',
  pauseOnInteraction: true,
})
```

---

## Dialog / Drawer

**Machine props:**

- `open` / `onOpenChange` — controlled open state
- `closeOnInteractOutside` — dismiss on outside click (default: true)
- `closeOnEscape` — dismiss on Escape key (default: true)
- `trapFocus` — trap focus inside dialog (default: true for modal)
- `preventScroll` — prevent body scroll when open (default: true for modal)
- `modal` — modal vs non-modal behavior
- `initialFocusEl` — element to focus on open
- `finalFocusEl` — element to focus on close
- `restoreFocus` — restore focus to trigger on close
- `role` — dialog or alertdialog
- `persistentElements` — elements outside dialog that should remain interactive

**Built-in behaviors — DO NOT reimplement:**

- Focus trapping (tab cycles within dialog)
- Initial focus placement
- Focus restoration on close
- Body scroll lock
- Outside click detection and dismissal
- Escape key handling
- Aria attributes (role, aria-modal, aria-labelledby, aria-describedby)
- Backdrop click handling
- Open/close animations (via data-state="open"/"closed")
- Nested dialog support

**Drawer adds:** `placement` prop (left, right, top, bottom) for slide direction.

**Common mistakes:**

```tsx
// WRONG — reimplementing focus trap
useEffect(() => {
  if (open) {
    const focusable = dialogRef.current.querySelectorAll('button, input, ...')
    // ... manual focus trap logic
  }
}, [open])

// WRONG — reimplementing scroll lock
useEffect(() => {
  if (open) document.body.style.overflow = 'hidden'
  return () => { document.body.style.overflow = '' }
}, [open])

// WRONG — reimplementing outside click
useEffect(() => {
  const handler = (e) => {
    if (!dialogRef.current?.contains(e.target)) onClose()
  }
  document.addEventListener('mousedown', handler)
  return () => document.removeEventListener('mousedown', handler)
}, [])

// RIGHT — just use the component, all of the above is built in
<Dialog.Root open={open} onOpenChange={(e) => setOpen(e.open)}>
```

---

## Select

**Machine props:**

- `collection` — ListCollection of items (REQUIRED)
- `value` / `onValueChange` — controlled selection
- `multiple` — multi-select mode
- `closeOnSelect` — close on selection (default: true for single, false for multiple)
- `loop` — loop keyboard focus through items
- `positioning` — floating UI positioning config
- `highlightedValue` / `onHighlightChange` — controlled highlight
- `disabled`, `readOnly`, `required`, `invalid` — form states
- `composite` — use roving tabindex for item focus
- `deselectable` — allow deselecting in single mode

**Built-in behaviors — DO NOT reimplement:**

- Keyboard navigation (arrow keys, home, end)
- Typeahead (type to jump to matching item)
- Open/close with Enter, Space, arrow keys
- Item highlight tracking on hover and keyboard
- Outside click to close
- Escape to close
- Positioning (floating UI — auto-placement, flip, shift)
- ARIA attributes (role, aria-expanded, aria-activedescendant, etc.)
- Form integration (hidden select element for form submission)
- Open/close animations via data-state

**Common mistakes:**

```tsx
// WRONG — manual keyboard handler
onKeyDown={(e) => {
  if (e.key === 'ArrowDown') { /* manual highlight logic */ }
  if (e.key === 'Enter') { /* manual select logic */ }
}}

// WRONG — manual positioning
const [position, setPosition] = useState({ top: 0, left: 0 })
useEffect(() => {
  const rect = triggerRef.current.getBoundingClientRect()
  setPosition({ top: rect.bottom, left: rect.left })
}, [open])

// RIGHT — the machine handles all keyboard and positioning
<Select.Root collection={collection} positioning={{ placement: 'bottom-start' }}>
```

---

## Menu

**Machine props:**

- `positioning` — floating UI config
- `closeOnSelect` — close on item select (default: true)
- `loop` — loop keyboard focus
- `highlightedValue` / `onHighlightChange`
- `composite` — use roving tabindex

**Built-in behaviors — DO NOT reimplement:**

- Keyboard navigation (arrows, home, end)
- Typeahead search
- Nested/sub-menu support (via TriggerItem)
- Outside click dismissal
- Escape key handling
- Focus management (focus trigger on close)
- ARIA menu role and attributes
- Checkbox and radio menu items
- Positioning and auto-flip

---

## Combobox

**Machine props:**

- `collection` — ListCollection (REQUIRED)
- `value` / `onValueChange` — controlled selection
- `inputValue` / `onInputValueChange` — controlled input text
- `multiple` — multi-select
- `allowCustomValue` — allow values not in collection
- `closeOnSelect` — close on select
- `loop` — loop keyboard focus
- `openOnClick` — open list on input click (default: true)
- `openOnChange` — open list on input change (default: true)
- `openOnKeyPress` — open list on key press
- `inputBehavior` — "autohighlight" | "autocomplete" | "none"
- `selectionBehavior` — "clear" | "replace" | "preserve"
- `positioning` — floating UI config
- `composite` — roving tabindex

**Built-in behaviors — DO NOT reimplement:**

- Input filtering (you provide filtered collection, machine handles the rest)
- Keyboard navigation in list
- Typeahead / autocomplete
- Highlight management
- Open/close logic
- Item selection and deselection
- Input value sync with selection
- ARIA combobox pattern
- Positioning
- Focus management

---

## Tabs

**Machine props:**

- `value` / `onValueChange` — controlled active tab
- `orientation` — horizontal | vertical (changes arrow key behavior)
- `loop` — loop focus through tabs
- `activationMode` — "automatic" (focus = activate) | "manual" (focus then Enter)
- `composite` — roving tabindex

**Built-in behaviors — DO NOT reimplement:**

- Arrow key navigation between tabs
- Tab → panel focus management
- Automatic or manual activation
- ARIA tablist/tab/tabpanel roles
- Keyboard focus wrapping (with loop)
- Active tab indicator positioning (via CSS variables)

---

## Accordion

**Machine props:**

- `value` / `onValueChange` — controlled open items
- `multiple` — allow multiple open items
- `collapsible` — allow all items to be closed (default: false)
- `orientation` — horizontal | vertical
- `disabled` — disable all items

**Built-in behaviors — DO NOT reimplement:**

- Open/close toggling with keyboard and click
- Arrow key navigation between triggers
- Home/End key support
- Single vs multiple expansion logic
- Collapsible behavior
- ARIA accordion pattern
- Open/close animations via data-state
- Content height animation (via --height CSS variable)

---

## Tooltip

**Machine props:**

- `openDelay` — delay before showing (default: 700ms)
- `closeDelay` — delay before hiding (default: 300ms)
- `closeOnPointerDown` — hide on pointer down (default: true)
- `closeOnScroll` — hide on scroll (default: true)
- `closeOnClick` — hide on click
- `closeOnEscape` — hide on escape
- `positioning` — floating UI config
- `interactive` — keep open when hovering content
- `disabled`

**Built-in behaviors — DO NOT reimplement:**

- Show/hide with delays
- Pointer enter/leave handling
- Focus show/hide
- Positioning and auto-flip
- Escape key dismiss
- ARIA tooltip pattern
- Global tooltip group (only one visible at a time, instant switch)
- Scroll dismiss

---

## Popover

**Machine props:**

- `open` / `onOpenChange` — controlled state
- `closeOnInteractOutside` — outside click dismiss (default: true)
- `closeOnEscape` — escape dismiss (default: true)
- `autoFocus` — focus first element on open
- `positioning` — floating UI config
- `modal` — modal behavior (focus trap)
- `portalled` — render in portal
- `persistentElements` — elements that shouldn't trigger outside click

**Built-in behaviors — DO NOT reimplement:**

- Focus management on open/close
- Outside click detection
- Escape key handling
- Positioning and auto-flip
- Arrow element positioning
- ARIA attributes
- Open/close animations via data-state

---

## Slider

**Machine props:**

- `value` / `onValueChange` — controlled value(s)
- `min`, `max`, `step` — range config
- `orientation` — horizontal | vertical
- `minStepsBetweenThumbs` — for range sliders
- `disabled`, `readOnly`
- `origin` — "start" | "center"

**Built-in behaviors:**

- Drag to change value
- Arrow key step changes
- Click on track to jump
- Multi-thumb support (range slider)
- ARIA slider pattern
- CSS variables for track fill (--slider-thumb-\*)

---

## NumberInput

**Machine props:**

- `value` / `onValueChange` — controlled value
- `min`, `max`, `step` — range config
- `allowOverflow` — allow values outside min/max
- `clampValueOnBlur` — clamp to range on blur
- `spinOnPress` — hold button to increment
- `locale` — number formatting
- `formatOptions` — Intl.NumberFormat options
- `disabled`, `readOnly`, `invalid`

**Built-in behaviors:**

- Increment/decrement buttons with spin
- Arrow key changes
- Mouse wheel support
- Value clamping
- Number formatting/parsing
- ARIA spinbutton pattern
- Keyboard: Arrow Up/Down, Page Up/Down, Home/End

---

## Checkbox / Switch

**Machine props:**

- `checked` / `onCheckedChange` — controlled state
- `indeterminate` — indeterminate state
- `disabled`, `readOnly`, `required`, `invalid`
- `value` — form value

**Built-in behaviors:**

- Toggle on click and Space/Enter
- Indeterminate state management
- Form integration
- ARIA checkbox/switch pattern
- data-state for styling (checked/unchecked/indeterminate)

---

## DatePicker

**Machine props:**

- `value` / `onValueChange`
- `min`, `max` — date range limits
- `disabled` — disabled dates (function)
- `locale` — date formatting locale
- `closeOnSelect`
- `selectionMode` — "single" | "multiple" | "range"
- `positioning`
- `startOfWeek` — 0-6

**Built-in behaviors:**

- Full calendar navigation (month/year/decade views)
- Keyboard navigation in calendar grid
- Date range selection with visual range highlight
- Date validation and disabled dates
- Locale-aware formatting
- Input parsing
- ARIA date picker pattern

---

## TagsInput

**Machine props:**

- `value` / `onValueChange`
- `max` — maximum tags
- `allowDuplicates`
- `addOnPaste` — parse pasted text into tags
- `delimiter` — character that creates a tag (default: comma)
- `disabled`, `readOnly`, `invalid`
- `validate` — validation function for new tags
- `editable` — allow editing existing tags

**Built-in behaviors:**

- Add on Enter/delimiter
- Remove on Backspace (when input empty)
- Paste handling (split by delimiter)
- Tag editing (double-click)
- Keyboard navigation between tags
- Duplicate prevention
- ARIA attributes
- Focus management

---

## Carousel

**Machine props:**

- `index` / `onIndexChange` — controlled slide
- `loop` — infinite loop
- `slidesPerView` — visible slides
- `slidesPerMove` — slides to advance
- `orientation` — horizontal | vertical
- `autoplay` — auto-advance
- `allowMouseDrag` — drag navigation

**Built-in behaviors:**

- Snap scrolling
- Touch/swipe navigation
- Mouse drag navigation
- Keyboard navigation (arrows)
- Auto-play with pause on interaction
- Loop wrapping
- ARIA carousel pattern
- Slide visibility tracking

---

## ToggleGroup

**Machine props:**

- `value` / `onValueChange`
- `multiple` — allow multiple active
- `disabled`
- `orientation`
- `loop` — loop keyboard focus
- `rovingFocus` — roving tabindex

**Built-in behaviors:**

- Single or multiple toggle selection
- Keyboard navigation (arrow keys)
- Roving tabindex
- ARIA toolbar pattern

---

## PinInput

**Machine props:**

- `value` / `onValueChange`
- `onValueComplete` — callback when all filled
- `placeholder`
- `type` — "alphanumeric" | "numeric" | "alphabetic"
- `otp` — one-time password mode (autocomplete)
- `mask` — mask input (like password)
- `disabled`

**Built-in behaviors:**

- Auto-advance on input
- Backspace to previous
- Paste handling (distribute across inputs)
- Input validation by type
- Focus management
- ARIA pattern

---

## General Rule

Before adding ANY of these to a component:

- `useState` for open/close → Check if the machine has `open`/`onOpenChange`
- `useEffect` with timers → Check if the machine has duration/delay props
- `onMouseEnter`/`onMouseLeave` → Check if the machine handles hover
- `onKeyDown` handlers → Check if the machine handles keyboard navigation
- `addEventListener` for clicks outside → Check `closeOnInteractOutside`
- Manual focus management → Check if the machine manages focus
- `useRef` + `getBoundingClientRect` for positioning → Check `positioning` prop

If the machine handles it, USE THE MACHINE. Don't fight the framework.
