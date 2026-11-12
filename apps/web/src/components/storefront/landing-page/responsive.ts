/**
 * Standardized responsive visibility utility for sections and elements.
 *
 * Device Breakpoints:
 * - Mobile:  < 640px (sm)
 * - Tablet:  640px - 1023px (sm to lg)
 * - Desktop: >= 1024px (lg)
 *
 * Generates non-conflicting Tailwind classes without cascade precedence issues.
 */
export function getResponsiveVisibilityClasses(
  hideMobile?: boolean,
  hideTablet?: boolean,
  hideDesktop?: boolean,
  isPreview?: boolean,
): string {
  if (isPreview) {
    return [
      hideMobile ? "opacity-75 ring-1 ring-amber-500/30" : "",
      hideTablet ? "opacity-75 ring-1 ring-purple-500/30" : "",
      hideDesktop ? "opacity-75 ring-1 ring-sky-500/30" : "",
    ]
      .filter(Boolean)
      .join(" ");
  }

  const m = Boolean(hideMobile);
  const t = Boolean(hideTablet);
  const d = Boolean(hideDesktop);

  if (m && t && d) return "hidden";
  if (m && t) return "hidden lg:block";
  if (m && d) return "hidden sm:block lg:hidden";
  if (t && d) return "sm:hidden";
  if (m) return "hidden sm:block";
  if (t) return "sm:hidden lg:block";
  if (d) return "lg:hidden";
  return "";
}
