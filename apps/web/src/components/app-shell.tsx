import type {
  PropsWithChildren
} from "react";
import {
  NavLink
} from "react-router-dom";

import {
  useAuth
} from "../auth/auth-context.js";

export function AppShell({
  children
}: PropsWithChildren) {
  const auth = useAuth();

  return (
    <div className="app-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">
            CONTRIBUTION OPERATIONS
          </p>
          <h1>ContribOS</h1>
        </div>

        <div className="topbar-actions">
          <nav
            className="nav"
            aria-label="Primary"
          >
            <NavLink to="/">
              Home
            </NavLink>
          </nav>

          {auth.status ===
          "AUTHENTICATED" ? (
            <div className="session-chip">
              <span>
                @{auth.user?.login}
              </span>
              <button
                type="button"
                className="link-button"
                onClick={() => {
                  void auth.signOut();
                }}
              >
                Sign out
              </button>
            </div>
          ) : auth.status ===
            "ANONYMOUS" ? (
            <button
              type="button"
              className="secondary-button"
              onClick={auth.signIn}
            >
              Sign in with GitHub
            </button>
          ) : null}
        </div>
      </header>

      <main className="content">
        {children}
      </main>
    </div>
  );
}
