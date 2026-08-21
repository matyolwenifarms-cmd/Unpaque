import { NavLink, Route, Routes } from "react-router-dom";
import Research from "@/pages/Research.tsx";
import SignIn from "@/pages/SignIn.tsx";
import Unpack from "@/pages/Unpack.tsx";
import { useSession } from "@/hooks/useSession.ts";
import { cn } from "@/lib/utils.ts";

const TABS = [
  { to: "/", label: "Unpack", blurb: "communication diagnostics" },
  { to: "/research", label: "The Researcher", blurb: "literature" },
];

export default function App() {
  const { session, configured } = useSession();

  return (
    <div className="mx-auto min-h-screen max-w-3xl px-5 py-10">
      <header className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">
          <span className="text-accent">Un</span>paque
        </h1>
        <nav className="mt-4 flex gap-2" aria-label="Features">
          {TABS.map((tab) => (
            <NavLink
              key={tab.to}
              to={tab.to}
              end={tab.to === "/"}
              className={({ isActive }) =>
                cn(
                  "rounded-lg border px-4 py-2 text-sm transition-colors",
                  isActive
                    ? "border-accent bg-accent/10 font-medium"
                    : "border-rule bg-raised hover:border-muted",
                )
              }
            >
              {tab.label}
              <span className="ml-2 text-xs text-muted">{tab.blurb}</span>
            </NavLink>
          ))}
        </nav>
        {configured && (
          <p className="mt-3 text-xs text-muted">
            {session ? (
              <>Signed in as {session.user.email}.</>
            ) : (
              <>
                Not signed in.{" "}
                <NavLink to="/sign-in" className="text-accent hover:underline">
                  Sign in
                </NavLink>{" "}
                to keep your work.
              </>
            )}
          </p>
        )}
      </header>

      <Routes>
        <Route path="/" element={<Unpack />} />
        <Route path="/research" element={<Research />} />
        <Route path="/sign-in" element={<SignIn />} />
      </Routes>
    </div>
  );
}
