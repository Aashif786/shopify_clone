"use client";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="route-state route-state--error" role="alert">
      <span className="route-loading-mark" aria-hidden="true">SC</span>
      <Alert className="max-w-xl text-left">
        <AlertTitle>Something went wrong</AlertTitle>
        <AlertDescription>We couldn&apos;t load this page. Try again, or return to the commerce workspace and continue where you left off.</AlertDescription>
      </Alert>
      <Button onClick={() => reset()}>Try again</Button>
    </main>
  );
}
