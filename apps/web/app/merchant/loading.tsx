export default function MerchantLoading() {
  return (
    <main className="merchant-content route-loading route-loading--merchant" aria-busy="true" aria-label="Loading merchant workspace">
      <div className="route-loading-line route-loading-line--wide" />
      <div className="route-loading-line" />
      <div className="route-loading-grid route-loading-grid--merchant" aria-hidden="true">
        <div /><div /><div /><div />
      </div>
      <div className="route-loading-panel" />
    </main>
  )
}
