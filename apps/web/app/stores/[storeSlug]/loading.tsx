/**
 * Storefront route loading state. Mirrors the final Atelier composition (header band,
 * an eyebrow + large headline block, then an uneven product grid) so the page does not
 * shift when real content replaces it. Skeletons shimmer via a composited transform and
 * stop under prefers-reduced-motion.
 */
export default function StorefrontLoading() {
  return (
    <div className="storefront-layout min-h-[100dvh] bg-background" aria-busy="true" aria-label="Loading storefront">
      <div className="border-b border-[color:var(--at-hairline)]">
        <div className="at-container flex h-[var(--at-header-h)] items-center justify-center">
          <div className="at-skeleton h-5 w-40" />
        </div>
      </div>

      <main className="at-container py-14 lg:py-20">
        <div className="at-skeleton h-3 w-24" />
        <div className="at-skeleton mt-6 h-14 w-full max-w-3xl lg:h-20" />
        <div className="at-skeleton mt-4 h-14 w-2/3 max-w-xl lg:h-20" />

        <div className="mt-14 grid grid-cols-2 gap-x-4 gap-y-10 lg:grid-cols-12 lg:gap-x-6">
          <div className="col-span-2 lg:col-span-7">
            <div className="at-skeleton aspect-[4/5] w-full" />
            <div className="at-skeleton mt-4 h-4 w-1/2" />
          </div>
          <div className="col-span-1 lg:col-span-5 lg:mt-24">
            <div className="at-skeleton aspect-square w-full" />
            <div className="at-skeleton mt-4 h-4 w-2/3" />
          </div>
        </div>
      </main>
    </div>
  );
}
