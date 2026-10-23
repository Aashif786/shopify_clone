import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main className="route-state" role="main">
      <span className="route-loading-mark" aria-hidden="true">404</span>
      <p className="route-state-kicker">Page not found</p>
      <h1>That destination doesn&apos;t exist.</h1>
      <p className="route-state-copy">The page may have moved, or the link may no longer be active.</p>
      <Link className={buttonVariants()} href="/">Return home</Link>
    </main>
  );
}
