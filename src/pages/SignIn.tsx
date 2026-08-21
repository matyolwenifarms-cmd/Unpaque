import { useState } from "react";
import { Loader2, Mail } from "lucide-react";
import { useSession } from "@/hooks/useSession.ts";
import { isConfigured, supabase } from "@/lib/supabase.ts";

type Stage = "asking" | "sending" | "sent" | "failed";

export default function SignIn() {
  const { session, configured } = useSession();
  const [email, setEmail] = useState("");
  const [stage, setStage] = useState<Stage>("asking");
  const [problem, setProblem] = useState("");

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!isConfigured || stage === "sending") return;
    setStage("sending");
    setProblem("");

    const { error } = await supabase().auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: `${window.location.origin}/` },
    });

    if (error) {
      setStage("failed");
      setProblem(error.message);
      return;
    }
    setStage("sent");
  }

  if (!configured) {
    return (
      <div className="rounded-lg border border-rule bg-raised p-5">
        <p>This build is not connected to an Unpaque project.</p>
      </div>
    );
  }

  if (session) {
    return (
      <div className="rounded-lg border border-rule bg-raised p-5">
        <p className="mb-3">
          Signed in as <span className="font-medium">{session.user.email}</span>.
        </p>
        <button
          type="button"
          onClick={() => void supabase().auth.signOut()}
          className="rounded-lg border border-rule px-4 py-2 text-sm hover:bg-paper"
        >
          Sign out
        </button>
      </div>
    );
  }

  // Deliberately the same message whether or not the address has an account.
  // Telling somebody "no account with that email" turns the form into a way to
  // find out who has one, which for an investigative tool is a real problem
  // rather than a theoretical one.
  if (stage === "sent") {
    return (
      <div className="rounded-lg border border-accent/40 bg-raised p-5">
        <p className="leading-relaxed">
          If <span className="font-medium">{email.trim()}</span> can sign in, a link is on its way.
          Open it on this device — it signs you in here, not where the mail is read.
        </p>
      </div>
    );
  }

  return (
    <div>
      <header className="mb-6">
        <h2 className="text-2xl font-bold tracking-tight">Sign in</h2>
        <p className="mt-1 text-sm text-muted">
          Unpaque sends a link rather than keeping a password. There is nothing to forget and
          nothing of yours to leak from here.
        </p>
      </header>

      <form onSubmit={onSubmit} className="max-w-md">
        <label htmlFor="email" className="mb-1 block text-sm font-medium">
          Email
        </label>
        <input
          id="email"
          type="email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          className="w-full rounded-lg border border-rule bg-raised px-4 py-3 outline-none focus:border-accent"
        />

        <button
          type="submit"
          disabled={stage === "sending" || email.trim() === ""}
          className="mt-3 inline-flex items-center gap-2 rounded-lg bg-accent px-5 py-3 font-medium text-accent-ink disabled:opacity-40"
        >
          {stage === "sending" ? (
            <Loader2 aria-hidden className="h-4 w-4 animate-spin" />
          ) : (
            <Mail aria-hidden className="h-4 w-4" />
          )}
          {stage === "sending" ? "Sending" : "Send a sign-in link"}
        </button>

        {stage === "failed" && (
          <p className="mt-3 text-sm" role="alert">
            {problem}
          </p>
        )}
      </form>
    </div>
  );
}
