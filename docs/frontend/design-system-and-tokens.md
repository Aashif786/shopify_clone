# Design System, Themes & Component Tokens

This document outlines the design tokens, CSS variable hierarchy, light and dark theme architectures, and shared UI component library implemented in `@calcart/ui` (`packages/ui`).

---

## 1. Design Token Architecture

Design tokens are structured into semantic tiers in `packages/ui/src/styles/tokens.css`:
1. **Global Constants**: Spacing scale, typography fonts, border radiuses, z-index stack.
2. **Semantic Light Palette**: Default canvas, surface, text, and border variables under `:root` and `[data-theme="light"]`.
3. **Semantic Dark Palette**: Inverted dark surface, text contrast, and border variables under `[data-theme="dark"]`.

### Core Token Variables

| Category | Token Variable | Light Value | Dark Value |
| :--- | :--- | :--- | :--- |
| **Canvas** | `--bg-canvas` | `#f8fafc` | `#0b0f19` |
| **Surface** | `--bg-surface` | `#ffffff` | `#111827` |
| **Subtle Surface** | `--bg-subtle` | `#f1f5f9` | `#1f2937` |
| **Text Primary** | `--text-primary` | `#0f172a` | `#f9fafb` |
| **Text Secondary** | `--text-secondary` | `#475569` | `#9ca3af` |
| **Text Muted** | `--text-muted` | `#64748b` | `#6b7280` |
| **Border Primary** | `--border-primary` | `#e2e8f0` | `#1f2937` |
| **Brand Primary** | `--brand-primary` | `#2563eb` | `#3b82f6` |
| **Success** | `--success` | `#16a34a` | `#22c55e` |
| **Warning** | `--warning` | `#ca8a04` | `#eab308` |
| **Danger** | `--danger` | `#dc2626` | `#ef4444` |

---

## 2. Component System (`packages/ui/src/components`)

All components conform to accessibility (WCAG 2.1 AA) and semantic HTML:

- **`Button`**: Variants (`primary`, `secondary`, `outline`, `ghost`, `danger`), sizes (`sm`, `md`, `lg`), loading spinner integration, disabled state handling.
- **`Card`**: Structured card container (`CardHeader`, `CardTitle`, `CardDescription`, `CardContent`, `CardFooter`).
- **`Input` & `FormField`**: Accessible label association via `id` and `htmlFor`, inline error feedback (`aria-invalid`, `aria-describedby`), disabled styling.
- **`Table`**: Responsive overflow container with zebra striping, sticky headers, cell padding, and empty states.
- **`Dialog`**: Accessible modal with focus trapping, `aria-modal="true"`, backdrop click dismiss, keyboard ESC dismiss.
- **`Badge`**: Status indicators (`default`, `success`, `warning`, `danger`, `outline`).
- **`Alert`**: Notification banner (`info`, `success`, `warning`, `error`) with icon and close button.
- **`LoadingIndicator` / `Spinner`**: Animated SVGs with `aria-live="polite"` and screen-reader announcements.
- **`EmptyState`**: Standardized fallback for zero-item lists with illustration slot and action CTA.
- **`Pagination`**: Cursor or page-based navigation with previous/next buttons.

---

## 3. Responsive Breakpoints

Defined in CSS tokens and media queries:
- **Mobile**: `< 640px` (single column, full-width drawers, stacked tables).
- **Tablet**: `640px – 1024px` (two-column grids, collapsible sidebars).
- **Desktop**: `> 1024px` (fixed 260px merchant sidebar, multi-column checkout layout).
