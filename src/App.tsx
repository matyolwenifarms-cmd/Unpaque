import { NavLink, Route, Routes, useLocation } from "react-router-dom";
import CaseView from "@/pages/CaseView.tsx";
import Cases from "@/pages/Cases.tsx";
import Landing from "@/pages/Landing.tsx";
import Research from "@/pages/Research.tsx";
import SignIn from "@/pages/SignIn.tsx";
import Unpack from "@/pages/Unpack.tsx";
import { useSession } from "@/hooks/useSession.ts";
import { FEATURES } from "@/lib/features.ts";
import { cn } from "@/lib/utils.ts";

export default function App() {
  const { session, configured } = useSession();
  const onLanding = useLocation().pathname === "/";

  return (
    <div className="mx-auto min-h-screen max-w-3xl px-5 py-10">
      <header className="mb-8 flex flex-wrap items-center justify-between gap-3">
        {/* Where the wordmark used to be. The mark now lives only on the plate,
            which is where it was designed to live. */}
        {configured ? (
          session ? (
            <span className="text-sm text-muted">Signed in as {session.user.email}</span>
          ) : (
            <NavLink
              to="/sign-in"
              className="rounded-lg border border-rule bg-raised px-4 py-2 text-sm font-medium hover:border-accent"
            >
              Log in
            </NavLink>
          )
        ) : (
          <span />
        )}

        {/* The features are on the plate on the landing page, so repeating them
            here would be the same navigation twice on one screen. Everywhere
            else they are the only way between the three tools — and with the
            wordmark gone, the only way back. */}
        {!onLanding && (
          <nav className="flex flex-wrap gap-2" aria-label="Features">
            <NavLink
              to="/"
              className="rounded-lg border border-rule bg-raised px-3 py-2 text-sm hover:border-muted"
            >
              Home
            </NavLink>
            {FEATURES.map((feature) => (
              <NavLink
                key={feature.to}
                to={feature.to}
                className={({ isActive }) =>
                  cn(
                    "rounded-lg border px-3 py-2 text-sm transition-colors",
                    isActive
                      ? "border-accent bg-accent/10 font-medium"
                      : "border-rule bg-raised hover:border-muted",
                  )
                }
              >
                {feature.name}
              </NavLink>
            ))}
          </nav>
        )}
      </header>

      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/unpack" element={<Unpack />} />
        <Route path="/research" element={<Research />} />
        <Route path="/cases" element={<Cases />} />
        <Route path="/cases/:id" element={<CaseView />} />
        <Route path="/sign-in" element={<SignIn />} />
      </Routes>
    </div>
  );
}
