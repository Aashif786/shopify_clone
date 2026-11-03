# ADR-008: Nested Layout Containers and Visual Builder Editing History

## Status

**Accepted**

## Date

2026-11-02

## Decision

The landing-page builder implements:
1. **Hierarchical Element Layout Containers**: A recursive, tree-based element architecture supporting first-class layout primitives (`container`, `row`, `column`, `columns`, `grid`, `stack`) with stable identities, depth bounds (`MAX_CONTAINER_DEPTH = 6`), circular nesting guards, and independent container layout engines.
2. **Transactional Past-Present-Future History State Machine**: An in-memory, bounded (`limit: 50`) editing history engine managing atomic state transitions, debounced rapid text/slider edits, discrete drag-and-drop transactions, non-destructive undo/redo, keyboard shortcuts (`Ctrl+Z`, `Ctrl+Shift+Z` / `Ctrl+Y`), and visual action log inspection.

---

## 1. Context & Problem Statement

Cal Cart merchants require a flexible visual landing page builder capable of complex modern layouts (e.g. multi-column hero sections, nested feature rows, side-by-side button pairs, and cards within responsive columns) while maintaining complete ease of use, zero data loss, and error recovery.

Key challenges:
- **Hierarchical Layouts**: Previously, section elements resided in a flat array (`section.elements`), restricting rich nesting (e.g. placing rows of buttons or multi-column media inside custom containers) without duplicating section primitives.
- **Data Integrity & Cycle Prevention**: Moving or reparenting elements within recursive trees must guarantee stable element IDs, preserve content and styling independently of layout, prevent circular references (e.g. dropping a parent into its own child), and enforce reasonable safety depth limits.
- **Backward Compatibility**: Thousands of existing merchant storefronts rely on flat element structures, legacy section presets, and adaptive layout modes (`auto`, `stack`, `row`, `columns-2`, `columns-3`, `grid`). They must render identically and normalize transparently.
- **Editing History (Undo / Redo)**: Visual building requires confidence. Merchants need multi-level undo and redo, atomic drag-and-drop movement, and debounced typing grouping without polluting the history stack with transient UI states (such as hover, active tab, or inspector toggles).

---

## 2. Decision Details

### 2.1 Universal Tree Architecture & Container Primitives

All elements in `modules/stores/src/domain/landing-page.ts` follow the recursive `PageElement` schema:

```ts
export interface PageElement<TContent = Record<string, unknown>> {
  id: string;
  type: ElementType;
  label?: string;
  isVisible: boolean;
  content: TContent;
  style?: ElementStyleConfig;
  responsive?: ResponsiveVisibilityConfig;
  animation?: ElementAnimationConfig;
  children?: PageElement[];
}
```

The system defines 6 specialized container types under `isContainerElement`:
- `container`: Universal styled wrapper with background, border, radius, shadow, padding, and inner layout modes (`auto`, `stack`, `row`, `columns`, `grid`).
- `row`: Horizontal flex flow (`flex flex-row flex-wrap gap-4 items-center`) with wrapping and responsive stacking controls.
- `column`: Vertical column container (`flex flex-col gap-4 items-start`) with width constraints and alignment.
- `columns`: Multi-column grid container with explicit aspect/width ratios (`50_50`, `60_40`, `40_60`, `70_30`, `30_70`, `33_33_33`).
- `grid`: CSS sub-grid with configurable column counts (1, 2, 3, 4, 6, 12) and gap tokens.
- `stack`: Vertical flexbox with controlled distribution and alignment.

### 2.2 Tree Operations & Safety Constraints

To prevent duplication and guarantee mathematical correctness, all tree operations reside in `@calcart/stores/landing-page`:
- `MAX_CONTAINER_DEPTH = 6`: Guards against infinite recursion and layout blowups.
- `isDescendantOf(elements, parentId, childId)`: Protects against circular nesting.
- `extractElementFromTree(elements, targetId)`: Cleanly lifts an element and its subtree out of any container depth.
- `insertElementIntoTree(elements, targetId, elementToInsert, position)`: Inserts before, after, or inside target containers.
- `moveElementInTree(elements, sourceId, targetId, position)`: Atomic multi-container reparenting.
- `deleteElementFromTree(elements, targetId, unwrapChildren)`: Supports safe deletion (unwrapping child elements into parent container to prevent accidental content loss).
- `duplicateElementInTree(elements, targetId)`: Deep-clones subtree with fresh unique IDs for every child.

### 2.3 History State Transition Architecture

The history system follows a classic three-stack state machine:

```ts
export interface HistoryEntry {
  config: StorefrontLandingPageConfig;
  description: string;
  category: "element" | "layout" | "section" | "theme";
  timestamp: number;
}

export interface EditorHistoryState {
  past: HistoryEntry[];
  present: StorefrontLandingPageConfig;
  future: HistoryEntry[];
}
```

State Transition Rules:
1. **New Operation**:
   - Compares JSON snapshot of `present` vs `newConfig`. If identical, discards (no redundant snapshots).
   - If debounced (e.g., continuous keystroke in heading or slider change): updates `present` in place without pushing a new entry if within the debounce window (800ms) for the same field.
   - Otherwise: pushes `present` to `past` (clamped to 50 entries) and resets `future: []`.
2. **Undo**:
   - If `past` is non-empty, pushes `present` to `future` and restores the latest entry from `past`.
3. **Redo**:
   - If `future` is non-empty, pushes `present` to `past` and restores the next entry from `future`.
4. **Direct History Jump**:
   - Selecting any step in the History Drawer jumps to that snapshot, correctly shifting the partition between `past` and `future`. Any subsequent edit from a past state truncates the abandoned `future` branch.
5. **Keyboard Guard**:
   - Global event listener ignores `Ctrl+Z` / `Cmd+Z` when the focus is inside an `<input>`, `<textarea>`, `<select>`, or content-editable node, preserving standard native text undo/redo.

### 2.4 Separation of Concerns: Content, Layout, Styling

The system enforces strict separation between:
1. **Content**: Text, URLs, media links, and product selectors.
2. **Layout**: Container hierarchy, parent-child relationships, order, flex/grid modes, and width fractions.
3. **Styling**: Colors, typography, borders, shadows, and paddings.

Moving, reordering, or reparenting an element never resets or mutates its content, styling tokens, or animations.

---

## 3. Consequences

### Positive
- True visual builder capabilities matching modern professional standards (Webflow/Framer/Squarespace).
- Non-destructive drag-and-drop: elements can be grouped into rows, nested into containers, or rearranged effortlessly.
- Full undo/redo confidence for merchants with keyboard shortcut support and a visual timeline panel.
- 100% backward-compatible: existing merchant drafts and published configurations load seamlessly without migration scripts.

### Neutral / Trade-offs
- In-memory history is bounded to 50 snapshots to maintain minimal memory consumption.
- History is local to the active editing session; refreshing the browser initializes a clean history based on the latest saved draft.
