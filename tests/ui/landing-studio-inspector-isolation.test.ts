import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

/**
 * Regression: clicking anything in the landing page studio's Contextual Inspector sent the
 * panel back to the top without applying the change.
 *
 * Cause: globals.css had `:focus-within:has(select) { overflow: visible }`. The inspector holds
 * <select>s, so as soon as a control inside it took focus, that rule forced overflow: visible on
 * the scroll container (and every ancestor up to the studio), which removed scrolling and
 * collapsed the panel's scroll position to 0. The studio must be exempt from that rule, and the
 * inspector must be an isolated toolbar.
 */
const root = path.resolve(__dirname, "../..");
const css = readFileSync(path.join(root, "apps/web/app/globals.css"), "utf8");
const page = readFileSync(path.join(root, "apps/web/app/merchant/landing-page/page.tsx"), "utf8");

describe("landing studio inspector isolation", () => {
  it("the global select-focus overflow rule exempts the studio and its ancestors", () => {
    const rule = css.match(/:focus-within:has\(select\)[^{]*\{/g) ?? [];
    expect(rule.length).toBeGreaterThan(0);
    for (const selector of rule) {
      expect(selector).toContain("[data-studio-panel]");
      expect(selector).toContain("[data-studio-panel] *");
      expect(selector).toContain(":has([data-studio-panel])");
    }
  });

  it("no unscoped rule forces overflow visible on a focused container", () => {
    const unscoped = css.match(/(^|\n)\s*:focus-within(?!:has\(select\):not)[^{]*\{[^}]*overflow:\s*visible/g);
    expect(unscoped).toBeNull();
  });

  it("the studio root and inspector are marked so the exemption and isolation apply", () => {
    expect(page).toContain('data-studio-panel=""');
    expect(page).toContain('data-studio-inspector=""');
    expect(css).toMatch(/\[data-studio-inspector\]\s*\{[^}]*overscroll-behavior:\s*contain/);
  });

  it("the page no longer fights the scroll position with restore timers", () => {
    expect(page).not.toContain("useLayoutEffect");
    expect(page).not.toContain("isRestoringScrollRef");
    expect(page).not.toContain("queueMicrotask");
    // it only returns to the top when the customer picks a different section, element or tab
    expect(page).toMatch(/\[selectedSectionId, selectedElementId, activeTab, resetInspectorScroll\]/);
  });
});
