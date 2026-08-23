import { useState } from "react";
import type { CoderRow } from "@/lib/qualitative-api.ts";

/**
 * Who else may code this study.
 *
 * An invitation names an address and grants nothing. Only the person holding
 * that address can turn it into access, and they do it from their own session
 * — nothing the owner types decides who is let in.
 */
export function Coders({
  coders,
  blind,
  onInvite,
  onRemove,
}: {
  coders: readonly CoderRow[];
  blind: boolean;
  onInvite: (email: string) => Promise<void>;
  onRemove: (email: string) => Promise<void>;
}) {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);

  async function invite(event: React.FormEvent) {
    event.preventDefault();
    if (email.trim() === "" || busy) return;
    setBusy(true);
    await onInvite(email);
    setBusy(false);
    setEmail("");
  }

  return (
    <section className="rounded-lg border border-rule bg-raised p-4">
      <h4 className="mb-2 text-sm font-medium">Coders</h4>

      {coders.length === 0 ? (
        <p className="text-sm text-muted">
          Nobody else yet. A second coder applies the same codebook to the same transcripts, working
          from their own account and seeing none of your codings until you unblind the study.
        </p>
      ) : (
        <ul className="mb-3 space-y-2">
          {coders.map((coder) => (
            <li
              key={coder.email}
              className="flex items-baseline justify-between gap-3 rounded border border-rule bg-paper p-2"
            >
              <span className="text-sm">{coder.email}</span>
              <span className="shrink-0 text-xs text-muted">
                {coder.accepted_at ? "coding" : "invited, not yet accepted"}
              </span>
              <button
                type="button"
                onClick={() => void onRemove(coder.email)}
                className="shrink-0 text-xs text-muted underline hover:text-ink"
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}

      <form onSubmit={invite}>
        <label htmlFor="coder-email" className="mb-1 block text-xs text-muted">
          Invite by email
        </label>
        <div className="flex flex-wrap gap-2">
          <input
            id="coder-email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="min-w-48 flex-1 rounded-lg border border-rule bg-paper px-3 py-2 text-sm outline-none focus:border-accent"
          />
          <button
            type="submit"
            disabled={email.trim() === "" || busy}
            className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-ink disabled:opacity-40"
          >
            {busy ? "Inviting" : "Invite"}
          </button>
        </div>
        {/* Deliberately not "an invitation has been sent to". Nothing is sent:
            the person sees it when they sign in with that address, and copy
            that promises an email nobody wrote is the kind of small lie that
            makes somebody distrust the rest of the screen. */}
        <p className="mt-2 text-xs text-muted">
          They will see the invitation when they sign in to Unpaque with that address. Nothing is
          emailed to them.
        </p>
      </form>

      {!blind && coders.length > 0 && (
        <p className="mt-3 text-xs text-muted">
          This study has been unblinded, so everybody here now sees everybody&rsquo;s codings.
        </p>
      )}
    </section>
  );
}
