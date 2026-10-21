export default function StorefrontLoading() {
  return (
    <main className="storefront-main route-loading route-loading--storefront" aria-busy="true" aria-label="Loading storefront">
      <div className="route-loading-line route-loading-line--wide" />
      <div className="route-loading-line" />
      <div className="route-loading-grid" aria-hidden="true">
        <div /><div /><div />
      </div>
    </main>
  )
}
