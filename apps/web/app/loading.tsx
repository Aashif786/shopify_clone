export default function Loading() {
  return (
    <main className="route-loading" aria-busy="true" aria-label="Loading">
      <span className="route-loading-mark" aria-hidden="true">SC</span>
      <div className="route-loading-line route-loading-line--wide" />
      <div className="route-loading-line" />
      <div className="route-loading-grid" aria-hidden="true">
        <div /><div /><div />
      </div>
    </main>
  )
}
