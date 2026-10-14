"use client";

export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="route-state route-state--error" role="alert">
      <span className="route-loading-mark" aria-hidden="true">SC</span>
      <p className="route-state-kicker">Something went wrong</p>
      <h1>We couldn&apos;t load this page.</h1>
      <p className="route-state-copy">Try again, or return to the commerce workspace and continue where you left off.</p>
      <button className="btn btn-primary" type="button" onClick={() => reset()}>Try again</button>
    </main>
  );
}
