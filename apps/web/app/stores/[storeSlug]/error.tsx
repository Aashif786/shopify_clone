"use client";

import Link from "next/link";
import { useParams } from "next/navigation";

/**
 * Boundary for any storefront route that throws while rendering. Offers a retry and a
 * way back to the store; deliberately shows no error internals to shoppers.
 */
export default function StorefrontError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const params = useParams<{ storeSlug?: string }>();
  const home = params?.storeSlug ? `/stores/${params.storeSlug}` : "/";

  return (
    <main
      className="storefront-layout flex min-h-[100dvh] items-center bg-background text-foreground"
      role="alert"
    >
      <div className="at-container py-24">
        <p className="at-eyebrow">Something went wrong</p>
        <h1 className="at-display-lg mt-4 max-w-2xl">This page didn&apos;t load.</h1>
        <p className="at-lede mt-6">
          It&apos;s likely temporary. Try again, or head back to the store and pick up where you left off.
        </p>
        <div className="mt-10 flex flex-wrap items-center gap-x-8 gap-y-4">
          <button
            type="button"
            onClick={() => reset()}
            className="at-press inline-flex h-12 items-center bg-foreground px-7 text-sm font-medium text-background focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            Try again
          </button>
          <Link href={home} className="at-link text-sm text-foreground">
            Back to the store
          </Link>
        </div>
      </div>
    </main>
  );
}
