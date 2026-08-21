import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { useSession } from "@/hooks/useSession.ts";

/**
 * Gate for anything that belongs to a person.
 *
 * This is a courtesy, not a control. Everything it protects is also protected
 * by row level security, which is what actually stops one person reading
 * another's cases — hiding a route in the browser stops nobody who can open a
 * network tab. The value here is that a signed-out visitor gets an explanation
 * instead of an empty list that looks like data loss.
 */
export function RequireSession({ children }: { children: ReactNode }) {
  const { session, loading, configured } = useSession();

  if (!configured) {
    return (
      <div className="rounded-lg border border-rule bg-raised p-5">
        <p className="leading-relaxed">
          This build is not connected to an Unpaque project, so there is nothing to sign in to.
        </p>
      </div>
    );
  }

  if (loading) {
    return <p className="text-sm text-muted">Checking your session…</p>;
  }

  if (!session) {
    return (
      <div className="rounded-lg border border-rule bg-raised p-5">
        <p className="mb-3 leading-relaxed">
          This part of Unpaque is yours, so it needs you signed in.
        </p>
        <Link
          to="/sign-in"
          className="inline-block rounded-lg bg-accent px-4 py-2 font-medium text-accent-ink"
        >
          Sign in
        </Link>
      </div>
    );
  }

  return <>{children}</>;
}
